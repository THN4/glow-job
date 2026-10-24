import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/features/roadmap/profileUpdates.ts', import.meta.url), 'utf8')
const uuidUrl = new URL('../src/lib/uuid.ts', import.meta.url).href
const { outputText } = ts.transpileModule(source.replace('../../lib/uuid.ts', uuidUrl), { compilerOptions: { module: ts.ModuleKind.ESNext } })
const { applyProfileUpdates } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

const profile = () => ({
  schemaVersion: 1,
  personal: { fullName: 'Jane Doe', headline: 'Developer', email: 'jane@example.com', source: 'cv' },
  summary: 'Saved summary', education: [{ id: 'education', degree: 'BSc' }],
  technicalSkills: [
    { id: 'python', name: 'Python', proficiency: 'beginner', proficiencyBasis: 'inferred', category: 'language', catalogMatch: { skillId: 42 }, evidence: [{ text: 'Original CV evidence' }] },
    { id: 'git', name: 'Git', proficiency: 'advanced', proficiencyBasis: 'explicit' },
  ],
  projects: [{ id: 'api', name: 'Portfolio API', description: 'Existing description', url: 'https://example.com/api', technologies: ['Python'], role: 'Developer', startDate: '2025' }],
  experience: [{ id: 'work', title: 'Developer' }], certifications: [], softSkills: [], tools: [], languages: [{ name: 'Thai' }],
})
const fields = (entries = {}) => {
  const form = new FormData()
  for (const [name, value] of Object.entries(entries)) form.set(name, value)
  return form
}

test('each skill saves its own level while all unrelated profile data and skills remain unchanged', () => {
  const original = profile()
  const before = structuredClone(original)
  const updated = applyProfileUpdates(original, fields(), [
    { name: 'python', level: 'expert' }, { name: 'Docker', level: 'intermediate' },
  ])
  assert.equal(updated.technicalSkills.length, 3)
  assert.equal(updated.technicalSkills[0].id, 'python')
  assert.equal(updated.technicalSkills[0].proficiency, 'expert')
  assert.equal(updated.technicalSkills[0].proficiencyBasis, 'explicit')
  assert.deepEqual(updated.technicalSkills[0].catalogMatch, original.technicalSkills[0].catalogMatch)
  assert.deepEqual(updated.technicalSkills[0].evidence, original.technicalSkills[0].evidence)
  assert.deepEqual(updated.technicalSkills[1], original.technicalSkills[1])
  assert.equal(updated.technicalSkills[2].proficiency, 'intermediate')
  for (const key of ['personal', 'summary', 'education', 'experience', 'languages', 'projects']) assert.deepEqual(updated[key], original[key])
  assert.deepEqual(original, before)
})

test('choosing Unknown explicitly resets only that skill to an unspecified level', () => {
  const updated = applyProfileUpdates(profile(), fields(), [{ name: 'Git', level: 'unknown' }])
  assert.equal(updated.technicalSkills[1].proficiency, 'unknown')
  assert.equal(updated.technicalSkills[1].proficiencyBasis, 'unknown')
  assert.equal(updated.technicalSkills[0].proficiency, 'beginner')
})

test('a new project links the selected skills and their evidence without sharing their levels', () => {
  const form = fields({ projectName: 'Data dashboard', projectDescription: 'Built a dashboard', projectUrl: 'https://example.com/dashboard', evidence: 'Used both skills in the dashboard' })
  const skills = [{ name: 'SQL', level: 'advanced' }, { name: 'React', level: 'beginner' }]
  const updated = applyProfileUpdates(profile(), form, skills)
  const project = updated.projects.at(-1)
  assert.deepEqual(project.technologies, ['SQL', 'React'])
  assert.equal(project.description, 'Built a dashboard')
  for (const skill of updated.technicalSkills.slice(-2)) {
    assert.equal(skill.evidence[0].itemId, project.id)
    assert.equal(skill.evidence[0].evidenceType, 'project')
  }
  assert.equal(updated.technicalSkills.at(-2).proficiency, 'advanced')
  assert.equal(updated.technicalSkills.at(-1).proficiency, 'beginner')
  // Retrying after a successful save must not duplicate projects or evidence.
  assert.deepEqual(applyProfileUpdates(updated, form, skills), updated)
})

test('existing project edits preserve saved metadata and add newly learned technologies', () => {
  const updated = applyProfileUpdates(profile(), fields({ projectName: ' portfolio api ', projectDescription: 'Updated details' }), [{ name: 'Docker', level: 'beginner' }])
  assert.equal(updated.projects.length, 1)
  assert.equal(updated.projects[0].id, 'api')
  assert.equal(updated.projects[0].role, 'Developer')
  assert.equal(updated.projects[0].startDate, '2025')
  assert.equal(updated.projects[0].url, 'https://example.com/api')
  assert.equal(updated.projects[0].description, 'Updated details')
  assert.deepEqual(updated.projects[0].technologies, ['Python', 'Docker'])
})

test('missing levels, duplicate skill names and incomplete project/evidence inputs are rejected', () => {
  const original = profile()
  const before = structuredClone(original)
  assert.throws(() => applyProfileUpdates(original, fields(), [{ name: 'SQL', level: null }]), /proficiency level for SQL/)
  assert.throws(() => applyProfileUpdates(original, fields(), [{ name: 'SQL', level: 'beginner' }, { name: ' sql ', level: 'expert' }]), /only once/)
  assert.throws(() => applyProfileUpdates(original, fields({ projectDescription: 'Missing name' }), []), /project name/)
  assert.throws(() => applyProfileUpdates(original, fields({ evidence: 'Missing skills' }), []), /skill names/)
  assert.deepEqual(original, before)
})

test('re-planning without profile updates leaves the saved profile intact', () => {
  const original = profile()
  assert.deepEqual(applyProfileUpdates(original, fields({ notes: 'Focus on backend projects' }), []), original)
})
