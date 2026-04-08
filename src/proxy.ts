import { neonAuthMiddleware } from '@neondatabase/auth/next/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const handler = neonAuthMiddleware({ loginUrl: '/auth/sign-in' })

export async function proxy(request: NextRequest) {
  // On public routes, only intercept to exchange the OAuth verifier token
  const { pathname } = request.nextUrl
  const isProtected = pathname.startsWith('/groups') || pathname === '/profile'
  if (!isProtected && !request.nextUrl.searchParams.has('neon_auth_session_verifier')) {
    return NextResponse.next()
  }
  return handler(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|api/).*)'],
}
