import { useWatch, type UseFormReturn } from 'react-hook-form'
import { Button } from '../../../../components/ui/button'
import { reviewCopy } from '../../../../lib/profileConstants'
import type { Profile } from '../../types'
import { EditorField } from './EditorField'

export function EducationEditor({ form }: { form: UseFormReturn<Profile> }) {
  const education = useWatch({ control: form.control, name: 'education' })
  return <fieldset className="space-y-4">
    <legend className="mb-3 text-lg font-semibold">{reviewCopy.titles.education}</legend>
    {education ? <>
      <EditorField form={form} name="education.degree" label={reviewCopy.fields.degree} />
      <EditorField form={form} name="education.school" label={reviewCopy.fields.school} />
      <EditorField form={form} name="education.period" label={reviewCopy.fields.period} />
      <Button type="button" variant="outline" onClick={() => form.setValue('education', null, { shouldDirty: true, shouldValidate: true })}>
        {reviewCopy.remove.education}
      </Button>
    </> : <Button type="button" variant="outline" onClick={() => form.setValue('education', { degree: '', school: '', period: '', confirmed: false }, { shouldDirty: true })}>
      {reviewCopy.add.education}
    </Button>}
  </fieldset>
}
