import { timingSafeEqual } from 'crypto'

/**
 * Gate for internal support endpoints. Authorized only when ADMIN_SECRET is set
 * and the caller presents it in the `x-admin-secret` header (constant-time
 * compare). When ADMIN_SECRET is unset, admin endpoints are fully disabled.
 */
export function isAuthorizedAdmin(req: Request): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret || secret.length < 16) return false
  const provided = req.headers.get('x-admin-secret') ?? ''
  const a = Buffer.from(provided)
  const b = Buffer.from(secret)
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
