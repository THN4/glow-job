# Extraction Flow

```
 file ─► [0 Cache/limit] ─► [1 Validate] ─► [2 Preprocess: text or page images] ─► [3 Extractor (Gemini)] ─► [4 Validate + ground-check] ─► [5 Post-process] ─► CvProfile
```

## 4.1 Why an AI model instead of OCR + rules

An ID-card scanner works with a fixed layout. CVs have no fixed layout: one or two columns, tables, icons, Thai and English mixed, photos of printed pages. A classic OCR + regex pipeline would need a separate parser for every layout and would still miss things like "Jun 2023 – Present".

A **vision-language model (Gemini)** reads extracted text and page images. Structured JSON output guides the response to the resume schema, and Pydantic validates it before post-processing.

Project URLs must be copied from a complete URL visibly present in the CV. A
plain-text label such as `GitHub: moviecade` is accepted as an explicit GitHub
reference and normalized to `https://github.com/moviecade`. Other text is kept
as project description text instead of being guessed into a URL.

## 4.2 Provider abstraction: Gemini and mock

All model access goes through one interface. Gemini is the model-backed provider; `mock` is available for tests and local development:

```python
# data-pipeline/src/resume/extraction/contracts.py
@dataclass
class PreparedCv:
    kind: Literal["text", "images"]      # text PDF / DOCX  |  scan / photo
    page_count: int
    text: str = ""
    images: list[PageImage] = field(default_factory=list)   # JPEG pages, base64
    warnings: list[str] = field(default_factory=list)

class Extractor(Protocol):
    name: str                            # e.g. the pinned Gemini model ID, "mock"
    groundable: bool                     # False for the mock
    async def extract(self, prepared: PreparedCv) -> ExtractorOutput: ...
    # ExtractorOutput = CvExtraction (validated with Pydantic) + optional token usage
```

| `RESUME_EXTRACTOR` | Implementation | Used for |
|---|---|---|
| `mock` | Returns a fixture `CvExtraction` after a configurable delay | Unit/integration tests and frontend development without external model calls |
| `gemini` | Google GenAI SDK async API using shared `GEMINI_API_KEY` and market's pinned model | Model-backed CV extraction; resume keeps its own prompt and response schema |

## 4.3 Step 0–2: cache, limit, validate, preprocess

**Step 0.** SHA-256 the file. If a cache entry for the file and extraction configuration exists (24 h), return it with `meta.cached: true`. This avoids repeating model calls for the same input. Also enforce `DAILY_EXTRACTION_LIMIT` (`0` = unlimited, the local default).

**Step 1–2.** The preprocessor converts each supported file to **text** or **page images**:

| Input | Handling | `PreparedCv.kind` |
|---|---|---|
| PDF with a usable text layer | Check page count (≤ 10) and encryption (PyMuPDF), extract text per page, and keep page breaks as `--- page N ---` | `text` |
| PDF without usable text (scan, or garbled Thai font encoding) | Detected when there are < 100 characters per page or many `�` / unprintable characters. Render pages to JPEG with PyMuPDF at ~150 DPI, long edge ≤ 1280 px. **Max 4 pages** in image mode; extra pages are skipped and a warning is added | `images` |
| JPG / PNG / WEBP | Pillow: EXIF rotate, resize long edge ≤ 1280 px, JPEG quality 85 | `images` |
| DOCX (stretch) | `mammoth` → plain text | `text` |

> Why 1280 px and max 4 images: this bounds request size and processing cost while keeping normal CV font sizes readable. Tune these limits with the evaluation set.

## 4.4 Step 3: the Gemini call

```python
# Simplified provider example; the adapter implementation also maps errors and usage.
import base64

client = create_gemini_client(api_key=settings.GEMINI_API_KEY).aio
parts = [
    *(
        types.Part.from_bytes(data=base64.b64decode(image.b64), mime_type=image.mime)
        for image in prepared.images
    ),
    USER_INSTRUCTIONS,
]
user_content = parts if prepared.kind == "images" else f"<cv>\n{prepared.text}\n</cv>\n{USER_INSTRUCTIONS}"
res = await client.models.generate_content(
    model=GEMINI_MODEL,                                  # same pinned model as market
    contents=user_content,
    config=types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        temperature=0,
        response_mime_type="application/json",
        response_schema=CvExtraction,
    ),
)
extraction = CvExtraction.model_validate_json(res.text)   # ValidationError -> one repair retry
# the pipeline then raises NOT_A_CV when extraction.is_document_a_cv is False
```

