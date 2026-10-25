"""Read existing Gemini document vectors; no model calls or profile-data egress."""

GEMINI_MODEL = "gemini-embedding-2"


def skill_similarities(connection, user_skill_ids: set[int], requirement_ids: set[int]) -> dict[int, float]:
    """Best cosine similarity to a confirmed skill's document centroid.

    Only active, same-model, nonzero 768-dimensional vectors participate.
    Missing document coverage stays missing; related skills are not credentials.
    """
    if not user_skill_ids or not requirement_ids:
        return {}
    rows = connection.execute(
        """
        WITH centroids AS MATERIALIZED (
            SELECT m.skill_id, avg(c.embedding) AS embedding
            FROM knowledge.knowledge_chunk_skills m
            JOIN knowledge.knowledge_chunks c USING (chunk_id)
            JOIN knowledge.knowledge_sources s USING (source_id)
            WHERE s.is_active AND c.embedding IS NOT NULL
              AND c.embedding_model = %s AND vector_dims(c.embedding) = 768
              AND vector_norm(c.embedding) > 0
              AND m.skill_id = ANY(%s)
            GROUP BY m.skill_id
        )
        SELECT r.skill_id, max(1 - (r.embedding <=> u.embedding))
        FROM centroids r CROSS JOIN centroids u
        WHERE r.skill_id = ANY(%s) AND u.skill_id = ANY(%s)
          AND vector_norm(r.embedding) > 0 AND vector_norm(u.embedding) > 0
        GROUP BY r.skill_id
        """,
        (GEMINI_MODEL, sorted(user_skill_ids | requirement_ids),
         sorted(requirement_ids), sorted(user_skill_ids)),
    ).fetchall()
    return {skill_id: max(0.0, min(1.0, float(score))) for skill_id, score in rows}
