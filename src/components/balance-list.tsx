'use client'

import type { Balance } from '@/types/database'
import { Currency } from '@/components/currency'
import { SettleUpDialog } from '@/components/settle-up-dialog'
import { AlertTriangleIcon, CheckCircle2Icon, ChevronDownIcon } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'

interface Member {
  id: string
  display_name: string
}

interface BalanceListProps {
  balances: Balance[]
  members: Member[]
  groupId: string
  groupCurrency: string
  currentUserId: string
}

function BalanceRow({ balance, groupId, groupCurrency, members, showSettleUp, shortenTo, currentUserId }: {
  balance: Balance
  groupId: string
  groupCurrency: string
  members: Member[]
  showSettleUp: boolean
  shortenTo?: boolean
  currentUserId: string
}) {
  const t = useTranslations('balance')
  const tc = useTranslations('common')
  const ts = useTranslations('settleUp')

  return (
    <Collapsible>
      <div className={`rounded-lg border p-4 ${showSettleUp ? 'border-primary/30 bg-primary/5' : ''}`}>
        <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 text-left">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm">
              <span className="font-medium">{balance.from_user_name}</span>
              {` ${t('owes')} `}
              <span className="font-medium">{shortenTo ? tc('you') : balance.to_user_name}</span>
            </p>
            <p className="text-base font-semibold flex items-center gap-1.5">
              <Currency amount={balance.amount} currency={balance.currency} />
              {balance.hasConversionWarning && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertTriangleIcon className="size-3.5 shrink-0 text-amber-500" aria-label={t('conversionUnavailable')} />
                  </TooltipTrigger>
                  <TooltipContent>{t('conversionUnavailable')}</TooltipContent>
                </Tooltip>
              )}
            </p>
          </div>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
          <div className="mt-3 pt-3 border-t flex flex-col gap-0.5">
            {balance.breakdown.map((item, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                {item.expense_title}
                {(balance.breakdown.length > 1 || balance.offset) && (
                  <span className="ml-1 tabular-nums">
                    · <Currency amount={item.amount} currency={item.currency} className="inline" />
                    {item.convertedAmount != null && (
                      <span className="text-muted-foreground/60"> (~<Currency amount={item.convertedAmount} currency={balance.currency} className="inline" />)</span>
                    )}
                    {item.conversionFailed && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertTriangleIcon className="ml-1 size-3 inline-block align-text-top text-amber-500" aria-label={t('conversionUnavailable')} />
                        </TooltipTrigger>
                        <TooltipContent>{t('conversionUnavailable')}</TooltipContent>
                      </Tooltip>
                    )}
                  </span>
                )}
              </p>
            ))}
            {balance.offset != null && balance.offsetBreakdown != null && (
              <p className="text-xs font-bold text-muted-foreground mt-2">
                {t('offsetLabel', {
                  name: balance.to_user_id === currentUserId ? tc('you') : balance.to_user_name,
                  verb: balance.to_user_id === currentUserId ? t('owe') : t('owes'),
                })}
              </p>
            )}
            {balance.offsetBreakdown?.map((item, i) => (
              <p key={`offset-${i}`} className="text-xs text-muted-foreground">
                {item.expense_title}
                <span className="ml-1 tabular-nums">
                  · −<Currency amount={item.amount} currency={item.currency} className="inline" />
                  {item.convertedAmount != null && (
                    <span className="text-muted-foreground/60"> (~<Currency amount={item.convertedAmount} currency={balance.currency} className="inline" />)</span>
                  )}
                  {item.conversionFailed && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangleIcon className="ml-1 size-3 inline-block align-text-top text-amber-500" aria-label={t('conversionUnavailable')} />
                      </TooltipTrigger>
                      <TooltipContent>{t('conversionUnavailable')}</TooltipContent>
                    </Tooltip>
                  )}
                </span>
              </p>
            ))}
            {showSettleUp && (
              <SettleUpDialog
                groupId={groupId}
                currency={groupCurrency}
                members={members}
                defaultFromId={balance.from_user_id}
                defaultToId={balance.to_user_id}
                defaultAmount={balance.amount}
                trigger={
                  <Button variant="outline" size="sm" className="w-full mt-3">
                    {shortenTo ? t('markSettled') : ts('trigger')}
                  </Button>
                }
              />
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

export function BalanceList({ balances, members, groupId, groupCurrency, currentUserId }: BalanceListProps) {
  const t = useTranslations('balance')

  if (balances.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2Icon}
        title={t('settledTitle')}
        description={t('settledDesc')}
      />
    )
  }

  const iOwe = balances.filter(b => b.from_user_id === currentUserId)
  const owedToMe = balances.filter(b => b.to_user_id === currentUserId)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {iOwe.length === 0 ? (
          <EmptyState
            icon={CheckCircle2Icon}
            title={t('youDontOweTitle')}
            description={t('youDontOweDesc')}
          />
        ) : (
          <AnimatePresence initial={false}>
            {iOwe.map(balance => (
              <motion.div
                key={`${balance.from_user_id}-${balance.to_user_id}`}
                layout="position"
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              >
                <BalanceRow balance={balance} groupId={groupId} groupCurrency={groupCurrency} members={members} showSettleUp currentUserId={currentUserId} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {owedToMe.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('owedToYouLabel')}</p>
          <AnimatePresence initial={false}>
            {owedToMe.map(balance => (
              <motion.div
                key={`${balance.from_user_id}-${balance.to_user_id}`}
                layout="position"
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              >
                <BalanceRow balance={balance} groupId={groupId} groupCurrency={groupCurrency} members={members} showSettleUp shortenTo currentUserId={currentUserId} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
