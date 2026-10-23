const vibrantColors = [
  'from-rose-600 to-pink-700',
  'from-orange-600 to-orange-700',
  'from-emerald-600 to-emerald-700',
  'from-teal-600 to-teal-700',
  'from-cyan-600 to-cyan-700',
  'from-blue-600 to-blue-700',
  'from-indigo-600 to-indigo-700',
  'from-violet-600 to-purple-700',
  'from-fuchsia-600 to-fuchsia-700',
  'from-pink-600 to-rose-700',
]

/** Stable variety across lists, filters, and reloads for the same company. */
export function companyAvatarColor(company: string) {
  const name = company.trim().toLowerCase().replace(/\s+/g, ' ')
  let hash = 0
  for (const character of name) hash = (Math.imul(hash, 31) + (character.codePointAt(0) ?? 0)) >>> 0
  return `border border-white/60 bg-gradient-to-br text-white shadow-sm ${vibrantColors[hash % vibrantColors.length]}`
}
