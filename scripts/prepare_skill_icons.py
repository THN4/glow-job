"""Bundle Devicon logos for the exported skill catalog. No database writes.

Refresh frontend/src/lib/skillIconCatalog.json with skill_id, skill_name,
skill_category and aliases from core.skills/core.skill_aliases before running.
Downloads are pinned to one upstream commit, recorded in the manifest.
"""
import concurrent.futures
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "frontend/src/assets/technology"
CATALOG = ROOT / "frontend/src/lib/skillIconCatalog.json"


def fetch(url):
    with urlopen(Request(url, headers={"User-Agent": "GlowJob-skill-icons"}), timeout=45) as response:
        return response.read()


def key(name):
    return re.sub(r"[\s._-]+", "", name.casefold())


# Explicit product identities; never assign logos by substring (Java != JavaScript).
OVERRIDES = {
    "Golang": "go", "Spring Framework": "spring", "Spring Boot": "spring",
    "Spring MVC": "spring", "Spark": "apachespark", "PySpark": "apachespark",
    "Apache Spark Batch/Real Time": "apachespark", "Kafka": "apachekafka",
    "Hadoop": "hadoop", "Hive": "apachehive", "GCP": "googlecloud",
    "Google Cloud": "googlecloud", "Google Cloud Platform": "googlecloud",
    "AWS": "amazonwebservices", "Azure": "azure", "Microsoft Azure": "azure",
    ".NET": "dotnetcore", "C#": "csharp", "C++": "cplusplus",
    "CSS": "css3", "HTML": "html5", "Scikit-learn": "scikitlearn",
    "SQL Server": "microsoftsqlserver", "MS SQL Server": "microsoftsqlserver",
    "GitLab Pipeline": "gitlab", "GitHub Actions": "githubactions",
    "GitHub Copilot": "githubcopilot", "BigQuery": "googlebigquery",
    "Google BigQuery": "googlebigquery", "mongo": "mongodb",
    "Postgres extension development": "postgresql", "pgvector": "postgresql",
    "WordPress Plug-in": "wordpress", "WordPress": "wordpress",
    "JPA/Hibernate": "hibernate", "Redux Toolkit": "redux",
    "Linux Server": "linux", "Vue": "vuejs", "React": "react",
    "Angular": "angular", "Node.js": "nodejs", "Next.js": "nextjs",
    "Visual Basic": "visualbasic", "VB": "visualbasic", "SCSS": "sass",
    "R": "r", "Maven": "maven", "Gradle": "gradle",
    "OpenAI APIs": "openai", "Claude Code": "claude", "LLaMA": "meta",
    "Microsoft Power BI": "powerbi", "Power BI": "powerbi",
    "Google Sheets": "googlesheets", "Microsoft Excel": "microsoftexcel",
    "Excel": "microsoftexcel", "MS Excel": "microsoftexcel",
    "Microsoft Access": "microsoftaccess", "MS Access": "microsoftaccess",
    "Microsoft Office 365 tools": "microsoftoffice", "SFDC": "salesforce",
    "AWS DynamoDB": "dynamodb", "Redshift": "amazonredshift",
    "S3": "amazons3", "Terraform": "terraform", "Apache Airflow": "apacheairflow",
    ".NET Core": "dotnetcore", "Azure Databricks": "databricks",
}


