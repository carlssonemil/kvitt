import { neonAuthMiddleware } from '@neondatabase/auth/next/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const NEON_AUTH_BASE_URL = process.env.NEON_AUTH_BASE_URL!
const COOKIE_PREFIX = '__Secure-neon-auth'
const VERIFIER_PARAM = 'neon_auth_session_verifier'
const CHALLENGE_COOKIE = `${COOKIE_PREFIX}.session_challange`
const PROXY_HEADERS = ['user-agent', 'authorization', 'referer', 'content-type']

const handler = neonAuthMiddleware({ loginUrl: '/auth/sign-in' })

/**
 * Exchange the OAuth verifier for a session, properly forwarding Set-Cookie
 * headers. The built-in exchangeOAuthToken in @neondatabase/auth uses a
 * deprecated `extractResponseCookies` that splits on ", " which breaks
 * cookies containing Expires dates with commas. Safari iOS rejects the
 * resulting malformed headers, so we handle the exchange here instead.
 */
async function exchangeVerifier(request: NextRequest): Promise<NextResponse | null> {
  const challenge = request.cookies.get(CHALLENGE_COOKIE)
  const verifier = request.nextUrl.searchParams.get(VERIFIER_PARAM)
  if (!verifier || !challenge) return null

  // Build the upstream get-session URL with the verifier
  const upstreamURL = new URL(`${NEON_AUTH_BASE_URL}/get-session`)
  upstreamURL.searchParams.set(VERIFIER_PARAM, verifier)

  // Extract neon-auth cookies from the request
  const cookieHeader = request.headers.get('cookie') ?? ''
  const neonCookies = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .filter((c) => c.startsWith(COOKIE_PREFIX))
    .join('; ')

  const reqHeaders = new Headers()
  for (const h of PROXY_HEADERS) {
    const v = request.headers.get(h)
    if (v) reqHeaders.set(h, v)
  }
  reqHeaders.set('Origin', request.headers.get('origin') || request.nextUrl.origin)
  reqHeaders.set('Cookie', neonCookies)
  reqHeaders.set('X-Neon-Auth-Next-Middleware', 'true')

  const response = await fetch(upstreamURL.toString(), {
    method: 'GET',
    headers: reqHeaders,
  })

  if (!response.ok) return null

  // Build redirect to the clean URL (no verifier), with properly split cookies
  const cleanUrl = request.nextUrl.clone()
  cleanUrl.searchParams.delete(VERIFIER_PARAM)

  const redirectHeaders = new Headers()
  for (const cookie of response.headers.getSetCookie()) {
    redirectHeaders.append('Set-Cookie', cookie)
  }

  return NextResponse.redirect(cleanUrl, { headers: redirectHeaders })
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = pathname.startsWith('/groups') || pathname === '/profile'
  const hasVerifier = request.nextUrl.searchParams.has(VERIFIER_PARAM)

  // On public routes without a verifier, skip auth entirely
  if (!isProtected && !hasVerifier) {
    return NextResponse.next()
  }

  // Handle OAuth verifier exchange ourselves (fixes Safari Set-Cookie bug)
  if (hasVerifier) {
    const result = await exchangeVerifier(request)
    if (result) return result
  }

  // Fall through to the standard middleware for session checks
  return handler(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|api/).*)'],
}
