# Recommendations: jobs and career paths

Jobs for you ranks individual postings. Career paths compares the saved profile
with aggregate career skill statistics; it does not rank individual vacancies.

## Job API

`GET /api/profiles/{profileId}/job-recommendations?limit=30`

Requires `X-Session-Id` and the same profile ownership checks as Applications.
Limits are 1–100. A different owner receives PROFILE_NOT_FOUND.

The response contains targetRole, policy, hasConfirmedSkills, totalCandidates,
unscoredPostings, limitations, and recommendations. Each recommendation includes
the existing CompanyOpening fields plus scorePct, matchedWeight, totalWeight,
matchesGoal, reasons, requiredMatches/Missing, preferredMatches/Missing, and
unscoredSkills.

## Policy: skill-presence-required-2-preferred-1-v1

- Match canonical skill IDs from confirmed, matched app.user_skills.
- Each required skill weighs 2, each preferred skill weighs 1.
- Score = 100 × matched weight / total scored weight, displayed to one decimal.
- Optional/unknown requirements do not contribute to either part of the score.
- Unknown learner proficiency still counts as skill presence; this score does
  not assess proficiency, experience, eligibility, or probability of an offer.
- Exclude postings with no scored skills or no overlapping scored skills.
- Rank the full database catalog before applying the result limit. Break equal
  coverage ties by saved target career, required overlap count, then job ID.
- Target career means the posting and primary goal share core.careers.career_id.
  Goal alignment is shown separately and never adds points.
- Postings have no reliably comparable structured experience/work-style
  requirements, and the profile has no comparable location preferences.
  These dimensions are explicitly unassessed rather than guessed from text.
- The existing save-from-job API links the posting to My Applications and reuses
  an existing tracker entry. It does not apply to the employer.

Uses existing app, market, and core tables. No new migration or model key is
required. Data availability still depends on importing postings and extracting
canonical market.job_skills.

## Frontend flow

- `/app/applications?tab=recommendations&view=jobs` opens Jobs for you (default).
- `/app/applications?tab=recommendations&view=careers` opens Career paths.
- Each view loads its own API. Roadmap headers and learning progress use the
  saved Roadmap API, with loading/unavailable states rather than mock fallback.
- View job shows matching reasons and the existing source-posting detail.
- Save to My Applications calls the existing from-job endpoint and opens the
  tracker. Already saved jobs are disabled in the list. API failures stay
  visible and do not mark the job as saved.
- Refresh matches fetches a new comparison after profile changes.

## Verification

From backend:

` .venv\Scripts\python.exe -m pytest tests/test_job_matching.py tests/test_career_matching.py `

HTTP tests use a fake repository and cover ownership and limits, not a live
PostgreSQL connection. Ranking tests cover weights, canonical IDs, missing data,
duplicate skills, ranking before truncation, and goal tie-breaking.
