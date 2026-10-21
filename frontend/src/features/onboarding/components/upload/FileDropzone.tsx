import { useId, useRef, useState, type RefObject } from 'react'
import { FileText } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import { cn } from '../../../../lib/utils'
import { CV_ACCEPT, uploadCopy } from '../../../../lib/uploadConstants'

type FileDropzoneProps = {
  file: File | null
  error: string | null
  inputRef: RefObject<HTMLInputElement | null>
  onFilesSelected: (files: File[]) => void
  disabled?: boolean
}

export function FileDropzone({ file, error, inputRef, onFilesSelected, disabled = false }: FileDropzoneProps) {
  const titleId = useId()
  const hintId = useId()
  const errorId = useId()
  const dragDepth = useRef(0)
  const [dragging, setDragging] = useState(false)

  return (
    <div>
      <Button type="button" variant="outline" disabled={disabled} onClick={() => inputRef.current?.click()}
        aria-labelledby={titleId} aria-describedby={[hintId, error ? errorId : null].filter(Boolean).join(' ')}
        aria-invalid={Boolean(error)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault()
          if (event.dataTransfer.types.includes('Files')) { dragDepth.current++; setDragging(true) }
        }}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }}
        onDragLeave={(event) => {
          event.preventDefault()
          dragDepth.current = Math.max(0, dragDepth.current - 1)
          if (dragDepth.current === 0) setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          if (disabled) return
          dragDepth.current = 0
          setDragging(false)
          onFilesSelected(Array.from(event.dataTransfer.files))
        }}
        className={cn('flex h-auto min-h-56 w-full flex-col gap-0 whitespace-normal rounded-xl border-dashed border-input bg-panel px-4 py-6 text-center text-sm font-normal shadow-none hover:border-primary hover:bg-accent sm:min-h-60 sm:px-5',
          dragging && 'border-primary bg-accent ring-2 ring-primary/20', error && 'border-destructive')}>
        <span className="flex size-18 items-center justify-center rounded-full bg-accent text-primary sm:size-22">
          <FileText className="size-8 sm:size-10" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <span id={titleId} className="mt-3 max-w-full break-all text-base font-semibold leading-6 text-foreground sm:text-xl">
          {dragging ? uploadCopy.dropNow : file?.name ?? uploadCopy.dropTitle}
        </span>
        <span className="mt-1 text-sm leading-6 text-muted-foreground sm:text-base">
          {uploadCopy.browsePrefix} <span className="text-primary">{file ? uploadCopy.replace : uploadCopy.browse}</span>
        </span>
        <span id={hintId} className="mt-3 text-xs leading-5 text-muted-foreground sm:text-sm">
          {file ? uploadCopy.fileSize(file.size) : uploadCopy.fileHint}
        </span>
      </Button>
      <input ref={inputRef} type="file" accept={CV_ACCEPT} disabled={disabled} aria-label={uploadCopy.fileInputLabel}
        className="hidden" onChange={(event) => {
          onFilesSelected(Array.from(event.currentTarget.files ?? []))
          event.currentTarget.value = ''
        }} />
      {error && <p id={errorId} role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  )
}