def main():
    commit = json.loads(fetch("https://api.github.com/repos/devicons/devicon/commits/master"))["sha"]
    base = f"https://raw.githubusercontent.com/devicons/devicon/{commit}"
    upstream = json.loads(fetch(f"{base}/devicon.json"))
    available = {i["name"]: i for i in upstream}
    lookup = {key(i["name"]): i["name"] for i in upstream}
    overrides = {key(n): slug for n, slug in OVERRIDES.items()}
    catalog = json.loads(CATALOG.read_text(encoding="utf-8-sig"))
    matches = {}
    for skill in catalog:
        for name in [skill["skill_name"], *skill["aliases"]]:
            slug = overrides.get(key(name), lookup.get(key(name)))
            if slug in available:
                matches[str(skill["skill_id"])] = slug
                break

    def download(slug):
        variants = available[slug]["versions"]["svg"]
        variant = next((v for v in ("original", "plain", "line", "original-wordmark", "plain-wordmark") if v in variants), variants[0])
        path = f"icons/{slug}/{slug}-{variant}.svg"
        svg = fetch(f"{base}/{path}")
        if b"<svg" not in svg or b"<script" in svg:
            raise ValueError(f"Unexpected SVG for {slug}")
        (ASSETS / f"{slug}.svg").write_bytes(svg)
        return slug, path

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        sources = dict(pool.map(download, sorted(set(matches.values()))))

    # Simple Icons supplies brands absent from Devicon (notably BI and Microsoft tools).
    # Pin the release and preserve its CC0 distribution license separately.
    simple_base = "https://raw.githubusercontent.com/simple-icons/simple-icons/11.15.0"
    simple = json.loads(fetch(f"{simple_base}/_data/simple-icons.json"))["icons"]
    extra_names = {
        "Microsoft Excel": "microsoftexcel", "Microsoft Access": "microsoftaccess",
        "MS Access": "microsoftaccess", "Microsoft Office 365 tools": "microsoftoffice",
        "Power BI": "powerbi", "Microsoft Power BI": "powerbi", "Tableau": "tableau",
        "Databricks": "databricks", "Azure Databricks": "databricks", "dbt": "dbt",
        "Snowflake": "snowflake", "Looker": "looker", "Looker Studio": "looker",
        "Google Sheets": "googlesheets", "Google Analytics": "googleanalytics",
        "OpenAI": "openai", "OpenAI APIs": "openai", "ChatGPT": "openai",
        "Anthropic": "anthropic", "Claude": "anthropic", "Claude Code": "anthropic",
        "Superset": "apachesuperset", "Metabase": "metabase", "Airbyte": "airbyte",
        "Hugging Face": "huggingface", "Power Platform": "powerapps",
        "Power Query": "powerquery", "SAP": "sap", "TikTok": "tiktok",
        "Tiktok Ads": "tiktok", "TikTok Business Center": "tiktok",
        "Google BigQuery": "googlebigquery", "BigQuery": "googlebigquery",
        "Data Studio": "googledatastudio", "Delta Lake": "delta",
    }
    # All override slugs below use ASCII brand names, matching Simple Icons' slug rules.
    simple_lookup = {key(i["title"]): i for i in simple}
    # Exact canonical/alias matches cover additional brands without maintaining a hand list.
    for skill in catalog:
        if str(skill["skill_id"]) in matches:
            continue
        for name in [skill["skill_name"], *skill["aliases"]]:
            info = simple_lookup.get(key(name))
            if info and info["title"].isascii():
                slug = re.sub(r"[^a-z0-9]", "", info["title"].lower().replace("+", "plus").replace(".", "dot").replace("#", "sharp").replace("&", "and"))
                extra_names[skill["skill_name"]] = slug
                break
    extra_sources = {}
    for name, slug in extra_names.items():
        rows = [s for s in catalog if key(s["skill_name"]) == key(name) and str(s["skill_id"]) not in matches]
        if not rows:
            continue
        info = next((i for i in simple if key(i["title"]) == key(slug)), simple_lookup.get(key(name)))
        if not info:
            continue
        filename = f"simple-{slug}"
        if filename not in extra_sources:
            svg = fetch(f"{simple_base}/icons/{slug}.svg").decode("utf-8")
            svg = svg.replace('<svg ', f'<svg fill="#{info["hex"]}" ', 1)
            (ASSETS / f"{filename}.svg").write_text(svg, encoding="utf-8")
            extra_sources[filename] = f"icons/{slug}.svg"
        for skill in rows:
            matches[str(skill["skill_id"])] = filename
    (ASSETS / "LICENSE.simple-icons").write_bytes(fetch(f"{simple_base}/LICENSE.md"))
    manifest = {"source": "https://github.com/devicons/devicon", "commit": commit,
                "skills": matches, "files": sources,
                "simpleIcons": {"source": "https://github.com/simple-icons/simple-icons", "version": "11.15.0", "files": extra_sources}}
    (ASSETS / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared {len(sources) + len(extra_sources)} logos for {len(matches)} of {len(catalog)} skills; remaining skills use symbols or initials.")


if __name__ == "__main__":
    main()
