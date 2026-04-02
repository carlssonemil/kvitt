-- Kvitt seed data — "Ski Trip 2026" test group
--
-- Prerequisites:
--   1. Run schema.sql to create all tables
--   2. Sign in to the app at least once (this creates your row in `users`)
--   3. Run this file: psql $DATABASE_URL -f seeds.sql
--
-- Safe to re-run — all inserts are idempotent.

DO $$
DECLARE
  -- Your account: detected from the first user in the database (the one who signed in)
  v_me          UUID;

  -- Fake users
  v_anna        UUID;
  v_bjorn       UUID;
  v_cecilia     UUID;

  -- Group
  v_group       UUID;

  -- Expenses
  v_exp1        UUID;
  v_exp2        UUID;
  v_exp3        UUID;
  v_exp4        UUID;
  v_exp5        UUID;
  v_exp6        UUID;

BEGIN
  -- ── Real user ──────────────────────────────────────────────────────────────
  SELECT id INTO v_me FROM users ORDER BY created_at ASC LIMIT 1;

  IF v_me IS NULL THEN
    RAISE EXCEPTION 'No users found. Sign in to the app first, then re-run seeds.sql.';
  END IF;

  -- ── Fake users ─────────────────────────────────────────────────────────────
  INSERT INTO users (display_name, email, avatar_url)
    VALUES ('Anna Lindstrom', 'anna@example.com', NULL)
    ON CONFLICT (email) DO NOTHING;
  SELECT id INTO v_anna FROM users WHERE email = 'anna@example.com';

  INSERT INTO users (display_name, email, avatar_url)
    VALUES ('Bjorn Eriksson', 'bjorn@example.com', NULL)
    ON CONFLICT (email) DO NOTHING;
  SELECT id INTO v_bjorn FROM users WHERE email = 'bjorn@example.com';

  INSERT INTO users (display_name, email, avatar_url)
    VALUES ('Cecilia Holm', 'cecilia@example.com', NULL)
    ON CONFLICT (email) DO NOTHING;
  SELECT id INTO v_cecilia FROM users WHERE email = 'cecilia@example.com';

  -- ── Group ──────────────────────────────────────────────────────────────────
  INSERT INTO groups (id, name, description, currency, created_by, invite_code)
    VALUES (
      gen_random_uuid(),
      'Ski Trip 2026',
      'Are, March 6-9',
      'SEK',
      v_me,
      'seed-skitrip26'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_group;

  -- If the group already existed, look it up
  IF v_group IS NULL THEN
    SELECT id INTO v_group FROM groups WHERE name = 'Ski Trip 2026' AND created_by = v_me;
  END IF;

  -- ── Members ────────────────────────────────────────────────────────────────
  INSERT INTO group_members (group_id, user_id) VALUES (v_group, v_me)       ON CONFLICT DO NOTHING;
  INSERT INTO group_members (group_id, user_id) VALUES (v_group, v_anna)     ON CONFLICT DO NOTHING;
  INSERT INTO group_members (group_id, user_id) VALUES (v_group, v_bjorn)    ON CONFLICT DO NOTHING;
  INSERT INTO group_members (group_id, user_id) VALUES (v_group, v_cecilia)  ON CONFLICT DO NOTHING;

  -- ── Expenses ───────────────────────────────────────────────────────────────
  -- 1. Cabin rental — you paid, split equally
  INSERT INTO expenses (id, group_id, paid_by, title, amount, currency, date, note, category, created_by)
    VALUES (gen_random_uuid(), v_group, v_me, 'Cabin rental', 4800.00, 'SEK', '2026-03-06', 'Booked via listing site', 'accommodation', v_me)
    RETURNING id INTO v_exp1;

  INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (v_exp1, v_me,      1200.00) ON CONFLICT DO NOTHING;
  INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (v_exp1, v_anna,    1200.00) ON CONFLICT DO NOTHING;
  INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (v_exp1, v_bjorn,   1200.00) ON CONFLICT DO NOTHING;
  INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (v_exp1, v_cecilia, 1200.00) ON CONFLICT DO NOTHING;

  -- 2. Lift passes day 1 — Anna paid, split equally
  INSERT INTO expenses (id, group_id, paid_by, title, amount, currency, date, note, category, created_by)
    VALUES (gen_random_uuid(), v_group, v_anna, 'Lift passes day 1', 2600.00, 'SEK', '2026-03-07', NULL, 'entertainment', v_anna)
    RETURNING id INTO v_exp2;

  INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (v_exp2, v_me,      650.00) ON CONFLICT DO NOTHING;
  INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (v_exp2, v_anna,    650.00) ON CONFLICT DO NOTHING;
  INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (v_exp2, v_bjorn,   650.00) ON CONFLICT DO NOTHING;
  INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (v_exp2, v_cecilia, 650.00) ON CONFLICT DO NOTHING;

  -- 3. Dinner day 1 — Bjorn paid, split equally
  INSERT INTO expenses (id, group_id, paid_by, title, amount, currency, date, note, category, created_by)
    VALUES (gen_random_uuid(), v_group, v_bjorn, 'Dinner at the lodge', 1380.00, 'SEK', '2026-03-07', 'Burgers and beers', 'food', v_bjorn)
    RETURNING id INTO v_exp3;

  INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (v_exp3, v_me,      345.00) ON CONFLICT DO NOTHING;
  INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (v_exp3, v_anna,    345.00) ON CONFLICT DO NOTHING;
  INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (v_exp3, v_bjorn,   345.00) ON CONFLICT DO NOTHING;
  INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (v_exp3, v_cecilia, 345.00) ON CONFLICT DO NOTHING;

  -- 4. Groceries — Cecilia paid, split equally
  INSERT INTO expenses (id, group_id, paid_by, title, amount, currency, date, note, category, created_by)
    VALUES (gen_random_uuid(), v_group, v_cecilia, 'Groceries', 860.00, 'SEK', '2026-03-07', 'Breakfast and lunch supplies', 'shopping', v_cecilia)
    RETURNING id INTO v_exp4;

  INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (v_exp4, v_me,      215.00) ON CONFLICT DO NOTHING;
  INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (v_exp4, v_anna,    215.00) ON CONFLICT DO NOTHING;
  INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (v_exp4, v_bjorn,   215.00) ON CONFLICT DO NOTHING;
  INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (v_exp4, v_cecilia, 215.00) ON CONFLICT DO NOTHING;

  -- 5. Lift passes day 2 — you paid, Cecilia left early (uneven split)
  INSERT INTO expenses (id, group_id, paid_by, title, amount, currency, date, note, category, created_by)
    VALUES (gen_random_uuid(), v_group, v_me, 'Lift passes day 2', 1950.00, 'SEK', '2026-03-08', 'Cecilia headed home early', 'entertainment', v_me)
    RETURNING id INTO v_exp5;

  INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (v_exp5, v_me,    650.00) ON CONFLICT DO NOTHING;
  INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (v_exp5, v_anna,  650.00) ON CONFLICT DO NOTHING;
  INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (v_exp5, v_bjorn, 650.00) ON CONFLICT DO NOTHING;

  -- 6. Last dinner — Anna paid, split equally among 3
  INSERT INTO expenses (id, group_id, paid_by, title, amount, currency, date, note, category, created_by)
    VALUES (gen_random_uuid(), v_group, v_anna, 'Last dinner', 960.00, 'SEK', '2026-03-08', NULL, 'food', v_anna)
    RETURNING id INTO v_exp6;

  INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (v_exp6, v_me,    320.00) ON CONFLICT DO NOTHING;
  INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (v_exp6, v_anna,  320.00) ON CONFLICT DO NOTHING;
  INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (v_exp6, v_bjorn, 320.00) ON CONFLICT DO NOTHING;

  -- ── Settlement ─────────────────────────────────────────────────────────────
  -- Bjorn partially pays Anna back
  INSERT INTO settlements (group_id, paid_by, paid_to, amount, note)
    VALUES (v_group, v_bjorn, v_anna, 500.00, 'Mobile payment')
    ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seed complete. Group "Ski Trip 2026" created with id = %', v_group;
END $$;
