"""Optional read-only checks against saved Market/Resume data."""

import os
import unittest

from rag.context.repository import load_inputs


@unittest.skipUnless(os.getenv("RAG_POSTGRES_CHECKS") == "1", "PostgreSQL checks are opt-in")
class ContextRepositoryTests(unittest.TestCase):
    def setUp(self):
        from scripts.rag._database import connect
        self.connection = connect()
        self.addCleanup(self.connection.close)

    def scalar_read(self, sql, params=()):
        with self.connection.transaction():
            self.connection.execute("SET TRANSACTION READ ONLY")
            return self.connection.execute(sql, params).fetchone()

    def test_date_basis_keeps_different_snapshots_separate(self):
        row = self.scalar_read("""
            SELECT s.career_profile_id FROM market.career_skill_stats s
            JOIN core.career_profiles p USING (career_profile_id)
            JOIN core.careers c USING (career_id)
            WHERE p.is_active AND c.is_active
            GROUP BY s.career_profile_id
            HAVING count(DISTINCT s.analysis_date_basis) = 2
            ORDER BY s.career_profile_id LIMIT 1
        """)
        if row is None:
            self.skipTest("No active career has both date bases")
        for basis in ("posted_at", "first_seen_at"):
            context = load_inputs(self.connection, career_profile_id=row[0], date_basis=basis)
            self.assertEqual(context.market.window.analysis_date_basis, basis)
            window = context.market.window
            expected = self.scalar_read("""
                SELECT count(*) FROM market.career_skill_stats
                WHERE career_profile_id = %s AND analysis_date_basis = %s
                  AND analysis_start_date = %s AND analysis_end_date = %s
            """, (row[0], basis, window.analysis_start_date, window.analysis_end_date))[0]
            self.assertEqual(len(context.market.skills), expected)

    def test_saved_profile_preserves_confirmed_and_unresolved_counts(self):
        row = self.scalar_read("""
            SELECT u.profile_id, p.career_profile_id FROM app.user_profiles u
            CROSS JOIN core.career_profiles p JOIN core.careers c USING (career_id)
            WHERE p.is_active AND c.is_active
            ORDER BY u.user_id, p.career_profile_id LIMIT 1
        """)
        if row is None:
            self.skipTest("No saved profile is available")
        context = load_inputs(self.connection, profile_id=row[0], career_profile_id=row[1])
        expected = self.scalar_read("""
            SELECT count(*) FILTER (WHERE s.match_status = 'matched'),
                   count(*) FILTER (WHERE s.match_status <> 'matched')
            FROM app.user_skills s JOIN app.user_profiles p USING (user_id)
            WHERE p.profile_id = %s AND s.user_confirmed
        """, (row[0],))
        self.assertEqual(len(context.user.confirmed_skills), expected[0])
        self.assertEqual(len(context.user.unresolved_skills), expected[1])
        self.assertNotIn("auth_subject", context.model_dump_json())

    def test_caller_transaction_is_not_silently_reused(self):
        with self.connection.transaction():
            self.connection.execute("SET TRANSACTION READ ONLY")
            with self.assertRaisesRegex(ValueError, "idle connection"):
                load_inputs(self.connection, career_profile_id=1)


if __name__ == "__main__":
    unittest.main()
