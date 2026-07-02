import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, MAX_TOTAL_UPLOAD_BYTES } from './validators'
import type { AllowedMimeType } from './enums'
import type { UploadedFile } from './types'

/**
 * lib/clientFiles.ts — shared client-side file selection/validation.
 *
 * Three UI surfaces accept uploads (intake primary quote, intake second quote,
 * Quote Shield living-report updates). They previously each carried their own
 * copy of the MIME/size/combined-cap/FileReader logic, which had already drifted
 * subtly. This is the single implementation; the server re-validates everything
 * (Zod + magic bytes), so this layer is purely about fast, friendly feedback.
 */

/** A file that has been read into a data URL, ready to preview or submit. */
export interface LocalFile {
  name:    string
  type:    AllowedMimeType
  size:    number
  dataUrl: string
}

export type ReadFilesResult =
  | { ok: true; files: LocalFile[] }
  | { ok: false; error: string }

const MB = (bytes: number) => Math.round(bytes / 1024 / 1024)

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('File read failed'))
    reader.readAsDataURL(file)
  })
}

/**
 * Validates a batch of newly selected files and reads them into LocalFiles.
 *
 * `existing` are the files already selected ANYWHERE that share this request's
 * combined-size cap (e.g. the second quote counts against the primary quote's
 * total, because they ship in one request body).
 */
export async function readAndValidateFiles(
  selected: File[],
  opts: {
    /** Files already counted toward the shared combined-size cap. */
    existing?: Array<{ size: number }>
    /** Max files allowed in THIS bucket after the add (per-bucket count cap). */
    maxCount: number
    /** Files already in this bucket (for the count cap). */
    currentCount?: number
    /** Suffix for the combined-size message, e.g. " across both quotes". */
    combinedScopeLabel?: string
  },
): Promise<ReadFilesResult> {
  const { existing = [], maxCount, currentCount = 0, combinedScopeLabel = '' } = opts

  if (currentCount + selected.length > maxCount) {
    return { ok: false, error: `Maximum ${maxCount} ${maxCount === 1 ? 'file' : 'files'} allowed.` }
  }

  const validated: LocalFile[] = []
  for (const file of selected) {
    if (!ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType)) {
      return { ok: false, error: 'Only JPEG, PNG, WebP images and PDFs are accepted.' }
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return { ok: false, error: `"${file.name}" exceeds the ${MB(MAX_FILE_SIZE_BYTES)}MB per-file limit.` }
    }
    let dataUrl: string
    try {
      dataUrl = await readAsDataUrl(file)
    } catch {
      return { ok: false, error: `"${file.name}" could not be read. Please try again.` }
    }
    validated.push({ name: file.name, type: file.type as AllowedMimeType, size: file.size, dataUrl })
  }

  const totalBytes = [...existing, ...validated].reduce((sum, f) => sum + f.size, 0)
  if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `Combined size must be under ${MB(MAX_TOTAL_UPLOAD_BYTES)}MB${combinedScopeLabel}. Try removing a file or using smaller scans.`,
    }
  }

  return { ok: true, files: validated }
}

/** Converts read LocalFiles to the wire format the API schemas expect. */
export function toUploadedFiles(files: LocalFile[]): UploadedFile[] {
  return files.map((f) => ({
    name: f.name,
    type: f.type,
    size: f.size,
    data: f.dataUrl.split(',')[1] ?? '',
  }))
}
