// ─── Base DB types (mirror SQL schema 1:1) ───────────────────────────────────

export interface DbUser {
  id: string
  display_name: string
  email: string
  avatar_url: string | null
  locale: string
  created_at: string
  deleted_at: string | null
}

export interface DbGroup {
  id: string
  name: string
  description: string | null
  currency: string
  created_by: string
  invite_code: string
  created_at: string
}

export interface DbGroupMember {
  id: string
  group_id: string
  user_id: string
  joined_at: string
}

export interface DbExpense {
  id: string
  group_id: string
  paid_by: string
  title: string
  amount: number
  currency: string
  date: string
  note: string | null
  category: string | null
  created_by: string
  created_at: string
}

export interface DbExpenseSplit {
  id: string
  expense_id: string
  user_id: string
  amount: number
}

export interface DbSettlement {
  id: string
  group_id: string
  paid_by: string
  paid_to: string
  amount: number
  currency: string
  note: string | null
  created_at: string
}

// ─── Derived / UI types ───────────────────────────────────────────────────────

export interface GroupWithMemberCount extends DbGroup {
  member_count: number
  your_balance: number // positive = others owe you, negative = you owe others
}

export interface ExpenseWithPayer extends DbExpense {
  paid_by_name: string
  paid_by_avatar: string | null
  splits: ExpenseSplitWithUser[]
}

export interface ExpenseSplitWithUser extends DbExpenseSplit {
  user_display_name: string
  user_avatar: string | null
}

export interface GroupMemberWithUser extends DbGroupMember {
  display_name: string
  email: string
  avatar_url: string | null
}

// Who owes who within a group (after simplification)
export interface Balance {
  from_user_id: string
  from_user_name: string
  to_user_id: string
  to_user_name: string
  amount: number
  currency: string
}

export interface GroupStats {
  total_expenses: number
  total_amount: number
  expense_count: number
  your_paid: number
  your_share: number
  this_month_total: number
  last_month_total: number
  monthly_spending: { month: string; total: number }[]
  payment_split: { user_id: string; name: string; total: number }[]
  top_expenses: { title: string; total: number; count: number }[]
  category_spending: { category: string | null; total: number }[]
}
