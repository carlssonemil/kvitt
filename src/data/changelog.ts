export type ChangelogEntry = {
  date: string
  title: string
  description: string | string[]
}

export const changelog: ChangelogEntry[] = [
  {
    date: '2026-04-08',
    title: 'Google sign-in fixes',
    description: [
      'Fixed Google OAuth flow so that signing in or signing up with Google now correctly establishes a session.',
      'New users signing in with Google are automatically registered — no need to sign up separately.',
    ],
  },
  {
    date: '2026-04-07',
    title: 'Bug fixes',
    description: [
      'Fixed the "Add expense" button not appearing in groups with no expenses on mobile.',
      'Fixed a layout scaling issue on mobile caused by a missing viewport meta tag.',
    ],
  },
  {
    date: '2026-04-02',
    title: 'Initial release',
    description: 'Kvitt is live! Track and split shared expenses with friends and groups.',
  },
]
