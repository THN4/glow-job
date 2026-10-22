"""Run the roadmap tests and write a visual report (HTML) from the real results.

Everything on the page comes from this run: pytest results (junit XML), the mock
roadmap generated from the demo Agent Context, and the validator's reaction to
deliberately broken drafts. No model is called and nothing is billed.

    python -m scripts.roadmap.visual_test_report                 # DB tests skipped
    python -m scripts.roadmap.visual_test_report --with-db       # starts a throwaway Postgres in Docker
    python -m scripts.roadmap.visual_test_report --open

Run it with the backend virtualenv's Python from the repository root.
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import subprocess
import sys
import tempfile
import time
import webbrowser
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import date, datetime, timezone
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
for path in (ROOT, ROOT / "data-pipeline", ROOT / "backend"):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from ai.roadmap.generate import generate_roadmap, prepare  # noqa: E402
from ai.roadmap.providers import MockRoadmapModel  # noqa: E402
from ai.roadmap.validate import validate_draft  # noqa: E402
from rag.context.agent_models import AgentContext  # noqa: E402

FIXTURE = ROOT / "ai/roadmap/fixtures/agent-context-demo-student.json"
TEST_FILES = {
    "tests/test_roadmap_core.py": "Core logic",
    "tests/test_roadmap_api.py": "API, in-memory repository",
    "tests/test_roadmap_db.py": "API + SQL, real PostgreSQL",
}
PLAN_DATE = date(2026, 10, 19)
CONTAINER, DB_PORT, DB_PASSWORD = "glowjob-roadmap-test", 55432, "roadmap-test"


# --------------------------------------------------------------------------- running tests


@dataclass
class Case:
    file: str
    name: str
    status: str  # passed | failed | skipped
    seconds: float
    detail: str = ""


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, **kwargs)


def start_database() -> None:
    """Throwaway pgvector Postgres with migrations 001-016, applied the way the tests were verified."""
    run(["docker", "rm", "-f", CONTAINER])
    started = run(["docker", "run", "-d", "--rm", "--name", CONTAINER, "-e", "POSTGRES_DB=glowjob",
                   "-e", "POSTGRES_USER=glowjob", "-e", f"POSTGRES_PASSWORD={DB_PASSWORD}",
                   "-p", f"{DB_PORT}:5432", "pgvector/pgvector:0.8.7-pg16-bookworm"])
    if started.returncode:
        raise RuntimeError("Could not start Postgres: " + started.stderr.strip())
    for _ in range(40):
        if run(["docker", "exec", CONTAINER, "pg_isready", "-U", "glowjob", "-d", "glowjob"]).returncode == 0:
            break
        time.sleep(2)
    time.sleep(4)  # the image restarts the server once after its first init
    psql = ["docker", "exec", CONTAINER, "psql", "-q", "-v", "ON_ERROR_STOP=1", "-U", "glowjob", "-d", "glowjob"]
    run([*psql, "-c", "CREATE SCHEMA IF NOT EXISTS system; CREATE TABLE IF NOT EXISTS system.schema_migrations "
                      "(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"])
    files = {p.name: p for d in (ROOT / "data-pipeline/migrations/versions", ROOT / "migrations/versions")
             for p in d.glob("*.sql")}
    for name in sorted(files):
        run(["docker", "cp", str(files[name]), f"{CONTAINER}:/tmp/m.sql"])
        done = run([*psql, "-1", "-f", "/tmp/m.sql", "-c",
                    f"INSERT INTO system.schema_migrations (version) VALUES ('{name}')"])
        if done.returncode:
            raise RuntimeError(f"Migration {name} failed: {done.stderr.strip()}")


def stop_database() -> None:
    run(["docker", "stop", CONTAINER])


def run_tests(with_db: bool) -> tuple[list[Case], str]:
    env = dict(os.environ)
    note = "PostgreSQL tests skipped (run with --with-db)"
    if with_db:
        start_database()
        env["ROADMAP_TEST_DATABASE"] = f"localhost:{DB_PORT}:glowjob:glowjob:{DB_PASSWORD}"
        note = "PostgreSQL 16 + pgvector in a throwaway container, migrations 001-016 applied"
    try:
        with tempfile.TemporaryDirectory() as tmp:
            xml_path = Path(tmp) / "junit.xml"
            run([sys.executable, "-m", "pytest", *TEST_FILES, "-q", f"--junitxml={xml_path}"],
                cwd=ROOT / "backend", env=env)
            tree = ET.parse(xml_path)
    finally:
        if with_db:
            stop_database()
    cases = []
    for node in tree.iter("testcase"):
        file = "tests/" + node.get("classname", "").split(".")[-1] + ".py"
        status, detail = "passed", ""
        for child in node:
            if child.tag in {"failure", "error"}:
                status, detail = "failed", (child.get("message") or "")[:300]
            elif child.tag == "skipped":
                status, detail = "skipped", child.get("message") or ""
        cases.append(Case(file, node.get("name", ""), status, float(node.get("time", 0)), detail))
    return cases, note


# --------------------------------------------------------------------------- roadmap and validator


def pipeline_facts():
    context = AgentContext.model_validate_json(FIXTURE.read_bytes())
    model = MockRoadmapModel()
    prepared = prepare(context, model, today=PLAN_DATE)
    result = generate_roadmap(context, model, prepared=prepared)
    full_chars = len(FIXTURE.read_text(encoding="utf-8"))
    sent_chars = len(json.dumps(prepared.compact, ensure_ascii=False))

    scenarios = []

    def scenario(title, wrong, change):
        draft = copy.deepcopy(result.draft)
        change(draft)
        check = validate_draft(draft, context, prepared.budget)
        if check.fatal:
            outcome, notes = "repair", check.fatal
        elif check.warnings:
            outcome, notes = "fixed", check.warnings
        else:
            outcome, notes = "pass", []
        scenarios.append({"title": title, "wrong": wrong, "outcome": outcome, "notes": notes})

    def bad_quote(d):
        d.steps[1].tasks[0].citations[0].quote = "This sentence does not appear in the cited source."

    def foundation_lesson(d):
        d.steps[0].tasks[0].task_kind = "learn"
        d.steps[0].hours_max = 6

    def forgot_deferred(d):
        d.deferred = []

    def unknown_dependency(d):
        d.steps[1].depends_on = ["check-docker", "step-that-does-not-exist"]

    def foundation_as_skill(d):
        d.steps[1].skill_id = 91

    def cycle(d):
        d.steps[0].depends_on = ["portfolio-project"]

    def over_budget(d):
        d.steps[1].hours_min, d.steps[1].hours_max = 90, 95

    def duplicate_key(d):
        d.steps[2].key = d.steps[1].key

    scenario("Baseline: mock roadmap, unchanged", "Nothing", lambda d: None)
    scenario("Citation quote not in the source", "A citation that the cited document does not contain", bad_quote)
    scenario("Foundation turned into a lesson", "A Docker 'learn' task, capped at 6 hours", foundation_lesson)
    scenario("Skill left out of the plan", "Java is neither planned nor deferred", forgot_deferred)
    scenario("Dependency on a missing step", "depends_on names a step that does not exist", unknown_dependency)
    scenario("Foundation used as a skill step", "Python (a foundation) planned as a skill", foundation_as_skill)
    scenario("Circular dependencies", "Docker check depends on the final project", cycle)
    scenario("Plan far over the time budget", "Airflow alone needs at least 90 hours", over_budget)
    scenario("Two steps with the same key", "Duplicate step key", duplicate_key)
    return context, result, prepared, full_chars, sent_chars, scenarios


# --------------------------------------------------------------------------- html


def humanize(name: str) -> str:
    base, _, param = name.partition("[")
    text = base.removeprefix("test_").replace("_", " ")
    return text[:1].upper() + text[1:] + (f"  [{param.rstrip(']')}]" if param else "")


ICON = {"passed": "✓", "failed": "✗", "skipped": "–", "pending": "○"}


def tests_html(cases: list[Case]) -> str:
    out = []
    for file, title in TEST_FILES.items():
        group = [c for c in cases if c.file == file]
        counts = {s: sum(c.status == s for c in group) for s in ("passed", "failed", "skipped")}
        summary = " · ".join(f"{n} {s}" for s, n in counts.items() if n)
        items = "".join(
            f'<li class="t {c.status}" title="{escape(c.detail)}"><span class="ic" aria-hidden="true">{ICON[c.status]}</span>'
            f'<span class="sr">{c.status}: </span><span class="nm">{escape(humanize(c.name))}</span>'
            f'<span class="ms">{c.seconds * 1000:.0f} ms</span></li>' for c in group)
        out.append(f'<section class="group"><header><h3>{escape(title)}</h3><code>{file}</code>'
                   f'<span class="sum">{summary or "no results"}</span></header><ul class="tests">{items}</ul></section>')
    return "".join(out)


def layers_html(cases: list[Case], db_note: str) -> str:
    def state(file):
        group = [c for c in cases if c.file == file]
        if not group:
            return "pending", "No results"
        if any(c.status == "failed" for c in group):
            return "failed", f"{sum(c.status == 'failed' for c in group)} failed"
        if all(c.status == "skipped" for c in group):
            return "skipped", "Skipped in this run"
        return "passed", f"{sum(c.status == 'passed' for c in group)} passed in this run"

    rows = [
        ("1", "Unit tests of the AI core", "Free", *state("tests/test_roadmap_core.py")),
        ("2", "API with an in-memory repository", "Free", *state("tests/test_roadmap_api.py")),
        ("3", "API and SQL on real PostgreSQL", "Free", *state("tests/test_roadmap_db.py")),
        ("4", "Docker image and HTTP end to end", "Free", "manual", "Passed on 2026-10-19, not part of this run"),
        ("5", "Team database and real knowledge files", "Free", "pending", "Waiting for the team database"),
        ("6", "Real Claude call", "About $0.10 to $0.25 each", "pending", "Waiting for approval"),
        ("7", "Amazon Bedrock", "AWS price", "pending", "Waiting for a region"),
        ("8", "Frontend integration", "Free (mock)", "pending", "Waiting for the frontend"),
    ]
    body = "".join(
        f'<tr><td class="num">{n}</td><td>{escape(name)}</td><td class="cost">{escape(cost)}</td>'
        f'<td><span class="chip {cls}"><span aria-hidden="true">{ICON.get(cls, "✓")}</span> {escape(label)}</span></td></tr>'
        for n, name, cost, cls, label in rows)
    return f'<div class="scroll"><table class="layers"><thead><tr><th>#</th><th>Layer</th><th>Cost</th><th>Status</th></tr></thead><tbody>{body}</tbody></table></div><p class="note">{escape(db_note)}.</p>'


def scenarios_html(scenarios) -> str:
    label = {"pass": ("passed", "Accepted"), "fixed": ("fixed", "Fixed in code"),
             "repair": ("repair", "Needs a repair call")}
    rows = []
    for s in scenarios:
        cls, text = label[s["outcome"]]
        notes = "".join(f"<li>{escape(n)}</li>" for n in s["notes"]) or "<li class='dim'>No findings</li>"
        rows.append(f'<tr><td><strong>{escape(s["title"])}</strong><br><span class="dim">{escape(s["wrong"])}</span></td>'
                    f'<td><span class="chip {cls}">{text}</span></td><td><ul class="notes">{notes}</ul></td></tr>')
    return ('<div class="scroll"><table class="scen"><thead><tr><th>Broken draft</th><th>Result</th>'
            '<th>What the validator said</th></tr></thead><tbody>' + "".join(rows) + "</tbody></table></div>")


def graph_svg(view) -> str:
    nodes = [n for n in view["nodes"]]
    w, h, gx, gy, pad = 156, 62, 54, 22, 14
    cols, rows = view["layout"]["columns"], view["layout"]["rows"]  # the frontend canvas grid
    width = pad * 2 + cols * w + (cols - 1) * gx
    height = pad * 2 + rows * h + (rows - 1) * gy
    pos = {n["key"]: (pad + (n["position"]["column"] - 1) * (w + gx), pad + (n["position"]["row"] - 1) * (h + gy))
           for n in nodes}
    parts = [f'<svg viewBox="0 0 {width} {height}" width="{width}" height="{height}" role="group" '
             f'aria-label="Roadmap steps and their dependencies">'
             '<defs><marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" '
             'orient="auto"><path d="M0 0 L8 4 L0 8 z" class="arrowhead"/></marker></defs>']
    for e in view["edges"]:
        (x1, y1), (x2, y2) = pos[e["from"]], pos[e["to"]]
        sx, sy, ex, ey = x1 + w, y1 + h / 2, x2, y2 + h / 2
        mid = (sx + ex) / 2
        if abs(y1 - y2) < 1:  # same row: straight arrow
            d = f"M{sx} {sy} L{ex - 2} {ey}"
        else:  # next row: leave the bottom, enter the top
            sx, sy, ex, ey = x1 + w / 2, y1 + h, x2 + w / 2, y2
            d = f"M{sx} {sy} C{sx} {(sy + ey) / 2} {ex} {(sy + ey) / 2} {ex} {ey - 2}"
        dashed = " dashed" if e.get("optional") else ""
        parts.append(f'<path class="edge{dashed}" d="{d}" marker-end="url(#arrow)"/>')
    for n in nodes:
        x, y = pos[n["key"]]
        hours = n["estimatedHours"]
        sub = f'{hours["min"]:g} to {hours["max"]:g} h' if hours else "target"
        title = n["title"] if len(n["title"]) <= 22 else n["title"][:21] + "…"
        parts.append(
            f'<g class="node k-{n["kind"]}" data-node="{escape(n["key"])}" tabindex="0" role="button" '
            f'aria-label="{escape(n["title"])}, {escape(n["kind"])}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6"/>'
            f'<text class="kind" x="{x + 12}" y="{y + 19}">{escape(n["kind"].replace("-", " ").upper())}</text>'
            f'<text class="ttl" x="{x + 12}" y="{y + 38}">{escape(title)}</text>'
            f'<text class="sub" x="{x + 12}" y="{y + 54}">{escape(sub)}</text></g>')
    parts.append("</svg>")
    return "".join(parts)


def hours_html(view) -> str:
    summary = view["summary"]
    planned, budget = summary["estimatedHours"], summary["budgetHours"]
    top = 70
    pct = lambda v: f"{v / top * 100:.2f}%"

    def bar(label, rng, cls):
        return (f'<div class="hrow"><div class="hlab">{label}<b>{rng["min"]:g} to {rng["max"]:g} h</b></div>'
                f'<div class="track"><div class="fill {cls}" style="left:{pct(rng["min"])};width:{pct(rng["max"] - rng["min"])}"></div></div></div>')

    ticks = "".join(f'<span style="left:{pct(t)}">{t}</span>' for t in range(0, top + 1, 10))
    return (bar("Time you have (2 to 5 h a week × 13 weeks)", budget, "budget") +
            bar("Time the plan asks for", planned, "plan") +
            f'<div class="axis">{ticks}</div>')


def size_html(full_chars: int, sent_chars: int) -> str:
    cut = round(100 - sent_chars / full_chars * 100)
    return (f'<div class="hrow"><div class="hlab">Full Agent Context<b>{full_chars:,} characters</b></div>'
            f'<div class="track"><div class="fill full" style="left:0;width:100%"></div></div></div>'
            f'<div class="hrow"><div class="hlab">Sent to the model<b>{sent_chars:,} characters ({cut}% less)</b></div>'
            f'<div class="track"><div class="fill plan" style="left:0;width:{sent_chars / full_chars * 100:.2f}%"></div></div></div>')


STYLE = """<style>
/* Layout: one calm column. Verdict first, then the roadmap the tests produced, then the evidence. */
:root{--bg:#f5f6f3;--surface:#ffffff;--ink:#192124;--muted:#5a666b;--line:#dde2de;--line-strong:#aeb8b3;
--accent:#1d5f8a;--accent-soft:#e3eef5;--pass:#17703f;--pass-soft:#e1f1e8;--fail:#a8231b;--fail-soft:#f8e3e0;
--warn:#8a5a00;--warn-soft:#f6ecd6;--idle:#5a666b;--idle-soft:#e9ecea;--fix:#1d5f8a;--fix-soft:#e3eef5;
--font-body:"Schibsted Grotesk",system-ui,-apple-system,"Segoe UI",sans-serif;
--font-mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Consolas,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#11171a;--surface:#182024;--ink:#e6ecea;--muted:#9aa8ab;
--line:#2a3639;--line-strong:#4c5c60;--accent:#6fb2dc;--accent-soft:#1c2f3b;--pass:#5fcf91;--pass-soft:#16301f;--fail:#ff8a80;
--fail-soft:#3a1c1a;--warn:#e6b450;--warn-soft:#352a12;--idle:#9aa8ab;--idle-soft:#222d30;--fix:#6fb2dc;--fix-soft:#1c2f3b;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#11171a;--surface:#182024;--ink:#e6ecea;--muted:#9aa8ab;--line:#2a3639;--line-strong:#4c5c60;
--accent:#6fb2dc;--accent-soft:#1c2f3b;--pass:#5fcf91;--pass-soft:#16301f;--fail:#ff8a80;--fail-soft:#3a1c1a;--warn:#e6b450;
--warn-soft:#352a12;--idle:#9aa8ab;--idle-soft:#222d30;--fix:#6fb2dc;--fix-soft:#1c2f3b;color-scheme:dark}
body{background:var(--bg);color:var(--ink);font-family:var(--font-body);font-size:15px;line-height:1.5}
.wrap{max-width:1040px;margin:0 auto;padding-inline:20px;padding-block:28px 56px;display:flex;flex-direction:column;gap:36px}
h1{font-size:clamp(1.7rem,4vw,2.3rem);line-height:1.1;margin:0;letter-spacing:-.02em;text-wrap:balance}
h2{font-size:1.2rem;margin:0 0 4px;letter-spacing:-.01em}
h3{font-size:.95rem;margin:0}
p{margin:0}
.eyebrow{font-family:var(--font-mono);font-size:.74rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.lede{color:var(--muted);max-width:62ch;margin-top:8px}
.head{display:flex;flex-direction:column;gap:6px}
.verdict{display:flex;flex-wrap:wrap;gap:12px}
.tile{flex:1 1 150px;min-width:0;background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:14px 16px;display:flex;flex-direction:column;gap:2px}
.tile b{font-size:2rem;line-height:1;font-variant-numeric:tabular-nums}
.tile span{color:var(--muted);font-size:.85rem}
.tile.ok b{color:var(--pass)}.tile.bad b{color:var(--fail)}
section.block{display:flex;flex-direction:column;gap:14px;min-width:0}
.sub{color:var(--muted);max-width:68ch}
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
table{border-collapse:collapse;width:100%;font-size:.9rem}
th{text-align:left;font-weight:600;font-size:.76rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);padding:10px 14px;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:11px 14px;border-bottom:1px solid var(--line);vertical-align:top}
tr:last-child td{border-bottom:0}
td.num{font-family:var(--font-mono);color:var(--muted);width:2rem}
td.cost{color:var(--muted);white-space:nowrap}
.chip{display:inline-flex;gap:6px;align-items:center;font-size:.8rem;font-weight:600;padding:3px 10px;border-radius:999px;white-space:nowrap}
.chip.passed{background:var(--pass-soft);color:var(--pass)}
.chip.failed,.chip.repair{background:var(--fail-soft);color:var(--fail)}
.chip.skipped{background:var(--warn-soft);color:var(--warn)}
.chip.fixed{background:var(--fix-soft);color:var(--fix)}
.chip.pending,.chip.manual{background:var(--idle-soft);color:var(--idle)}
.note{color:var(--muted);font-size:.85rem}
.dim{color:var(--muted)}
.map{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
@media (min-width:900px){.map{grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)}}
.canvas{overflow-x:auto;background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:10px}
.canvas svg{display:block;max-width:none}
.node{cursor:pointer}
.node rect{fill:var(--surface);stroke:var(--line-strong);stroke-width:1.2}
.node.k-skill rect{fill:var(--accent-soft);stroke:var(--accent)}
.node.k-goal rect{fill:var(--ink);stroke:var(--ink)}
.node.k-foundation-check rect{stroke-dasharray:4 3}
.node text{fill:var(--ink);font-family:var(--font-body)}
.node .kind{font-family:var(--font-mono);font-size:9px;letter-spacing:.08em;fill:var(--muted)}
.node .ttl{font-size:13px;font-weight:600}
.node .sub{font-size:11px;fill:var(--muted)}
.node.k-goal text{fill:var(--bg)}.node.k-goal .kind,.node.k-goal .sub{fill:var(--bg);opacity:.8}
.node:hover rect,.node.sel rect{stroke:var(--accent);stroke-width:2.4}
.node:focus-visible{outline:none}.node:focus-visible rect{stroke:var(--accent);stroke-width:3}
.edge{fill:none;stroke:var(--line-strong);stroke-width:1.5}.edge.dashed{stroke-dasharray:5 4}.arrowhead{fill:var(--line-strong)}
.detail{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:16px;display:flex;flex-direction:column;gap:10px;min-width:0;align-self:start}
.detail h3{font-size:1.05rem}
.detail ul{margin:0;padding-left:1.1rem;display:flex;flex-direction:column;gap:4px}
.detail .task{border-top:1px solid var(--line);padding-top:8px;display:flex;flex-direction:column;gap:4px}
.kindchip{font-family:var(--font-mono);font-size:.7rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
blockquote{margin:0;padding:6px 10px;border-left:2px solid var(--accent);background:var(--accent-soft);font-size:.82rem;overflow-wrap:anywhere}
a{color:var(--accent)}
.aside{display:flex;flex-wrap:wrap;gap:10px 28px;font-size:.88rem;color:var(--muted)}
.aside strong{color:var(--ink)}
.hrow{display:grid;grid-template-columns:minmax(0,1fr);gap:6px}
.hlab{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:.88rem}
.hlab b{font-variant-numeric:tabular-nums}
.track{position:relative;height:16px;background:var(--idle-soft);border-radius:4px}
.fill{position:absolute;top:0;bottom:0;border-radius:4px}
.fill.budget{background:var(--line-strong)}.fill.plan{background:var(--accent)}.fill.full{background:var(--line-strong)}
.axis{position:relative;height:18px;font-family:var(--font-mono);font-size:.7rem;color:var(--muted);margin-bottom:6px}
.axis span{position:absolute;transform:translateX(-50%)}
.charts{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:16px;display:flex;flex-direction:column;gap:14px}
.group{background:var(--surface);border:1px solid var(--line);border-radius:8px;overflow:hidden}
.group header{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;padding:12px 16px;border-bottom:1px solid var(--line)}
.group header code{font-family:var(--font-mono);font-size:.76rem;color:var(--muted)}
.group .sum{margin-left:auto;font-size:.8rem;color:var(--muted)}
.tests{list-style:none;margin:0;padding:6px 8px;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,330px),1fr));gap:0 12px}
.t{display:flex;gap:8px;align-items:baseline;padding:5px 8px;font-size:.86rem;min-width:0;border-radius:4px}
.t .nm{flex:1;min-width:0;overflow-wrap:anywhere}
.t .ms{font-family:var(--font-mono);font-size:.72rem;color:var(--muted);font-variant-numeric:tabular-nums}
.t .ic{width:1.1em;text-align:center;font-weight:700}
.t.passed .ic{color:var(--pass)}.t.failed .ic{color:var(--fail)}.t.skipped .ic{color:var(--warn)}
.t.failed{background:var(--fail-soft)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
ul.notes{margin:0;padding-left:1rem;display:flex;flex-direction:column;gap:3px;font-size:.84rem}
.scen td:first-child{min-width:220px}
.foot{color:var(--muted);font-size:.8rem;font-family:var(--font-mono);overflow-wrap:anywhere}
</style>"""

SCRIPT = """<script>
(function(){
var view=JSON.parse(document.getElementById('view-data').textContent);
var byKey={};view.nodes.forEach(function(n){byKey[n.key]=n;});
var panel=document.getElementById('detail');
function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function show(key){
  var n=byKey[key];if(!n)return;
  document.querySelectorAll('.node').forEach(function(g){g.classList.toggle('sel',g.dataset.node===key);});
  panel.textContent='';
  panel.appendChild(el('span','kindchip',n.kind.replace('-',' ')));
  panel.appendChild(el('h3','',n.title));
  var h=n.estimatedHours;
  panel.appendChild(el('p','dim',(h?h.min+' to '+h.max+' hours · ':'')+n.summary));
  if(n.notice)panel.appendChild(el('p','note',n.notice));
  if(n.whyItMatters.length){var ul=el('ul');n.whyItMatters.forEach(function(w){ul.appendChild(el('li','',w));});panel.appendChild(ul);}
  n.checklist.forEach(function(item){
    var t=el('div','task');
    t.appendChild(el('span','kindchip',item.taskKind));
    t.appendChild(el('strong','',item.label));
    item.citations.forEach(function(c){
      t.appendChild(el('blockquote','','“'+c.quote+'”'));
      if(c.url){var a=el('a','',c.title+(c.heading&&c.heading!==c.title?' › '+c.heading:''));a.href=c.url;a.target='_blank';a.rel='noopener';t.appendChild(a);}
    });
    panel.appendChild(t);
  });
}
document.querySelectorAll('.node').forEach(function(g){
  g.addEventListener('click',function(){show(g.dataset.node);});
  g.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();show(g.dataset.node);}});
});
var first=view.nodes.find(function(n){return n.kind==='skill';})||view.nodes[0];
show(first.key);
})();
</script>"""


def render(cases, db_note, context, result, full_chars, sent_chars, scenarios, generated_at) -> str:
    view = result.view.model_dump(mode="json", by_alias=True)
    passed = sum(c.status == "passed" for c in cases)
    failed = sum(c.status == "failed" for c in cases)
    skipped = sum(c.status == "skipped" for c in cases)
    fixed = sum(s["outcome"] == "fixed" for s in scenarios)
    repair = sum(s["outcome"] == "repair" for s in scenarios)
    data = json.dumps(view, ensure_ascii=False).replace("</", "<\\/")
    deferred = "".join(f"<li><strong>{escape(d['skillName'])}</strong>: {escape(d['reasonCode'])}</li>" for d in view["deferred"])
    asks = "".join(f"<li>{escape(c['question'])}</li>" for c in view["confirmations"])
    fixture_note = ("Demo learner: Computer Science student, Data Engineer goal, 3 months, 2 to 5 hours a week. "
                    "Synthetic data from the demo seed.")
    return f"""<title>Roadmap Test Report</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Schibsted+Grotesk:wght@400;500;600;700&display=swap">
{STYLE}
<main class="wrap">
<header class="head">
<span class="eyebrow">Glow Job · roadmap generation</span>
<h1>Roadmap test report</h1>
<p class="lede">Results from running the roadmap tests, the roadmap the mock model produced, and how the checks react to broken drafts. No AI model was called and nothing was billed. {escape(fixture_note)}</p>
</header>

