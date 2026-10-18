"""Reuse the pipeline's connection settings without duplicating DB configuration."""

from pathlib import Path
import sys


def connect():
    pipeline = Path(__file__).resolve().parents[2] / "data-pipeline"
    if not (pipeline / "src/shared/db/database.py").is_file():
        raise ValueError("Initialize the data-pipeline submodule before reading the database")
    if str(pipeline) not in sys.path:
        sys.path.insert(0, str(pipeline))
    from src.shared.db.database import get_database_connection
    return get_database_connection()
