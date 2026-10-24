-- Synthetic development users only. Run after schema migrations 001-009.
-- Plain PostgreSQL: works with psql or pgAdmin Query Tool, without Python/LLM.
-- Existing reserved demo accounts are kept unchanged, including their progress.
-- No catalog, market, knowledge, resume, or extraction records are created.
-- Usage and fixture details: docs/db/demo-user-seed.md (host repository).
BEGIN;
SET LOCAL TIME ZONE 'Asia/Bangkok';
SET LOCAL lock_timeout = '5s';
SELECT pg_advisory_xact_lock(hashtextextended('glowjob.demo-users.v1', 0));

CREATE TEMP TABLE glowjob_demo_cases (
    seed_key text PRIMARY KEY,
    payload jsonb NOT NULL
) ON COMMIT DROP;

INSERT INTO glowjob_demo_cases (seed_key, payload) VALUES
('student-data', $fixture$
{
  "profile_id": "prf_demo_student_data",
  "display_name": "Demo Student Data",
  "email": "demo.student.data@example.invalid",
  "current_status": "student",
  "current_job_title": null,
  "years_experience": 0,
  "field_of_study": "Computer Science",
  "summary": "Synthetic student profile for development, not a real CV.",
  "education": {"id":"demo-education-student", "degree":"B.Sc.", "fieldOfStudy":"Computer Science", "institution":"Glow Job Demo University", "startDate":"2022", "endDate":null, "isCurrent":true, "gpa":null, "description":"Fictional education for development."},
  "project": {"id":"demo-project-student", "name":"Demo Student Data Pipeline", "description":"Built a fictional pipeline with Python, SQL and Pandas, versioned with Git, and tried Docker. Demo Unmapped Skill is an intentional testing label.", "role":"Student developer", "url":"https://example.invalid/demo/student-pipeline", "startDate":"2026-06", "endDate":"2026-08", "technologies":["Python","SQL","Pandas","Git","Docker","Demo Unmapped Skill"]},
  "work": null,
  "certification": {"id":"demo-cert-student", "kind":"workshop", "name":"Demo SQL Workshop", "issuer":"Glow Job Demo Training", "date":"2026-08", "detail":"Synthetic workshop, not a real credential."},
  "skills": [
    {"name":"Python", "category":"language", "proficiency":"beginner"},
    {"name":"SQL", "category":"database", "proficiency":"beginner"},
    {"name":"Pandas", "category":"data", "proficiency":"beginner"},
    {"name":"Git", "category":"devops", "proficiency":"beginner"},
    {"name":"Docker", "tool":true, "proficiency":"unknown"},
    {"name":"Demo Unmapped Skill", "category":"other", "proficiency":"unknown"}
  ],
  "goal": {"career_profile_slug":"data_engineer_general", "target_role_title":"Data Engineer", "readiness_timeframe":"three_months", "deadline_months":3, "weekly_availability":"hours_2_to_5", "available_hours_per_week":null, "preferred_learning_style":"hands_on_projects", "additional_context":"Demo: preparing for a data engineering internship with a small weekly time budget."}
}
$fixture$::jsonb),
('backend', $fixture$
{
  "profile_id": "prf_demo_backend",
  "display_name": "Demo Backend Developer",
  "email": "demo.backend@example.invalid",
  "current_status": "employed_full_time",
  "current_job_title": "Backend Developer",
  "years_experience": 2,
  "field_of_study": "Information Technology",
  "summary": "Synthetic employed Backend developer for development, not a real CV.",
  "education": {"id":"demo-education-backend", "degree":"B.Sc.", "fieldOfStudy":"Information Technology", "institution":"Glow Job Demo University", "startDate":"2019", "endDate":"2023", "isCurrent":false, "gpa":null, "description":"Fictional education for development."},
  "project": {"id":"demo-project-backend", "name":"Demo Inventory API", "description":"Built a fictional inventory API using JavaScript, TypeScript, Node.js, PostgreSQL and SQL, with Docker and Git.", "role":"Backend developer", "url":"https://example.invalid/demo/inventory-api", "startDate":"2026-02", "endDate":"2026-05", "technologies":["JavaScript","TypeScript","Node.js","PostgreSQL","SQL","Docker","Git"]},
  "work": {"id":"demo-work-backend", "title":"Backend Developer", "organization":"Glow Job Demo Company", "employmentType":"full-time", "location":"Bangkok", "startDate":"2024-10", "endDate":null, "isCurrent":true, "description":"Fictional work maintaining a Node.js API with PostgreSQL, Docker and Git.", "highlights":["Synthetic work experience for feature development."], "technologies":["Node.js","PostgreSQL","Docker","Git"]},
  "certification": {"id":"demo-cert-backend", "kind":"workshop", "name":"Demo API Design Workshop", "issuer":"Glow Job Demo Training", "date":"2025-11", "detail":"Synthetic workshop, not a real credential."},
  "skills": [
    {"name":"JavaScript", "category":"language", "proficiency":"intermediate"},
    {"name":"TypeScript", "category":"language", "proficiency":"intermediate"},
    {"name":"Node.js", "category":"framework", "proficiency":"intermediate"},
    {"name":"PostgreSQL", "category":"database", "proficiency":"intermediate"},
    {"name":"SQL", "category":"database", "proficiency":"intermediate"},
    {"name":"Docker", "category":"devops", "proficiency":"intermediate"},
    {"name":"Git", "category":"devops", "proficiency":"advanced"}
  ],
  "goal": {"career_profile_slug":"backend_engineer_general", "target_role_title":"Backend Engineer", "readiness_timeframe":null, "deadline_days":180, "weekly_availability":"hours_5_to_10", "available_hours_per_week":8, "preferred_learning_style":"reading_articles", "additional_context":"Demo: improve Backend design while working full time. The explicit target date is set once when the account is seeded."}
}
$fixture$::jsonb),
('unknown-data', $fixture$
{
  "profile_id": "prf_demo_unknown_data",
  "display_name": "Demo Career Changer",
  "email": "demo.unknown.data@example.invalid",
  "current_status": "between_opportunities",
  "current_job_title": null,
  "years_experience": 3,
  "field_of_study": "Business Administration",
  "summary": "Synthetic career changer with unassessed technical levels, not a real CV.",
  "education": {"id":"demo-education-unknown", "degree":"B.B.A.", "fieldOfStudy":"Business Administration", "institution":"Glow Job Demo University", "startDate":"2017", "endDate":"2021", "isCurrent":false, "gpa":null, "description":"Fictional education for development."},
  "project": {"id":"demo-project-unknown", "name":"Demo Operations Dashboard", "description":"Practiced Python, SQL, Postgres, Excel and Power BI in a fictional operations dashboard. Skill levels have not been assessed.", "role":"Independent learner", "url":"https://example.invalid/demo/operations-dashboard", "startDate":"2026-07", "endDate":"2026-09", "technologies":["Python","SQL","Postgres","Excel","Power BI"]},
  "work": {"id":"demo-work-unknown", "title":"Operations Coordinator", "organization":"Glow Job Demo Company", "employmentType":"full-time", "location":"Bangkok", "startDate":"2021-01", "endDate":"2024-01", "isCurrent":false, "description":"Fictional operations work producing Excel reports. No proficiency assessment is implied.", "highlights":["Synthetic experience for testing a career change."], "technologies":["Excel"]},
  "certification": {"id":"demo-cert-unknown", "kind":"activity", "name":"Demo Learning Group", "issuer":"Glow Job Demo Community", "date":"2026-09", "detail":"Synthetic learning activity."},
  "skills": [
    {"name":"Python", "category":"language", "proficiency":"unknown"},
    {"name":"SQL", "category":"database", "proficiency":"unknown"},
    {"name":"Postgres", "category":"database", "proficiency":"unknown"},
    {"name":"Excel", "tool":true, "proficiency":"unknown"},
    {"name":"Power BI", "tool":true, "proficiency":"unknown"}
  ],
  "goal": {"career_profile_slug":"data_engineer_general", "target_role_title":"Data Engineer", "readiness_timeframe":"no_fixed_deadline", "weekly_availability":"hours_10_plus", "available_hours_per_week":null, "preferred_learning_style":"structured_courses", "additional_context":"Demo: changing careers with no fixed deadline. Technical skill names are confirmed but levels are unknown."}
}
$fixture$::jsonb);

