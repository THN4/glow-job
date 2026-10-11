# 5. Extraction Pipeline

```
 file ─► [0 Cache/limit] ─► [1 Validate] ─► [2 Preprocess: text or page images] ─► [3 Extractor (Qwen)] ─► [4 Validate + ground-check] ─► [5 Post-process] ─► CvProfile
```

## 5.1 Why an AI model instead of OCR + rules

An ID-card scanner works with a fixed layout. CVs have no fixed layout: one or two columns, tables, icons, Thai and English mixed, photos of printed pages. A classic OCR + regex pipeline would need a separate parser for every layout and would still miss things like "Jun 2023 – Present".

A **vision-language model (Qwen-VL)** reads both text and page images, and **JSON-schema structured output** (constrained decoding on the server) forces the response into our schema. The backend never parses free text.

## 5.2 Provider abstraction: local first, AWS later

All model access goes through one interface, so moving from the notebook server to AWS is a config change:

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
    name: str                            # e.g. "qwen3-vl:8b", "mock"
    groundable: bool                     # False for the mock
    async def extract(self, prepared: PreparedCv) -> ExtractorOutput: ...
    # ExtractorOutput = CvExtraction (validated with Pydantic) + optional token usage
```

| `EXTRACTOR` | Implementation | Used for |
|---|---|---|
| `mock` | Returns a fixture `CvExtraction` after a ~3 s delay | Unit/integration tests, CI, frontend development without the model server |
| `openai-compatible` | `openai` Python package → any OpenAI-compatible server | **Qwen on the DevOps notebook (Ollama / vLLM) now.** Also vLLM on an AWS GPU later |
| `bedrock` | AWS SDK / Bedrock (added at deploy time if DevOps picks a Bedrock-hosted model) | AWS deployment option, see 06-aws-setup-and-cost.md |

## 5.3 Step 0–2: cache, limit, validate, preprocess

**Step 0.** SHA-256 the file. If `CACHE#<hash>` exists (24 h), return the cached result with `meta.cached: true`. This saves minutes of local GPU time on repeated test uploads and saves money on AWS. When deployed, also enforce `DAILY_EXTRACTION_LIMIT` (`0` = unlimited, the local default).

**Step 1–2.** Qwen cannot read PDF files, so everything becomes either **text** or **page images**:

| Input | Handling | `PreparedCv.kind` |
|---|---|---|
| PDF with a usable text layer | Check page count (≤ 10) and encryption (PyMuPDF), extract text per page, and keep page breaks as `--- page N ---` | `text` |
| PDF without usable text (scan, or garbled Thai font encoding) | Detected when there are < 100 characters per page or many `�` / unprintable characters. Render pages to JPEG with PyMuPDF at ~150 DPI, long edge ≤ 1280 px. **Max 4 pages** in image mode; extra pages are skipped and a warning is added | `images` |
| JPG / PNG / WEBP | Pillow: EXIF rotate, resize long edge ≤ 1280 px, JPEG quality 85 | `images` |
| DOCX (stretch) | `mammoth` → plain text | `text` |

> Why 1280 px and max 4 images: on an 8B VL model, each image adds a lot of tokens and VRAM, and processing time grows quickly. 1280 px keeps normal CV font sizes readable. Tune this in the eval.

## 5.4 Step 3: the Qwen call (OpenAI-compatible)

```python
# data-pipeline/src/resume/extraction/providers/openai_compatible.py (simplified; provider)
client = AsyncOpenAI(
    base_url=settings.LLM_BASE_URL,            # e.g. http://notebook-server:11434/v1 (Ollama)
    api_key=settings.LLM_API_KEY,              # Ollama ignores it; vLLM can require one
    timeout=settings.LLM_TIMEOUT_MS / 1000,
    max_retries=1,
)
schema = cv_extraction_json_schema()           # Pydantic model_json_schema(), $refs inlined

user_content = (
    [{"type": "text", "text": f"<cv>\n{prepared.text}\n</cv>\n\n{USER_INSTRUCTIONS}"}]
    if prepared.kind == "text"
    else [*({"type": "image_url", "image_url": {"url": f"data:{i.mime};base64,{i.b64}"}} for i in prepared.images),
          {"type": "text", "text": USER_INSTRUCTIONS}]
)

res = await client.chat.completions.create(
    model=settings.LLM_MODEL,
    temperature=0,
    max_tokens=4096,
    response_format={"type": "json_schema", "json_schema": {"name": "cv_extraction", "schema": schema, "strict": True}},
    messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user_content}],
)

choice = res.choices[0]
if choice.finish_reason == "length":
    raise AppError("EXTRACTION_FAILED")                    # output cut off
extraction = CvExtraction.model_validate(parse_json_loose(choice.message.content))   # ValidationError -> one repair retry
# the pipeline then raises NOT_A_CV when extraction.is_document_a_cv is False
```

