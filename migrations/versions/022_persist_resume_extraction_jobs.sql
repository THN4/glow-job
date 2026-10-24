-- Persist anonymous CV extraction jobs and structured pre-review results.
-- The original CV remains temporary and is deleted after extraction.
ALTER TABLE app.resumes
    ALTER COLUMN storage_key DROP NOT NULL,
    ADD COLUMN file_sha256 text,
    ADD COLUMN temporary_file_deleted_at timestamptz;

ALTER TABLE app.resume_extractions
    ADD COLUMN job_id text,
    ADD COLUMN stage text NOT NULL DEFAULT 'reading',
    ADD COLUMN prompt_version text,
    ADD COLUMN extraction_schema_version integer,
    ADD COLUMN processing_version text,
    ADD COLUMN error_payload jsonb,
    ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX uq_resume_extractions_job_id
    ON app.resume_extractions (job_id) WHERE job_id IS NOT NULL;
CREATE INDEX ix_resume_extractions_status_updated
    ON app.resume_extractions (status, updated_at DESC);
