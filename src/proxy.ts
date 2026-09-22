import { NextResponse, type NextRequest } from 'next/server'
import { decide, TOKEN_COOKIE } from '@/lib/access'

/** See `decide` for who is let in and why. */
export function proxy(request: NextRequest) {
  const key = process.env.SEYES_KEY
  const decision = decide(request.nextUrl, request.cookies.get(TOKEN_COOKIE)?.value, key)

  if (decision.kind === 'deny') {
    return NextResponse.json({ error: 'Not allowed' }, { status: 401 })
  }
  if (decision.kind === 'admit' && key) {
    const response = NextResponse.redirect(new URL(decision.redirectTo, request.url))
    response.cookies.set(TOKEN_COOKIE, key, { httpOnly: true, sameSite: 'strict', path: '/' })
    return response
  }
  return NextResponse.next()
}

export const config = {
  // Static assets carry nothing private and are skipped.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
