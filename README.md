<table><tr>
<td><img src="public/logo-192.png" alt="Kvitt logo" width="48" height="48" /></td>
<td><h1>Kvitt</h1></td>
</tr></table>

Split bills and track shared expenses with friends. Kvitt makes it easy to see who owes what and settle up.

## Features

- Split any expense your way — equally, by exact amounts, or by percentage
- Balances that stay current — update the moment an expense or settlement is added
- See where the money goes — spending broken down by category and month
- Any currency, converted automatically at today's rate
- Create groups and invite members via link
- Record settlements to clear debts
- Expense history with filtering and infinite scroll
- English and Swedish, with more locales easy to add
- Light/dark mode

## Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** Neon Postgres
- **Auth:** Neon Auth
- **UI:** shadcn/ui + Tailwind CSS
- **i18n:** next-intl (English, Swedish)
- **Animation:** Framer Motion
- **Charts:** Recharts
- **Testing:** Vitest
- **Deployment:** Vercel

## Local Development

**Prerequisites:** Node.js 22.13+ (see `.tool-versions`; `asdf install` picks it up automatically), a [Neon](https://neon.tech) database

1. Clone the repo and install dependencies:

```bash
npm install
```

2. Copy the environment variables and fill them in:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `NEON_AUTH_BASE_URL` | Neon Auth base URL |
| `NEXT_PUBLIC_BASE_URL` | Public URL (e.g. `http://localhost:3000`) |

3. Set up the database:

```bash
psql $DATABASE_URL -f schema.sql
```

4. (Optional) Seed with sample data:

```bash
psql $DATABASE_URL -f seeds.sql
```

5. Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Testing

```bash
npm test          # run once
npm run test:watch  # watch mode
```