<section class="block" aria-label="Test results">
<div class="verdict">
<div class="tile {'ok' if not failed else 'bad'}"><b>{passed}</b><span>tests passed</span></div>
<div class="tile {'bad' if failed else ''}"><b>{failed}</b><span>failed</span></div>
<div class="tile"><b>{skipped}</b><span>skipped</span></div>
<div class="tile"><b>{fixed}</b><span>broken drafts fixed in code</span></div>
<div class="tile"><b>{repair}</b><span>need a repair call</span></div>
</div>
</section>

<section class="block">
<div><h2>Where testing stands</h2><p class="sub">Layers run from free to paid. The first three ran just now.</p></div>
{layers_html(cases, db_note)}
</section>

<section class="block">
<div><h2>The roadmap the tests produced</h2><p class="sub">Generated from the demo Agent Context with the free mock model and placed on the same 4-column grid the frontend canvas uses. A dashed arrow is a recommended path that does not block the next step. Select a step to see its tasks and the sources they cite.</p></div>
<div class="map"><div class="canvas">{graph_svg(view)}</div><aside class="detail" id="detail" aria-live="polite"></aside></div>
<div class="aside">
<span><strong>Moved to a later roadmap:</strong></span><ul class="notes">{deferred or '<li>None</li>'}</ul>
<span><strong>Questions for the learner:</strong></span><ul class="notes">{asks or '<li>None</li>'}</ul>
</div>
</section>

