import { headers } from 'next/headers'

/**
 * Layout for the funnel / app routes (intake, questions, preview, success,
 * unlock, report). Reading a request header opts this whole subtree into
 * DYNAMIC rendering, which is required for the per-request CSP nonce (set in
 * middleware for these paths) to be stamped onto framework scripts.
 *
 * Marketing pages live OUTSIDE this group and stay statically rendered + CDN
 * cached, with the looser static CSP — they reflect no untrusted input, so the
 * strict nonce policy buys nothing there.
 */
export default function FlowLayout({ children }: { children: React.ReactNode }) {
  headers()
  return children
}