Notes for the implementer:
- **Always validate with Pydantic.** Small local models can still produce schema-valid nonsense, and some server versions ignore `response_format`. Allow **one repair retry** that feeds the validation error back to the model, then fail with `EXTRACTION_FAILED`.
- **Keep every field required.** The server only guarantees keys that are `required` in the schema, so model fields are nullable but not optional. Strip Pydantic's `title` annotations from the schema **without** dropping a real field called `title` (this bug happened once and has a regression test).
- **Context window:** Ollama's default context is small (a few thousand tokens), so the CV + schema would be silently truncated. The server must run with a context of at least **16k** (see 07-local-qwen-setup.md). Log `usage.prompt_tokens` and warn when it gets close to the limit.
- **No thinking:** use the *Instruct* variant. If a Qwen3 text model with thinking is used, disable thinking (e.g. `/no_think` in the system prompt) or the JSON will be preceded by reasoning.
- **Concurrency 1:** the local job runner processes one extraction at a time. The notebook GPU can't run several in parallel, and queuing gives predictable latency. Extra jobs wait with `status: "queued"`.
- **Timeouts:** local inference is slower than a cloud API. The client timeout is 180 s (configurable) and the job poll timeout is 300 s.
- **Logging:** log model, `kind`, page count, `usage`, `durationMs` and `finish_reason`. **Never** log the text, images or output content.

## 5.5 The AI-facing schema (`CvExtraction`)

This is a reduced version of `CvProfile`: no `id`, `source`, `needsReview` or `schemaVersion` (see 03-data-schema.md §3.5), plus three top-level fields:

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

## 5.6 Prompt (draft)

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

## 5.7 Step 4–5: validate, ground-check, post-process

1. **Pydantic validation** (already done in step 3) plus:
   - Date sanity check (`startDate ≤ endDate`, year between 1950 and next year). If it fails, set confidence to `low`.
   - Validate emails and URLs. Invalid values become `null` and a warning is added.
2. **Grounding check (text inputs only):** this is an anti-hallucination guard, important with smaller local models. For each item, check that its key strings (institution, organization, project name, skill name, certification name) actually occur in the extracted CV text (case- and whitespace-insensitive, with a small fuzzy tolerance). If not, set confidence to `low`, which flags the item for review. Image inputs can't be checked this way, so they rely on the model's confidence plus the review step.
3. **Normalize skills** with `skill_aliases.py` (`reactjs`/`react.js` → `React`, `postgres` → `PostgreSQL`, …). Deduplicate and keep the highest confidence.
4. **Assign IDs** and set `source: "cv"`.
5. **Compute `needsReview`** = `confidence !== "high"` OR a key field is null (education: `institution`; experience: `title` or `organization`; project: `name`).
6. Build `meta` (duration, model, `reviewCount`, warnings, `inputKind`, `cached`) and store the result under `CACHE#<hash>` (24 h).

Steps 1, 2, 3, 4 and 5 are pure functions, fully unit-tested without any model.

## 5.8 Privacy and security checklist

**Local (notebook server)**
- [ ] The Ollama/vLLM port is reachable only on the LAN/Tailscale, never port-forwarded to the internet.
- [ ] If the server is shared, put a reverse proxy with an API key in front (`LLM_API_KEY`).
- [ ] Uploaded files go to a temp folder and are deleted right after processing (in `finally`), plus a startup sweep of leftovers.
- [ ] Ollama doesn't keep prompts. Don't enable any request logging/tracing that would store CV content.

**AWS (deployment)**
- [ ] The S3 uploads bucket blocks public access, uses SSE, and expires objects after 1 day as a safety net. The worker deletes each object in `finally`.
- [ ] Size and type are enforced by the presigned POST policy and re-checked from magic bytes.
- [ ] Job records have a 1-hour TTL and the hash cache a 24-hour TTL. Only profiles the user saves persist.
- [ ] If the model runs on a GPU instance, it is in a private subnet / security group reachable only from the worker.

**Both**
- [ ] Logs carry only metadata, never CV content.
- [ ] CORS is restricted to the frontend origins.
- [ ] Test fixtures are synthetic CVs. No real people's CVs are committed to the repo.
- [ ] UI privacy text: "Your CV is processed by our AI to build your profile and is deleted right after."
