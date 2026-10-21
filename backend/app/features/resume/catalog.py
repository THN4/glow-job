"""Read-only backend adapter for the shared skill catalog."""

from __future__ import annotations

import logging

import psycopg

from app.features.resume.config import CvSettings
from app.features.resume.errors import AppError
from src.shared.skill_normalization.normalizer import build_skill_catalog

log = logging.getLogger("cv_extraction")


class SkillCatalogRepository:
    """Load canonical skills and aliases; this adapter never writes catalog data."""

    def __init__(self, settings: CvSettings):
        self._settings = settings

    def load(self) -> dict[str, dict[str, object]] | None:
        """Return None when local DB matching is not configured."""
        if not self._settings.skill_catalog_configured:
            return None

        try:
            with psycopg.connect(
                host=self._settings.DB_HOST,
                port=self._settings.DB_PORT,
                dbname=self._settings.DB_NAME,
                user=self._settings.DB_USER,
                password=self._settings.DB_PASSWORD,
                connect_timeout=5,
            ) as connection:
                connection.execute("SET TRANSACTION READ ONLY")
                skills = connection.execute(
                    """
                    SELECT skill_id, skill_name, skill_category, catalog_status
                    FROM core.skills ORDER BY skill_id
                    """
                ).fetchall()
                aliases = connection.execute(
                    "SELECT skill_id, alias FROM core.skill_aliases ORDER BY alias_id"
                ).fetchall()
            if not skills:
                raise ValueError("The shared skill catalog is empty")
            return build_skill_catalog(skills, aliases)
        except Exception as exc:  # noqa: BLE001 - don't expose DB details to API clients
            log.warning("skill catalog lookup failed: %s", type(exc).__name__)
            raise AppError("SKILL_CATALOG_UNAVAILABLE") from exc
