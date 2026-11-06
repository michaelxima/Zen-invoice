# Changelog

## Unreleased — Phase 0 (safety net)

- **Disposable test database guard.** The browser suite, `db:seed` and `db:migrate:test` now refuse to run unless `TEST_DATABASE_URL` names a local `*_test` database that differs from `.env.local`; Playwright starts its own server on port 3105 with that database and never reuses a running one; `db:migrate` requires `MIGRATE_CONFIRM_DATABASE` for any other database; CI uses `invoice_claw_test`.
  Why: tests and migration experiments could previously write to the developer's everyday database. Verified by: unit tests in `src/db/disposable.test.ts` (pending local run).
- **WP-0.1** `.gitignore` now keeps `.env.example` and ignores Playwright output, `outputs/`, `.work/` (~75k files) and `.manus/`. Git repository still to be initialised (see MASTER-PLAN.md).
- **WP-0.2** Removed the unused in-memory `GlobalDataStore` plus stale copies `store.ts.new` / `store.ts.tmp` (older drafts that advertised payment methods the app doesn't support). DTO types moved to `src/lib/types/dto.ts`; 9 importers updated. Removed inline `console.assert` block from `calculator.ts`.
- **WP-0.3** Replaced the hand-rolled assert script with Vitest (`test:unit`, `test:watch`, `test:coverage`). Existing checks ported 1:1, plus edge cases (empty invoice, non-finite / non-positive amounts, half-up rounding). Vitest only collects `src/**/*.test.ts`, so Playwright specs in `/tests` are untouched.
- Verified by: pending local run of `npm run lint && npm run typecheck && npm run test:unit && npm run build`.
