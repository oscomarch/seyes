/**
 * CSRF guard for the mutating filesystem API routes.
 *
 * The threat: this server listens on localhost with no auth, so any page
 * open in the user's browser can fire a request at it. A plain cross-origin
 * fetch/XHR is blocked from *reading* the response, but a request that
 * never needs a CORS preflight (a simple GET, or a form-style POST sent as
 * `text/plain`) still reaches the handler and still executes — the
 * attacker just can't see the result. That's enough to write, move, or
 * trash notes, or repoint the app's root, behind the user's back.
 *
 * The mitigation is same-origin enforcement plus a Content-Type check, not
 * an auth layer: the goal is only to confirm the request came from this
 * app's own UI, not from some other page borrowing the user's browser.
 */
export class GuardError extends Error {}

function isSameOrigin(request: Request): boolean {
  const secFetchSite = request.headers.get('sec-fetch-site')
  if (secFetchSite !== null) {
    // Sent by every current browser. The most reliable signal, so it wins
    // whenever present. `same-site` (a different subdomain/port sharing a
    // registrable domain) is deliberately NOT trusted here alongside
    // `cross-site` — only an exact same-origin request (or the absence of
    // an initiating site, `none`, e.g. a typed URL or bookmark) is allowed.
    return secFetchSite === 'same-origin' || secFetchSite === 'none'
  }

  const origin = request.headers.get('origin')
  if (origin !== null) {
    // Older browsers, or requests where Sec-Fetch-Site isn't sent. Compare
    // host (hostname + port) only — never assume a scheme matches.
    try {
      return new URL(origin).host === new URL(request.url).host
    } catch {
      return false
    }
  }

  // Neither header is present. This is NOT a browser-initiated fetch, form
  // submission, or navigation — real browsers always send at least one of
  // these on a request like this. It's a non-browser client: curl, a
  // script, another local tool. The entire threat model here is a browser
  // being tricked into making the request on the user's behalf, so a
  // client that isn't a browser at all is outside that model. Allowing it
  // through costs nothing security-wise and keeps the local `curl`
  // workflow working. Do NOT change this to reject bare requests "to be
  // safe" — that would break the legitimate workflow while stopping
  // nothing, since a real attack page can never suppress both headers.
  return true
}

/**
 * Throws when `request` did not originate from this app's own page, or
 * when its body isn't declared as JSON (closing the `text/plain`
 * form-post path that a real cross-origin request could otherwise use to
 * reach a handler that blindly calls `request.json()`). Call this as the
 * first statement inside a mutating handler's try block; the handler's
 * existing catch turns the thrown GuardError into an HTTP response.
 */
export function sameOriginOnly(request: Request): void {
  if (!isSameOrigin(request)) {
    throw new GuardError('Cross-origin request rejected')
  }

  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new GuardError(`Expected application/json, got "${contentType || '(none)'}"`)
  }
}
