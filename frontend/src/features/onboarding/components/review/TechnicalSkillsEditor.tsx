import { X } from 'lucide-react'
import { useId } from 'react'
import { Button } from '../../../../components/ui/button'
import { reviewCopy, SKILL_LEVEL_OPTIONS } from '../../../../lib/profileConstants'
import { cn } from '../../../../lib/utils'
import { skillLevelSchema, type TechnicalSkill } from '../../types'
import { SkillInput } from './SkillInput'

type TechnicalSkillsEditorProps = {
  skills: TechnicalSkill[]
  onChange: (skills: TechnicalSkill[]) => void
  removable?: boolean
  showValidation?: boolean
}

const levelColors = {
  unset: 'border-border bg-card',
  beginner: 'border-skill-beginner-border bg-skill-beginner',
  intermediate: 'border-skill-intermediate-border bg-skill-intermediate',
  advanced: 'border-skill-advanced-border bg-skill-advanced',
  expert: 'border-skill-expert-border bg-skill-expert',
  unknown: 'border-skill-unknown-border bg-skill-unknown',
} as const
const levelStrength = { beginner: 1, intermediate: 2, advanced: 3, expert: 4, unknown: 0 } as const

function SkillLevelIndicator({ level }: { level: TechnicalSkill['level'] }) {
  const strength = level ? levelStrength[level] : 0
  return <span aria-hidden="true" className="flex h-3 shrink-0 items-end gap-0.5">
    {[1, 2, 3, 4].map((bar) => <span key={bar}
      className={cn('w-0.5 rounded-full', bar <= strength ? 'bg-foreground/50' : 'bg-foreground/10')}
      style={{ height: `${bar * 2 + 2}px` }} />)}
  </span>
}

export function TechnicalSkillsEditor({ skills, onChange, removable = false, showValidation = false }: TechnicalSkillsEditorProps) {
  const levelHintId = useId()
  const missingLevels = skills.filter((skill) => skill.level === null).length
  return <div className="@container space-y-3">
    {removable ? <div className="grid gap-2 @min-[28rem]:grid-cols-2">
      {skills.map((skill, index) => <div key={skill.name} className={cn(
        'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border p-2 transition-colors @min-[15rem]:grid-cols-[minmax(0,1fr)_8rem_auto]',
        levelColors[skill.level ?? 'unset'],
      )} data-skill={skill.name} data-level={skill.level ?? 'unset'}>
        <span className="col-start-1 row-start-1 min-w-0 break-words text-sm font-medium text-foreground">{skill.name}</span>
        <select aria-label={reviewCopy.skillLevelLabel(skill.name)} aria-required="true" value={skill.level ?? ''}
          aria-invalid={showValidation && skill.level === null}
          aria-describedby={skill.level === null ? levelHintId : undefined}
          onChange={(event) => {
            const level = skillLevelSchema.safeParse(event.target.value || null)
            if (level.success) onChange(skills.map((entry, current) => current === index ? { ...entry, level: level.data } : entry))
          }}
          className="col-span-2 col-start-1 row-start-2 h-9 w-full min-w-0 rounded-lg border border-input bg-card px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 @min-[15rem]:col-span-1 @min-[15rem]:col-start-2 @min-[15rem]:row-start-1">
          <option value="">{reviewCopy.skillLevelPlaceholder}</option>
          {SKILL_LEVEL_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select>
        <Button type="button" variant="ghost" size="icon" aria-label={reviewCopy.removeSkill(skill.name)}
          onClick={() => onChange(skills.filter((_, current) => current !== index))}
          className="col-start-2 row-start-1 size-7 text-muted-foreground @min-[15rem]:col-start-3">
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>)}
    </div> : <ul className="flex flex-wrap gap-2">
      {skills.map((skill) => {
        const levelLabel = SKILL_LEVEL_OPTIONS.find(({ value }) => value === skill.level)?.label ?? reviewCopy.skillLevelRequired
        return <li key={skill.name} data-skill={skill.name} data-level={skill.level ?? 'unset'}
          title={`${skill.name}: ${levelLabel}`}
          className={cn('inline-flex max-w-full items-center gap-2 rounded-full border px-2.5 py-1 text-sm leading-5 text-foreground', levelColors[skill.level ?? 'unset'])}>
          <span className="min-w-0 break-words">{skill.name}</span>
          <SkillLevelIndicator level={skill.level} />
          <span className="sr-only">{`: ${levelLabel}`}</span>
        </li>
      })}
    </ul>}
    {!skills.length && <p className="text-sm leading-5 text-muted-foreground">{reviewCopy.empty.skills}</p>}
    <SkillInput skills={skills.map(({ name }) => name)} onChange={(names) => onChange(names.map((name) =>
      skills.find((skill) => skill.name === name) ?? { name, level: null },
    ))} />
    {removable && missingLevels > 0 && <p id={levelHintId} role={showValidation ? 'alert' : 'status'} className="text-sm leading-5 text-warning">
      {reviewCopy.missingSkillLevels(missingLevels)} {reviewCopy.skillLevelsBeforeContinue}
    </p>}
  </div>
}
