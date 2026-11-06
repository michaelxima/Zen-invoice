# Invoice Claw — Master Plan: From "Works" to World-Class

> Written after auditing the actual code (schema, money math, invoice actions, Stripe checkout/webhook,
> rate limiter, tests, CI) — not from the roadmap's claims. Every work package names the files it touches.

---

## 0. The Master Prompt (paste this into your coding agent at the start of every session)

```text
You are the principal engineer on Invoice Claw, a multi-tenant invoicing SaaS
(Next.js 16.3 App Router, React 19, TypeScript strict, Drizzle + PostgreSQL, Stripe Connect, Resend).

NON-NEGOTIABLES
1. Read AGENTS.md first. This Next.js version has breaking changes: before touching routing,
   caching, server actions, proxy.ts or config, read the matching guide in node_modules/next/dist/docs/.
2. Work ONLY on the single work package (WP) I name from MASTER-PLAN.md. One WP = one commit/PR.
   Do not refactor outside its scope. If you discover another problem, append it to
   MASTER-PLAN.md §7 "Discovered issues" instead of fixing it.
3. Money is integer minor units (bigint/number-safe) end to end. Never use floats, parseFloat,
   or toFixed for money. All money logic lives in src/lib/money/ and is 100% branch-covered.
4. Every query on tenant data is scoped by businessId derived from the session — never from input.
   Every new route/action gets a cross-tenant negative test.
5. Never mark an invoice paid except from a verified, deduplicated Stripe webhook.
6. No network calls (Stripe, Resend, AI) inside a DB transaction holding row locks.
7. Migrations: generate, read the SQL, make them backward compatible (expand → migrate → contract).
   Only run against a disposable database. Never db:push.
8. Use npm only. Never add a dependency without stating why and its bundle/server cost.

DEFINITION OF DONE (all must pass, paste the output in your final message)
  npm run lint && npm run typecheck && npm run test:unit && npm run build && npm run test:e2e
  + new/changed behaviour has tests (unit for logic, Playwright for user journeys)
  + no new `any`, console.log, TODO, or dead files
  + UI changes: keyboard-navigable, axe-clean, works at 360px and 1440px, light + dark
  + a 3-line CHANGELOG entry: what changed, why, how it was verified

At the end, report: files changed, tests added, gate output, risks, and the next WP.
```

---

## 1. Honest Audit — Where the App Really Is

**What's genuinely good (keep it):**
- Tenant scoping via `getSessionBusinessId()` in server actions; client lookups check `businessId`.
- Payments only settle through a signed Stripe webhook, with livemode mismatch protection.
- Checkout reuses an open session and uses row locking; zod validation on inputs.
- Invoice send only flips Draft → Sent after the email provider accepts. Archive instead of delete.
- CI already runs lint, typecheck, unit tests, migrations, build and Playwright on disposable Postgres.

**What keeps it mediocre (evidence → impact):**

