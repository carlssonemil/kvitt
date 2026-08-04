'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { getGroupStatsAction } from '@/actions/group-actions'
import type { GroupStats } from '@/types/database'

interface GroupStatsCacheValue {
  stats: GroupStats | null
  error: string | null
  prefetch: () => void
  invalidate: () => void
}

const GroupStatsCacheContext = createContext<GroupStatsCacheValue | null>(null)

type FetchStatus = 'idle' | 'loading' | 'loaded' | 'error'

export function GroupStatsCacheProvider({ groupId, children }: { groupId: string; children: React.ReactNode }) {
  const [stats, setStats] = useState<GroupStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const statusRef = useRef<FetchStatus>('idle')

  const prefetch = useCallback(() => {
    if (statusRef.current === 'loading' || statusRef.current === 'loaded') return
    statusRef.current = 'loading'
    getGroupStatsAction(groupId).then(result => {
      if (result.error) {
        statusRef.current = 'error'
        setError(result.error)
      } else {
        statusRef.current = 'loaded'
        setStats(result.stats ?? null)
      }
    })
  }, [groupId])

  const invalidate = useCallback(() => {
    statusRef.current = 'idle'
    setStats(null)
    setError(null)
    prefetch()
  }, [prefetch])

  const value = useMemo(
    () => ({ stats, error, prefetch, invalidate }),
    [stats, error, prefetch, invalidate]
  )

  return (
    <GroupStatsCacheContext.Provider value={value}>
      {children}
    </GroupStatsCacheContext.Provider>
  )
}

export function useGroupStatsCache(): GroupStatsCacheValue {
  const ctx = useContext(GroupStatsCacheContext)
  if (!ctx) throw new Error('useGroupStatsCache must be used within a GroupStatsCacheProvider')
  return ctx
}
