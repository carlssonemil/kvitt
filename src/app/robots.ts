import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/terms', '/privacy', '/changelog', '/auth/'],
        disallow: ['/groups', '/groups/', '/profile', '/invite/', '/api/'],
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://kvitt.emca.app'}/sitemap.xml`,
  }
}