| # | Problem | Where | Impact |
|---|---------|-------|--------|
| A1 | **No git repository** in the project folder | project root | One bad agent edit = unrecoverable. CI can't run. |
| A2 | Money computed as JS floats, stored via `toFixed(2)` | `calculator.ts`, `actions/invoices.ts`, portal, PDF | Rounding drift; per-line vs total mismatch; audit risk |
| A3 | Zero-decimal currencies = only JPY; calculator duplicates the logic | `money.ts`, `calculator.ts` | Wrong charges for KRW, ISK etc. |
| A4 | **Tax & discount rates are not persisted** — `enrichInvoice` returns `taxRate: 0, discountRate: 0` | `actions/invoices.ts`, `schema.ts` | Editing/re-rendering an invoice loses its tax basis. No per-line VAT (SE 25/12/6%). |
| A5 | Status is free `varchar`, no CHECK/enum; timestamps without time zone | `schema.ts` | Invalid states possible; overdue/due-date bugs across time zones |
| A6 | Comments, reminders and events all crammed into `audit_logs.metadata` text; audit log has no `businessId`/actor | `schema.ts` | Can't query, can't prove who did what; comment sender is always "client" |
| A7 | List page is N+1: 4 queries per invoice; search filters in JS on `clientId` (not client name); no pagination | `getInvoices` | Slow at 200+ invoices; search doesn't find clients by name |
| A8 | Portal **GET marks invoice as viewed** | `getInvoiceByToken` | Email link scanners/prefetchers fake read receipts |
| A9 | Stripe API calls inside a DB transaction holding `FOR UPDATE` | `api/checkout/route.ts` | Lock held during network latency; pool exhaustion |
| A10 | No webhook event dedupe table; Stripe apiVersion force-cast | `api/stripe/webhook` | Replays rely on side effects; version drift |
| A11 | In-memory per-process rate limiter | `security/rate-limit.ts` | No protection on serverless/multi-instance |
| A12 | Almost every page is `"use client"`, 450–600-line page components | `app/**/page.tsx` | Big bundles, waterfalls, hard to test |
| A13 | i18n is one 513-line client file + localStorage | `lib/i18n.ts`, `useTranslation.ts` | Hydration flash, no SSR locale, untyped keys |
| A14 | Dead/junk files: `store.ts.new`, `store.ts.tmp`, unused in-memory `GlobalDataStore` | `lib/` | Confusion; DTO types live in a file called "store" |
| A15 | Tests: ~50 lines unit, ~100 lines e2e; no tenant-isolation, webhook, or money property tests | `__tests__`, `tests/` | "Green" CI proves very little |
| A16 | No background jobs → no recurring invoices, no automatic overdue, no scheduled reminders | `recurring/page.tsx` | Core invoicing features missing |
| A17 | Brand split: "Invoice Claw" vs "Zen-Invoice"; hardcoded `bg-slate-950` vs tokens | Sidebar, checklist, pages | Product feels unfinished |
| A18 | Roadmap contains regulated features (invoice factoring = lending) and vanity ones (ESG liters of water) | `ROADMAP.md` | Scope risk; legal exposure |

---

## 2. What "100%" Means (measurable, or it doesn't count)

| Area | Target |
|------|--------|
| Correctness | Money module 100% branch coverage + property tests; 0 known data-loss bugs |
| Security | Cross-tenant tests for every action/route; OWASP ASVS L2 checklist; CSP + security headers; secrets never client-side |
| Reliability | Webhooks idempotent; jobs retried with backoff; error rate < 0.1%; daily backup + tested restore |
| Performance | Invoice list p95 < 300 ms at 10k invoices; LCP < 2.0 s; Lighthouse ≥ 95 perf |
| Accessibility | WCAG 2.2 AA; axe 0 violations on all pages; full keyboard flow for create → send |
| Quality | 0 `any`, 0 TS errors, 0 lint warnings; ≥ 85% line coverage on `src/lib`; 12 critical e2e journeys |
| Product | Invoices, estimates, recurring, reminders, partial payments, credit notes, multi-VAT, PDF, portal, exports |
| Compliance | Sequential gapless numbering per business; immutable issued invoices (corrections via credit notes); GDPR export/delete; Peppol BIS 3.0 output |
| UX | One design system, one brand, light/dark, 7 locales server-rendered, empty/loading/error state on every screen |

---

## 3. Phases & Work Packages

Run them in order. Phase 0 and 1 are not optional — everything else builds on them.

### Phase 0 — Safety Net (day 1)
- **WP-0.1 Version control.** `git init`, verify `.gitignore` covers `.env.local`, `.next`, `test-results`, `outputs`, `.work`, `.manus`. First commit. Push to a private remote so CI runs.
- **WP-0.2 Clean house.** Delete `store.ts.new`, `store.ts.tmp`, the `GlobalDataStore` class. Move DTOs to `src/lib/types/dto.ts`. Remove `require.main` asserts from `calculator.ts` (they belong in tests).
- **WP-0.3 Test runner.** Replace the hand-rolled assert script with Vitest (`test:unit`), coverage via v8, run in CI. Keep Playwright for e2e.
- **WP-0.4 One brand.** Decide "Invoice Claw" or "Zen-Invoice". Rename everywhere (sidebar, metadata, emails, PDF, checklist).

