"""Error codes shared by the API and job failures. See docs/cv-extraction/03-api-reference.md section 3.9."""

from __future__ import annotations

from typing import Any

from src.resume.errors import ResumeProcessingError

# code -> (http status, retryable, default message)
_CATALOG: dict[str, tuple[int, bool, str]] = {
    "INVALID_REQUEST": (400, False, "The request is missing or has invalid fields."),
    "INVALID_PROFILE": (400, False, "The profile has invalid fields."),
    "FILE_TOO_LARGE": (413, False, "The file is larger than the allowed size."),
    "UNSUPPORTED_FILE_TYPE": (415, False, "Only PDF, JPG, PNG and WEBP files are supported."),
    "UPLOAD_NOT_FOUND": (404, False, "The upload was not found or has expired."),
    "JOB_NOT_FOUND": (404, False, "The extraction job was not found or has expired."),
    "PROFILE_NOT_FOUND": (404, False, "The profile was not found."),
    "PROFILE_ALREADY_EXISTS": (409, False, "A profile already exists for this anonymous session."),
    "NOT_FOUND": (404, False, "Not found."),
    "DAILY_LIMIT_REACHED": (429, False, "Today's extraction limit has been reached."),
    "TOO_MANY_PAGES": (422, False, "The PDF has too many pages."),
    "UNREADABLE_DOCUMENT": (422, False, "The file could not be read."),
    "NOT_A_CV": (422, False, "This document does not look like a CV."),
    "MODEL_UNAVAILABLE": (503, True, "The AI provider is not available right now."),
    "SKILL_CATALOG_UNAVAILABLE": (503, True, "The skill catalog is not available right now."),
    "PROFILE_STORE_UNAVAILABLE": (503, True, "The profile could not be saved right now."),
    "CAREER_MATCH_UNAVAILABLE": (503, True, "Career match data is not available right now."),
    "EXTRACTION_FAILED": (502, True, "The CV could not be extracted. Please try again."),
    "EXTRACTION_TIMEOUT": (504, True, "The extraction took too long. Please try again."),
    "GOAL_NOT_FOUND": (409, False, "Set a career goal before creating a roadmap."),
    "CAREER_PROFILE_NOT_FOUND": (404, False, "The career profile was not found."),
    "KNOWLEDGE_NOT_READY": (409, False, "The selected skill gaps need reviewed learning content."),
    "ROADMAP_CONTEXT_FAILED": (409, False, "The roadmap inputs could not be prepared."),
    "ROADMAP_NOT_FOUND": (404, False, "No roadmap was found."),
    "TASK_NOT_FOUND": (404, False, "The roadmap task was not found."),
    "ROADMAP_STEP_LOCKED": (409, False, "Complete the connected prerequisite steps first."),
    "CHECKLIST_INCOMPLETE": (409, False, "Complete every checklist item before confirming this step."),
    "ROADMAP_LIMIT_REACHED": (429, False, "Today's roadmap limit has been reached. Try again tomorrow."),
    "ROADMAP_BUDGET_REACHED": (429, False, "Roadmap generation is paused for the rest of this month."),
    "ROADMAP_UNAVAILABLE": (503, True, "Roadmaps need the shared database."),
    "MODEL_REFUSAL": (422, False, "The AI could not create a roadmap for this request."),
    "ROADMAP_GENERATION_FAILED": (502, True, "The roadmap could not be generated. Please try again."),
    "ASSESSMENT_NOT_FOUND": (404, False, "The skill check was not found."),
    "ASSESSMENT_STATE_INVALID": (409, False, "This skill check is not at that step."),
    "ASSESSMENT_UNAVAILABLE": (503, True, "Skill checks need the shared database."),
    "APPLICATIONS_UNAVAILABLE": (503, True, "Applications need the shared database."),
    "JOB_POSTING_NOT_FOUND": (404, False, "The job posting was not found."),
    "SKILL_NOT_FOUND": (404, False, "The skill was not found."),
    "EVIDENCE_NOT_FOUND": (404, False, "The skill evidence was not found."),
    "NO_CHECK_QUESTIONS": (409, False, "There are no questions for these tasks yet."),
    "INTERNAL_ERROR": (500, True, "Something went wrong."),
}


class AppError(Exception):
    def __init__(self, code: str, message: str | None = None, details: Any = None):
        status, retryable, default = _CATALOG[code]
        super().__init__(message or default)
        self.code = code
        self.status = status
        self.retryable = retryable
        self.message = message or default
        self.details = details

    def to_body(self) -> dict[str, Any]:
        body: dict[str, Any] = {"code": self.code, "message": self.message, "retryable": self.retryable}
        if self.details is not None:
            body["details"] = self.details
        return body


def to_app_error(err: BaseException) -> AppError:
    if isinstance(err, AppError):
        return err
    if isinstance(err, ResumeProcessingError):
        return AppError(err.code, err.message)
    return AppError("INTERNAL_ERROR")
