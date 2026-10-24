"""Arrange roadmap nodes in a serpentine path with dedicated branch/join rows."""

from __future__ import annotations

COLUMNS = 3
MAX_NODES_PER_ROW = 3
MAX_ROWS = 24


def depth(keys: list[str], depends_on: dict[str, list[str]],
          stable_order: dict[str, int] | None = None) -> dict[str, int]:
    """Return the longest dependency-path depth for each node."""
    known = set(keys)
    result: dict[str, int] = {}
    visiting: set[str] = set()

    def visit(key: str) -> int:
        if key in result:
            return result[key]
        if key in visiting:
            return 0
        visiting.add(key)
        parents = [parent for parent in depends_on.get(key, ()) if parent in known and parent != key]
        value = 1 + max(visit(parent) for parent in parents) if parents else 0
        visiting.remove(key)
        result[key] = value
        return value

    for key in keys:
        visit(key)
    return result


def place(keys: list[str], depends_on: dict[str, list[str]],
          stable_order: dict[str, int] | None = None) -> dict[str, tuple[int, int]]:
    """Return unique (row, column) positions, numbering both from 1.

    Linear route nodes are packed into rows of three. Rows alternate direction:
    left-to-right, then right-to-left. A node with multiple parents or children
    is placed alone on its row, leaving room for its incoming or outgoing branches.
    """
    stable_order = stable_order or {}
    known = set(keys)
    input_order = {key: index for index, key in enumerate(keys)}
    parents = {
        key: {parent for parent in depends_on.get(key, ()) if parent in known and parent != key}
        for key in keys
    }
    children: dict[str, set[str]] = {key: set() for key in keys}
    for child, parent_keys in parents.items():
        for parent in parent_keys:
            children[parent].add(child)

    # Stable topological order keeps recommended skill ranks intact while real
    # dependencies always take precedence.
    remaining = {key: set(value) for key, value in parents.items()}
    ordered: list[str] = []
    while remaining:
        available = sorted(
            (key for key, deps in remaining.items() if not deps),
            key=lambda key: (stable_order.get(key, 10_000), input_order[key]),
        )
        if not available:
            ordered.extend(sorted(remaining, key=lambda key: (stable_order.get(key, 10_000), input_order[key])))
            break
        current = available[0]
        ordered.append(current)
        del remaining[current]
        for deps in remaining.values():
            deps.discard(current)

    branch_or_join = {
        key for key in keys if len(parents[key]) >= 2 or len(children[key]) >= 2
    }
    rows: list[list[str]] = []
    current_row: list[str] = []

    def flush() -> None:
        if current_row:
            rows.append(current_row.copy())
            current_row.clear()

    for key in ordered:
        if key in branch_or_join:
            flush()
            rows.append([key])
            continue

        # Do not draw a same-row edge through an intermediate node. If a parent
        # is not at the end of this row, start a new row for the child.
        if any(parent in current_row and parent != current_row[-1] for parent in parents[key]):
            flush()
        if len(current_row) >= MAX_NODES_PER_ROW:
            flush()
        current_row.append(key)
    flush()

    positions: dict[str, tuple[int, int]] = {}
    for row_number, row_keys in enumerate(rows, start=1):
        if len(row_keys) == 1:
            columns = (2,)
        elif row_number % 2:
            columns = tuple(range(1, len(row_keys) + 1))
        else:
            columns = tuple(range(COLUMNS, COLUMNS - len(row_keys), -1))
        for key, column in zip(row_keys, columns):
            positions[key] = (row_number, column)

    # Give a two-way split a balanced left/right pair beneath its single-node row.
    rows_by_number: dict[int, list[str]] = {}
    for key, (row_number, _) in positions.items():
        rows_by_number.setdefault(row_number, []).append(key)
    for parent in ordered:
        branch_children = sorted(children[parent], key=lambda key: positions[key][1])
        if len(branch_children) not in {2, 3}:
            continue
        child_rows = {positions[key][0] for key in branch_children}
        if len(child_rows) != 1:
            continue
        row_number = child_rows.pop()
        if set(rows_by_number[row_number]) != set(branch_children):
            continue
        columns = (1, 3) if len(branch_children) == 2 else (1, 2, 3)
        for key, column in zip(branch_children, columns):
            positions[key] = (row_number, column)
    return positions


def row_count(keys: list[str], depends_on: dict[str, list[str]],
              stable_order: dict[str, int] | None = None) -> int:
    positions = place(keys, depends_on, stable_order)
    return max((row for row, _ in positions.values()), default=0)