### Phase 1 — Correctness Core (money, schema, tenancy)
- **WP-1.1 Money module** (`src/lib/money/`) — integer minor units, ISO 4217 exponents, half-up rounding, per-line tax. See §4.1. Replace every `parseFloat`/`toFixed` on money (≈30 sites found in `ai-create`, `invoices/*`, `estimates/*`, portal, PDF, actions).
- **WP-1.2 Schema v2 (expand migration)** — see §4.2: enums, `*_minor` bigint columns, per-line `tax_rate_bps`, persisted discount, `timestamptz`, `business_id` + `actor` on audit log, dedicated `invoice_comments`, `stripe_events`, `jobs`, per-business number sequences, indexes. Backfill from existing numeric columns, then switch reads, then drop old columns in a later WP.
- **WP-1.3 Immutability rule.** Once `sent`, line items/totals are locked. Changes = void + reissue or credit note. Enforce in the action *and* with a DB trigger.
- **WP-1.4 Gapless numbering.** `INV-{YYYY}-{seq}` from a per-business counter row updated in the same transaction (`UPDATE ... RETURNING`). Users can set prefix, never the sequence.
- **WP-1.5 Tenant isolation suite.** Playwright: user B tries every invoice/client/estimate ID and action of user A → all 404. Consider Postgres RLS with `SET LOCAL app.business_id` as defence in depth.

### Phase 2 — Payments & Reliability
- **WP-2.1 Webhook idempotency** — `stripe_events` insert-on-conflict gate (§4.3). Pin the Stripe API version to the one the installed SDK types declare; remove the cast.
- **WP-2.2 Checkout without held locks** — read & validate in a short transaction, call Stripe outside it, write the session ID with a compare-and-set update.
- **WP-2.3 Partial payments & refunds** — `payments` ledger is the source of truth; invoice `amount_paid_minor` derived; statuses `partially_paid`, `refunded`; handle `charge.refunded`.
- **WP-2.4 Job queue** (§4.4) — Postgres `jobs` table + `FOR UPDATE SKIP LOCKED` worker, triggered by a secured cron route. Retries with exponential backoff, dead-letter state, visible in an admin page.
- **WP-2.5 Automatic overdue** — daily job flips `sent`/`partially_paid` → `overdue` using the business's time zone.
- **WP-2.6 Distributed rate limit** — Postgres- or Redis-backed limiter (same interface as `enforceRateLimit`), per IP + per token + per business.

### Phase 3 — Product Completeness
- **WP-3.1 Recurring invoices** — `recurring_schedules` (RRULE-lite: interval, anchor day, end), generated by jobs, draft-or-auto-send option, skip/pause, preview of the next 3 dates.
- **WP-3.2 Reminder sequences** — per-business policy (−3d, 0d, +3d, +7d), tone, opt-out per client, every send logged in a real `reminders` table.
- **WP-3.3 Credit notes & void** — negative documents referencing the original, own number series, reflected in balances.
- **WP-3.4 Read receipts done right** — portal records `viewed` via a POST fired after client-side render plus user interaction signals; ignore known scanner user agents; `downloaded` on actual PDF stream.
- **WP-3.5 Items & tax catalog** — saved products/services with default VAT; tax rates per business (SE 25/12/6/0, reverse charge text for EU B2B).
- **WP-3.6 Exports** — CSV/SIE (Swedish accounting) export of invoices and payments; GDPR export & erasure per client.
- **WP-3.7 Team access** — drop `businesses.user_id UNIQUE`; `memberships(user, business, role)` with owner/admin/member/accountant roles.

### Phase 4 — Architecture & Performance
- **WP-4.1 Server-first pages** — pages become Server Components that fetch; interactive islands (editor, filters) are small client components. Target: no page file > 200 lines.
- **WP-4.2 One-query list** — invoice list with join + aggregate, cursor pagination, server-side search on number + client name (`pg_trgm` index), status filter in SQL.
- **WP-4.3 Data layer** — `src/lib/db/queries.ts` split per aggregate (`invoices.repo.ts` …); every function takes `businessId` as first arg; return typed DTOs, never raw rows to the client.
- **WP-4.4 PDF** — generate server-side in a route handler; cache by `invoice_id + updated_at`; remove `"use client"` from the PDF document.
- **WP-4.5 Typed i18n** — server-resolved locale (cookie + `Accept-Language`), per-locale JSON split by namespace, type-safe keys, `Intl` for dates/currency. No localStorage.

