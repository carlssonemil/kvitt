import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://kvitt.emca.app'
  return [
    { url: base, priority: 1 },
    { url: `${base}/auth/sign-in`, priority: 0.8 },
    { url: `${base}/auth/sign-up`, priority: 0.8 },
    { url: `${base}/changelog`, priority: 0.5 },
    { url: `${base}/terms`, priority: 0.3 },
    { url: `${base}/privacy`, priority: 0.3 },
  ]
}
