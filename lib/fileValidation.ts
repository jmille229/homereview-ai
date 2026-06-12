import type { UploadedFile } from './types'

/**
 * Server-side content validation for uploaded files.
 *
 * Zod only checks the *declared* MIME type and base64 length — both fully
 * client-controlled. Without this, an attacker can send 2 MB of random base64
 * labelled `image/png` and it gets shipped to an expensive Claude vision call,
 * burning tokens on garbage. This sniffs the magic bytes of the decoded data so
 * malformed/mismatched files are rejected cheaply, before any model call.
 */

// Decode just the leading bytes we need to fingerprint the format.
function leadingBytes(base64: string, n: number): Uint8Array {
  // A base64 quantum is 4 chars -> 3 bytes; decode a small prefix only.
  const prefixChars = Math.min(base64.length, Math.ceil((n + 3) / 3) * 4)
  try {
    const buf = Buffer.from(base64.slice(0, prefixChars), 'base64')
    return new Uint8Array(buf.subarray(0, n))
  } catch {
    return new Uint8Array(0)
  }
}

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false
  return sig.every((b, i) => bytes[offset + i] === b)
}

function matchesDeclaredType(type: UploadedFile['type'], bytes: Uint8Array): boolean {
  switch (type) {
    case 'image/jpeg':
      return startsWith(bytes, [0xff, 0xd8, 0xff])
    case 'image/png':
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case 'image/webp':
      // "RIFF"…"WEBP" — bytes 0-3 RIFF, bytes 8-11 WEBP
      return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
    case 'application/pdf':
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46]) // "%PDF"
    default:
      return false
  }
}

/**
 * Returns true only if every file's decoded magic bytes match its declared
 * type. Empty input is valid (no files to check).
 */
export function filesHaveValidSignatures(files: UploadedFile[]): boolean {
  return files.every((f) => matchesDeclaredType(f.type, leadingBytes(f.data, 12)))
}
