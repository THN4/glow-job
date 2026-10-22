import { CV_MAX_SIZE, uploadCopy } from './uploadConstants'

export function validateCvFile(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  const supportedExtension = /\.(pdf|jpe?g|png|webp)$/i.test(file.name)
  const supportedType = !file.type || ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)
  if (!supportedExtension || !supportedType) return uploadCopy.errors.type
  if (file.size > CV_MAX_SIZE) return uploadCopy.errors.size
  if (file.size === 0) return uploadCopy.errors.empty
  return null
}
