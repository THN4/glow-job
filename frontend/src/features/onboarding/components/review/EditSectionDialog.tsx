import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../../components/ui/dialog'
import { reviewCopy } from '../../../../lib/profileConstants'
import { profileSchema, type Profile, type ProfileSection } from '../../types'
import { ArraySectionEditor } from './ArraySectionEditor'
import { EducationEditor } from './EducationEditor'
import { SkillListEditor } from './SkillListEditor'

type EditSectionDialogProps = {
  section: ProfileSection | 'all'
  profile: Profile
  onSave: (updates: Partial<Profile>) => void
  onClose: () => void
  onRestoreFocus: () => void
}

export function EditSectionDialog({ section, profile, onSave, onClose, onRestoreFocus }: EditSectionDialogProps) {
  const form = useForm<Profile>({ resolver: zodResolver(profileSchema), defaultValues: {
    ...structuredClone(profile),
    education: section === 'education' && !profile.education ? { degree: '', school: '', period: '', confirmed: false } : structuredClone(profile.education),
  } })
  const show = (target: ProfileSection) => section === 'all' || section === target

  function save(values: Profile) {
    if (show('education') && values.education) values.education.confirmed = true
    if (section === 'all') onSave(values)
    else onSave({ [section]: values[section] })
    onClose()
  }

  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
    <DialogContent showCloseButton={false} className="max-h-[90svh] overflow-y-auto bg-card p-5 text-foreground sm:max-w-2xl sm:p-6"
      onCloseAutoFocus={(event) => { event.preventDefault(); onRestoreFocus() }}>
      <DialogHeader className="pr-8">
        <DialogTitle className="text-2xl font-bold leading-8">{section === 'all' ? reviewCopy.editProfile : reviewCopy.editSection(reviewCopy.titles[section])}</DialogTitle>
        <DialogDescription className="text-base leading-6">{reviewCopy.dialogDescription}</DialogDescription>
      </DialogHeader>
      <DialogClose asChild><Button type="button" variant="ghost" size="icon" aria-label={reviewCopy.close} className="absolute right-3 top-3">
        <X className="size-5" aria-hidden="true" />
      </Button></DialogClose>
      <form onSubmit={form.handleSubmit(save)} noValidate className="space-y-6">
        {show('education') && <EducationEditor form={form} />}
        {show('skills') && <fieldset className="space-y-3">
          <legend className="mb-3 text-lg font-semibold">{reviewCopy.titles.skills}</legend>
          <Controller control={form.control} name="skills" render={({ field }) => <SkillListEditor skills={field.value} onChange={field.onChange} />} />
          {form.formState.errors.skills?.message && <p role="alert" className="text-sm text-destructive">{form.formState.errors.skills.message}</p>}
        </fieldset>}
        {(['projects', 'experience', 'certifications'] as const).filter(show).map((kind) => <ArraySectionEditor key={kind} section={kind} form={form} />)}
        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-border bg-card py-3">
          <Button type="button" variant="outline" onClick={onClose}>{reviewCopy.cancel}</Button>
          <Button type="submit">{reviewCopy.save}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
}
