# Release Scope — v1 (APPROVED 2026-11-06)

> Status: **approved** 2026-11-06 by the owner. Decisions A (email), B (payments), C (brand) and the
> feature table §1 are signed off. Changes now require a CHANGELOG entry and an updated row here.
> Rule: a feature is either **IN** (completed, tested, gated in CI) or **OUT** (unreachable or clearly
> labelled "not available"). No third state. A feature honestly marked unavailable beats a misleading promise.
> Evidence references are to the code as audited on 2026-11-06 (pre-remediation baseline commit).

## 1. Summary

| # | Area | Current reality (evidence) | Proposal | Owner decision |
|---|------|----------------------------|----------|----------------|
| 1 | Email + password accounts | Works; sign-out is a plain link to `/login` (`Sidebar.tsx:159`); unverified registration (`actions/auth.ts`) | **IN** — after Phase 1.2 (real sign-out, revocation) | ☐ |
| 2 | Google sign-in | Credentials present in `.env.local`; links accounts by email equality (`auth/options.ts`) | **OUT** — disable provider until 1.2 linking safety is done | ☐ |
| 3 | Onboarding | Values lost on blur, tax ID dropped (`onboarding/page.tsx`) | **IN** — after Phase 1.3 | ☐ |
| 4 | Clients | CRUD works; counts/billed totals hard-coded to 0 (`actions/clients.ts:13-24`) | **IN** — after Phase 2.4 metrics fix | ☐ |
| 5 | Invoices (draft → issue) | Core flow exists; money/tax not persisted (A4) | **IN** — after Phase 2.1–2.3 | ☐ |
| 6 | Estimates → invoice | Converts straight to Sent (`db/queries.ts:169-205`) | **IN** — after 2.3 (convert to draft) | ☐ |
| 7 | PDF download | Recomputes totals from zeroed rates (`InvoicePdfDocument.tsx`) | **IN** — after 2.1 (render saved amounts) | ☐ |
| 8 | Client portal (view, PDF, pay) | Exists; GET marks viewed; owner preview counted as client view | **IN** (view + download + card payment) — after 2.5 and 3.2–3.4 | ☐ |
| 9 | Dashboard / reporting | Sums across currencies, labels `$` (`queries.ts:219-225`, `dashboard/page.tsx`) | **IN** — after 2.4 (per-currency totals) | ☐ |
| 10 | Invoice email (Resend) | Real provider path; not idempotent (3.1); no key configured | **IN** (decision A1) — after 3.1 + verified sender domain | ☑ |
| 11 | Manual reminders (tone picker) | Real send path; tone not persisted in history (`actions/invoices.ts:44-47`) | **IN** (follows A1) — after 3.1 and 2.5 (tone/actor recorded) | ☑ |
| 12 | Automatic reminder sequences / late fees | Not built | **OUT** | ☐ |
| 13 | Online payment (Stripe Connect / Checkout) | Wrong API version cast, locks held across network, no refunds (3.2–3.4); no keys configured | **IN** (decision B) — card via Stripe Checkout, after 3.2–3.4 pass in Stripe test mode | ☑ |
| 14 | Other payment rails (Swish, SEPA, Klarna, A2A) | Not built; gateway API already returns 410 | **OUT** — card only for v1; enabling Stripe-hosted methods later is a scope change | ☐ |
| 15 | Recurring invoices | Page already says "not available yet" (`recurring/page.tsx:10-12`); sidebar still links it | **OUT** — keep honest page, add "Unavailable" badge or remove nav item | ☐ |
| 16 | Localization (de/fr/es/sv/no/da) | 7 locales in one client file, localStorage, no SSR, untyped (`i18n.ts`, `LanguageSwitcher.tsx`) | **OUT** — ship **English only**; hide the language switcher | ☐ |
| 17 | AI create (text / voice / upload) | Uploads leak across modes; advertises DOC/DOCX + 10 MB but server allows 5 MB (`ai-create/page.tsx:164,415`, `ai-parse/route.ts:102`) | **OUT** — route and nav hidden behind a server-side flag, default off | ☐ |
| 18 | "Template gallery" in invoice editor | Only pre-fills notes text per preset (`invoices/new/page.tsx:121-154`); not visual designs | **IN as "Note presets"** (rename) — or remove | ☐ |
| 19 | Logo upload / "Pick a design" / "Integrate payment gateway" | Promised in `WelcomeWizard.tsx:9` and `onboarding/page.tsx:181`; `logoUrl` column exists but no upload UI | **OUT** — remove the promises from wizard/onboarding copy | ☐ |
| 20 | Credit notes, partial payments, exports (CSV/SIE), Peppol, teams | Not built | **OUT** | ☐ |
| 21 | Brand name | Mixed "Invoice Claw" / "Zen-Invoice" (`layout.tsx:8`, sidebar, portal, onboarding) | **Zen-Invoice** (decision C) — user-facing text only, WP-0.4 | ☑ |