### Phase 5 — World-Class UX
- **WP-5.1 Design system** — tokens in `tokens.css` drive Tailwind v4 theme; ban raw `slate-*` in pages via lint rule; primitives: Button, Input, Select, Dialog, Toast, Table, Badge, EmptyState, Skeleton.
- **WP-5.2 Invoice editor** — keyboard-first line items (Tab/Enter adds row), live PDF preview, autosave drafts, undo, client quick-create inline, currency/VAT smart defaults.
- **WP-5.3 Every state designed** — loading skeletons, empty states with one clear CTA, error boundaries with retry, optimistic updates with rollback.
- **WP-5.4 Portal** — mobile-first, sticky Pay bar, payment methods available for the currency (card, Klarna, SEPA, Swish via Stripe where supported), clear paid confirmation + receipt email.
- **WP-5.5 Accessibility pass** — axe in Playwright on every route; focus management in dialogs; contrast AA in both themes.
- **WP-5.6 Onboarding** — 3 steps to the first sent invoice in < 2 minutes; measure it.

### Phase 6 — Production Operations
- **WP-6.1 Observability** — structured logger (no PII), error tracking, request IDs, job/webhook dashboards, uptime check on `/api/health`.
- **WP-6.2 Security hardening** — CSP with nonces, HSTS, `frame-ancestors`, secret scanning + `npm audit` + Dependabot in CI, session rotation, 2FA (TOTP) for owners.
- **WP-6.3 Backups & DR** — managed Postgres PITR; monthly restore drill documented.
- **WP-6.4 Environments** — preview deploys per PR against branch DBs; staging with Stripe test mode; production checklist.

### Phase 7 — Differentiators (only after 0–6 are green)
- **WP-7.1 AI capture** — upload PDF/photo → structured draft, always human-confirmed, with per-field confidence; data-processing notice & opt-in.
- **WP-7.2 Natural-language invoice** — "Bill Acme 4,500 SEK for July dev, net 30, 25% VAT" → draft, never auto-send.
- **WP-7.3 Peppol BIS 3.0 / Factur-X** — UBL XML generation validated against official Schematron in CI; send through a certified Access Point provider.
- **WP-7.4 Cash-flow insights** — expected inflow forecast, days-sales-outstanding, late-payer patterns per client.

**Deliberately cut:** invoice factoring ("Cash Out Now") — it's regulated lending; only via a licensed partner, much later. ESG "liters of water saved" — not credible; drop it.

---

## 4. Reference Implementations (the foundations everything else depends on)

> Verify any Next.js-specific API against `node_modules/next/dist/docs/` before use. The code below is framework-agnostic.

### 4.1 `src/lib/money/index.ts` — integer money, no floats