-- A reserved profile ID must never overwrite another account.
DO $guard$
BEGIN
    IF EXISTS (
        SELECT 1 FROM glowjob_demo_cases c
        JOIN app.user_profiles p ON p.profile_id = c.payload->>'profile_id'
        JOIN app.users u USING (user_id)
        WHERE u.auth_provider <> 'anonymous'
           OR u.auth_subject IS DISTINCT FROM 'glowjob-demo-v1:' || c.seed_key
    ) THEN
        RAISE EXCEPTION 'A reserved demo profile ID is already owned by another account';
    END IF;
END
$guard$;

CREATE TEMP TABLE glowjob_demo_new_users ON COMMIT DROP AS
WITH inserted AS (
    INSERT INTO app.users (email, auth_provider, auth_subject)
    SELECT c.payload->>'email', 'anonymous', 'glowjob-demo-v1:' || c.seed_key
    FROM glowjob_demo_cases c
    WHERE NOT EXISTS (
        SELECT 1 FROM app.users u
        WHERE u.auth_provider = 'anonymous'
          AND u.auth_subject = 'glowjob-demo-v1:' || c.seed_key
    )
    ON CONFLICT (auth_provider, auth_subject) DO NOTHING
    RETURNING user_id, auth_subject
)
SELECT c.seed_key, c.payload, i.user_id FROM inserted i
JOIN glowjob_demo_cases c ON i.auth_subject = 'glowjob-demo-v1:' || c.seed_key;

