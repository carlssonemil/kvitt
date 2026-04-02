export const DEFAULT_CURRENCY = 'SEK'

export const SUPPORTED_CURRENCIES = ['SEK', 'EUR', 'USD', 'GBP', 'NOK', 'DKK'] as const
export type Currency = typeof SUPPORTED_CURRENCIES[number]

export const SPLIT_TYPES = ['equal', 'exact', 'percentage'] as const
export type SplitType = typeof SPLIT_TYPES[number]

export const ROUTES = {
  HOME: '/',
  GROUPS: '/groups',
  GROUP: (id: string) => `/groups/${id}`,
  INVITE: (code: string) => `/invite/${code}`,
  PROFILE: '/profile',
  SIGN_IN: '/handler/sign-in',
  SIGN_UP: '/handler/sign-up',
} as const

export const GROUP_TABS = ['expenses', 'balances', 'stats', 'settings'] as const
export type GroupTab = typeof GROUP_TABS[number]