```ts
// All amounts are integer minor units (e.g. öre, cents). Quantities are thousandths (1.5 → 1500).
// Rates are basis points (25% → 2500).

const exponentCache = new Map<string, number>();

/** ISO 4217 minor-unit exponent via Intl (JPY/KRW → 0, SEK/EUR → 2, BHD → 3). */
export function currencyExponent(currency: string): number {
  const code = currency.toUpperCase();
  const cached = exponentCache.get(code);
  if (cached !== undefined) return cached;
  const exp = new Intl.NumberFormat("en", { style: "currency", currency: code })
    .resolvedOptions().maximumFractionDigits ?? 2;
  exponentCache.set(code, exp);
  return exp;
}
// NOTE: Stripe has its own special cases (e.g. ISK, HUF, TWD). Map ISO → Stripe amounts in
// src/lib/money/stripe.ts and verify against Stripe's currency docs before going live.

/** Integer division rounding half away from zero. */
export function divRound(n: bigint, d: bigint): bigint {
  if (d <= 0n) throw new Error("divisor must be positive");
  const q = n / d;
  const r = n % d;
  if (r * 2n >= d) return q + 1n;
  if (r * -2n >= d) return q - 1n;
  return q;
}

export type MoneyLine = {
  quantityMilli: number;   // 1.5 units → 1500
  unitPriceMinor: number;  // 99.50 SEK → 9950
  taxRateBps: number;      // 25% → 2500
  discountBps?: number;    // line discount, 10% → 1000
};

export type LineResult = { netMinor: number; taxMinor: number; grossMinor: number };
export type Totals = {
  lines: LineResult[];
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  taxBreakdown: Array<{ rateBps: number; baseMinor: number; taxMinor: number }>;
};

const toSafe = (v: bigint): number => {
  if (v > BigInt(Number.MAX_SAFE_INTEGER) || v < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error("amount out of safe range");
  }
  return Number(v);
};

export function computeTotals(lines: MoneyLine[], invoiceDiscountBps = 0): Totals {
  let subtotal = 0n, discount = 0n;
  const bases = new Map<number, bigint>();

  const lineResults = lines.map((l) => {
    for (const v of [l.quantityMilli, l.unitPriceMinor, l.taxRateBps, l.discountBps ?? 0]) {
      if (!Number.isSafeInteger(v)) throw new Error("money inputs must be safe integers");
    }
    const gross = divRound(BigInt(l.quantityMilli) * BigInt(l.unitPriceMinor), 1000n);
    const lineDisc = divRound(gross * BigInt(l.discountBps ?? 0), 10_000n);
    const afterLine = gross - lineDisc;
    const invDisc = divRound(afterLine * BigInt(invoiceDiscountBps), 10_000n);
    const net = afterLine - invDisc;
    subtotal += gross;
    discount += lineDisc + invDisc;
    bases.set(l.taxRateBps, (bases.get(l.taxRateBps) ?? 0n) + net);
    return { net, rate: l.taxRateBps };
  });

  // Tax is rounded once per rate (per VAT rules), not per line.
  let tax = 0n;
  const taxBreakdown = [...bases].map(([rateBps, base]) => {
    const t = divRound(base * BigInt(rateBps), 10_000n);
    tax += t;
    return { rateBps, baseMinor: toSafe(base), taxMinor: toSafe(t) };
  });

  const net = subtotal - discount;
  return {
    lines: lineResults.map(({ net: n, rate }) => {
      const t = divRound(n * BigInt(rate), 10_000n);
      return { netMinor: toSafe(n), taxMinor: toSafe(t), grossMinor: toSafe(n + t) };
    }),
    subtotalMinor: toSafe(subtotal),
    discountMinor: toSafe(discount),
    taxMinor: toSafe(tax),
    totalMinor: toSafe(net + tax),
    taxBreakdown,
  };
}

/** Parse user input like "1 234,50" or "1234.50" into minor units — the only place strings become money. */
export function parseMoney(input: string, currency: string): number {
  const exp = currencyExponent(currency);
  const cleaned = input.replace(/[\s\u00A0']/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) throw new Error("invalid amount");
  const [int, frac = ""] = cleaned.split(".");
  if (frac.length > exp) throw new Error(`max ${exp} decimals for ${currency}`);
  const minor = BigInt(int + frac.padEnd(exp, "0"));
  return toSafe(minor);
}

export function formatMoney(minor: number, currency: string, locale: string): string {
  const exp = currencyExponent(currency);
  return new Intl.NumberFormat(locale, { style: "currency", currency })
    .format(minor / 10 ** exp); // display only — never feed back into math
}
```

Tests to write first (Vitest + fast-check): totals are invariant to line order; `total = subtotal − discount + tax` always; parse→format round-trips; JPY/KRW have no decimals; 3 × 0.10 = 30 minor; mixed 25/12/6% VAT matches a hand-calculated Swedish receipt.

### 4.2 Schema v2 highlights (`src/db/schema.ts`)

