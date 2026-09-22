import { timingSafeEqual } from 'node:crypto'

export const TOKEN_COOKIE = 'seyes_key'
export const TOKEN_PARAM = 'seyes-key'

/** Constant-time string compare, so the key can't be guessed by timing. */
export function sameKey(given: string | undefined | null, expected: string): boolean {
  if (!given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export type Decision =
  | { kind: 'open' }
  | { kind: 'allow' }
  | { kind: 'deny' }
  | { kind: 'admit'; redirectTo: string }

/**
 * Who may talk to this server.
 *
 * Run from a terminal (the npm launcher) there is no key and everything is
 * open, as before: the server listens on 127.0.0.1 only, and the CSRF guard
 * keeps web pages out. The Mac app starts the server with a fresh random key
 * each launch and opens its window at `/?seyes-key=…`; that one visit trades
 * the key for an HttpOnly cookie and redirects to a clean URL. From then on
 * every API request must carry the cookie, so no other program on the
 * machine can read or change the writing, even though it can reach the port.
 */
export function decide(url: URL, cookie: string | undefined, key: string | undefined): Decision {
  if (!key) return { kind: 'open' }
  const offered = url.searchParams.get(TOKEN_PARAM)
  if (offered !== null) {
    if (!sameKey(offered, key)) return { kind: 'deny' }
    const clean = new URL(url)
    clean.searchParams.delete(TOKEN_PARAM)
    return { kind: 'admit', redirectTo: clean.pathname + clean.search }
  }
  if (!url.pathname.startsWith('/api/')) return { kind: 'allow' }
  return sameKey(cookie, key) ? { kind: 'allow' } : { kind: 'deny' }
}
