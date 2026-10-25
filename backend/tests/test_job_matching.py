"""Deterministic ranking and HTTP ownership checks; no database or paid AI."""
import httpx
import pytest
from unittest.mock import MagicMock
from fastapi import FastAPI

from app.features.applications.job_matching import filter_job_matches, rank_jobs
from app.features.applications.router import get_applications_service, router
from app.features.applications.service import ApplicationsService
from app.features.resume.career_matching import CareerMatchRepository
from app.features.applications.semantic_matching import skill_similarities, GEMINI_MODEL


def job(job_id, requirements, career_id=1):
    return {
        "opening": {"jobId": job_id, "id": str(job_id), "company": "Example", "role": "Developer"},
        "careerId": career_id,
        "requirements": [
            {"skillId": skill_id, "name": name, "type": kind}
            for skill_id, name, kind in requirements
        ],
    }


def test_required_skills_weigh_twice_preferred_and_do_not_claim_proficiency():
    candidate = job(1, [(1, "Python", "required"), (2, "SQL", "preferred")])
    result = rank_jobs([candidate], {1}, 1, 10)[0]
    assert result["scorePct"] == 66.7
    assert result["requiredMatches"] == ["Python"]
    assert result["preferredMissing"] == ["SQL"]
    assert result["matchedWeight"] == 2 and result["totalWeight"] == 3
    assert "proficiency" not in result


def test_canonical_ids_not_labels_and_unclassified_skills_do_not_inflate_score():
    candidates = [
        job(1, [(999, "Python", "required")]),
        job(2, [(1, "Python", "unknown")]),
        job(3, [(1, "Python", "required"), (2, "Other", "optional"), (3, "Unknown", "unknown")]),
    ]
    result = rank_jobs(candidates, {1}, None, 10)
    assert [item["jobId"] for item in result] == [3]
    assert result[0]["scorePct"] == 100
    assert result[0]["unscoredSkills"] == ["Other", "Unknown"]


def test_rank_before_limit_goal_only_breaks_ties_and_empty_profile_has_no_matches():
    candidates = [
        job(1, [(1, "Python", "required"), (2, "SQL", "required")], 7),
        job(2, [(1, "Python", "required")], 8),
        job(3, [(1, "Python", "required")], 7),
    ]
    assert [item["jobId"] for item in rank_jobs(candidates, {1}, 7, 2)] == [3, 2]
    assert rank_jobs(candidates, set(), 7, 2) == []
    assert rank_jobs([job(4, [])], {1}, 7, 2) == []


def test_duplicate_skill_counts_once_with_required_precedence():
    candidate = job(1, [(1, "Python", "preferred"), (1, "Python", "required"), (2, "SQL", "preferred")])
    assert rank_jobs([candidate], {1}, None, 1)[0]["scorePct"] == 66.7


def test_vector_similarity_can_recommend_related_skills_without_claiming_coverage():
    candidates = [job(1, [(2, "SQL", "required")]), job(2, [(3, "Pandas", "required")])]
    result = rank_jobs(candidates, {1}, None, 10, similarities={2: 0.7, 3: 0.9})
    assert [item["jobId"] for item in result] == [2, 1]
    assert result[0]["semanticScorePct"] == 90
    assert result[0]["scorePct"] == 0
    assert result[0]["requiredMatches"] == []
    assert result[0]["requiredMissing"] == ["Pandas"]
    assert rank_jobs(candidates, set(), None, 10, similarities={2: 0.9}) == []


def test_incomplete_vectors_fall_back_without_inflating_similarity_and_weights_deduplicate():
    candidates = [job(1, [(1, "Python", "required"), (2, "SQL", "preferred")]),
                  job(2, [(3, "Pandas", "required")])]
    result = rank_jobs(candidates, {1}, None, 10, similarities={1: 1.0, 3: 0.8})
    assert [item["jobId"] for item in result] == [2, 1]
    assert result[1]["semanticScorePct"] is None
    assert result[1]["scorePct"] == 66.7
    weighted = job(3, [(1, "Python", "required"), (1, "Python", "preferred"), (2, "SQL", "preferred")])
    assert rank_jobs([weighted], {1}, None, 10, similarities={1: 1, 2: 0.4})[0]["semanticScorePct"] == 80
    assert [item["jobId"] for item in rank_jobs(candidates, {1}, None, 10, similarities={1: 1, 3: 0.8}, sort="coverage")] == [1, 2]


def test_existing_gemini_vectors_are_read_without_embedding_calls():
    connection = MagicMock()
    connection.execute.return_value.fetchall.return_value = [(2, 0.8), (3, -0.1)]
    assert skill_similarities(connection, {1}, {2, 3}) == {2: 0.8, 3: 0.0}
    sql, params = connection.execute.call_args.args
    assert params == (GEMINI_MODEL, [1, 2, 3], [2, 3], [1])
    assert "s.is_active" in sql and "avg(c.embedding)" in sql and "<=>" in sql
    connection.reset_mock()
    assert skill_similarities(connection, set(), {2}) == {}
    connection.execute.assert_not_called()


def test_semantic_filtering_happens_before_limit_and_zero_similarity_is_not_a_match():
    jobs = [job(1, [(2, "SQL", "required")]), job(2, [(3, "Pandas", "required")]),
            job(3, [(4, "Other", "required")])]
    for candidate, location in zip(jobs, ["Bangkok", "Remote", "Remote"]):
        candidate["opening"]["location"] = location
    data = {"jobs": jobs, "userSkillIds": {1}, "goalCareerId": None,
            "skillSimilarities": {2: 0.9, 3: 0.8, 4: 0.0}}
    result = filter_job_matches(data, 1, location="Remote")
    assert result["totalMatched"] == 2
    assert result["filteredCount"] == 1
    assert result["recommendations"][0]["jobId"] == 2
    assert result["recommendations"][0]["semanticScorePct"] == 80