```ts
import { pgEnum, pgTable, uuid, text, bigint, integer, timestamp, index, uniqueIndex, jsonb, primaryKey } from "drizzle-orm/pg-core";

export const invoiceStatus = pgEnum("invoice_status",
  ["draft", "sent", "partially_paid", "paid", "overdue", "void"]);
export const actorType = pgEnum("actor_type", ["user", "client", "system", "stripe"]);

const minor = (name: string) => bigint(name, { mode: "number" }).notNull().default(0);
const tstz = (name: string) => timestamp(name, { withTimezone: true });

// invoices: add/replace
//   status: invoiceStatus("status").notNull().default("draft"),
//   subtotalMinor: minor("subtotal_minor"), discountMinor: minor("discount_minor"),
//   taxMinor: minor("tax_minor"), totalMinor: minor("total_minor"), amountPaidMinor: minor("amount_paid_minor"),
//   discountBps: integer("discount_bps").notNull().default(0),
//   issuedAt / dueAt / paidAt / voidedAt: tstz(...)
//   + index("invoices_business_status_due_idx").on(t.businessId, t.status, t.dueAt)

// invoice_items: quantityMilli integer, unitPriceMinor bigint, taxRateBps integer, discountBps integer, position integer

export const numberSequences = pgTable("number_sequences", {
  businessId: uuid("business_id").notNull(),
  kind: text("kind").notNull(),          // 'invoice' | 'estimate' | 'credit_note'
  year: integer("year").notNull(),
  next: integer("next").notNull().default(1),
}, (t) => [primaryKey({ columns: [t.businessId, t.kind, t.year] })]);

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  action: text("action").notNull(),
  actorType: actorType("actor_type").notNull(),
  actorId: text("actor_id"),
  data: jsonb("data"),
  createdAt: tstz("created_at").defaultNow().notNull(),
}, (t) => [index("audit_business_entity_idx").on(t.businessId, t.entityType, t.entityId, t.createdAt)]);

export const invoiceComments = pgTable("invoice_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id").notNull(),
  invoiceId: uuid("invoice_id").notNull(),
  author: actorType("author").notNull(),   // 'client' | 'user'
  authorName: text("author_name").notNull(),
  body: text("body").notNull(),
  createdAt: tstz("created_at").defaultNow().notNull(),
});

export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),               // evt_...
  type: text("type").notNull(),
  account: text("account"),
  receivedAt: tstz("received_at").defaultNow().notNull(),
  processedAt: tstz("processed_at"),
});
```
Add CHECK constraints in the SQL migration: `total_minor >= 0`, `amount_paid_minor <= total_minor` (except refunds), `due_at >= issued_at`.

### 4.3 Idempotent webhook core

```ts
// inside the webhook, after signature verification
const inserted = await db.insert(stripeEvents)
  .values({ id: event.id, type: event.type, account: event.account ?? null })
  .onConflictDoNothing()
  .returning({ id: stripeEvents.id });
if (inserted.length === 0) return NextResponse.json({ received: true, duplicate: true });

await db.transaction(async (tx) => {
  await applyPaymentEvent(tx, event);   // ledger insert (unique on payment_intent) + recompute amount_paid
  await tx.update(stripeEvents).set({ processedAt: new Date() }).where(eq(stripeEvents.id, event.id));
});
// If applyPaymentEvent throws, delete the stripe_events row (or mark failed) so Stripe's retry can reprocess.
```

### 4.4 Postgres job queue (no new infrastructure)

```sql
CREATE TABLE jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         text NOT NULL,                 -- 'send_reminder' | 'generate_recurring' | 'mark_overdue'
  business_id  uuid,
  payload      jsonb NOT NULL DEFAULT '{}',
  run_at       timestamptz NOT NULL DEFAULT now(),
  attempts     int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 8,
  status       text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','dead')),
  last_error   text,
  dedupe_key   text UNIQUE                    -- e.g. 'reminder:<invoice>:+3d'
);
CREATE INDEX jobs_ready_idx ON jobs (run_at) WHERE status = 'queued';

-- Worker claim (run from a cron-triggered, secret-protected route; batch of 20):
UPDATE jobs SET status = 'running', attempts = attempts + 1
WHERE id IN (
  SELECT id FROM jobs WHERE status = 'queued' AND run_at <= now()
  ORDER BY run_at FOR UPDATE SKIP LOCKED LIMIT 20
) RETURNING *;
-- On failure: status = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'queued' END,
--             run_at = now() + (interval '1 minute' * power(2, attempts))
```

---

