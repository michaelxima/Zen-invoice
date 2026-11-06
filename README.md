# Invoice Claw — Invoicing and Billing Workspace

Invoice Claw is a multi-tenant invoicing application built with Next.js App Router, TypeScript, Tailwind CSS, Drizzle ORM, and PostgreSQL.

## Implemented application areas

- Invoice and estimate creation, PDF previews, and client management.
- Business-scoped data access with session ownership checks on private server actions and APIs.
- Public invoice portal access through a private UUID bearer token; draft invoices are not payable.
- Invoice email is sent only through the authenticated, rate-limited endpoint. A draft changes to Sent only after the email provider accepts the message. Reminders require an already-sent or overdue invoice.
- Stripe Connect Standard OAuth and connected-account Checkout are available only after platform configuration; a signed connected-account webhook is required to mark an invoice paid. No manual or simulated payment path marks invoices paid.
- AI parsing is optional. Enable it only after reviewing third-party data processing and privacy obligations.

Recurring invoice scheduling is not available yet. The route is informational only; no schedule is created or run.

## Runtime and package manager

The project is pinned to Next.js 16.3.0 and Node.js 20.9–24. Use the npm lockfile and npm 11.9.0. Do not mix npm and pnpm lockfiles. Production builds use Next.js's Webpack backend for a repeatable build on the supported desktop/CI environments.

```bash
npm ci
cp .env.example .env.local
```

Set `DATABASE_URL`, `NEXTAUTH_URL`, and a strong `NEXTAUTH_SECRET`. Google OAuth is optional; when enabled, register the redirect URL for the exact local origin:

```text
http://localhost:3005/api/auth/callback/google
```

Before running database commands, make sure `DATABASE_URL` is a disposable local/development database. Never run migration or seed commands against an unverified production database. Review every generated SQL migration and stage it against a backup first.

```bash
npm run db:migrate          # asks you to confirm the database name; see Testing
npm run typecheck
npm run lint
npm run test:unit
npm run dev -- --port 3005
```

## Testing against a disposable database

The browser suite, the seed command and test migrations write data, so they only run against a throwaway database. Put `TEST_DATABASE_URL` in `.env.test.local` (git-ignored). The guard in `src/db/disposable.ts` refuses to start unless the database name ends in `_test` and the host is this machine (`ALLOW_REMOTE_TEST_DATABASE=1` allows a throwaway remote database). The suite also refuses to run if `TEST_DATABASE_URL` is the same database as `DATABASE_URL` in `.env.local`.

```bash
npm run db:test:create     # creates the test database (add -- --reset to drop and recreate it)
npm run db:migrate:test    # applies migrations to the test database
```

Playwright starts its own `next dev` on port 3105 (`E2E_PORT`) with `DATABASE_URL` set to the test database, and never reuses a running server. Stop any `npm run dev` for this project first: Next.js allows only one dev server per project.

`npm run db:migrate` (no `:test`) refuses to touch any database until you name it in `MIGRATE_CONFIRM_DATABASE`. Take a backup and prove it restores before migrating a real database.

CI provisions a disposable `invoice_claw_test` PostgreSQL service:

```bash
npm run test:e2e
```

For a production build and local start smoke test:

```bash
npm run build
npm run start
```

## Optional services

- **Stripe Connect:** configure `STRIPE_CONNECT_CLIENT_ID`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` in the deployment secret manager. Register `https://<production-origin>/api/stripe/webhook` for the connected-account events `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Sign in to the app and open Business Settings to connect a Stripe account. Each business must connect its own account before its invoice portal can create card Checkout sessions.
- **Resend:** configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL` using a verified sender domain. Until this is configured, initial invoice email and reminders fail visibly and invoices remain drafts.
- **AI parsing:** configure a supported Gemini API key only after reviewing third-party data processing, request-size limits, and applicable privacy disclosures.

Keep all keys server-side. Never use a `NEXT_PUBLIC_` prefix for secret keys. Production `NEXTAUTH_URL` must be the canonical HTTPS origin. No deployment provider is preselected by this repository.