CREATE TEMP TABLE glowjob_demo_experiences ON COMMIT DROP AS
SELECT u.user_id, 'project'::text AS experience_type, u.payload->'project' AS item
FROM glowjob_demo_new_users u
UNION ALL
SELECT u.user_id, 'work', u.payload->'work'
FROM glowjob_demo_new_users u WHERE jsonb_typeof(u.payload->'work') = 'object';

INSERT INTO app.user_experiences (
    user_id, experience_type, title, organization, role, location, url, description,
    highlights, start_date, start_date_precision, end_date, end_date_precision,
    is_current, source, extraction_confidence, user_confirmed
)
SELECT e.user_id, e.experience_type::app.experience_type,
       CASE WHEN e.experience_type = 'project' THEN e.item->>'name' ELSE e.item->>'title' END,
       CASE WHEN e.experience_type = 'project' THEN 'Glow Job Demo Projects' ELSE e.item->>'organization' END,
       coalesce(e.item->>'role', e.item->>'employmentType'), e.item->>'location',
       e.item->>'url', e.item->>'description', coalesce(e.item->'highlights', '[]'::jsonb),
       (e.item->>'startDate' || '-01')::date, 'month',
       (e.item->>'endDate' || '-01')::date,
       CASE WHEN e.item->>'endDate' IS NOT NULL THEN 'month'::app.date_precision END,
       coalesce((e.item->>'isCurrent')::boolean, false), 'seed_demo_users_v1', 1.0, true
FROM glowjob_demo_experiences e;

CREATE TEMP TABLE glowjob_demo_experience_ids ON COMMIT DROP AS
SELECT d.user_id, d.item->>'id' AS item_id, e.experience_id
FROM glowjob_demo_experiences d JOIN app.user_experiences e
  ON e.user_id = d.user_id AND e.experience_type::text = d.experience_type
 AND e.title = CASE WHEN d.experience_type = 'project' THEN d.item->>'name' ELSE d.item->>'title' END
 AND e.source = 'seed_demo_users_v1';

