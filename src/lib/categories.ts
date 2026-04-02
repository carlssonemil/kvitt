import {
  UtensilsIcon,
  CarIcon,
  ShoppingCartIcon,
  ShoppingBasketIcon,
  BedDoubleIcon,
  PopcornIcon,
  ZapIcon,
  HeartPulseIcon,
  PackageIcon,
  ReceiptIcon,
  GiftIcon,
  HomeIcon,
  RepeatIcon,
  PlaneIcon,
  HandCoinsIcon,
  type LucideIcon,
} from 'lucide-react'

export const EXPENSE_CATEGORIES = [
  { key: 'accommodation', label: 'Accommodation',  icon: BedDoubleIcon },
  { key: 'entertainment', label: 'Entertainment',  icon: PopcornIcon },
  { key: 'food',          label: 'Food & Drink',   icon: UtensilsIcon },
  { key: 'gifts',         label: 'Gifts',          icon: GiftIcon },
  { key: 'groceries',     label: 'Groceries',      icon: ShoppingBasketIcon },
  { key: 'health',        label: 'Health',         icon: HeartPulseIcon },
  { key: 'rent',          label: 'Rent',           icon: HomeIcon },
  { key: 'shopping',      label: 'Shopping',       icon: ShoppingCartIcon },
  { key: 'subscriptions', label: 'Subscriptions',  icon: RepeatIcon },
  { key: 'transport',     label: 'Transport',      icon: CarIcon },
  { key: 'travel',        label: 'Travel',         icon: PlaneIcon },
  { key: 'utilities',     label: 'Utilities',      icon: ZapIcon },
  { key: 'other',         label: 'Other',          icon: PackageIcon },
] as const

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]['key']

export const CATEGORY_MAP = Object.fromEntries(
  EXPENSE_CATEGORIES.map(c => [c.key, { label: c.label, icon: c.icon }])
) as Record<string, { label: string; icon: LucideIcon }>

export function getCategoryIcon(category: string | null): LucideIcon {
  if (category === 'settlement') return HandCoinsIcon
  return category ? (CATEGORY_MAP[category]?.icon ?? ReceiptIcon) : ReceiptIcon
}

export function getCategoryLabel(category: string | null): string {
  return category ? (CATEGORY_MAP[category]?.label ?? category) : 'Uncategorized'
}
