import { neonAuthMiddleware } from '@neondatabase/auth/next/server'
import type { NextRequest } from 'next/server'

const handler = neonAuthMiddleware({ loginUrl: '/auth/sign-in' })

export function proxy(request: NextRequest) {
  return handler(request)
}

export const config = {
  matcher: ['/groups/:path*', '/profile'],
}