-- Prefer an exact canonical name. Aliases are considered only when no canonical
-- name matches. Ambiguous or missing matches remain unresolved, never guessed.
CREATE TEMP TABLE glowjob_demo_skills ON COMMIT DROP AS
SELECT u.seed_key, u.user_id, v.ordinality AS ordinal, v.value AS item,
       v.value->>'name' AS raw_name,
       coalesce((v.value->>'tool')::boolean, false) AS is_tool,
       CASE WHEN matched.match_count = 1 THEN matched.skill_id END AS skill_id,
       CASE WHEN matched.match_count = 1 THEN matched.skill_name END AS canonical_name,
       CASE WHEN matched.match_count = 1 THEN matched.match_method END AS match_method
FROM glowjob_demo_new_users u
CROSS JOIN LATERAL jsonb_array_elements(u.payload->'skills') WITH ORDINALITY v
LEFT JOIN LATERAL (
    SELECT count(DISTINCT m.skill_id) AS match_count,
           min(m.skill_id) AS skill_id, min(m.skill_name) AS skill_name,
           min(m.match_method) AS match_method
    FROM (
        SELECT s.skill_id, s.skill_name, 'exact_canonical'::text AS match_method
        FROM core.skills s
        WHERE lower(regexp_replace(btrim(s.skill_name), '[[:space:]]+', ' ', 'g'))
            = lower(regexp_replace(btrim(v.value->>'name'), '[[:space:]]+', ' ', 'g'))
        UNION ALL
        SELECT s.skill_id, s.skill_name, 'exact_alias'
        FROM core.skill_aliases a JOIN core.skills s USING (skill_id)
        WHERE lower(regexp_replace(btrim(a.alias), '[[:space:]]+', ' ', 'g'))
            = lower(regexp_replace(btrim(v.value->>'name'), '[[:space:]]+', ' ', 'g'))
          AND NOT EXISTS (
              SELECT 1 FROM core.skills exact_name
              WHERE lower(regexp_replace(btrim(exact_name.skill_name), '[[:space:]]+', ' ', 'g'))
                  = lower(regexp_replace(btrim(v.value->>'name'), '[[:space:]]+', ' ', 'g'))
          )
    ) m
) matched ON true;

INSERT INTO app.user_skills (
    user_id, skill_id, raw_skill_name, normalized_skill_name, match_status,
    proficiency_level, proficiency_basis, source, confidence, verification_type, user_confirmed
)
SELECT DISTINCT ON (user_id, coalesce(skill_id::text, 'raw:' || lower(raw_name)))
       user_id, skill_id, raw_name, canonical_name,
       CASE WHEN skill_id IS NULL THEN 'needs_review' ELSE 'matched' END::app.user_skill_match_status,
       (item->>'proficiency')::app.proficiency_level,
       CASE WHEN item->>'proficiency' = 'unknown' THEN 'unknown' ELSE 'explicit' END,
       'seed_demo_users_v1', 1.0, 'synthetic_demo_fixture', true
FROM glowjob_demo_skills
ORDER BY user_id, coalesce(skill_id::text, 'raw:' || lower(raw_name)), is_tool, ordinal;

INSERT INTO app.user_skill_evidence (user_skill_id, experience_id, evidence_type, evidence_text, confidence)
SELECT DISTINCT s.user_skill_id, ids.experience_id, e.experience_type,
       e.item->>'description', 1.0
FROM glowjob_demo_experiences e
JOIN glowjob_demo_experience_ids ids
  ON ids.user_id = e.user_id AND ids.item_id = e.item->>'id'
CROSS JOIN LATERAL jsonb_array_elements_text(e.item->'technologies') technology(raw_name)
JOIN glowjob_demo_skills labels
  ON labels.user_id = e.user_id AND lower(labels.raw_name) = lower(technology.raw_name)
JOIN app.user_skills s ON s.user_id = labels.user_id
 AND ((labels.skill_id IS NOT NULL AND s.skill_id = labels.skill_id)
   OR (labels.skill_id IS NULL AND s.skill_id IS NULL AND s.raw_skill_name = labels.raw_name));

