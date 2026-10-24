import { PROFILE_SECTIONS, type Profile, type ProfileSection } from '../features/onboarding/types'

export function hasRequiredSkillLevels(profile: Pick<Profile, 'skills'>): boolean {
  return profile.skills.every((skill) => skill.level !== null)
}

export function isProfileReviewComplete(profile: Profile): boolean {
  return profile.user_confirmed && hasRequiredSkillLevels(profile)
}

function withReviewStatus(profile: Profile, reviewed: boolean): Profile {
  const confirmed = reviewed && hasRequiredSkillLevels(profile)
  return {
    ...profile,
    user_confirmed: confirmed,
    education: profile.education ? { ...profile.education, confirmed } : null,
  }
}

export function markProfileReviewed(profile: Profile): Profile {
  return withReviewStatus(profile, true)
}

function sectionContent(profile: Profile, section: ProfileSection) {
  if (section === 'education' && profile.education) {
    const { degree, school, period } = profile.education
    return { degree, school, period }
  }
  return profile[section]
}

export function applyProfileChanges(profile: Profile, updates: Partial<Profile>): Profile {
  const updated = { ...profile, ...updates }
  const changed = PROFILE_SECTIONS.some((section) =>
    JSON.stringify(sectionContent(profile, section)) !== JSON.stringify(sectionContent(updated, section)),
  )
  // Only continuing from Review acknowledges the profile; edit forms cannot do so.
  return withReviewStatus(updated, profile.user_confirmed && !changed)
}
