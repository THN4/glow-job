"""Input contracts shared by offline previews and future Backend callers."""

from datetime import date, datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Level = Literal["beginner", "intermediate", "advanced", "expert", "unknown"]
DateBasis = Literal["posted_at", "first_seen_at"]
Availability = Literal["under_2_hours", "hours_2_to_5", "hours_5_to_10", "hours_10_plus"]


class Record(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class Evidence(Record):
    evidence_type: str
    excerpt: str | None = None
    experience_id: int | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)


class ConfirmedSkill(Record):
    skill_id: int = Field(gt=0)
    skill_name: str
    raw_skill_name: str
    proficiency_level: Level
    proficiency_basis: Literal["explicit", "inferred", "unknown"]
    confidence: float | None = Field(default=None, ge=0, le=1)
    evidence: tuple[Evidence, ...] = ()


class UnresolvedSkill(Record):
    raw_skill_name: str
    match_status: Literal["unmatched", "needs_review"]
    proficiency_level: Level
    evidence: tuple[Evidence, ...] = ()


class ProjectSkill(Record):
    skill_id: int = Field(gt=0)
    skill_name: str


class UserProject(Record):
    """A user-confirmed project, linked only to canonical skills with evidence."""

    experience_id: int = Field(gt=0)
    title: str
    role: str | None = None
    description: str | None = None
    highlights: tuple[str, ...] = ()
    start_date: date | None = None
    end_date: date | None = None
    is_current: bool = False
    skills: tuple[ProjectSkill, ...] = ()


class Background(Record):
    current_status: Literal[
        "student", "employed_full_time", "employed_part_time",
        "between_opportunities", "other",
    ] | None = None
    current_situation_detail: str | None = None
    current_job_title: str | None = None
    years_experience: float | None = Field(default=None, ge=0)
    education_level: str | None = None
    field_of_study: str | None = None


class Goal(Record):
    goal_id: int = Field(gt=0)
    career_id: int = Field(gt=0)
    career_profile_id: int = Field(gt=0)
    target_role_title: str
    readiness_timeframe: Literal[
        "three_months", "six_months", "one_year", "no_fixed_deadline",
    ] | None = None
    target_date: date | None = None
    weekly_availability: Availability | None = None
    available_hours_per_week: float | None = Field(default=None, ge=0)
    preferred_learning_style: Literal[
        "structured_courses", "hands_on_projects", "reading_articles", "videos_tutorials",
    ] | None = None
    additional_context: str | None = Field(default=None, max_length=500)


class UserInputs(Record):
    profile_id: str
    background: Background
    goal: Goal | None = None
    confirmed_skills: tuple[ConfirmedSkill, ...] = ()
    unresolved_skills: tuple[UnresolvedSkill, ...] = ()
    projects: tuple[UserProject, ...] = ()

    @model_validator(mode="after")
    def unique_canonical_skills(self):
        ids = [skill.skill_id for skill in self.confirmed_skills]
        if len(ids) != len(set(ids)):
            raise ValueError("Confirmed skills must be unique by canonical skill_id")
        return self


class CareerProfile(Record):
    career_id: int = Field(gt=0)
    career_profile_id: int = Field(gt=0)
    career_name: str
    profile_name: str
    seniority_level: str


class MarketWindow(Record):
    analysis_start_date: date
    analysis_end_date: date
    analysis_date_basis: DateBasis

    @model_validator(mode="after")
    def valid_dates(self):
        if self.analysis_end_date < self.analysis_start_date:
            raise ValueError("Market window ends before it starts")
        return self


class MarketSkill(Record):
    skill_id: int = Field(gt=0)
    skill_name: str
    demand_count: int = Field(ge=0)
    total_jobs: int = Field(gt=0)
    demand_percentage: float = Field(ge=0, le=100)
    required_count: int = Field(ge=0)
    preferred_count: int = Field(ge=0)
    optional_count: int = Field(ge=0)
    weighted_demand_score: float | None = Field(default=None, ge=0, le=1)
    target_level: Level = "unknown"
    target_level_confidence: float | None = Field(default=None, ge=0, le=1)
    level_observation_count: int = Field(default=0, ge=0)
    importance_tier: Literal["core", "important", "optional", "unknown"] = "unknown"
    last_updated: datetime

    @model_validator(mode="after")
    def consistent_observations(self):
        if self.demand_count > self.total_jobs:
            raise ValueError("Demand count exceeds the market cohort")
        if self.required_count + self.preferred_count + self.optional_count > self.demand_count:
            raise ValueError("Requirement counts exceed demand count")
        if self.level_observation_count > self.demand_count:
            raise ValueError("Level observations exceed demand count")
        expected = 100 * self.demand_count / self.total_jobs
        if abs(self.demand_percentage - expected) > 0.011:
            raise ValueError("demand_percentage must use the 0-100 scale and match counts")
        return self


class MarketInputs(Record):
    career_profile_id: int = Field(gt=0)
    window: MarketWindow | None = None
    skills: tuple[MarketSkill, ...] = ()

    @model_validator(mode="after")
    def one_cohort(self):
        if self.skills and self.window is None:
            raise ValueError("Market skills require an explicit window and date basis")
        if len({skill.total_jobs for skill in self.skills}) > 1:
            raise ValueError("Market skills must belong to one cohort")
        ids = [skill.skill_id for skill in self.skills]
        if len(ids) != len(set(ids)):
            raise ValueError("Market skills must be unique within the snapshot")
        return self


class ContextInputs(Record):
    schema_version: Literal["0.3"] = "0.3"
    status: Literal["input_preview"] = "input_preview"
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    career: CareerProfile
    market: MarketInputs
    user: UserInputs | None = None
    score_policy_status: Literal["pending_example_comparison"] = "pending_example_comparison"
    warnings: tuple[str, ...] = ()

    @model_validator(mode="after")
    def consistent_career(self):
        if self.market.career_profile_id != self.career.career_profile_id:
            raise ValueError("Market snapshot belongs to a different career profile")
        if self.user and self.user.goal:
            goal = self.user.goal
            if (goal.career_id, goal.career_profile_id) != (
                self.career.career_id, self.career.career_profile_id,
            ):
                raise ValueError("Saved goal belongs to a different career profile")
        return self
