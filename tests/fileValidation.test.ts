import { describe, it, expect } from 'vitest'
import { filesHaveValidSignatures } from '@/lib/fileValidation'
import type { UploadedFile } from '@/lib/types'

// Build a base64 payload with the given leading magic bytes + filler.
function b64(magic: number[], pad = 16): string {
  return Buffer.from([...magic, ...Array(pad).fill(0)]).toString('base64')
}

const JPEG = [0xff, 0xd8, 0xff]
const PNG  = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const PDF  = [0x25, 0x50, 0x44, 0x46]

function file(type: UploadedFile['type'], data: string): UploadedFile {
  return { name: 'q', type, size: 1000, data }
}

describe('filesHaveValidSignatures (magic-byte sniffing)', () => {
  it('accepts files whose bytes match their declared type', () => {
    expect(filesHaveValidSignatures([file('image/jpeg', b64(JPEG))])).toBe(true)
    expect(filesHaveValidSignatures([file('image/png', b64(PNG))])).toBe(true)
    expect(filesHaveValidSignatures([file('application/pdf', b64(PDF))])).toBe(true)
  })

  it('accepts WebP (RIFF…WEBP)', () => {
    const webp = Buffer.concat([
      Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP'), Buffer.alloc(8),
    ]).toString('base64')
    expect(filesHaveValidSignatures([file('image/webp', webp)])).toBe(true)
  })

  it('rejects a mislabeled file (PDF bytes declared as PNG)', () => {
    expect(filesHaveValidSignatures([file('image/png', b64(PDF))])).toBe(false)
  })

  it('rejects random garbage declared as an image', () => {
    expect(filesHaveValidSignatures([file('image/png', b64([1, 2, 3, 4]))])).toBe(false)
  })

  it('rejects when ANY file in the batch is bad', () => {
    expect(filesHaveValidSignatures([
      file('application/pdf', b64(PDF)),
      file('image/jpeg', b64(PNG)), // mismatch
    ])).toBe(false)
  })

  it('treats an empty batch as valid (nothing to reject)', () => {
    expect(filesHaveValidSignatures([])).toBe(true)
  })
})
