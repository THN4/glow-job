"""Glow Job backend package.

The resume domain lives in the sibling ``data-pipeline`` submodule. Add that
checkout to the import path so the backend can run directly from this repo.
"""

from pathlib import Path
import sys

_DATA_PIPELINE_ROOT = Path(__file__).resolve().parents[2] / "data-pipeline"
if not _DATA_PIPELINE_ROOT.is_dir():
    raise ImportError(
        "The data-pipeline submodule is missing. From the glow-job root run "
        "`git submodule update --init --recursive data-pipeline`."
    )

_data_pipeline_path = str(_DATA_PIPELINE_ROOT)
if _data_pipeline_path not in sys.path:
    sys.path.insert(0, _data_pipeline_path)
