"""Application-owned Agent Context contract; policies may still be pending."""

from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import Field, model_validator

from rag.context.models import (
    Record, Level, Background, Goal, ConfirmedSkill, UnresolvedSkill,
    CareerProfile, MarketWindow, MarketSkill,
)

GapStatus = Literal["covered", "proficiency_gap", "missing_from_profile", "not_assessed", "market_data_insufficient"]


class GapAssessment(Record):
    status: GapStatus
    current_level: Level | None
    target_level: Level | None
    observed_level_gap: int | None = Field(default=None, ge=0, le=3)
    gap_score: None = None
    reason_code: str
    limitations: tuple[str, ...] = ()


class GapSummary(Record):
    considered: int = Field(ge=0)
    covered: int = Field(ge=0)
    proficiency_gap: int = Field(ge=0)
    missing_from_profile: int = Field(ge=0)
    not_assessed: int = Field(ge=0)
    market_data_insufficient: int = Field(ge=0)

    @model_validator(mode="after")
    def disjoint_counts(self):
        if self.considered != sum(getattr(self, name) for name in (
            "covered", "proficiency_gap", "missing_from_profile", "not_assessed", "market_data_insufficient",
        )):
            raise ValueError("Gap summary must count each considered skill once")
        return self


class ScoreState(Record):
    status: Literal["pending_example_comparison"] = "pending_example_comparison"
    policy_version: None = None
    metrics: tuple[()] = ()


class CareerContext(CareerProfile):
    market_window: MarketWindow | None
    total_jobs: int = Field(ge=0)
    market_skill_count: int = Field(ge=0)
    scores: ScoreState = Field(default_factory=ScoreState)


class UserContext(Record):
    profile_id: str
    background: Background
    career_goal: Goal | None
    confirmed_skills: tuple[ConfirmedSkill, ...]
    unresolved_skills: tuple[UnresolvedSkill, ...]
    evidence_excerpts_truncated: bool = False


class EvidenceEntry(Record):
    chunk_id: int = Field(gt=0)
    source_id: int = Field(gt=0)
    title: str
    source_url: str | None
    heading_path: tuple[str, ...] = ()
    content: str
    content_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    usage_roles: tuple[Literal["learning_content", "dependency_evidence"], ...]
    used_by_skill_ids: tuple[int, ...]


class CitationRef(Record):
    chunk_id: int = Field(gt=0)
    quote: str = Field(min_length=20, max_length=1800)


class CitedClaim(Record):
    text: str
    support_kind: Literal["instructional", "topic_outline"]
    citations: tuple[CitationRef, ...] = Field(min_length=1)


class DependencyLink(Record):
    dependency_id: int = Field(gt=0)
    target_skill_id: int = Field(gt=0)
    dependency_type: Literal["prerequisite", "recommended_before", "related"]
    scope_type: Literal["general", "document_specific", "conditional"]
    scope_note: str | None
    runtime_role: Literal["global_ordering", "context_only", "informational"]
    applicability: Literal["not_assessed_for_user", "document_context_required", "needs_confirmation"]
    chunk_id: int = Field(gt=0)
    evidence_quote: str
    blocks_unconditional_progress: bool


class FoundationMention(Record):
    skill_id: int = Field(gt=0)
    skill_name: str
    presentation: Literal["foundation_mention", "related_mention"]
    learning_content_status: Literal["not_requested", "unavailable"]
    confirmed_in_user_profile: bool
    user_level: Level | None
    learner_satisfaction: Literal["not_assessed"] = "not_assessed"
    creates_learning_activity: Literal[False] = False
    notice: str
    relationships: tuple[DependencyLink, ...]


class Priority(Record):
    rank: int = Field(gt=0)
    priority_score: None = None
    policy_version: Literal["explicit-caller-selection-v1"] = "explicit-caller-selection-v1"
    reasons: tuple[str, ...]


