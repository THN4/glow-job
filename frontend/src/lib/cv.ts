import { CV_MAX_SIZE, uploadCopy } from './uploadConstants'

export function validateCvFile(file: Pick<File, 'name' | 'size'>): string | null {
  if (!/\.(pdf|doc|docx)$/i.test(file.name)) return uploadCopy.errors.type
  if (file.size > CV_MAX_SIZE) return uploadCopy.errors.size
  if (file.size === 0) return uploadCopy.errors.empty
  return null
}
