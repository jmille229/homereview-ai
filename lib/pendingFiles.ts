import type { UploadedFile } from './types'

const FILES_STORAGE_KEY  = 'hr-pending-files'
const SECOND_STORAGE_KEY = 'hr-pending-second-quote'

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

/**
 * Second contractor quote (Quote Shield only) — kept separate from the primary
 * quote's files so the API can tell which document is which for comparison.
 */
export function savePendingSecondQuote(files: UploadedFile[]): void {
  if (typeof window === 'undefined') return
  try {
    if (files.length === 0) sessionStorage.removeItem(SECOND_STORAGE_KEY)
    else sessionStorage.setItem(SECOND_STORAGE_KEY, JSON.stringify(files))
  } catch { /* non-fatal */ }
}

export function getPendingSecondQuote(): UploadedFile[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(SECOND_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as UploadedFile[]) : []
  } catch {
    return []
  }
}

export function clearPendingFiles(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(FILES_STORAGE_KEY)
    sessionStorage.removeItem(SECOND_STORAGE_KEY)
  } catch { /* non-fatal */ }
}