<section class="block">
<div><h2>Does the plan fit the time?</h2><p class="sub">Hours are planning estimates, not measured learning time. The budget comes from the saved weekly availability range and the 13 weeks to the target date.</p></div>
<div class="charts">{hours_html(view)}</div>
</section>

<section class="block">
<div><h2>What the model sees</h2><p class="sub">Dependency-only sources, repeated CV excerpts and metadata are removed before the call. Fewer input characters means a cheaper call.</p></div>
<div class="charts">{size_html(full_chars, sent_chars)}</div>
</section>

<section class="block">
<div><h2>What the checks do with a bad draft</h2><p class="sub">Each row breaks the mock roadmap in one way and runs the real validator. Problems that code can fix safely cost nothing. Structural problems trigger one repair call to the model.</p></div>
{scenarios_html(scenarios)}
</section>

<section class="block">
<div><h2>Every test</h2><p class="sub">Hover a row for the failure message when one fails.</p></div>
{tests_html(cases)}
</section>

<p class="foot">Generated {generated_at} · python -m scripts.roadmap.visual_test_report{' --with-db' if 'throwaway' in db_note else ''} · plan date {PLAN_DATE.isoformat()}</p>
</main>
<script type="application/json" id="view-data">{data}</script>
{SCRIPT}"""


def standalone(fragment: str) -> str:
    return ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + fragment + "</body></html>")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--with-db", action="store_true", help="Start a throwaway Postgres in Docker for the SQL tests")
    parser.add_argument("--output", type=Path, default=ROOT / "rag/data/roadmap-test-report.html")
    parser.add_argument("--fragment", type=Path, help="Also write the page without the html/head/body wrapper")
    parser.add_argument("--open", action="store_true")
    args = parser.parse_args()

    print("Running tests…")
    cases, db_note = run_tests(args.with_db)
    print("Generating the mock roadmap and checking broken drafts…")
    context, result, prepared, full_chars, sent_chars, scenarios = pipeline_facts()
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    page = render(cases, db_note, context, result, full_chars, sent_chars, scenarios, generated_at)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(standalone(page), encoding="utf-8")
    if args.fragment:
        args.fragment.write_text(page, encoding="utf-8")
    counts = {s: sum(c.status == s for c in cases) for s in ("passed", "failed", "skipped")}
    print(f"{counts} → {args.output}")
    if args.open:
        webbrowser.open(args.output.as_uri())
    return 1 if counts["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
