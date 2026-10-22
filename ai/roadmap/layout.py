"""Place roadmap steps on the frontend canvas: a grid of 4 columns and at most 6 rows.

The Figma design reads top to bottom. A run of single steps flows left to right in one
row (Python, SQL, ETL, project). Steps that branch get their own row, spread over the
columns, and the goal sits alone in the last row. Rows and columns are integers because
the canvas places nodes with CSS grid lines.
"""

from __future__ import annotations

COLUMNS = 4
MAX_ROWS = 6
# Columns used by a row of N nodes. Single nodes and pairs centre on column 3 like the design.
LANES = {1: (3,), 2: (2, 4), 3: (2, 3, 4), 4: (1, 2, 3, 4)}


def depth(keys: list[str], depends_on: dict[str, list[str]]) -> dict[str, int]:
    """Longest dependency path to each key. Unknown keys are ignored and cycles cannot loop."""
    known = set(keys)
    result: dict[str, int] = {}
    visiting: set[str] = set()

    def visit(key: str) -> int:
        if key in result:
            return result[key]
        if key in visiting:
            return 0
        visiting.add(key)
        deps = [d for d in depends_on.get(key, []) if d in known and d != key]
        result[key] = 1 + max(visit(d) for d in deps) if deps else 0
        visiting.discard(key)
        return result[key]

    for key in keys:
        visit(key)
    return result


def place(keys: list[str], depends_on: dict[str, list[str]]) -> dict[str, tuple[int, int]]:
    """Return (row, column), both starting at 1, for every key. ``keys`` keeps the plan's order."""
    layer = depth(keys, depends_on)
    by_layer: dict[int, list[str]] = {}
    for key in keys:
        by_layer.setdefault(layer[key], []).append(key)

    rows: list[list[str]] = []
    run: list[str] = []

    def flush() -> None:
        for start in range(0, len(run), COLUMNS):
            rows.append(run[start:start + COLUMNS])
        run.clear()

    for index in sorted(by_layer):
        members = by_layer[index]
        if len(members) == 1:
            run.extend(members)
            continue
        flush()
        for start in range(0, len(members), COLUMNS):
            rows.append(members[start:start + COLUMNS])
    flush()

    positions: dict[str, tuple[int, int]] = {}
    for row_number, members in enumerate(rows, 1):
        for key, column in zip(members, LANES[len(members)]):
            positions[key] = (row_number, column)
    return positions


def row_count(keys: list[str], depends_on: dict[str, list[str]]) -> int:
    positions = place(keys, depends_on)
    return max((row for row, _ in positions.values()), default=0)
