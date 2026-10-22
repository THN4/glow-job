import type { LevelCheckTarget } from './types'

export function capitalize(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text
}

/** "Intermediate · Level checked by quiz", or "Not assessed" when the profile has no level. */
export function levelLabel(target: LevelCheckTarget | undefined): string {
  if (!target) return 'Not assessed'
  if (!target.level) return target.inProfile ? 'Not assessed' : 'Not in your profile yet'
  return `${capitalize(target.level)} · ${target.reason}`
}

/** One-tap self ratings for the quick question. */
export const QUICK_ANSWERS = [
  { label: 'Just starting', level: 'beginner' },
  { label: 'I use it on my own', level: 'intermediate' },
  { label: 'I could teach it', level: 'advanced' },
] as const
