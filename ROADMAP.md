# Invoice Claw — Master Execution Roadmap & Agent Operating Directive

> **GOVERNING DIRECTIVE FOR ALL AGENTS & DEVELOPERS:**
> 1. **MANDATORY VAD PROTOCOL (Verification, Acceptance & Design):** Every task must uphold top-tier visual aesthetics (Tailwind v4 tokens, responsive layouts, micro-interactions, dark mode) and zero-defect functionality.
> 2. **STRICT ATOMIZATION:** Work is partitioned into discrete, non-overlapping atomic tasks. Never bundle unrelated changes.
> 3. **MANDATORY END-TO-END (E2E) VERIFICATION GATE:** Before marking any task as complete or advancing to the next task, the agent **MUST** run automated tests, type-checks, and browser/API verification. **Skipping verification or advancing on mock data without passing quality gates is strictly prohibited.**

---

## Architecture & Technology Baseline

- **Framework:** Next.js 15+ App Router (React 19, Server Components, Server Actions, API routes)
- **Language:** TypeScript (Strict mode, zero `any` policy where possible)
- **Styling & Design System:** Tailwind CSS v4, Lucide Icons, Glassmorphic & modern dark palette
- **Database & ORM:** PostgreSQL (Neon / Supabase) via Drizzle ORM
- **PDF Engine:** `@react-pdf/renderer` (Side-by-side dynamic canvas + Server-rendered downloads)
- **Communications:** Resend SDK (Transactional email with PDF attachments & webhooks)
- **Payment & Settlement:** Stripe Elements & Checkout, Open Banking / A2A instant bank transfers
- **AI Engine:** Multi-modal Vision OCR (Gemini / OpenAI), Natural Language Parsing, Autonomous Agents

---

## Phase 1: Database Persistence & Full Invoicely Feature Parity
*Goal: Move from mock UI states to a real-time, persistent, multi-tenant billing platform matching Invoicely.*

