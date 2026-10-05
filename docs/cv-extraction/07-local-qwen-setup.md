# 7. Local Qwen Setup (DevOps notebook server)

The backend talks to the model through an **OpenAI-compatible API**, so any of these servers work: **Ollama** (recommended, easiest), **vLLM** (faster, needs a bigger GPU) or LM Studio. The backend only needs three values: `LLM_BASE_URL`, `LLM_MODEL` and optionally `LLM_API_KEY`.

> Model tags and server flags change often. Check the current Ollama library / vLLM docs for the exact names before setting up.

## 7.1 Pick a model for your hardware

The CV feature needs a **vision-language (VL)** model, because scanned CVs and photos are sent as images. Text PDFs work with any model.

| Notebook GPU VRAM | Suggested model (Ollama tag) | Notes |
|---|---|---|
| ≥ 12 GB | `qwen3-vl:8b` (**default**) | Best balance of accuracy and speed |
| 8 GB | `qwen2.5vl:7b` or `qwen3-vl:4b` | Fewer images per request, so keep the 4-page image limit |
| Apple Silicon ≥ 16 GB unified memory | `qwen3-vl:8b` | Works with Ollama on Metal |
| CPU only | `qwen3-vl:4b` | Very slow for images (minutes). OK for text PDFs during development |

Thai CVs: Qwen models handle Thai reasonably, but include Thai CVs in the eval to check (task 9).

## 7.2 Ollama setup

```bash
# 1. Install Ollama (https://ollama.com), then pull the model
ollama pull qwen3-vl:8b

# 2. Server settings (systemd override, or env vars before `ollama serve`)
OLLAMA_HOST=0.0.0.0:11434      # listen on the network. PRIVATE network/Tailscale only!
OLLAMA_CONTEXT_LENGTH=16384    # REQUIRED: the default is too small, so the CV + schema would be truncated
OLLAMA_NUM_PARALLEL=1          # one request at a time (the backend queues the rest)
OLLAMA_KEEP_ALIVE=30m          # keep the model in memory between requests (avoids slow cold loads)
```

On Linux with systemd: `sudo systemctl edit ollama`, add the variables under `[Service]` as `Environment="OLLAMA_CONTEXT_LENGTH=16384"` and so on, then `sudo systemctl restart ollama`.

Backend `.env`:
```
EXTRACTOR=openai-compatible
LLM_BASE_URL=http://<notebook-host>:11434/v1
LLM_MODEL=qwen3-vl:8b
LLM_TIMEOUT_MS=180000
```

## 7.3 vLLM alternative (NVIDIA GPU, faster)

```bash
vllm serve Qwen/Qwen3-VL-8B-Instruct \
  --max-model-len 16384 \
  --api-key <shared-secret> \
  --limit-mm-per-prompt '{"image": 4}'     # flag syntax differs between vLLM versions, so check the docs
```

Use an AWQ/FP8 quantized variant if VRAM is tight. Backend `.env`: `LLM_BASE_URL=http://<host>:8000/v1`, `LLM_MODEL=Qwen/Qwen3-VL-8B-Instruct`, `LLM_API_KEY=<shared-secret>`.

vLLM is also the natural path if the model later runs on an AWS GPU instance (see 06-aws-setup-and-cost.md), because the backend config stays the same and only the URL changes.

## 7.4 Let teammates reach it

