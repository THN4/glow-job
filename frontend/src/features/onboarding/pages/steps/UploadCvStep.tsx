import { useRef, useState } from 'react'
import { LoaderCircle, ShieldCheck, Upload, X } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import { onboardingCopy } from '../../../../lib/constants'
import { validateCvFile } from '../../../../lib/cv'
import { uploadCopy } from '../../../../lib/uploadConstants'
import { reviewCopy } from '../../../../lib/profileConstants'
import { PageHeader } from '../../components/layout/PageHeader'
import { FileDropzone } from '../../components/upload/FileDropzone'
import { WhatWeFindPanel } from '../../components/upload/WhatWeFindPanel'

type UploadCvStepProps = {
  file: File | null
  onFileSelected: (file: File | null) => void
  onUpload: () => void
  onContinueWithoutCv: () => void
  isUploading?: boolean
  uploadError?: string | null
}

export function UploadCvStep({ file, onFileSelected, onUpload, onContinueWithoutCv, isUploading = false, uploadError }: UploadCvStepProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  function handleFiles(files: File[]) {
    if (!files.length) return
    const nextError = files.length > 1 ? uploadCopy.errors.multiple : validateCvFile(files[0])
    setError(nextError)
    onFileSelected(nextError ? null : files[0])
  }

  return (
    <div aria-busy={isUploading} className="grid items-start gap-8 xl:grid-cols-[minmax(0,1.58fr)_minmax(0,1fr)] xl:gap-11">
      <div className="min-w-0">
        <PageHeader {...onboardingCopy.headers[1]} className="mb-6 sm:mb-6" />
        <FileDropzone file={file} error={error} inputRef={inputRef} onFilesSelected={handleFiles} disabled={isUploading} />
        {file && <div className="mt-2 flex justify-center">
          <Button type="button" variant="ghost" disabled={isUploading} onClick={() => { onFileSelected(null); setError(null) }}
            className="h-10 gap-2 text-sm text-muted-foreground">
            <X className="size-4" aria-hidden="true" />{uploadCopy.remove}
          </Button>
        </div>}
        <Button type="button" disabled={isUploading} onClick={() => file ? onUpload() : inputRef.current?.click()}
          className="mx-auto mt-4 flex h-11 w-full max-w-90 gap-2 text-sm font-semibold shadow-sm sm:h-12 sm:text-base">
          {isUploading ? <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> :
            <Upload className="size-5" strokeWidth={1.8} aria-hidden="true" />}
          {isUploading ? reviewCopy.preparing : uploadCopy.upload}
        </Button>
        {uploadError && <p role="alert" className="mt-3 text-center text-sm text-destructive">{uploadError}</p>}
        <Button type="button" variant="link" disabled={isUploading} onClick={onContinueWithoutCv}
          className="mx-auto mt-2 flex h-10 text-sm font-normal underline underline-offset-4 sm:text-base">
          {uploadCopy.skip}
        </Button>
        <p className="mx-auto mt-2 flex max-w-lg items-start justify-center gap-2 text-xs leading-5 text-muted-foreground sm:text-sm">
          <ShieldCheck className="size-5 shrink-0" strokeWidth={1.6} aria-hidden="true" />
          <span>{uploadCopy.privacy}</span>
        </p>
      </div>
      <WhatWeFindPanel />
    </div>
  )
}
