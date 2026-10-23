"""Explainable skill-presence matching; no model calls or hiring predictions."""

from typing import Any
from datetime import datetime, timezone

POLICY = "skill-presence-required-2-preferred-1-v1"
WEIGHTS = {"required": 2, "preferred": 1}


def rank_jobs(jobs: list[dict[str, Any]], user_skill_ids: set[int],
              goal_career_id: int | None, limit: int | None) -> list[dict[str, Any]]:
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


def filter_job_matches(data: dict[str, Any], limit: int, *, sort: str = "coverage",
                       location: str | None = None, employment_type: str | None = None,
                       skill_id: int | None = None) -> dict[str, Any]:
    matches = rank_jobs(data["jobs"], data["userSkillIds"], data["goalCareerId"], None)
    requirements = {job["opening"]["jobId"]: job["requirements"] for job in data["jobs"]}
    skills = {
        skill["skillId"]: skill["name"]
        for job in matches for skill in requirements[job["jobId"]]
        if skill["type"] in WEIGHTS
    }

    def normalize(value: str | None) -> str:
        return (value or "").strip().casefold()

    def options(field: str) -> list[str]:
        values = {}
        for job in matches:
            value = job.get(field, "").strip()
            if value and normalize(value) != "not specified":
                values.setdefault(normalize(value), value)
        return sorted(values.values(), key=str.casefold)

    filtered = [
        job for job in matches
        if (not location or normalize(job.get("location")) == normalize(location))
        and (not employment_type or normalize(job.get("experience")) == normalize(employment_type))
        and (skill_id is None or any(
            skill["skillId"] == skill_id and skill["type"] in WEIGHTS
            for skill in requirements[job["jobId"]]))
    ]
    if sort == "recent":
        def timestamp(job: dict[str, Any]) -> float:
            value = job.get("postedAt")
            if not value:
                return float("-inf")
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return (parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)).timestamp()
        # Stable sort preserves coverage/goal tie-breaking for equal dates.
        filtered.sort(key=timestamp, reverse=True)
    return {
        "totalMatched": len(matches), "filteredCount": len(filtered),
        "returnedCount": min(limit, len(filtered)),
        "recommendations": filtered[:limit],
        "filterOptions": {
            "locations": options("location"), "employmentTypes": options("experience"),
            "skills": [{"skillId": key, "name": value} for key, value in
                       sorted(skills.items(), key=lambda pair: (pair[1].casefold(), pair[0]))],
        },
    }
