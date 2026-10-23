"""Explainable skill-presence matching; no model calls or hiring predictions."""

from typing import Any

POLICY = "skill-presence-required-2-preferred-1-v1"
WEIGHTS = {"required": 2, "preferred": 1}


def rank_jobs(jobs: list[dict[str, Any]], user_skill_ids: set[int],
              goal_career_id: int | None, limit: int) -> list[dict[str, Any]]:
    ranked = []
    for job in jobs:
        # Canonical IDs, not display-name similarity. Avoid double-counting a skill.
        requirements: dict[int, dict[str, Any]] = {}
        for skill in job["requirements"]:
            previous = requirements.get(skill["skillId"])
            if previous is None or WEIGHTS.get(skill["type"], 0) > WEIGHTS.get(previous["type"], 0):
                requirements[skill["skillId"]] = skill
        scored = [skill for skill in requirements.values() if skill["type"] in WEIGHTS]
        total = sum(WEIGHTS[skill["type"]] for skill in scored)
        matched = [skill for skill in scored if skill["skillId"] in user_skill_ids]
        if not total or not matched:
            continue
        weight = sum(WEIGHTS[skill["type"]] for skill in matched)
        groups = {}
        for requirement_type in WEIGHTS:
            groups[requirement_type + "Matches"] = sorted(
                skill["name"] for skill in scored
                if skill["type"] == requirement_type and skill["skillId"] in user_skill_ids)
            groups[requirement_type + "Missing"] = sorted(
                skill["name"] for skill in scored
                if skill["type"] == requirement_type and skill["skillId"] not in user_skill_ids)
        matches_goal = goal_career_id is not None and job["careerId"] == goal_career_id
        reasons = [f"{len(matched)} of {len(scored)} scored posting skills are in your confirmed profile."]
        if matches_goal:
            reasons.append("This posting belongs to your saved target career.")
        ranked.append({
            **job["opening"], **groups,
            "scorePct": round(100 * weight / total, 1),
            "matchedWeight": weight, "totalWeight": total,
            "matchesGoal": matches_goal, "reasons": reasons,
            "unscoredSkills": sorted(skill["name"] for skill in requirements.values()
                                     if skill["type"] not in WEIGHTS),
        })
    ranked.sort(key=lambda item: (
        -item["matchedWeight"] / item["totalWeight"],
        not item["matchesGoal"], -len(item["requiredMatches"]), -item["jobId"]))
    return ranked[:limit]
