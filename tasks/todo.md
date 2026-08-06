# Dependency update plan

Source: `npm audit` (21 vulnerabilities: 1 critical, 10 high, 8 moderate, 2 low) + `npm outdated`, captured 2026-08-06.

Each phase below is intended as a separate PR, ordered by risk/value. Verify with `npm run build` and `npm test` after each phase. Note: only the production `DATABASE_URL` exists in this environment (no dev database) — confirm whether `vitest` touches `src/lib/db.ts` before running tests, and don't run writes/tests against prod without checking first.

## Phase 1 — Safe transitive fixes ✅ done 2026-08-06
- [x] Run `npm audit fix` (no `--force`)
- [x] Fixes (all transitive, resolved within existing semver ranges): `qs`, `uuid`, `ua-parser-js`, `js-yaml`, `kysely`, `brace-expansion`, `defu`, `fast-uri`, `body-parser`, `@babel/core`, `express-rate-limit`, `ip-address`
- [x] Run build + test suite, confirm no regressions — 153/153 tests pass, build compiles/type-checks cleanly (fails only at page-data collection due to missing `DATABASE_URL`, expected — no dev DB in this environment)
- [x] Commit lockfile changes — only `package-lock.json` changed, `package.json` untouched
- Result: 21 → 9 vulnerabilities remaining (1 critical, 3 high, 5 moderate) — the rest need Phase 2 (`next`) and Phase 3 (`@neondatabase/auth`)

## Phase 2 — Next.js 16.2.1 → 16.3.0
- [ ] Read `node_modules/next/dist/docs/` and changelog for 16.3 deprecations before changing code (per AGENTS.md — this fork diverges from upstream Next conventions)
- [ ] Bump `next` and `eslint-config-next` to `16.3.0` in `package.json`
- [ ] Resolves 12 high-severity Next CVEs (DoS, cache poisoning, middleware/proxy bypass, SSRF, XSS) plus bundled `postcss`/`sharp` vulnerabilities
- [ ] Run build + test suite

## Phase 3 — `@neondatabase/auth` 0.1.0-beta.21 → 0.4.2-beta
- [ ] Isolate in its own PR — critical severity (2FA bypass, account takeover via OAuth/magic-link) but a pre-1.0 beta package jumping several beta versions on the auth layer
- [ ] Review `@neondatabase/auth` changelog across beta.21 → 0.2.0-beta → 0.3.0-beta → 0.4.0/0.4.1/0.4.2-beta for breaking API changes
- [ ] `npm audit fix --force` could not resolve this automatically (`Will install undefined@undefined`) — bump manually in `package.json`
- [ ] Manually exercise login, 2FA, OAuth, and session flows after upgrade (not just automated tests)

## Phase 4 — `shadcn` devDependency 4.1.1 → 4.16.1
- [ ] Dev-only CLI tool, low blast radius (not shipped to prod)
- [ ] Resolves moderate `hono`/`@hono/node-server` path-traversal issues via updated `@modelcontextprotocol/sdk`
- [ ] Bump and re-run `npx shadcn` once to confirm CLI still works with existing `components.json`

## Phase 5 — Routine in-range bumps (batch into one PR)
- [ ] `@neondatabase/serverless` 1.0.2 → 1.1.0
- [ ] `tailwindcss` / `@tailwindcss/postcss` 4.2.2 → 4.3.3
- [ ] `@types/node`, `@types/react`, `@types/react-dom` → latest within current major
- [ ] `date-fns` 4.1.0 → 4.4.0
- [ ] `next-intl` 4.11.0 → 4.13.5
- [ ] `radix-ui` 1.4.3 → 1.6.7
- [ ] `tailwind-merge` 3.5.0 → 3.6.0
- [ ] `recharts` 3.8.0 → 3.10.1
- [ ] `framer-motion` 12.38.0 → 12.43.0 (stay on 12.x)
- [ ] `lucide-react` 1.7.0 → 1.28.0 (spot-check icons still render — frequent releases)
- [ ] `nanoid` 5.1.7 → 5.1.16 (stay on 5.x)
- [ ] `eslint` 9.39.4 → 9.39.5 (stay on 9.x)
- [ ] Run build + test suite

## Phase 6 — Major-version evaluations (each its own spike, not bundled)
- [ ] TypeScript 5.9.3 → 7.0.2 — review breaking changes across two majors
- [ ] Vitest 3.2.7 → 4.1.10 — check config/API breaking changes
- [ ] ESLint 9 → 10 — check flat-config/rule changes
- [ ] `framer-motion` 12 → 13 — check if project should migrate to the renamed `motion` package instead
- [ ] `react-day-picker` 9.14.0 → 10.0.1 — used by date pickers, verify API surface
- [ ] `nanoid` 5 → 6 — verify ESM-only doesn't break build
- [ ] `react`/`react-dom` currently pinned exact at `19.2.4` (latest `19.2.8`) — consider relaxing pin or bumping manually

## Phase 7 — Infra
- [ ] Bump local/CI Node engine to ≥20.19 — several transitive deps (`@noble/ciphers`, `@noble/hashes`, `eslint-visitor-keys@5`, `validate-npm-package-name@7`) already require it; current env is v20.11.0 and throws `EBADENGINE` warnings on install

## Review
(fill in after execution: what was done, what deviated from plan, what broke)
