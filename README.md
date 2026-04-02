# Kvitt

Split bills and track shared expenses with friends. Kvitt makes it easy to see who owes what and settle up.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** Neon Postgres
- **Auth:** Neon Auth
- **UI:** shadcn/ui + Tailwind CSS
- **Deployment:** Vercel

## Features

- Create groups and invite members via link
- Add expenses with flexible split options (equal, exact, percentage)
- Track balances across multiple currencies with live exchange rates
- Record settlements to clear debts
- Expense history with filtering and infinite scroll
- Light/dark mode

## Local Development

**Prerequisites:** Node.js 20+, a [Neon](https://neon.tech) database

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