INSERT INTO app.user_educations (
    user_id, institution_name, degree, field_of_study,
    start_date, start_date_precision, end_date, end_date_precision,
    description, source, extraction_confidence, user_confirmed
)
SELECT user_id, payload->'education'->>'institution', payload->'education'->>'degree',
       payload->'education'->>'fieldOfStudy',
       (payload->'education'->>'startDate' || '-01-01')::date, 'year',
       (payload->'education'->>'endDate' || '-01-01')::date,
       CASE WHEN payload->'education'->>'endDate' IS NOT NULL THEN 'year'::app.date_precision END,
       payload->'education'->>'description', 'seed_demo_users_v1', 1.0, true
FROM glowjob_demo_new_users;

INSERT INTO app.user_certifications (
    user_id, kind, name, issuer, awarded_on, awarded_on_precision, details,
    source, extraction_confidence, user_confirmed
)
SELECT user_id, (payload->'certification'->>'kind')::app.certification_kind,
       payload->'certification'->>'name', payload->'certification'->>'issuer',
       (payload->'certification'->>'date' || '-01')::date, 'month',
       payload->'certification'->>'detail', 'seed_demo_users_v1', 1.0, true
FROM glowjob_demo_new_users;

INSERT INTO app.user_career_goals (
    user_id, target_role_title, career_id, career_profile_id, is_primary,
    readiness_timeframe, target_date, weekly_availability, available_hours_per_week,
    preferred_learning_style, additional_context
)
SELECT u.user_id, u.payload->'goal'->>'target_role_title',
       c.career_id, CASE WHEN c.career_id IS NOT NULL THEN p.career_profile_id END, true,
       (u.payload->'goal'->>'readiness_timeframe')::app.readiness_timeframe,
       CASE WHEN u.payload->'goal'->>'deadline_days' IS NOT NULL
              THEN CURRENT_DATE + (u.payload->'goal'->>'deadline_days')::integer
            WHEN u.payload->'goal'->>'deadline_months' IS NOT NULL
              THEN (CURRENT_DATE + make_interval(months => (u.payload->'goal'->>'deadline_months')::integer))::date
       END,
       (u.payload->'goal'->>'weekly_availability')::app.weekly_availability_band,
       (u.payload->'goal'->>'available_hours_per_week')::numeric,
       (u.payload->'goal'->>'preferred_learning_style')::app.learning_preference,
       u.payload->'goal'->>'additional_context'
FROM glowjob_demo_new_users u
LEFT JOIN core.career_profiles p ON p.slug = u.payload->'goal'->>'career_profile_slug' AND p.is_active
LEFT JOIN core.careers c ON c.career_id = p.career_id AND c.is_active;

-- The JSON profile and relational rows originate from the same fixtures. This
-- allows existing GET /api/profiles/{profile_id} consumers to read the seed too.
INSERT INTO app.user_profiles (
    user_id, profile_id, display_name, current_status, current_job_title,
    years_experience, location, education_level, field_of_study, background_summary,
    profile_data
)
SELECT u.user_id, u.payload->>'profile_id', u.payload->>'display_name',
       (u.payload->>'current_status')::app.current_situation,
       u.payload->>'current_job_title', (u.payload->>'years_experience')::numeric,
       'Bangkok', 'bachelor', u.payload->>'field_of_study', u.payload->>'summary',
       jsonb_build_object(
           'schemaVersion', 1,
           'personal', jsonb_build_object(
               'fullName', u.payload->>'display_name', 'headline', u.payload->>'current_job_title',
               'email', u.payload->>'email', 'phone', NULL, 'location', 'Bangkok',
               'links', '[]'::jsonb, 'confidence', 'high', 'needsReview', false, 'source', 'user'
           ),
           'summary', u.payload->>'summary',
           'education', jsonb_build_array(u.payload->'education' || '{"confidence":"high","needsReview":false,"source":"user"}'::jsonb),
           'technicalSkills', coalesce(technical.items, '[]'::jsonb),
           'tools', coalesce(tools.items, '[]'::jsonb),
           'experience', CASE WHEN jsonb_typeof(u.payload->'work') = 'object'
               THEN jsonb_build_array(u.payload->'work' || '{"confidence":"high","needsReview":false,"source":"user"}'::jsonb)
               ELSE '[]'::jsonb END,
           'projects', jsonb_build_array(u.payload->'project' || '{"confidence":"high","needsReview":false,"source":"user"}'::jsonb),
           'certifications', jsonb_build_array(u.payload->'certification' || '{"confidence":"high","needsReview":false,"source":"user"}'::jsonb),
           'softSkills', '[]'::jsonb, 'languages', '[]'::jsonb,
           'derived', jsonb_build_object(
               'yearsExperience', (u.payload->>'years_experience')::numeric,
               'currentJobTitle', u.payload->>'current_job_title', 'educationLevel', 'bachelor',
               'fieldOfStudy', u.payload->>'field_of_study',
               'suggestedStatus', CASE u.payload->>'current_status'
                   WHEN 'student' THEN 'student' WHEN 'employed_full_time' THEN 'employed'
                   ELSE 'career_switcher' END
           )
       )
