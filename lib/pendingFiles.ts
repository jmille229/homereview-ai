import type { UploadedFile } from './types'

const FILES_STORAGE_KEY = 'hr-pending-files'

/**
 * Saves uploaded files to sessionStorage so they survive navigation
 * from the intake page to the questions page without living in Zustand
 * (which would require storing large base64 blobs in serialized state).
 */
export function savePendingFiles(files: UploadedFile[]): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(files))
  } catch {
    // sessionStorage unavailable — non-fatal, files simply won't be uploaded
  }
}

export function getPendingFiles(): UploadedFile[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(FILES_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as UploadedFile[]) : []
  } catch {
    return []
  }
}

export function clearPendingFiles(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(FILES_STORAGE_KEY)
  } catch { /* non-fatal */ }
}
