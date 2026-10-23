"""Opt-in paid smoke test with synthetic CV/evidence only; no DB or embeddings."""

import argparse
import asyncio
import hashlib
import json

from src.documents.retrieval.skill_context import review_content
from src.documents.schemas.skill_context import ContextRequest, RetrievedChunk
from src.resume.config import ResumeModelSettings
from src.resume.extraction.contracts import PreparedCv
from src.resume.extraction.providers import create_extractor
from src.shared.llm.bedrock_client import BedrockTextSettings


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--allow-spend", action="store_true", help="Allow paid Nova Pro calls")
    args = parser.parse_args()
    if not args.allow_spend:
        parser.error("Pass --allow-spend to authorize the synthetic paid smoke test")
    cfg = ResumeModelSettings(RESUME_EXTRACTOR="bedrock_converse")
    extractor = create_extractor(cfg)
    result = asyncio.run(extractor.extract(PreparedCv(kind="text", page_count=1, text=(
        "Alex Example\nSoftware Developer\nSkills: Python (advanced), Git\n"
        "Education: B.Sc. Computer Science, Example University, 2024\n"
    ))))
    assert result.extraction.is_document_a_cv
    assert result.extraction.personal.full_name == "Alex Example"
    assert any(skill.name.casefold() == "python" for skill in result.extraction.technical_skills)
    passage = "Git records changes to files in a repository. Use git init to create a repository and git add to stage files."
    chunk = RetrievedChunk(chunk_id=1, source_id=1, title="Synthetic Git lesson", source_url=None,
                           content=passage, content_hash=hashlib.sha256(passage.encode()).hexdigest(),
                           retrieval_score=0.9)
    reviewed = review_content({"skill_id": 1, "skill_name": "Git"}, ContextRequest(skill_ids=[1]),
                              "Foundational concepts and learning topics for Git", [chunk])
    assert reviewed.status in {"supported", "partial"}
    assert reviewed.claims
    print(json.dumps({"cv_provider": extractor.provider, "cv_model": extractor.name,
                      "cv_schema": "passed", "rag_model": BedrockTextSettings().BEDROCK_RAG_MODEL,
                      "rag_citations": "passed", "claims": len(reviewed.claims),
                      "database_writes": False}))


if __name__ == "__main__":
    main()
