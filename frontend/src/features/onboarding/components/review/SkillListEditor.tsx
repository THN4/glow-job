import { X } from 'lucide-react'
import { SkillChip } from '../../../../components/shared/SkillChip'
import { Button } from '../../../../components/ui/button'
import { reviewCopy } from '../../../../lib/profileConstants'
import { SkillInput } from './SkillInput'

export function SkillListEditor({ skills, onChange, label = reviewCopy.fields.skill, technologies = false }: {
  skills: string[]; onChange: (skills: string[]) => void; label?: string; technologies?: boolean
}) {
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      {skills.map((skill, index) => <SkillChip key={skill}>
        {skill}
        <Button type="button" variant="ghost" size="icon-xs" aria-label={reviewCopy.removeSkill(skill)}
          onClick={() => onChange(skills.filter((_, current) => current !== index))} className="size-5 rounded-full text-primary">
          <X className="size-3" aria-hidden="true" />
        </Button>
      </SkillChip>)}
    </div>
    <SkillInput skills={skills} onChange={onChange} label={label}
      placeholder={technologies ? reviewCopy.technologyPlaceholder : reviewCopy.skillPlaceholder} />
  </div>
}
