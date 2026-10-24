import assert from 'node:assert/strict'
import test from 'node:test'
import { hasProfileInformation, profileFromCv } from '../src/features/onboarding/profileFromCv.ts'

const empty = { education: [], technicalSkills: [], projects: [], experience: [], certifications: [] }
test('documents without extracted information remain empty', () => {
  const profile = profileFromCv(empty)
  assert.equal(hasProfileInformation(profile), false)
  assert.equal(profile.education, null)
  assert.deepEqual(profile.skills, [])
})
test('blank extracted rows do not trigger recommendations', () => {
  assert.equal(hasProfileInformation(profileFromCv({ ...empty, education: [{}], technicalSkills: [{ name: ' ' }], projects: [{}], experience: [{}], certifications: [{}] })), false)
})
test('real skills are preserved and deduplicated without inventing proficiency', () => {
  const profile = profileFromCv({ ...empty, technicalSkills: [{ name: 'Python' }, { name: 'python' }, { name: 'Docker', proficiency: 'beginner' }] })
  assert.equal(hasProfileInformation(profile), true)
  assert.equal(profile.skills.length, 2)
  assert.equal(profile.skills[0].level, 'unknown')
  assert.equal(profile.skills[1].level, 'beginner')
})
