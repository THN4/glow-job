"""Standalone dev entry point. When the team's FastAPI app exists, only
``app.include_router(cv_router, prefix="/api")`` is needed there (see app/cv_extraction/__init__.py)."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .cv_extraction import router as cv_router
from .cv_extraction.config import get_settings


def create_app() -> FastAPI:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    settings = get_settings()
    app = FastAPI(title="Glow Job API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()],
        allow_methods=["GET", "POST", "PUT", "OPTIONS"],
        allow_headers=["*"],
    )

    @app.get(f"{settings.API_PREFIX}/health")
    async def health() -> dict:
        return {"status": "ok", "extractor": settings.EXTRACTOR}

    app.include_router(cv_router, prefix=settings.API_PREFIX)
    return app


app = create_app()