class RoadmapCandidate(Record):
    skill_id: int = Field(gt=0)
    skill_name: str
    selection_role: Literal["main"] = "main"
    gap: GapAssessment
    proficiency_basis: Literal["explicit", "inferred", "unknown"] | None
    market: MarketSkill | None
    priority: Priority
    learning_recommendation: Literal["candidate", "reference_only", "needs_confirmation"]
    rag_status: Literal["supported", "partial", "insufficient_evidence", "not_reviewed", "error"]
    teaching_content_status: Literal["available", "outline_only", "unavailable", "not_reviewed"]
    knowledge_current_level: Level = "unknown"
    knowledge_target_level: Level = "unknown"
    knowledge_query: str | None = None
    claims: tuple[CitedClaim, ...]
    evidence_chunk_ids: tuple[int, ...]
    foundation_skill_ids: tuple[int, ...]
    dependency_coverage: Literal["unknown"] = "unknown"
    warnings: tuple[str, ...]


class AgentContext(Record):
    schema_version: Literal["0.3"] = "0.3"
    context_id: str = Field(default_factory=lambda: "ctx_" + uuid4().hex)
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: Literal["preview_pending_policies"] = "preview_pending_policies"
    policy_versions: dict[str, str | None]
    provenance: dict[str, str]
    user_context: UserContext
    career_context: CareerContext
    skill_gap_summary: GapSummary
    selected_skill_gap_summary: GapSummary
    roadmap_candidates: tuple[RoadmapCandidate, ...]
    foundation_mentions: tuple[FoundationMention, ...]
    evidence_registry: tuple[EvidenceEntry, ...]
    warnings: tuple[str, ...]

    @model_validator(mode="after")
    def linked_context(self):
        from hashlib import sha256

        candidates = {skill.skill_id: skill for skill in self.roadmap_candidates}
        registry = {item.chunk_id: item for item in self.evidence_registry}
        foundations = {item.skill_id: item for item in self.foundation_mentions}
        if len(candidates) != len(self.roadmap_candidates) or len(registry) != len(self.evidence_registry) or len(foundations) != len(self.foundation_mentions):
            raise ValueError("Canonical candidates, foundations and evidence entries must be unique")
        if self.selected_skill_gap_summary.considered != len(candidates):
            raise ValueError("Selected gap summary differs from candidate count")
        from collections import Counter
        selected_counts = Counter(skill.gap.status for skill in candidates.values())
        if any(getattr(self.selected_skill_gap_summary, name) != selected_counts[name] for name in (
            "covered", "proficiency_gap", "missing_from_profile", "not_assessed", "market_data_insufficient",
        )):
            raise ValueError("Selected gap counts differ from actual candidate statuses")
        if self.skill_gap_summary.considered != self.career_context.market_skill_count:
            raise ValueError("Market gap summary differs from the input cohort")
        confirmed_ids = [skill.skill_id for skill in self.user_context.confirmed_skills]
        if len(set(confirmed_ids)) != len(confirmed_ids):
            raise ValueError("Confirmed user skills must be unique canonical IDs")
        for entry in registry.values():
            if sha256(entry.content.encode()).hexdigest() != entry.content_hash:
                raise ValueError("Evidence registry hash mismatch")
        for skill in candidates.values():
            cited = {citation.chunk_id for claim in skill.claims for citation in claim.citations}
            if cited != set(skill.evidence_chunk_ids):
                raise ValueError("Candidate citations must match its evidence references")
            if not set(skill.foundation_skill_ids) <= foundations.keys():
                raise ValueError("Unregistered foundation reference")
            for claim in skill.claims:
                for citation in claim.citations:
                    entry = registry.get(citation.chunk_id)
                    if (entry is None or "learning_content" not in entry.usage_roles
                            or skill.skill_id not in entry.used_by_skill_ids
                            or " ".join(citation.quote.split()) not in " ".join(entry.content.split())):
                        raise ValueError("Invalid or unsupported learning citation")
        for foundation in foundations.values():
            for relationship in foundation.relationships:
                entry = registry.get(relationship.chunk_id)
                if (relationship.target_skill_id not in candidates or entry is None
                        or "dependency_evidence" not in entry.usage_roles
                        or " ".join(relationship.evidence_quote.split()) not in " ".join(entry.content.split())):
                    raise ValueError("Invalid dependency evidence reference")
        goal = self.user_context.career_goal
        if goal and (goal.career_id, goal.career_profile_id) != (
            self.career_context.career_id, self.career_context.career_profile_id,
        ):
            raise ValueError("Saved goal and market career differ")
        return self
