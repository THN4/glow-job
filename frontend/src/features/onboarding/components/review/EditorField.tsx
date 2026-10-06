import { useId } from 'react'
import type { FieldPath, UseFormReturn } from 'react-hook-form'
import { Input } from '../../../../components/ui/input'
import { Label } from '../../../../components/ui/label'
import { Textarea } from '../../../../components/ui/textarea'
import type { Profile } from '../../types'

export function EditorField({ form, name, label, multiline = false }: {
  form: UseFormReturn<Profile>; name: FieldPath<Profile>; label: string; multiline?: boolean
}) {
  const id = useId()
  const error = form.getFieldState(name, form.formState).error?.message
  const props = { ...form.register(name), id, 'aria-invalid': Boolean(error), 'aria-describedby': error ? `${id}-error` : undefined }
  return <div className="space-y-2">
    <Label htmlFor={id} className="leading-5">{label}</Label>
    {multiline ? <Textarea {...props} className="min-h-24 resize-y bg-card text-base md:text-base" /> :
      <Input {...props} className="h-10 bg-card text-base md:text-base" />}
    {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
  </div>
}