def test_filters_run_before_limit_options_cover_all_matches_and_empty_results_keep_counts():
    jobs = [job(i, [(1, "Python", "required")]) for i in range(1, 42)]
    for item in jobs:
        item["opening"].update(location="Bangkok", experience="Full-time")
    jobs[0]["opening"].update(location=" Chiang Mai ", experience="Internship")
    jobs[0]["requirements"].append({"skillId": 2, "name": "SQL", "type": "preferred"})
    data = {"jobs": jobs, "userSkillIds": {1}, "goalCareerId": None}
    result = filter_job_matches(data, 1, location="chiang mai", employment_type="internship", skill_id=2)
    assert [item["jobId"] for item in result["recommendations"]] == [1]
    assert result["totalMatched"] == 41 and result["filteredCount"] == 1
    assert result["returnedCount"] == 1
    assert result["filterOptions"]["locations"] == ["Bangkok", "Chiang Mai"]
    assert result["filterOptions"]["skills"] == [{"skillId": 1, "name": "Python"}, {"skillId": 2, "name": "SQL"}]
    empty = filter_job_matches(data, 30, skill_id=999)
    assert empty["filteredCount"] == 0 and empty["totalMatched"] == 41
    assert empty["filterOptions"] == result["filterOptions"]


def test_recent_sort_uses_dates_nulls_last_and_does_not_override_matching():
    jobs = [job(i, [(1, "Python", "required")]) for i in range(1, 5)]
    for item, posted in zip(jobs, ["2026-01-01T00:00:00Z", None, "2026-03-01T07:00:00+07:00", "2026-03-01T00:00:00Z"]):
        item["opening"]["postedAt"] = posted
    data = {"jobs": jobs, "userSkillIds": {1}, "goalCareerId": None}
    assert [item["jobId"] for item in filter_job_matches(data, 4, sort="recent")["recommendations"]] == [4, 3, 1, 2]
    assert filter_job_matches({**data, "userSkillIds": set()}, 4, sort="recent")["recommendations"] == []


def test_career_cards_show_present_skills_even_when_level_is_unknown(monkeypatch):
    repo = CareerMatchRepository.__new__(CareerMatchRepository)
    connection = MagicMock()
    connection.execute.return_value.fetchone.return_value = ("Backend Engineer",)
    monkeypatch.setattr(repo, "_connect", lambda: connection)
    monkeypatch.setattr(repo, "_list_career_profiles", lambda: [
        {"careerProfileId": 1, "profileName": "Backend Engineer", "seniorityLevel": "general"},
    ])
    monkeypatch.setattr(repo, "_calculate", lambda *args: {
        "skills": [{
            "userHasSkill": True, "status": "not_assessed", "skillName": "Python",
            "weightedDemandScore": 10, "priorityRank": 1, "demandPercentage": 50,
        }],
        "scores": {"marketSkillCoveragePct": 100}, "status": "ready",
        "marketSample": {"totalJobs": 10},
    })
    recommendation = repo._recommendations("profile", "session", 6)["recommendations"][0]
    assert recommendation["transferableSkills"] == ["Python"]
    assert recommendation["developmentAreas"] == ["Python"]


class FakeRepository:
    def __init__(self):
        self.inputs_called = False

    def owner(self, profile_id, session_id):
        return 7 if (profile_id, session_id) == ("profile-1", "session-1") else None

    def job_matching_inputs(self, user_id):
        assert user_id == 7
        self.inputs_called = True
        return {
            "userSkillIds": {1}, "targetRole": "Backend Engineer", "goalCareerId": 1,
            "jobs": [job(1, []), job(2, [(1, "Python", "required")])],
        }


@pytest.mark.asyncio
async def test_api_requires_ownership_and_returns_explanations():
    repository = FakeRepository()
    app = FastAPI()
    app.include_router(router, prefix="/api")
    app.dependency_overrides[get_applications_service] = lambda: ApplicationsService(repository)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        url = "/api/profiles/profile-1/job-recommendations"
        denied = await client.get(url, headers={"X-Session-Id": "other-session"})
        assert denied.status_code == 404
        assert not repository.inputs_called
        missing = await client.get(url)
        assert missing.status_code == 400
        for limit in ("0", "101", "invalid"):
            response = await client.get(url + "?limit=" + limit, headers={"X-Session-Id": "session-1"})
            assert response.status_code == 400
        response = await client.get(url, headers={"X-Session-Id": "session-1"})
        assert response.status_code == 200
        body = response.json()
        assert body["targetRole"] == "Backend Engineer"
        assert body["totalCandidates"] == 2 and body["unscoredPostings"] == 1
        assert body["recommendations"][0]["matchesGoal"] is True
        assert body["recommendations"][0]["reasons"]
        assert body["limitations"] and body["policy"].endswith("-v1")
        assert body["totalMatched"] == body["filteredCount"] == body["returnedCount"] == 1
        filtered = await client.get(url + "?location=Elsewhere&employmentType=Internship&skillId=1",
                                    headers={"X-Session-Id": "session-1"})
        assert filtered.status_code == 200 and filtered.json()["filteredCount"] == 0
        assert filtered.json()["totalMatched"] == 1
        for query in ("sort=invalid", "skillId=0", "skillId=SQL", "location="):
            invalid = await client.get(url + "?" + query, headers={"X-Session-Id": "session-1"})
            assert invalid.status_code == 400
