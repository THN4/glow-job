import { BrainCircuit, ChartNoAxesCombined, Cloud, Code2, Container, Database, Layers3, Network, ShieldCheck, TestTubeDiagonal, Workflow, Wrench, type LucideIcon } from 'lucide-react'
import { resolveSkillIcon } from '../lib/skillIcons'

const logos = import.meta.glob('../assets/technology/*.svg', { eager: true, query: '?url&no-inline', import: 'default' }) as Record<string, string>
const symbols: Record<string, LucideIcon> = {
  brain: BrainCircuit, chart: ChartNoAxesCombined, cloud: Cloud, code: Code2,
  container: Container, database: Database, layers: Layers3, network: Network,
  shield: ShieldCheck, test: TestTubeDiagonal, workflow: Workflow, wrench: Wrench,
}

/** Decorative: the adjacent skill name supplies the accessible label. No remote image requests. */
export function SkillIcon({ name, skillId, size = 20, className = '' }: { name: string; skillId?: number; size?: number; className?: string }) {
  const spec = resolveSkillIcon(name, skillId)
  const logo = spec.kind === 'logo' ? logos[`../assets/technology/${spec.name}.svg`] : undefined
  if (logo) return <img src={logo} alt="" aria-hidden="true" width={size} height={size} className={`shrink-0 object-contain ${className}`} />
  const Icon = spec.kind === 'symbol' ? symbols[spec.name] : undefined
  if (Icon) return <Icon size={size} aria-hidden="true" className={`shrink-0 ${className}`} />
  return <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded bg-slate-100 font-semibold text-slate-700 ${className}`} style={{ width: size, height: size, fontSize: Math.max(8, size * 0.45), lineHeight: 1 }}>{spec.kind === 'initials' ? spec.name : '?'}</span>
}
