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

### Filtering and sorting

Query parameters: sort=coverage|recent (default coverage), location (up to 300
characters), employmentType (up to 100 characters), skillId (positive canonical
ID). Location/employment comparison trims whitespace and ignores case. Skill
filtering means the posting lists that required/preferred skill, not that the
learner must have it. All filters combine with AND, before applying limit.
Employment uses the posting's employment_type, exposed as experience in the
existing CompanyOpening contract. This is not a comparison of years of experience.

Newest sorts actual postedAt timestamps descending, unknown dates last, retaining
coverage ordering for equal dates. It never substitutes collection date for an
unknown publication date.

Response additions: totalMatched before filters, filteredCount after filters,
returnedCount after limit, and filterOptions.locations/employmentTypes/skills.
Dropdown options come from all matching postings before filters and limit, so
zero results do not erase available choices. unscoredPostings is catalog-wide
and specifically means no classified required/preferred skills, not every kind
of incomplete posting.

The toolbar keeps filters in the URL, survives refresh/back navigation, and
retains the previous results disabled while fetching updated matches. Clear
filters removes the four filter parameters while keeping the current view.
How matching works opens a keyboard-accessible dialog.

Frontend URL checks: from frontend run
`node --experimental-strip-types --test tests/jobFilters.test.mjs`.

## Verification

From backend:

` .venv\Scripts\python.exe -m pytest tests/test_job_matching.py tests/test_career_matching.py `

HTTP tests use a fake repository and cover ownership and limits, not a live
PostgreSQL connection. Ranking tests cover weights, canonical IDs, missing data,
duplicate skills, ranking before truncation, and goal tie-breaking.
