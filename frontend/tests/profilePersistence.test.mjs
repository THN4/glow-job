import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/features/onboarding/api/profilePersistence.ts', import.meta.url), 'utf8')
const uuidUrl = new URL('../src/lib/uuid.ts', import.meta.url).href
const { outputText } = ts.transpileModule(source.replace('../../../lib/uuid.ts', uuidUrl), { compilerOptions: { module: ts.ModuleKind.ESNext } })
const { toSavedCvProfile } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
const empty = () => ({ education: null, skills: [], projects: [], experience: [], certifications: [], user_confirmed: true })

test('manual review creates a complete API profile and explicit skill levels', () => {
  const saved = toSavedCvProfile({ ...empty(), skills: [{ name: 'Python', level: 'advanced' }],
    education: { degree: 'BSc', school: 'University', period: '2020 – 2024', confirmed: true },
    experience: [{ role: 'Developer', company: 'Example', period: '2024-01 – Present', description: '', skills: ['Python'] }] })
  assert.equal(saved.personal.source, 'user')
  assert.equal(saved.technicalSkills[0].proficiencyBasis, 'explicit')
  assert.equal(saved.education[0].startDate, '2020')
  assert.equal(saved.experience[0].isCurrent, true)
  assert.equal(saved.experience[0].endDate, null)
  assert.deepEqual(saved.languages, [])
  assert.ok(saved.technicalSkills[0].id)
})

test('CV review preserves hidden details, removes deleted items and applies edits', () => {
  const original = { schemaVersion: 1, personal: { fullName: 'Jane' }, summary: 'Summary',
    education: [{ id: 'edu1', degree: 'BSc', institution: 'University', fieldOfStudy: 'CS', startDate: '2020', endDate: '2024' }, { id: 'edu2' }],
    technicalSkills: [{ id: 'skill1', name: 'Python', category: 'language', evidence: [{ text: 'Built tools' }] }, { id: 'skill2', name: 'SQL' }],
    projects: [{ id: 'project1', name: 'App', url: 'https://example.com' }], experience: [], certifications: [],
    softSkills: [{ name: 'Teamwork' }], tools: [], languages: [{ name: 'Thai' }] }
  const before = structuredClone(original)
  const saved = toSavedCvProfile({ ...empty(),
    education: { degree: 'BSc', school: 'Updated University', period: '2020 – 2024', confirmed: true },
    skills: [{ name: 'Python', level: 'expert' }],
    projects: [{ name: 'App', description: 'Edited', skills: ['Python'] }] }, original)
  assert.equal(saved.personal.fullName, 'Jane')
  assert.deepEqual(saved.languages, original.languages)
  assert.equal(saved.education.length, 2)
  assert.equal(saved.education[0].fieldOfStudy, 'CS')
  assert.equal(saved.education[0].institution, 'Updated University')
  assert.equal(saved.technicalSkills.length, 1)
  assert.equal(saved.technicalSkills[0].id, 'skill1')
  assert.equal(saved.technicalSkills[0].proficiency, 'expert')
  assert.deepEqual(saved.technicalSkills[0].evidence, original.technicalSkills[0].evidence)
  assert.equal(saved.projects[0].url, 'https://example.com')
  assert.equal(saved.projects[0].description, 'Edited')
  assert.deepEqual(original, before)
})
