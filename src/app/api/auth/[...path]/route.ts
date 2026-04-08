/**
 * Custom auth proxy handler that properly forwards Set-Cookie headers.
 *
 * The built-in authApiHandler from @neondatabase/auth uses
 *   headers.set('set-cookie', response.headers.get('set-cookie'))
 * which combines multiple Set-Cookie values into one comma-joined string.
 * Safari (especially iOS) rejects this combined header, so the OAuth
 * challenge cookie is never stored and sign-in via Google silently fails.
 *
 * This handler proxies to NEON_AUTH_BASE_URL directly and uses
 * getSetCookie() on the upstream response (before any combining) to
 * forward each cookie as its own Set-Cookie header.
 */

const NEON_AUTH_BASE_URL = process.env.NEON_AUTH_BASE_URL!
const COOKIE_PREFIX = '__Secure-neon-auth'
const PROXY_HEADERS = ['user-agent', 'authorization', 'referer', 'content-type']
const RESPONSE_HEADERS_ALLOWLIST = [
  'content-type',
  'content-length',
  'content-encoding',
  'transfer-encoding',
  'connection',
  'date',
  'set-auth-jwt',
  'set-auth-token',
  'x-neon-ret-request-id',
]

function extractNeonAuthCookies(headers: Headers): string {
  const cookieHeader = headers.get('cookie')
  if (!cookieHeader) return ''
  return cookieHeader
    .split(';')
    .map((c) => c.trim())
    .filter((c) => c.startsWith(COOKIE_PREFIX))
    .join('; ')
}

function getOrigin(request: Request): string {
  return (
    request.headers.get('origin') ||
    request.headers.get('referer')?.split('/').slice(0, 3).join('/') ||
    new URL(request.url).origin
  )
}

async function handler(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const path = (await params).path.join('/')
  const originalUrl = new URL(request.url)
  const upstreamURL = new URL(`${NEON_AUTH_BASE_URL}/${path}`)
  upstreamURL.search = originalUrl.search

  const reqHeaders = new Headers()
  for (const h of PROXY_HEADERS) {
    const v = request.headers.get(h)
    if (v) reqHeaders.set(h, v)
  }
  reqHeaders.set('Origin', getOrigin(request))
  reqHeaders.set('Cookie', extractNeonAuthCookies(request.headers))
  reqHeaders.set('X-Neon-Auth-Next-Middleware', 'true')

  const body = request.method !== 'GET' && request.method !== 'HEAD' ? await request.text() : undefined

  const upstream = await fetch(upstreamURL.toString(), {
    method: request.method,
    headers: reqHeaders,
    body: body || undefined,
  })

  // Build response headers, handling Set-Cookie properly
  const respHeaders = new Headers()
  for (const header of RESPONSE_HEADERS_ALLOWLIST) {
    const value = upstream.headers.get(header)
    if (value) respHeaders.set(header, value)
  }

  // Forward each Set-Cookie as a separate header, stripping the
  // `Partitioned` attribute that Neon Auth adds. Safari does not support
  // `Partitioned` and silently drops cookies that include it, which
  // prevents the OAuth challenge cookie from ever being stored.
  for (const cookie of upstream.headers.getSetCookie()) {
    respHeaders.append('set-cookie', cookie.replace(/;\s*Partitioned/i, ''))
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  })
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const DELETE = handler
