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
 * Exchange the OAuth verifier for a session without using a redirect.
 *
 * The built-in exchangeOAuthToken in @neondatabase/auth sets session cookies
 * on a 3xx redirect response. Safari iOS does not reliably persist cookies
 * from redirect responses, so the session is lost and the user gets bounced
 * back to sign-in.
 *
 * Instead we exchange the verifier, inject the resulting session cookie into
 * the forwarded request headers (so server components see the session), and
 * set the cookie on the outgoing response (so the browser persists it). The
 * client-side Neon Auth adapter already cleans the verifier param from the
 * URL via history.replaceState.
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

  const upstream = await fetch(upstreamURL.toString(), {
    method: 'GET',
    headers: reqHeaders,
  })

  if (!upstream.ok) return null

  // Parse new cookie name=value pairs from the upstream Set-Cookie headers
  // and merge them into the forwarded request's Cookie header so that
  // server components (neonAuth / fetchSession) see the fresh session.
  const upstreamSetCookies = upstream.headers.getSetCookie()
  const newCookiePairs = upstreamSetCookies.map((sc) => sc.split(';')[0].trim())
  const mergedCookie = cookieHeader
    ? `${cookieHeader}; ${newCookiePairs.join('; ')}`
    : newCookiePairs.join('; ')

  const forwardedHeaders = new Headers(request.headers)
  forwardedHeaders.set('cookie', mergedCookie)
  forwardedHeaders.set('X-Neon-Auth-Next-Middleware', 'true')

  // Pass through (no redirect) with the session cookie on both the request
  // and the response so the page renders authenticated and the browser
  // persists the cookie for subsequent navigations.
  const response = NextResponse.next({
    request: { headers: forwardedHeaders },
  })

  for (const sc of upstreamSetCookies) {
    response.headers.append('set-cookie', sc.replace(/;\s*Partitioned/i, ''))
  }

  return response
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = pathname.startsWith('/groups') || pathname === '/profile'
  const hasVerifier = request.nextUrl.searchParams.has(VERIFIER_PARAM)

  // On public routes without a verifier, skip auth entirely
  if (!isProtected && !hasVerifier) {
    return NextResponse.next()
  }

  // Handle OAuth verifier exchange ourselves (fixes Safari iOS cookie issue)
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