### Task 1.1: Database Schema Expansion & Server Actions Migration [ATOMIC]
- **Scope:**
  - Update [`src/db/schema.ts`](file:///c:/Users/mican/Documents/Invoice%20Claw/src/db/schema.ts) to include tables for:
    - `estimates` (Quotes/Estimates with convert-to-invoice status)
    - `payments` (Ledger of partial/full transaction records linked to invoices)
    - `reminders` (Scheduled email triggers and reminder history)
    - `audit_logs` (Timestamped event trail for invoice creation, views, payments)
  - Create type-safe Server Actions for full CRUD across Businesses, Clients, Invoices, Estimates, and Payments.
- **Verification Gate:**
  - Run `npx drizzle-kit generate` and verify migration files.
  - Run automated unit tests verifying insert/update/delete operations against schema constraints.

### Task 1.2: Persistent Invoices & Real-Time Dashboard Integration [ATOMIC]
- **Scope:**
  - Refactor [`src/app/invoices/page.tsx`](file:///c:/Users/mican/Documents/Invoice%20Claw/src/app/invoices/page.tsx) and [`src/app/dashboard/page.tsx`](file:///c:/Users/mican/Documents/Invoice%20Claw/src/app/dashboard/page.tsx) to fetch and mutate real data from Postgres.
  - Implement optimistic UI updates, pagination, status filtering (`Draft`, `Sent`, `Paid`, `Overdue`, `Disputed`), and instant search.
- **Verification Gate:**
  - Create 5 test invoices in DB; verify they appear in dashboard metrics (Total Outstanding, Paid This Month, Drafts).
  - Verify status transition (Mark as Paid) persists after hard page refresh.

### Task 1.3: Interactive Client CRUD & Multi-Currency Engine [ATOMIC]
- **Scope:**
  - Refactor [`src/app/clients/page.tsx`](file:///c:/Users/mican/Documents/Invoice%20Claw/src/app/clients/page.tsx) with live DB operations, client billing stats (lifetime revenue, outstanding balance), and currency preferences.
  - Connect client selector directly in the invoice editor ([`src/app/invoices/new/page.tsx`](file:///c:/Users/mican/Documents/Invoice%20Claw/src/app/invoices/new/page.tsx)) to auto-populate client details.
- **Verification Gate:**
  - E2E test creating a new client, selecting that client in the invoice editor, and verifying all fields populate correctly.

### Task 1.4: Zero-Friction Client Self-Service Portal [ATOMIC]
- **Scope:**
  - Build public tokenized route `/portal/[token]` allowing clients to view invoice details, download PDF, view payment history, and pay online without login friction.
  - Implement dynamic branding (logo, brand colors, contact details) based on the issuing business.
- **Verification Gate:**
  - Generate a secure invoice payment link, open in incognito/browser subagent, test PDF download and payment button accessibility.

### Task 1.5: Estimates / Quotes to Invoice Conversion Engine [ATOMIC]
- **Scope:**
  - Create `/estimates` and `/estimates/new` with estimate generation, client approval workflow, and 1-click "Convert to Invoice" action.
- **Verification Gate:**
  - Create an estimate, simulate client acceptance, trigger conversion, verify new invoice is created with identical line items and linked estimate ID.

---

## Phase 2: Kivra-Grade Verified Delivery & Smart Invoicing
*Goal: Match Kivra's certified digital delivery, verified read receipts, and instant direct bank settlement.*

### Task 2.1: Certified Digital Delivery & Cryptographic Read Receipts [ATOMIC]
- **Scope:**
  - Implement delivery tracking beyond simple email open pixels:
    - Secure signed token generation for each recipient.
    - Timestamped "Delivered", "First Opened", "Downloaded", and "Viewed" event logging stored in `audit_logs`.
    - Real-time status badges in the invoice management dashboard.
- **Verification Gate:**
  - Trigger invoice send; simulate opening `/portal/[token]` in a separate browser context; verify dashboard instantly updates to "Viewed at [Timestamp]".

### Task 2.2: Instant Account-to-Account (A2A) & Open Banking Checkout [ATOMIC]
- **Scope:**
  - Integrate Stripe Financial Connections / Open Banking / A2A payment rails (SEPA Instant, Swish, ACH Direct Debit, iDEAL) alongside standard card payments.
  - Enable 0–0.5% transaction cost bank-to-bank settlement to bypass standard 2.9% credit card fees.
- **Verification Gate:**
  - Simulate A2A bank transfer intent and verify webhook updates invoice status from `Sent` -> `Paid` with ledger transaction ID.

### Task 2.3: The "Living" Interactive Smart Invoice Canvas [ATOMIC]
- **Scope:**
  - Transform the public invoice view from a passive document into an interactive workspace:
    - In-invoice messaging & queries (e.g. client requests line-item clarification directly on invoice).
    - Custom PO (Purchase Order) attachment field for client procurement teams.
    - Flexible payment options: 1-click Full Pay, 50/50 Milestone Deposit, or Split Payments.
- **Verification Gate:**
  - Add a line item comment from the portal view; verify issuer receives alert in notification center and DB audit log.

### Task 2.4: Multi-Tier Automated Reminder & Escalation Sequences [ATOMIC]
- **Scope:**
  - Implement automated reminder schedules (`3 days before due`, `on due date`, `3 days overdue`, `7 days overdue with late fee`).
  - Add configurable tone modes (Friendly, Formal, Strict, Urgent) and automatic late fee calculations.
- **Verification Gate:**
  - Execute cron/schedule test route; verify correct reminder templates fire with active payment links and applied late fees.

---

## Phase 3: Autonomous AI Agentic Invoicing Engine (The Surpassing Moat)
*Goal: Eliminate 95% of manual bookkeeping and billing tasks through multi-modal AI.*

### Task 3.1: Multimodal Vision OCR (Receipts & Invoices to Structured Data) [ATOMIC]
- **Scope:**
  - Upgrade `/api/ai-parse` to multi-modal Gemini Vision / OpenAI API.
  - Allow users to drag-and-drop receipts, supplier PDFs, photos of paper invoices, or spreadsheets to instantly generate ready-to-send invoices.
- **Verification Gate:**
  - Feed 3 real-world receipt/invoice images (clean PDF, crumpled receipt, handwritten table) to the OCR endpoint; verify precision extraction of items, quantities, taxes, and totals.

### Task 3.2: Voice-to-Invoice & Conversational Invoicing [ATOMIC]
- **Scope:**
  - Add browser microphone voice dictation and conversational prompt box:
    - *"Bill Acme Corp $4,500 for July sprint development and $500 for hosting, Net 30, add 10% tax."*
  - Real-time side-by-side preview updates dynamically as the AI streams structured JSON.
- **Verification Gate:**
  - Pass 5 varied voice/text natural language test cases; verify correct currency symbol, item breakdown, and due dates populate in under 1.5 seconds.

### Task 3.3: Autonomous Accounts Receivable (AR) Follow-up Agent [ATOMIC]
- **Scope:**
  - Implement an autonomous agent that monitors unpaid invoices, detects payment patterns, drafts contextual reply emails when clients reply with questions, and offers installment plans to overdue clients.
- **Verification Gate:**
  - Simulate client reply: *"Can we pay 50% now and 50% in two weeks?"* Verify AI parses intent, drafts approval email, and splits the invoice into two milestone payment links.

---

## Phase 4: Fintech Capital, Peppol E-Delivery & Enterprise Compliance
*Goal: Enterprise e-invoicing compliance, instant liquidity factoring, and ESG tracking.*

### Task 4.1: 1-Click B2B Invoice Factoring ("Get Paid Instantly") [ATOMIC]
- **Scope:**
  - Build the **"Cash Out Now"** instant financing widget for verified businesses.
  - Advance 90–95% of invoice face value immediately for a 1.5% fee on 30-to-90 day terms, backed by automated payout routing.
- **Verification Gate:**
  - Simulate invoice factoring request; verify instant advance ledger entry and automatic reconciliation when the client later pays the factoring escrow account.

### Task 4.2: Universal E-Invoicing (Peppol BIS Billing 3.0 & ZUGFeRD/Factur-X) [ATOMIC]
- **Scope:**
  - XML format generator compliant with European Peppol BIS 3.0, Factur-X, and US e-invoicing exchange frameworks.
  - Dual-output: Human-readable PDF + embedded machine-readable XML.
- **Verification Gate:**
  - Validate generated XML against official Peppol Schematron validation suites; ensure zero syntax or compliance errors.

### Task 4.3: Kivra-Style ESG & Paperless Impact Dashboard [ATOMIC]
- **Scope:**
  - Compute ecological impact metrics: Paper sheets saved, liters of water spared, and kg of CO₂ avoided through digital issuance and A2A banking.
  - Add shareable client badges and annual sustainability certificates for businesses.
- **Verification Gate:**
  - Verify algorithm computes correct cumulative savings based on invoice volume and renders ESG widgets cleanly on dashboard and PDF footer.

---

## Strict Verification Checklist for Every Task

Every agent must run the following validation protocol before submitting or moving forward:

```bash
# 1. Type Safety Check (Zero errors required)
npx tsc --noEmit

# 2. Linting & Code Standards
npm run lint

# 3. Automated Test Suite Execution
npm test  # or node --loader ts-node src/__tests__/e2e-audit.test.ts

# 4. Production Build Verification
npm run build
```

---

## Definition of Done (DoD) for Any Task
- [ ] Task is strictly atomic and addresses only its scoped objective.
- [ ] Database interactions use type-safe Drizzle ORM and handle edge-case errors gracefully.
- [ ] UI adheres to rich aesthetics (dark mode, Tailwind v4 tokens, responsive layouts, micro-animations).
- [ ] All automated unit/integration tests pass with 100% success rate.
- [ ] Visual verification conducted via browser/subagent.
- [ ] Code is formatted, linted, and fully type-checked without build warnings.
