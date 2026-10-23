import catalog from './skillIconCatalog.json' with { type: 'json' }
import manifest from '../assets/technology/manifest.json' with { type: 'json' }

export type SkillIconSpec = { kind: 'logo'; name: string } | { kind: 'symbol'; name: string } | { kind: 'initials'; name: string }

// Preserve meaningful punctuation: C, C++, C#, .NET and R are different identities.
export const skillIconKey = (name: string) => name.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ')
const byId = new Map(catalog.map(skill => [skill.skill_id, skill]))
const byName = new Map<string, typeof catalog[number]>()
// Canonical names take priority over aliases belonging to another skill.
for (const skill of catalog) byName.set(skillIconKey(skill.skill_name), skill)
for (const skill of catalog) for (const alias of skill.aliases) {
  if (!byName.has(skillIconKey(alias))) byName.set(skillIconKey(alias), skill)
}
const logos: Record<string, string> = manifest.skills

const categories: Record<string, string> = {
  database: 'database', query_language: 'database', programming_language: 'code',
  data_framework: 'layers', data_tool: 'chart', data_practice: 'chart',
  container_tool: 'container', orchestration_tool: 'workflow',
}
const concepts: Array<[RegExp, string]> = [
  [/\b(security|owasp|pdpa|governance|risk|identity|firewall|basel|ifrs|icaap)\b/, 'shield'],
  [/\b(test|tests|testing|tdd|validation|quality)\b/, 'test'],
  [/\b(ai|ml|llm|llms|learning|neural|models|model|rag|prompting|inference|quantization|fine-tuning|natural language processing|computer vision|embeddings|knowledge graphs|algorithms|tool calling|function calling|multimodal|sft|dpo)\b/, 'brain'],
  [/\b(cloud|serverless|azure|aws|gcp)\b/, 'cloud'],
  [/\b(api|apis|rpc|websocket|integration|integrations|network|mqtt|modbus|opc|message queuing|messaging middleware|distributed systems|iot)\b/, 'network'],
  [/\b(architecture|design patterns|system design|solid|microservices|data structures|object-oriented design)\b/, 'layers'],
  [/\b(etl|elt|pipeline|pipelines|workflow|orchestration|automation|ci\/cd|devops)\b/, 'workflow'],
  [/\b(database|databases|sql|warehouse|warehousing|lakehouse|metadata|data modeling|data modelling|vector search)\b/, 'database'],
  [/\b(analytics|analysis|statistics|statistical|probability|regression|clustering|visualization|bi|pricing|business intelligence|data science|time series|anomaly detection|price elasticity)\b/, 'chart'],
  [/\b(programming|scripting|code|coding|development|web|regex|json|xml|yaml|front-end|full stack|responsive design|debugging)\b/, 'code'],
  [/\b(engineering|mechanical|electrical|hvac|plumbing|maintenance|power distribution)\b/, 'wrench'],
  [/\b(agile|scrum|project management|process improvement|sops)\b/, 'workflow'],
]

export function resolveSkillIcon(name: string, skillId?: number): SkillIconSpec {
  // IDs are authoritative when provided by the API. Unknown IDs can still resolve by name.
  const skill = (skillId === undefined ? undefined : byId.get(skillId)) ?? byName.get(skillIconKey(name))
  const logo = skill ? logos[String(skill.skill_id)] : undefined
  if (logo) return { kind: 'logo', name: logo }
  const canonical = skillIconKey(skill?.skill_name ?? name)
  const concept = concepts.find(([pattern]) => pattern.test(canonical))?.[1]
  const symbol = concept ?? categories[skill?.skill_category ?? '']
  if (symbol) return { kind: 'symbol', name: symbol }
  const words = (skill?.skill_name ?? name).match(/[\p{L}\p{N}+#]+/gu) ?? []
  const initials = words.length > 1 ? words.slice(0, 2).map(word => word[0]).join('') : (words[0] ?? '?').slice(0, 2)
  return { kind: 'initials', name: initials.toUpperCase() }
}