- **Recommended: [Tailscale](https://tailscale.com)** (free for small teams). Install it on the notebook server and on each developer machine, then use `http://<tailscale-name>:11434/v1`.
- Same office/LAN: use the server's LAN IP.
- **Never** port-forward 11434/8000 to the internet. Ollama has no authentication, so anyone could use the GPU and see prompts (CV data).

## 7.5 Smoke test

```bash
# 1. Is the server up, and is the model there?
curl http://<host>:11434/v1/models

# 2. Does structured JSON output work?
curl http://<host>:11434/v1/chat/completions -H "Content-Type: application/json" -d '{
  "model": "qwen3-vl:8b",
  "temperature": 0,
  "messages": [{"role": "user", "content": "Extract: Jane studied B.Sc. Computer Science at Chulalongkorn University 2020-2024."}],
  "response_format": {"type": "json_schema", "json_schema": {"name": "t", "schema": {
    "type": "object",
    "properties": {"degree": {"type": "string"}, "institution": {"type": "string"}, "startYear": {"type": "string"}},
    "required": ["degree", "institution", "startYear"]
  }}}
}'
# Expect the reply content to be ONLY JSON matching the schema.

# 3. From the repo, run a real CV through the whole pipeline
# from backend-py/ (venv active); create the sample files first with: python -m tests.fixtures
python -m app.scripts.extract tests/generated/sample-cv.pdf
```

## 7.6 Expected performance (rough, measure in the eval)

| Input | 8B VL model on a ~12–16 GB GPU |
|---|---|
| 2-page text PDF (text path) | ~10–30 s |
| 1 photo / 1-page scan | ~20–60 s |
| 4-page scan | ~1–3 min |

The "Analyzing your CV" UI says "usually takes less than a minute". That holds for text PDFs and single photos. Long scans may need the UI copy adjusted or the page limit reduced.

## 7.7 Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Output misses later CV sections, or the JSON is cut off | Context too small. Check `OLLAMA_CONTEXT_LENGTH` / `--max-model-len` |
| Reply contains text before the JSON, or `<think>` tags | A thinking model variant. Use the *Instruct* VL model, or disable thinking |
| `response_format` ignored (free text returned) | Old server version. Update Ollama/vLLM. The backend's Pydantic validation + one repair retry catch this |
| First request very slow, later ones fast | Model cold load. Increase `OLLAMA_KEEP_ALIVE` |
| Out-of-memory with images | Use a smaller model or quantization, lower the image size (1024 px), or reduce the max image pages |
| Teammates can't connect | `OLLAMA_HOST` still `127.0.0.1`, firewall, or Tailscale not connected |

## 7.8 What was tested on the real server (2026-10-05)

Server: Ollama 0.35.1, GPU memory ~6 GB (models bigger than that run partly on the CPU).

| Model | Text CV (same 1-page CV) | Images | Verdict |
|---|---|---|---|
| `qwen2.5-coder:7b` (4.7 GB, 61 % on GPU) | All fields correct, **~81-87 s** | Not supported (text-only) | **In use.** Fastest and as accurate as the others |
| `gemma4:e4b` (9.6 GB, 27 % on GPU) | Same quality, a few extra items (Node.js, Tailwind), but **~161 s** (2x slower, thinking tokens) and one education item flagged for review | **Doesn't work**: the model says "no image was provided" / calls a red image "black" and the prompt has no image tokens, so the images never reach the vision encoder | Not worth the 2x slowdown |
| `rafw007/gemma4-e4b-claude-coder`, `-e2b-claude-coder` | Not tested for text | Same problem as above (e2b ignored the image too) | Skip |

**Conclusion:** no installed model can read scans or photos. The one real fix is to install a Qwen vision model that fits ~6 GB, e.g. `qwen3-vl:4b` (or `qwen2.5vl:7b`, tight on memory). One vision model also handles text CVs, so it could replace `qwen2.5-coder`. Check the exact tag in the Ollama library, then test with the checks in 7.5 (send a simple image and ask what is in it) before changing `.env` to `LLM_MODEL=<tag>` and `LLM_VISION=true`.

### Update (same day): a working vision model

DevOps installed `vegeta/qwen3.5-4b-mtp:q8` (4.3B, Q8, vision + thinking). It **does** see images (a red image with white "HELLO 42" was described correctly), and it read the scanned CV and the phone-photo CV correctly.

Two things are needed for it to work well:
1. **Small context window.** Ollama loaded it with its native 131k context, so only 18 % of the model fit on the GPU and requests timed out. With 16k it is 34-107 s per CV. The backend now sets this per request with `EXTRACTOR=ollama` (`LLM_NUM_CTX=16384`); on the server, `OLLAMA_CONTEXT_LENGTH=16384` does the same for every client.
2. **Thinking off** (`LLM_THINK=false`), otherwise the token budget goes on reasoning.

Also: use the **full tag** in `LLM_MODEL` (`vegeta/qwen3.5-4b-mtp:q8`, not `qwen3-4b_q8`). `pielee/qwen3-4b_q8:latest` is text-only.

