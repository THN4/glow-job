import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '../../../components/ui/dialog'
import { safeSourceUrl } from '../learningSources'
import type { RoadmapEvidence } from '../type'

type EvidenceFormProps = {
  topic: string
  onSave: (evidence: RoadmapEvidence) => void
}

export function EvidenceForm({ topic, onSave }: EvidenceFormProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [type, setType] = useState<RoadmapEvidence['type']>('GitHub project')
  const [photo, setPhoto] = useState<string>()
  const [photoName, setPhotoName] = useState('')
  const [reading, setReading] = useState(false)
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title') ?? '').trim()
    const link = String(form.get('url') ?? '').trim()
    const notes = String(form.get('notes') ?? '').trim()
    const url = safeSourceUrl(link)
    if (!title || (type === 'GitHub project' && !link) || (type === 'Certificate' && !link && !photo) || (type === 'Self report' && !notes)) {
      setError(type === 'Certificate' ? 'Enter a title and add a certificate photo or link.' : type === 'GitHub project' ? 'Enter a title and project link.' : 'Enter a title and describe what you learned.')
      return
    }
    if (link && !url) {
      setError('Enter a valid http or https link.')
      return
    }
    onSave({ id: crypto.randomUUID(), type, title, url, notes, photo: type !== 'GitHub project' ? photo : undefined })
    setOpen(false)
  }
  const fieldClass = 'mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus-visible:outline-primary'
  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); setError(''); setPhoto(undefined); setPhotoName(''); setType('GitHub project') }}>
      <DialogTrigger asChild>
        <button type="button" className="min-h-9 rounded-lg border border-blue-200 px-2 text-[10px] font-semibold text-blue-700 hover:bg-blue-50">Manage evidence</button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-lg sm:max-w-lg">
        <DialogTitle className="pr-8 text-lg font-semibold">Add evidence</DialogTitle>
        <DialogDescription>Add a project, certificate, or study notes for {topic}.</DialogDescription>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium">Evidence type
            <select name="type" value={type} onChange={(event) => { setType(event.target.value as RoadmapEvidence['type']); setPhoto(undefined); setError('') }} disabled={reading} className={fieldClass}>
              <option>GitHub project</option><option>Certificate</option><option>Self report</option>
            </select>
          </label>
          <label className="block text-sm font-medium">Title
            <input name="title" required maxLength={160} className={fieldClass} placeholder="My pipeline project" />
          </label>
          {type !== 'Self report' && <label className="block text-sm font-medium">{type === 'Certificate' ? 'Certificate link' : 'Project link'}
            <input key={type} name="url" type="url" required={type === 'GitHub project'} maxLength={2048} className={fieldClass} placeholder="https://…" />
          </label>}
          {type !== 'GitHub project' && <label className="block text-sm font-medium">{type === 'Certificate' ? 'Certificate photo (optional with link)' : 'Photo (optional)'}
            <div className="mt-1 flex flex-wrap items-center gap-2">
            <label className="relative inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-white px-2.5 text-xs font-medium text-foreground shadow-xs transition hover:bg-accent focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
              <Plus size={14} className="text-primary" aria-hidden="true" />
              Add file
              <input key={`${type}-photo`} type="file" accept="image/png,image/jpeg,image/webp" aria-label={type === 'Certificate' ? 'Upload a certificate photo' : 'Add an optional photo to your self report'} className="absolute inset-0 cursor-pointer opacity-0" disabled={reading} onChange={(event) => {
              const file = event.target.files?.[0]
              setPhoto(undefined)
              setPhotoName('')
              if (!file) return
              if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 500 * 1024) {
                setError('Choose a PNG, JPEG, or WebP image up to 500 KB.')
                event.target.value = ''
                return
              }
              setError('')
              setPhotoName(file.name)
              setReading(true)
              const reader = new FileReader()
              reader.onload = () => { setPhoto(String(reader.result)); setReading(false) }
              reader.onerror = () => { setError('Could not read the photo. Try another image.'); setReading(false) }
              reader.readAsDataURL(file)
            }} />
            </label>
            {photoName && <span className="max-w-48 truncate text-xs text-muted-foreground">{photoName}</span>}
            </div>
            <span className="mt-1 block text-xs font-normal text-muted-foreground">PNG, JPEG, or WebP, up to 500 KB. Saved in this browser.</span>
            {photo && <img src={photo} alt={`${type} photo preview`} className="mt-2 max-h-48 rounded-lg object-contain" />}
          </label>
          }
          <label className="block text-sm font-medium">Notes
            <textarea name="notes" required={type === 'Self report'} rows={4} maxLength={4000} className={fieldClass} placeholder="Describe what you built or learned…" />
          </label>
          <p className="text-xs text-muted-foreground">Evidence is saved in this browser.</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
            <button type="submit" disabled={reading} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Save evidence</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
