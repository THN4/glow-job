"""Profile-authorized application tracker operations."""

from __future__ import annotations

import asyncio
from typing import Any

from app.features.resume.errors import AppError
from app.features.applications.job_matching import POLICY, WEIGHTS, filter_job_matches


class ApplicationsService:
    def __init__(self, repository: Any):
        self.repository = repository

    async def _owner(self, profile_id: str, session_id: str) -> int:
        user_id = await asyncio.to_thread(self.repository.owner, profile_id, session_id)
        if user_id is None:
            raise AppError("PROFILE_NOT_FOUND")
        return user_id

    async def list(self, profile_id: str, session_id: str) -> dict[str, Any]:
        user_id = await self._owner(profile_id, session_id)
        applications = await asyncio.to_thread(self.repository.list_for_user, user_id)
        return {"applications": applications}

    async def list_job_postings(self, limit: int = 60) -> dict[str, Any]:
        jobs = await asyncio.to_thread(self.repository.list_job_postings, limit)
        return {"jobPostings": jobs}

    async def job_recommendations(self, profile_id: str, session_id: str, limit: int, *,
                                  sort: str = "coverage", location: str | None = None,
                                  employment_type: str | None = None, skill_id: int | None = None) -> dict[str, Any]:
        user_id = await self._owner(profile_id, session_id)
        data = await asyncio.to_thread(self.repository.job_matching_inputs, user_id)
        jobs = data["jobs"]
        return {
            "targetRole": data["targetRole"],
            "policy": POLICY,
            "hasConfirmedSkills": bool(data["userSkillIds"]),
            "totalCandidates": len(jobs),
            "unscoredPostings": sum(not any(skill["type"] in WEIGHTS for skill in job["requirements"]) for job in jobs),
            **filter_job_matches(data, limit, sort=sort, location=location,
                                 employment_type=employment_type, skill_id=skill_id),
            "limitations": [
                "Scores compare confirmed skill presence, not proficiency or hiring probability.",
                "Required skills count twice as much as preferred skills. Optional and unclassified skills are excluded.",
                "Experience, location preferences, and work style are not scored because comparable structured requirements are unavailable.",
                "Postings without scored skills or without any matching skills are not recommended. Check the source for availability.",
            ],
        }

    async def save_job_posting(self, profile_id: str, session_id: str, job_id: int) -> dict[str, Any]:
        user_id = await self._owner(profile_id, session_id)
        application = await asyncio.to_thread(self.repository.save_job_posting, user_id, job_id)
        if application is None:
            raise AppError("JOB_POSTING_NOT_FOUND", "The job posting was not found.")
        return application

    async def get(self, profile_id: str, session_id: str, application_id: int) -> dict[str, Any]:
        user_id = await self._owner(profile_id, session_id)
        application = await asyncio.to_thread(self.repository.get_for_user, user_id, application_id)
        if application is None:
            raise AppError("NOT_FOUND", "The application was not found.")
        return application

    async def create(self, profile_id: str, session_id: str, values: dict[str, Any]) -> dict[str, Any]:
        user_id = await self._owner(profile_id, session_id)
        return await asyncio.to_thread(self.repository.create, user_id, values)

    async def update(self, profile_id: str, session_id: str, application_id: int,
                     values: dict[str, Any]) -> dict[str, Any]:
        user_id = await self._owner(profile_id, session_id)
        application = await asyncio.to_thread(self.repository.update, user_id, application_id, values)
        if application is None:
            raise AppError("NOT_FOUND", "The application was not found.")
        return application
