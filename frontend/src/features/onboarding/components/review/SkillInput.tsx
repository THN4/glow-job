import { useId, useState } from 'react'
import { PlusCircle } from 'lucide-react'
import { Input } from '../../../../components/ui/input'
import { Button } from '../../../../components/ui/button'
import { reviewCopy, SKILL_MAX_LENGTH } from '../../../../lib/profileConstants'
import { skillSchema } from '../../types'

export function SkillInput({ skills, onChange, label = reviewCopy.fields.skill, placeholder = reviewCopy.skillPlaceholder }: {
  skills: string[]; onChange: (skills: string[]) => void; label?: string; placeholder?: string
}) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const errorId = useId()
  function addSkill() {
    const parsed = skillSchema.safeParse(draft)
    if (!parsed.success) { setError(parsed.error.issues[0].message); return }
    if (skills.some((skill) => skill.toLowerCase() === parsed.data.toLowerCase())) {
      setError(reviewCopy.duplicateSkill); return
    }
    onChange([...skills, parsed.data])
    setDraft('')
    setError(null)
  }
  return <div>
    <div className="relative">
      <Input aria-label={label} value={draft} maxLength={SKILL_MAX_LENGTH} placeholder={placeholder}
        onChange={(event) => { setDraft(event.target.value); setError(null) }} aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addSkill() } }}
        className="h-8 border-input bg-transparent pl-9 text-base md:text-base" />
      <Button type="button" variant="ghost" size="icon" onClick={addSkill} aria-label={reviewCopy.addSkill}
        className="absolute left-0 top-0 size-8 text-muted-foreground">
        <PlusCircle className="size-3.5" aria-hidden="true" />
      </Button>
    </div>
    {error && <p id={errorId} role="alert" className="mt-1 text-sm text-destructive">{error}</p>}
  </div>
}
