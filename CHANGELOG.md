# Changelog

## Unreleased — Phase 0 (safety net)

- **WP-0.1** `.gitignore` now keeps `.env.example` and ignores Playwright output, `outputs/`, `.work/` (~75k files) and `.manus/`. Git repository still to be initialised (see MASTER-PLAN.md).
- **WP-0.2** Removed the unused in-memory `GlobalDataStore` plus stale copies `store.ts.new` / `store.ts.tmp` (older drafts that advertised payment methods the app doesn't support). DTO types moved to `src/lib/types/dto.ts`; 9 importers updated. Removed inline `console.assert` block from `calculator.ts`.
- **WP-0.3** Replaced the hand-rolled assert script with Vitest (`test:unit`, `test:watch`, `test:coverage`). Existing checks ported 1:1, plus edge cases (empty invoice, non-finite / non-positive amounts, half-up rounding). Vitest only collects `src/**/*.test.ts`, so Playwright specs in `/tests` are untouched.
- Verified by: pending local run of `npm run lint && npm run typecheck && npm run test:unit && npm run build`.
