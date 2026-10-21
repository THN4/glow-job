import { Controller, useFieldArray, type FieldPath, type UseFormReturn } from 'react-hook-form'
import { Button } from '../../../../components/ui/button'
import { Label } from '../../../../components/ui/label'
import { reviewCopy } from '../../../../lib/profileConstants'
import type { Profile } from '../../types'
import { EditorField } from './EditorField'
import { SkillListEditor } from './SkillListEditor'

type ArraySection = 'projects' | 'experience' | 'certifications'
const defaults = {
  projects: { name: '', description: '', skills: [] },
  experience: { role: '', company: '', period: '', description: '', skills: [] },
  certifications: { name: '', details: '', outcome: '' },
} satisfies { [Key in ArraySection]: Profile[Key][number] }
const fieldsBySection = {
  projects: [
    { key: 'name', label: reviewCopy.fields.projectName },
    { key: 'description', label: reviewCopy.fields.description, multiline: true },
  ],
  experience: [
    { key: 'role', label: reviewCopy.fields.role }, { key: 'company', label: reviewCopy.fields.company },
    { key: 'period', label: reviewCopy.fields.period }, { key: 'description', label: reviewCopy.fields.description, multiline: true },
  ],
  certifications: [
    { key: 'name', label: reviewCopy.fields.certificationName }, { key: 'details', label: reviewCopy.fields.details },
    { key: 'outcome', label: reviewCopy.fields.outcome },
  ],
} satisfies { [Key in ArraySection]: readonly { key: keyof Profile[Key][number]; label: string; multiline?: boolean }[] }

export function ArraySectionEditor({ section, form }: { section: ArraySection; form: UseFormReturn<Profile> }) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: section })
  return <fieldset className="space-y-4">
    <legend className="mb-3 text-lg font-semibold">{reviewCopy.titles[section]}</legend>
    {fields.map((entry, index) => <fieldset key={entry.id} className="space-y-4 rounded-xl border border-border bg-panel p-4">
      <legend className="px-1 font-medium">{reviewCopy.entryLabel(reviewCopy.titles[section], index)}</legend>
      {fieldsBySection[section].map((field) => <EditorField key={field.key} form={form}
        name={`${section}.${index}.${field.key}` as FieldPath<Profile>} label={field.label}
        multiline={'multiline' in field && field.multiline} />)}
      {(section === 'projects' || section === 'experience') && <div className="space-y-2">
        <Label className="leading-5">{reviewCopy.fields.technologies}</Label>
        <Controller control={form.control} name={`${section}.${index}.skills`} render={({ field }) =>
          <SkillListEditor skills={field.value} onChange={field.onChange} technologies label={reviewCopy.fields.technologies} />} />
      </div>}
      <Button type="button" variant="outline" aria-label={reviewCopy.removeEntry(reviewCopy.remove[section], index)} onClick={() => remove(index)}>
        {reviewCopy.remove[section]}
      </Button>
    </fieldset>)}
    <Button type="button" variant="outline" onClick={() => append(structuredClone(defaults[section]))}>{reviewCopy.add[section]}</Button>
  </fieldset>
}
