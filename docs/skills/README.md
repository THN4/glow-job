# Skill icons

`frontend/src/components/SkillIcon.tsx` is the shared renderer for skill profile,
roadmap skill nodes, and assessment skill cards. `frontend/src/lib/skillIcons.ts`
resolves canonical IDs, exact names and database aliases. It preserves punctuation
and never guesses a product from a substring (Java, JavaScript, C# and C++ remain
distinct). Projects and career activities retain icons for their node kinds.

The catalog snapshot covers all 539 skills in the local application database as
of 2026-10-23. Matching brands use bundled SVGs; general skills use topic symbols;
ambiguous names and unsupported brands use initials. Newly introduced names get
the same safe symbol/initial fallback until the catalog is refreshed.

Open [the visual inventory](skill-icon-audit.html) to search every skill by name,
alias or ID and filter branded logos, symbols and initials. It is a standalone
HTML file; it does not need the app or an internet connection.

## Refresh

Export the following read-only query as UTF-8 JSON into
`frontend/src/lib/skillIconCatalog.json` from the intended application database:

```sql
SELECT json_agg(s) FROM (
  SELECT skill_id, skill_name, skill_category,
    COALESCE((SELECT json_agg(alias) FROM core.skill_aliases a
              WHERE a.skill_id = s.skill_id), '[]') AS aliases
  FROM core.skills s ORDER BY skill_id
) s;
```

From the repository root, run `python scripts/prepare_skill_icons.py` to download
logos and update the source manifest. This requires internet access and performs
no database writes. Explicit identity mappings live in that script. Review the
manifest and inventory when updating upstream assets.

From `frontend`, run:

```sh
node --experimental-strip-types --test tests/skillIcons.test.mjs
node --experimental-strip-types scripts/audit-skill-icons.mjs
npm run build
```

The tests verify coverage of the snapshot, local logo existence, name/alias
resolution and common identity collisions. Refreshing assets or the catalog also
requires regenerating the inventory.
