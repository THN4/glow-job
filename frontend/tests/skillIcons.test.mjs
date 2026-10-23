import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import catalog from '../src/lib/skillIconCatalog.json' with { type: 'json' }
import { resolveSkillIcon } from '../src/lib/skillIcons.ts'

test('every exported database skill has a usable icon and every logo exists locally', () => {
  assert.equal(new Set(catalog.map(s => s.skill_id)).size, catalog.length)
  assert.ok(catalog.length >= 539)
  for (const skill of catalog) {
    const icon = resolveSkillIcon(skill.skill_name, skill.skill_id)
    assert.ok(['logo', 'symbol', 'initials'].includes(icon.kind), skill.skill_name)
    assert.ok(icon.name && icon.name !== '?', skill.skill_name)
    if (icon.kind === 'logo') {
      const path = new URL(`../src/assets/technology/${icon.name}.svg`, import.meta.url)
      assert.ok(existsSync(path), skill.skill_name)
      assert.match(readFileSync(path, 'utf8'), /<svg\b/)
    }
    assert.deepEqual(resolveSkillIcon(skill.skill_name), icon, skill.skill_name)
  }
})

test('canonical identities and aliases resolve without substring collisions', () => {
  for (const [name, expected] of [['Java', 'java'], ['JavaScript', 'javascript'], ['C#', 'csharp'], ['C++', 'cplusplus'], ['R', 'r'], ['React', 'react'], ['Golang', 'go'], ['NodeJS', 'nodejs'], ['airflow', 'apacheairflow'], ['MS Excel', 'simple-microsoftexcel']]) {
    assert.deepEqual(resolveSkillIcon(name), { kind: 'logo', name: expected })
  }
  assert.deepEqual(resolveSkillIcon('  PYTHON  '), resolveSkillIcon('Python'))
  assert.notEqual(resolveSkillIcon('JavaScript interview preparation').kind, 'logo')
  assert.notEqual(resolveSkillIcon('GitHub Copilot').name, 'github')
  assert.notEqual(resolveSkillIcon('RAG').name, 'r')
})

test('concepts and unfamiliar skills never impersonate a technology brand', () => {
  assert.deepEqual(resolveSkillIcon('SQL'), { kind: 'symbol', name: 'database' })
  assert.deepEqual(resolveSkillIcon('CI/CD'), { kind: 'symbol', name: 'workflow' })
  assert.deepEqual(resolveSkillIcon('AOS'), { kind: 'initials', name: 'AO' })
  assert.deepEqual(resolveSkillIcon('Unknown product'), { kind: 'initials', name: 'UP' })
  assert.deepEqual(resolveSkillIcon('Unknown product', 999999), { kind: 'initials', name: 'UP' })
  assert.deepEqual(resolveSkillIcon('Old display name', 91), { kind: 'logo', name: 'python' })
})