Notes for the implementer:
- **Always validate with Pydantic.** Structured output reduces formatting errors but semantic validation and a single repair retry are still required; after that, fail with `EXTRACTION_FAILED`.
- **Keep every field required.** Model fields are nullable but not optional so the response shape remains predictable.
- **Concurrency 1:** the local job runner processes one extraction at a time. Extra jobs wait with `status: "queued"`.
- **Transient API failures:** retry Gemini `429`, `500`, and `503` responses up to two times with exponential delays before returning an extraction error.
- **Timeouts:** the Gemini request timeout is configurable (`RESUME_GEMINI_TIMEOUT_MS`); the job timeout also includes preprocessing and cleanup.
- **Logging:** log model, `kind`, page count, `usage`, `durationMs` and `finish_reason`. **Never** log the text, images or output content.

## 4.5 The AI-facing schema (`CvExtraction`)

This is a reduced version of `CvProfile`: no `id`, `source`, `needsReview` or `schemaVersion` (see [02-profile-schema.md](02-profile-schema.md) §2.5), plus three top-level fields:

```ts
const CvExtraction = z.object({
  isDocumentACv: z.boolean(),
  detectedLanguage: z.enum(["en", "th", "mixed"]),
  warnings: z.array(z.string()),          // e.g. "Page 2 is blurry"
  personal: ..., summary: ..., education: ..., technicalSkills: ...,
  softSkills: ..., experience: ..., projects: ..., certifications: ...,
  tools: ..., languages: ...,
});
```

Each item includes `confidence: z.enum(["high","medium","low"])`. Add `.describe()` text to fields, because it ends up in the JSON schema the model sees. Keep the schema **flat and small**: smaller models follow simpler schemas more reliably.

## 4.6 Prompt behavior

**System prompt**

> You extract structured career information from a CV/résumé (given as page images, or as extracted text inside <cv> tags) for Glow Job, a career-guidance app. The user will review and correct your output, so accuracy matters more than completeness.
>
> - Only record information that is written in the document. If something is not stated, use null or an empty list. Never guess company names, dates or degrees.
> - Copy names of people, schools, companies and projects exactly as written, in their original language (Thai stays Thai).
> - Dates: use "YYYY" or "YYYY-MM". "Present", "Current" or "ปัจจุบัน" means isCurrent = true and endDate = null.
> - Technical skills are programming languages, frameworks, libraries, databases, cloud and DevOps. Tools are software products used for work (Figma, Jira, Excel). Skills listed only under a job or project go in that item's `technologies` and **also** in `technicalSkills`.
> - confidence: "high" when the value is clearly printed and unambiguous; "medium" when you inferred structure; "low" when the text was hard to read or the item is ambiguous.
> - If the document is not a CV/résumé, set isDocumentACv = false and leave the other sections empty.
> - Add a short warning for problems that affect quality (blurry image, cut-off page, unusual layout).
> - Respond with JSON only.

**User instruction text** (after the CV): "Extract this CV into the required JSON format."

Small models follow concrete examples better than rules. If the eval shows mistakes, add **one short worked example** (a mini CV and its JSON) to the system prompt before trying a bigger model.

## 4.7 Step 4–5: validate, ground-check, post-process

1. **Pydantic validation** (already done in step 3) plus:
   - Date sanity check (`startDate ≤ endDate`, year between 1950 and next year). If it fails, set confidence to `low`.
   - Validate emails and URLs. Invalid values become `null` and a warning is added.
2. **Grounding check (text inputs only):** this is an anti-hallucination guard. For each item, check that its key strings (institution, organization, project name, skill name, certification name) actually occur in the extracted CV text (case- and whitespace-insensitive, with a small fuzzy tolerance). If not, set confidence to `low`, which flags the item for review. Image inputs can't be checked this way, so they rely on the model's confidence plus the review step.
3. **Normalize skills** with `skill_aliases.py` (`reactjs`/`react.js` → `React`, `postgres` → `PostgreSQL`, …). Deduplicate and keep the highest confidence.
4. **Assign IDs** and set `source: "cv"`.
5. **Compute `needsReview`** = `confidence !== "high"` OR a key field is null (education: `institution`; experience: `title` or `organization`; project: `name`).
6. Build `meta` (duration, model, `reviewCount`, warnings, `inputKind`, `cached`) and store the result under `CACHE#<hash>` (24 h).

Steps 1, 2, 3, 4 and 5 are pure functions, fully unit-tested without any model.

## 4.8 Privacy and security

**Gemini API**
- [ ] Keep `GEMINI_API_KEY` in environment/secret storage and never commit it or log it.
- [ ] Uploaded files go to a temp folder and are deleted right after processing (in `finally`), plus a startup sweep of leftovers.
- [ ] Avoid request logging/tracing that would store CV content.

**Privacy and security**
- [ ] Logs carry only metadata, never CV content.
- [ ] CORS is restricted to the frontend origins.
- [ ] Test fixtures are synthetic CVs. No real people's CVs are committed to the repo.
- [ ] UI privacy text: "Your CV is processed by our AI to build your profile and is deleted right after."
