"""Optional PostgreSQL checks; every schema/data change is rolled back.

Enable with RAG_POSTGRES_CHECKS=1 on a database that has migrations 001-013
but no skill_dependencies table yet. Existing dependency tables are never used.
"""

import os
from pathlib import Path
import unittest


@unittest.skipUnless(os.getenv("RAG_POSTGRES_CHECKS") == "1", "PostgreSQL checks are opt-in")
class DependencyMigrationTests(unittest.TestCase):
    def setUp(self):
        from scripts.rag._database import connect
        self.connection = connect()
        self.connection.autocommit = True
        self.addCleanup(self.connection.close)
        exists = self.connection.execute("SELECT to_regclass('knowledge.skill_dependencies')").fetchone()[0]
        if exists:
            self.skipTest("Existing dependency table must not be touched by this rollback check")
        self.transaction = self.connection.transaction(force_rollback=True)
        self.transaction.__enter__()
        self.addCleanup(self.transaction.__exit__, None, None, None)
        migration = Path(__file__).resolve().parents[2] / "data-pipeline/migrations/versions/014_create_skill_dependencies.sql"
        # Match the repository migration runner's statement boundaries.
        for statement in migration.read_text(encoding="utf-8").split(";"):
            if statement.strip():
                self.connection.execute(statement)
        skills = self.connection.execute("SELECT skill_id FROM core.skills ORDER BY skill_id LIMIT 2").fetchall()
        sources = self.connection.execute("SELECT source_id FROM knowledge.knowledge_sources ORDER BY source_id LIMIT 1").fetchall()
        if len(skills) < 2 or not sources:
            self.skipTest("Two canonical skills and one source are required for rollback checks")
        self.prerequisite, self.target, self.source = skills[0][0], skills[1][0], sources[0][0]

    def insert(self, *, verified=False, source=None, evidence=None, target=None):
        return self.connection.execute("""
            INSERT INTO knowledge.skill_dependencies (
                prerequisite_skill_id, target_skill_id, dependency_type,
                strength, source_id, evidence_text, is_verified
            ) VALUES (%s, %s, 'prerequisite', 'required', %s, %s, %s)
            RETURNING is_verified
        """, (self.prerequisite, self.target if target is None else target, source, evidence, verified)).fetchone()[0]

    def test_proposal_can_wait_for_evidence_but_cannot_be_verified_without_it(self):
        from psycopg.errors import CheckViolation
        self.assertFalse(self.insert())
        with self.assertRaises(CheckViolation):
            with self.connection.transaction():
                self.connection.execute("UPDATE knowledge.skill_dependencies SET is_verified = true")

    def test_verified_relationship_requires_nonblank_evidence_and_a_source(self):
        from psycopg.errors import CheckViolation
        for source, text in ((None, "Temporary test evidence"), (self.source, "  ")):
            with self.assertRaises(CheckViolation):
                with self.connection.transaction():
                    self.insert(verified=True, source=source, evidence=text)
        self.assertTrue(self.insert(verified=True, source=self.source, evidence="Temporary test evidence"))

    def test_self_dependency_is_rejected(self):
        from psycopg.errors import CheckViolation
        with self.assertRaises(CheckViolation):
            with self.connection.transaction():
                self.insert(target=self.prerequisite)

    def test_duplicate_edge_is_rejected(self):
        from psycopg.errors import UniqueViolation
        self.insert()
        with self.assertRaises(UniqueViolation):
            with self.connection.transaction():
                self.insert()


if __name__ == "__main__":
    unittest.main()
