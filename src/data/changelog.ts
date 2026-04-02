export type ChangelogEntry = {
  date: string
  title: string
  description: string | string[]
}

export const changelog: ChangelogEntry[] = [
  {
    date: '2026-04-02',
    title: 'Initial release',
    description: 'Kvitt is live! Track and split shared expenses with friends and groups.',
  },
]
