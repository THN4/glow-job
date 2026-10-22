"""Roadmap contracts: what the model returns (draft) and what the API serves (view).

The draft is deliberately small: every field the model writes costs output tokens,
and facts that already exist in Agent Context (levels, market counts, source URLs)
are copied in by code instead of being regenerated.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

StepKind = Literal["skill", "foundation_check", "project", "career_activity"]
TaskKind = Literal["learn", "practice", "check"]
DeferReason = Literal[
    "OUTSIDE_TIME_BUDGET", "CONTENT_OUTLINE_ONLY", "LOW_MARKET_SIGNAL", "NEEDS_CONFIRMATION",
]


# --------------------------------------------------------------------------- model output


class Draft(BaseModel):
    model_config = ConfigDict(extra="forbid")


class DraftCitation(Draft):
    chunk_id: int
    quote: str = Field(description="Exact substring copied from the cited source content.")


class DraftTask(Draft):
    title: str
    detail: str
    task_kind: TaskKind
    citations: list[DraftCitation]


class DraftStep(Draft):
    key: str = Field(description="Short unique slug, e.g. 'airflow-basics'.")
    kind: StepKind
    skill_id: int | None
    title: str
    summary: str
    why: list[str]
    hours_min: int
    hours_max: int
    depends_on: list[str]
    tasks: list[DraftTask]


class DraftNextAction(Draft):
    step_key: str
    text: str


class DraftDeferred(Draft):
    skill_id: int
    reason_code: DeferReason
    note: str


class DraftConfirmation(Draft):
    skill_id: int
    question: str


class RoadmapDraft(Draft):
    title: str
    overview: str
    planning_note: str
    steps: list[DraftStep]
    next_action: DraftNextAction
    deferred: list[DraftDeferred]
    confirmations: list[DraftConfirmation]


# --------------------------------------------------------------------------- API view


class View(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class HoursRange(View):
    min: float
    max: float


class Citation(View):
    chunk_id: int
    title: str
    url: str | None
    heading: str | None
    quote: str


class ChecklistItem(View):
    id: str
    label: str
    detail: str
    task_kind: TaskKind
    completed: bool = False
    citations: list[Citation] = []


class NodeSkill(View):
    skill_id: int
    name: str
    current_level: str | None
    target_level: str | None
    gap_status: str | None
    in_profile: bool
    # Plain-language profile status for the detail panel, e.g. "Not in your profile yet".
    # It replaces the design's "Current confidence" percentage, which is not calculated.
    profile_label: str = ""


ProgressStatus = Literal["not_started", "in_progress", "completed", "skipped"]


class Position(View):
    """Canvas grid line numbers, starting at 1. column is 1-4."""

    row: int
    column: int


class RoadmapNode(View):
    key: str
    kind: Literal["skill", "foundation-check", "project", "career-activity", "goal"]
    title: str
    # Text under the title on the node card, e.g. "In progress" or "Upcoming project".
    subtitle: str = ""
    summary: str
    why_it_matters: list[str]
    skill: NodeSkill | None = None
    estimated_hours: HoursRange | None = None
    depends_on: list[str] = []
    layer: int = 0
    order: int = 0
    position: Position = Position(row=1, column=1)
    status: ProgressStatus = "not_started"
    checklist: list[ChecklistItem] = []
    citations: list[Citation] = []
    notice: str | None = None


class Edge(View):
    from_: str = Field(alias="from")
    to: str
    # True for a recommended path that does not block the next step (drawn dashed).
    optional: bool = False


class Layout(View):
    columns: int
    rows: int


class Summary(View):
    title: str
    overview: str
    target_role: str
    career_name: str
    readiness_timeframe: str | None
    target_date: str | None
    weekly_availability: str | None
    learning_style: str | None
    estimated_hours: HoursRange
    budget_hours: HoursRange | None
    weekly_hours: HoursRange | None
    # Header and sidebar text, for example "3 months" and "12 weeks remaining".
    duration_label: str
    time_remaining_label: str
    planning_note: str
    assumptions: list[str]


class NextAction(View):
    node_key: str
    text: str


class DeferredSkill(View):
    skill_id: int
    skill_name: str
    reason_code: DeferReason
    note: str


class Confirmation(View):
    skill_id: int
    skill_name: str
    question: str


class ContentNotice(View):
    skill_id: int
    skill_name: str
    notice: str


class Progress(View):
    completed_steps: int
    total_steps: int
    completed_tasks: int
    total_tasks: int
    percent: int
    # Honest replacement for "On track", for example "2 of 9 tasks done".
    label: str = ""


class Generation(View):
    provider: str
    model: str
    prompt_version: str
    context_id: str
    reused: bool = False


class RoadmapView(View):
    roadmap_id: int | None = None
    version: int | None = None
    status: Literal["draft", "active", "completed", "replaced", "archived"] = "draft"
    generated_at: str
    generation: Generation
    summary: Summary
    next_action: NextAction
    # Node that gets the "You are here" badge: the first step in progress, else the next action.
    current_node_key: str = ""
    layout: Layout = Layout(columns=4, rows=1)
    nodes: list[RoadmapNode]
    edges: list[Edge]
    deferred: list[DeferredSkill]
    confirmations: list[Confirmation]
    content_notices: list[ContentNotice]
    limitations: list[str]
    progress: Progress
