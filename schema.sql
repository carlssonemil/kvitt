-- Kvitt shared expenses schema

-- Users (synced from Better Auth on first action via ensureUser)
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);

-- Groups
CREATE TABLE IF NOT EXISTS groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  currency    TEXT NOT NULL DEFAULT 'SEK',
  created_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_groups_created_by   ON groups(created_by);
CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_invite_code ON groups(invite_code);

-- Group members
CREATE TABLE IF NOT EXISTS group_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id  ON group_members(user_id);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  paid_by    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  amount     NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency   TEXT NOT NULL DEFAULT 'SEK',
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  note       TEXT,
  category   TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_group_id ON expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by  ON expenses(paid_by);

-- Expense splits (how an expense is divided among members)
CREATE TABLE IF NOT EXISTS expense_splits (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  UNIQUE (expense_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_id ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_user_id    ON expense_splits(user_id);

-- Settlements (recording that someone paid someone back)
CREATE TABLE IF NOT EXISTS settlements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  paid_by    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  paid_to    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency   TEXT NOT NULL DEFAULT 'SEK',
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_settlements_group_id ON settlements(group_id);
CREATE INDEX IF NOT EXISTS idx_settlements_paid_by  ON settlements(paid_by);
CREATE INDEX IF NOT EXISTS idx_settlements_paid_to  ON settlements(paid_to);
