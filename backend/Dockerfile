FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/data-pipeline:/app

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# The backend imports the reusable resume and shared packages from this submodule.
COPY backend/app /app/backend/app
COPY data-pipeline/src /app/data-pipeline/src
# Roadmap generation: Agent Context assembly (rag) and the model/validation core (ai).
COPY rag /app/rag
COPY ai /app/ai

WORKDIR /app/backend
EXPOSE 8787

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8787"]
