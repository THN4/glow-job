"""Find explicit catalog skill mentions in user-reported application feedback."""

from __future__ import annotations

import re
import unicodedata


def mentioned_skill_ids(reason: str, spellings: list[tuple[int, str]]) -> list[int]:
    """Return canonical IDs in mention order; never infer a skill from related words."""
    text = unicodedata.normalize("NFKC", reason).casefold()
    found: dict[int, tuple[int, int]] = {}
    for skill_id, raw in spellings:
        term = unicodedata.normalize("NFKC", raw).strip().casefold()
        # Very short aliases (Go, R, C) occur in ordinary prose too often.
        if len(term) < 3:
            continue
        pattern = rf"(?<![a-z0-9_]){re.escape(term)}(?![a-z0-9_])"
        match = re.search(pattern, text)
        if match is None:
            continue
        candidate = (match.start(), -len(term))
        if skill_id not in found or candidate < found[skill_id]:
            found[skill_id] = candidate
    return sorted(found, key=lambda skill_id: (found[skill_id], skill_id))