## 2. What "OUT" must look like (acceptance criteria)

For every OUT feature:
1. **Not reachable by accident:** no primary nav/CTA, or the nav item carries a visible "Not available" label.
2. **Server-enforced:** the route/API returns a clear unavailable response (page with explanation, or HTTP 404/503) — hiding a button is not enough. Gate with a single server-side module, e.g. `src/lib/features.ts`, reading env flags that **default to off**.
3. **No copy promises it:** README, onboarding, wizard, marketing/metadata text and i18n strings don't advertise it.
4. **Tested:** one Playwright check per OUT feature asserting it is unavailable (and that the API refuses when called directly).
5. **No secrets required:** the app builds and runs with the OUT feature's env keys absent.

For every IN feature: the "Done when" criteria of its Phase task in the remediation plan, plus the Definition of Done in `MASTER-PLAN.md` §0.

## 3. Owner decisions (2026-11-06) and what they add to the release

**A. Email — IN (A1).** Release blockers added:
- Phase 3.1 complete: durable send intent/outbox, atomic claim before the provider call, stable provider idempotency key, provider *acceptance* recorded separately from *delivery*, cancellation serialized against in-flight sends.
- Phase 2.2 complete: the recipient on the confirmation screen is the address that is emailed and stored.
- Resend: a **verified sender domain** with SPF/DKIM (and DMARC) records; `RESEND_FROM_EMAIL` on that domain. Bounce/complaint behavior verified only in an authorized test environment.
- Owner provides: a domain they control, and a Resend account.

**B. Online payments — IN, card via Stripe Checkout (Stripe Connect).** This is the largest and riskiest block. Release blockers added:
- Phase 3.2: a real supported Stripe API version for the installed SDK; the unsafe version cast removed in checkout *and* webhook; checkout refuses to start if webhook configuration is missing.
- Phase 3.3: a persisted checkout-attempt record (immutable account, invoice, amount, currency, stable idempotency key); no network calls while holding row locks; safe sequencing of account reconnects; expired/late sessions reconciled before cancellation.
- Phase 3.4: refunds and disputes reflected in the ledger and reporting.
- Phase 2.1 is a hard prerequisite: the amount charged must equal the saved invoice, portal and PDF total to the minor unit.
- Verified in **Stripe test mode**: one authorized test payment produces exactly one verified, deduplicated settlement; duplicate and late webhooks, timeouts and account A→B reconnect cannot lose or double a payment.
- Owner provides: a Stripe platform account with Connect enabled (`STRIPE_CONNECT_CLIENT_ID`, `STRIPE_SECRET_KEY`), a registered connected-account webhook endpoint (`STRIPE_WEBHOOK_SECRET`), and a public HTTPS staging URL for webhook testing.
- Legal/ops note: card payments flow to each business's own connected Stripe account; the platform terms, privacy notice and refund wording must say so before go-live.

**C. Brand — Zen-Invoice.** Scope of the rename (WP-0.4):
- Rename **user-facing** text: page titles/metadata, sidebar, login, onboarding, portal, PDF, email subject/sender name/body, README, `.env.example` sample sender name.
- Leave **internal identifiers** unchanged in v1 (`package.json` name `invoice-claw`, database `invoice_claw`, folder name, CI service names) — renaming them adds risk without user value; revisit later as a separate WP.
- The localStorage key `zen-invoice-lang` already matches; it goes away with row 16 anyway.

**Net effect on schedule:** with A1 and B both IN, Phases 1, 2 and 3 (3.1–3.4) are all release blockers. Using `MASTER-PLAN.md` §6 effort estimates, that is roughly 4–5 weeks of focused work before v1, plus owner lead time for the domain, Resend and Stripe setup. Start those account setups now so they don't block testing.

## 4. Sign-off

| Decision | Choice | Signed by | Date |
|----------|--------|-----------|------|
| Table §1 approved as marked | Approved as proposed (rows 1–21) | Michael Anyanwu (owner) | 2026-11-06 |
| A. Email | A1 — IN | Michael Anyanwu (owner) | 2026-11-06 |
| B. Online payments | IN — card via Stripe Checkout | Michael Anyanwu (owner) | 2026-11-06 |
| C. Brand | Zen-Invoice | Michael Anyanwu (owner) | 2026-11-06 |

Changes to this scope after sign-off require an entry in `CHANGELOG.md` and an updated row here.
