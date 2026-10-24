-- Allow the Resume onboarding flow to persist profiles before account login exists.
-- session_id is stored as the anonymous auth subject, and the profile ID remains a
-- separate opaque API identifier.
ALTER TABLE app.users
    ALTER COLUMN email DROP NOT NULL;

ALTER TABLE app.users
    ADD CONSTRAINT ck_users_anonymous_requires_subject
    CHECK (auth_provider <> 'anonymous' OR NULLIF(btrim(auth_subject), '') IS NOT NULL);

ALTER TABLE app.user_profiles
    ADD COLUMN profile_id text,
    ADD COLUMN profile_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();

UPDATE app.user_profiles
SET profile_id = 'prf_' || gen_random_uuid()::text
WHERE profile_id IS NULL;

ALTER TABLE app.user_profiles
    ALTER COLUMN profile_id SET NOT NULL;

ALTER TABLE app.user_profiles
    ADD CONSTRAINT uq_user_profiles_profile_id UNIQUE (profile_id);

ALTER TABLE app.user_skills
    ADD COLUMN proficiency_basis text NOT NULL DEFAULT 'unknown'
    CHECK (proficiency_basis IN ('explicit', 'inferred', 'unknown'));