FROM glowjob_demo_new_users u
LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object(
        'id', 'demo-skill-' || s.seed_key || '-' || s.ordinal,
        'name', s.raw_name, 'rawName', s.raw_name, 'category', s.item->>'category',
        'proficiency', s.item->>'proficiency',
        'proficiencyBasis', CASE WHEN s.item->>'proficiency' = 'unknown' THEN 'unknown' ELSE 'explicit' END,
        'confidence', 'high', 'needsReview', false, 'source', 'user',
        'catalogMatch', jsonb_build_object(
            'status', CASE WHEN s.skill_id IS NULL THEN 'unmatched' ELSE 'matched' END,
            'skillId', s.skill_id, 'canonicalName', s.canonical_name, 'matchMethod', s.match_method
        ),
        'evidence', jsonb_build_array(jsonb_build_object(
            'evidenceType', 'project', 'itemId', u.payload->'project'->>'id',
            'text', u.payload->'project'->>'description'
        ))
    ) ORDER BY s.ordinal) AS items
    FROM glowjob_demo_skills s WHERE s.user_id = u.user_id AND NOT s.is_tool
) technical ON true
LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object(
        'id', 'demo-tool-' || s.seed_key || '-' || s.ordinal,
        'name', s.raw_name, 'confidence', 'high', 'needsReview', false, 'source', 'user',
        'catalogMatch', jsonb_build_object(
            'status', CASE WHEN s.skill_id IS NULL THEN 'unmatched' ELSE 'matched' END,
            'skillId', s.skill_id, 'canonicalName', s.canonical_name, 'matchMethod', s.match_method
        )
    ) ORDER BY s.ordinal) AS items
    FROM glowjob_demo_skills s WHERE s.user_id = u.user_id AND s.is_tool
) tools ON true;

-- This summary includes existing demos, so reruns show their actual saved IDs.
SELECT c.seed_key,
       CASE WHEN n.user_id IS NULL THEN 'kept_existing' ELSE 'created' END AS seed_action,
       u.user_id, p.profile_id, u.auth_subject AS demo_session_id,
       (SELECT count(*) FROM app.user_skills s WHERE s.user_id = u.user_id AND s.match_status = 'matched') AS matched_skills,
       (SELECT count(*) FROM app.user_skills s WHERE s.user_id = u.user_id AND s.match_status <> 'matched') AS unresolved_skills,
       (SELECT career_profile_id FROM app.user_career_goals g WHERE g.user_id = u.user_id AND g.is_primary) AS career_profile_id
FROM glowjob_demo_cases c
JOIN app.users u ON u.auth_provider = 'anonymous' AND u.auth_subject = 'glowjob-demo-v1:' || c.seed_key
LEFT JOIN app.user_profiles p USING (user_id)
LEFT JOIN glowjob_demo_new_users n ON n.user_id = u.user_id
ORDER BY c.seed_key;
COMMIT;
