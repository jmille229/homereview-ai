import { NextResponse } from 'next/server'

/**
 * Raw-body-aware JSON reader.
 *
 * The previous guard trusted the client-supplied `Content-Length` header, which
 * an attacker can omit or understate to slip an oversized body past the check
 * and still force the server to buffer it. This reads the actual bytes and
 * enforces the limit on the real length before parsing.
 */
export class BodyTooLargeError extends Error {}

export async function readLimitedJson(req: Request, maxBytes: number): Promise<unknown> {
  // Fast pre-check on the declared length — cheaply rejects honest oversized
  // clients before we buffer anything.
  const declared = req.headers.get('content-length')
  if (declared && Number(declared) > maxBytes) throw new BodyTooLargeError()

  const raw = await req.text()
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) throw new BodyTooLargeError()
  if (raw.length === 0) return undefined
  return JSON.parse(raw) // SyntaxError on malformed JSON — caller maps to 400
}

/**
 * Parses a request body with a hard size limit and returns either the parsed
 * value or a ready-to-return error response. Keeps every route's body handling
 * identical (413 too-large, 400 malformed).
 */
export async function parseJsonBody(
  req: Request,
  maxBytes: number,
): Promise<{ ok: true; data: unknown } | { ok: false; res: NextResponse }> {
  try {
    return { ok: true, data: await readLimitedJson(req, maxBytes) }
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      return { ok: false, res: NextResponse.json({ error: 'Request body too large.' }, { status: 413 }) }
    }
    return { ok: false, res: NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }
  }
}
