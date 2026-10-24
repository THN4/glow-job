"""Question bank items and the checks every item must pass before it can be approved.

Items are single-answer questions with four options. Each one is tied to the knowledge chunk
whose text supports the correct answer, so a step check can match it to the study task that
cites the same chunk, and the answer review can show the exact source sentence.
"""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Level = Literal["beginner", "intermediate", "advanced"]
# provisional: drafted on demand for a step check, usable there until a reviewer approves or rejects it
Status = Literal["draft", "provisional", "approved", "rejected", "retired"]
_SPACE = re.compile(r"\s+")
_BANNED_OPTIONS = ("all of the above", "none of the above", "both a and b")
MIN_QUOTE = 15
MAX_OPTION = 160


def normalize(text: str) -> str:
    return _SPACE.sub(" ", text).strip()


class BankItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    skill_id: int = Field(gt=0)
    chunk_id: int = Field(gt=0)
    level: Level
    stem: str = Field(min_length=10, max_length=300)
    options: list[str] = Field(min_length=4, max_length=4)
    answer_index: int = Field(ge=0, le=3)
    quote: str = Field(min_length=MIN_QUOTE, max_length=600)
    source_title: str
    source_heading: str | None = None
    source_url: str | None = None
    content_hash: str | None = None
    status: Status = "draft"
    generated_by: str = "unknown"
    flags: list[str] = Field(default_factory=list)


class SelfCheckStatement(BaseModel):
    model_config = ConfigDict(extra="forbid")

    skill_id: int | None = None  # None = generic statement with a {skill} placeholder
    level: Level
    position: int = Field(ge=1, le=9)
    text: str = Field(min_length=10, max_length=200)


class Bank(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["assessment-bank-1"] = "assessment-bank-1"
    items: list[BankItem]
    statements: list[SelfCheckStatement] = Field(default_factory=list)


def item_issues(item: BankItem, chunk_text: str | None) -> list[str]:
    """Problems that stop an item from being approved. Pass the chunk text when it is available."""
    issues: list[str] = []
    options = [normalize(o) for o in item.options]
    if any(not o for o in options):
        issues.append("An option is empty.")
    if len({o.lower() for o in options}) != len(options):
        issues.append("Options must be different from each other.")
    if any(len(o) > MAX_OPTION for o in options):
        issues.append(f"Options must be at most {MAX_OPTION} characters.")
    if any(b in o.lower() for o in options for b in _BANNED_OPTIONS):
        issues.append("Do not use 'all/none of the above' style options.")
    if not item.stem.strip().endswith("?"):
        issues.append("The question must end with a question mark.")
    if chunk_text is not None and normalize(item.quote) not in normalize(chunk_text):
        issues.append("The quote is not an exact passage of the cited chunk.")
    return issues
