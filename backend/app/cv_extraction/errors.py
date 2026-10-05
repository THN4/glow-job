"""Error codes shared by the API and job failures. See docs/cv-extraction/04-api-spec.md section 4.9."""

from __future__ import annotations

from typing import Any

# code -> (http status, retryable, default message)
_CATALOG: dict[str, tuple[int, bool, str]] = {
    "INVALID_REQUEST": (400, False, "The request is missing or has invalid fields."),
    "INVALID_PROFILE": (400, False, "The profile has invalid fields."),
    "FILE_TOO_LARGE": (413, False, "The file is larger than the allowed size."),
    "UNSUPPORTED_FILE_TYPE": (415, False, "Only PDF, JPG, PNG and WEBP files are supported."),
    "UPLOAD_NOT_FOUND": (404, False, "The upload was not found or has expired."),
    "JOB_NOT_FOUND": (404, False, "The extraction job was not found or has expired."),
    "PROFILE_NOT_FOUND": (404, False, "The profile was not found."),
    "NOT_FOUND": (404, False, "Not found."),
    "DAILY_LIMIT_REACHED": (429, False, "Today's extraction limit has been reached."),
    "TOO_MANY_PAGES": (422, False, "The PDF has too many pages."),
    "UNREADABLE_DOCUMENT": (422, False, "The file could not be read."),
    "NOT_A_CV": (422, False, "This document does not look like a CV."),
    "MODEL_UNAVAILABLE": (503, True, "The AI server is not reachable right now."),
    "EXTRACTION_FAILED": (502, True, "The CV could not be extracted. Please try again."),
    "EXTRACTION_TIMEOUT": (504, True, "The extraction took too long. Please try again."),
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
    return err if isinstance(err, AppError) else AppError("INTERNAL_ERROR")