## 5. Critical E2E Journeys (the 12 that must always pass)

1. Register → onboarding → first invoice sent (time it).
2. Create client inline from invoice editor; fields autofill.
3. Multi-VAT invoice totals match the PDF and the portal to the öre.
4. Sent invoice cannot be edited; correction via credit note.
5. Portal: view → download PDF → pay (Stripe test) → webhook → Paid, receipt email.
6. Duplicate webhook delivery does not double-record payment.
7. Partial payment → partially_paid → second payment → paid.
8. Estimate → client accepts in portal → convert → invoice with identical lines.
9. Recurring schedule generates the next invoice on the right day in Europe/Stockholm.
10. Reminder sequence fires once per step (dedupe), respects client opt-out.
11. Cross-tenant: user B gets 404 on every resource of user A.
12. Locale switch (sv ↔ en) renders server-side with correct number/date formats.

---

## 6. Execution Order & Rough Effort (one experienced dev)

| Phase | Effort | Exit criterion |
|-------|--------|----------------|
| 0 Safety net | 1 day | Git + Vitest + one brand, CI green |
| 1 Correctness core | 1.5–2 weeks | All money integer; schema v2 live; isolation suite green |
| 2 Payments & reliability | 1.5 weeks | Idempotent webhooks, job queue, auto-overdue |
| 3 Product completeness | 3 weeks | Recurring, reminders, credit notes, exports, teams |
| 4 Architecture & perf | 1.5 weeks | p95 < 300 ms at 10k invoices; pages server-first |
| 5 UX | 2 weeks | axe clean, Lighthouse ≥ 95, design system enforced |
| 6 Operations | 1 week | Observability, CSP, restore drill done |
| 7 Differentiators | ongoing | Each behind a feature flag with its own gate |

Roughly **12–14 weeks** to a genuinely world-class v1. Anything faster skips verification.

---

## 7. Discovered Issues (agents append here, never fix out of scope)

- **2026-11-06 — WP-0.3 incomplete:** `vitest` (and `@vitest/coverage-v8` for `test:coverage`) were never added to `devDependencies`. `npm run test:unit` fails with "vitest is not recognized" and `tsc` fails on `vitest.config.ts` and the test file, so `typecheck`, `build` and CI fail on the baseline commit too. Fix: add both as dev dependencies (same version), separate commit.
- **2026-11-06 — lint warnings (pre-existing):** `@next/next/no-img-element` at `src/app/portal/[token]/page.tsx:128,190` and `src/components/Sidebar.tsx:80` (brand logo). Fold into WP-0.4 (brand rename) or WP-5.1; the Definition of Done requires 0 warnings.
- **2026-11-06 — `tests/auth.spec.ts` never runs:** it sits outside Playwright's `testDir` (`./tests/e2e`), and it expects the title `Zen-Invoice` on `/`. Move it into `tests/e2e/` (or delete it) as part of WP-0.4.
- **2026-11-06 — E2E baseline before WP-1.3 (on `fix/1.4-proxy-placement`):** 11 passed, 2 failed. `onboarding.spec.ts` stops at "Step 3 of 3" and `invoice.spec.ts` times out waiting for the business-name field after "Continue to business". Both match the known onboarding bug (values kept only on blur). Re-run after WP-1.3.
- **2026-11-06 — Vitest 5 config warning:** `vitest.config.ts` uses ESM syntax but is loaded as CommonJS (no `"type": "module"`); Vite says the native config loader will reject this in a future major. Fix: rename to `vitest.config.mts`. Separate small commit.
- **2026-11-06 — Next.js 16.4.5 docs vs package:** the proxy docs name the test helper `unstable_doesProxyMatch`, but `next/experimental/testing/server` only exports `unstable_doesMiddlewareMatch`. `src/proxy.test.ts` imports the exported name under an alias; recheck after the next Next.js upgrade.
- **2026-11-06 — Noisy auth logs:** NextAuth logs a full stack trace (`JWT_SESSION_ERROR`) for every forged or expired cookie. Harmless, but it floods logs and can be used to fill them. Handle under WP-6.1 (structured logger) with a custom `logger.error` that records one line, no token.
