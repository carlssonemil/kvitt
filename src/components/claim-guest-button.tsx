'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { claimGuest } from '@/actions/member-actions'
import { ROUTES } from '@/lib/constants'

export function ClaimGuestButton({ claimToken }: { claimToken: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleClaim() {
    startTransition(async () => {
      const result = await claimGuest(claimToken)
      if (result.error) {
        toast.error(result.error)
        return
      }
      router.push(ROUTES.GROUP(result.groupId!))
    })
  }

  return (
    <Button onClick={handleClaim} disabled={isPending}>
      {isPending ? 'Claiming…' : 'Claim'}
    </Button>
  )
}
