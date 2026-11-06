# WP 1.1 — Dependency security upgrade plan

> Researched 2026-11-06. Re-check advisories and `npm view` output immediately before applying and again before deploy;
> advisories and available versions change. Applicability below is based on a code scan of this repo, not on proof of exploitation.

## 1. Targets

| Package | Now (lockfile) | Target | Why |
|---------|----------------|--------|-----|
| `next` | 16.3.0 (exact pin) | **16.4.5** (exact pin) | Nov 3 2026 security release patched only 16.4.5 and 15.5.29 — there is no patched 16.3.x for it. |
| `eslint-config-next` | 16.3.0 | **16.4.5** | Must match `next`. |
| `sharp` (transitive) | 0.35.3 | **≥ 0.35.5** | 0.35.5 carries the librsvg fix; Next 16.4.1+ ships it, but a lockfile can hold an old copy. Add an `overrides` entry only if a copy < 0.35.5 survives. |
| `zod` | 4.4.3 (`^4.4.3`) | **latest 4.x ≥ 4.6.6** | GHSA-mrhx-c7xc-m3w5 / CVE-2023-54404: memory exhaustion on unbounded array schemas, affects ≤ 4.6.5. |
| `react`, `react-dom` | 19.2.8 | **Match the peer range of next@16.4.5** (≥ 19.2.9 on the 19.2 line, or 19.3.x if required) | React Server Components fix for the Oct RCE shipped in 19.2.9 / 19.3.1. Decide from `npm view next@16.4.5 peerDependencies`. |
| `source-map-js` (transitive) | 1.2.1 | Per `npm audit` advice | Advisory details to be read from the audit JSON; likely dev/build-time only. |

Do **not** run `npm audit fix --force`.

## 2. Advisory applicability for this app

| Release | Advisory | Applies here? | Reason |
|---------|----------|---------------|--------|
| Aug 25 2026 (fixed 16.3.3) | Windows-hosted server RCE | **Yes (local/dev)** | Development and the audit run on Windows. |
| Aug 25 2026 (fixed 16.3.3) | AVIF image-optimizer RCE | **Likely** | `next/image` is used (`onboarding/page.tsx`); the built-in optimizer endpoint is on by default. |
| Oct 14 2026 (fixed 16.4.1) | GHSA-673q-mjm6-r5xr `use cache` RCE | No (not reachable) | No `use cache`, no `cacheComponents`. Upgrade anyway — the advisory has no workaround. |
| Oct 14 2026 (fixed 16.4.1) | CVE-2026-96889 SVG via sharp/librsvg | No (not reachable) | `dangerouslyAllowSVG` is off; no `next/og`/`ImageResponse`. Still fix sharp. |
| Oct 14 2026 (fixed 16.4.1) | GHSA-p3m5-59mp-jv5r Server Actions DoS | **Yes** | 5 server-action modules (`src/lib/actions/*`). |
| Nov 3 2026 (fixed 16.4.5) | GHSA-7qx7-33qx-rqx2 SVG rejection bypass | **Likely** | Applies to the built-in optimizer with `dangerouslyAllowSVG: false` — this app's default. |
| Nov 3 2026 | GHSA-pc58-hwjq-p385 response injection | Probably not | No route returns a fetched response unchanged (scan). Re-check if a proxying route is added. |
| Nov 3 2026 | GHSA-f3mh-rxg3-f5g2 Edge HttpOnly cookie | No | No Edge runtime routes. |
| Nov 3 2026 | 4 × Cache Components / `use cache` issues | No | Cache Components not used. |
| Zod | GHSA-mrhx-c7xc-m3w5 | **Yes** | `z.array(...)` without `.max()` in `validations/invoice.ts` (×2) and `api/ai-parse/route.ts`. Also add explicit `.max()` limits (defence in depth; tracked under Phase 2.1/1.6). |

## 3. Upgrade risks (16.3 → 16.4)

- 16.4 makes Cache Components the recommended model and the default for **new** projects only; existing apps keep current caching unless `cacheComponents: true` is set. **Do not enable it in this WP.**
- 16.4 integrates React 19.3; check the peer range and React release notes.
- 16.4.2 backported a fix to proxy runtime loading — relevant to WP 1.4 (moving `proxy.ts` to `src/`). Do 1.4 **after** this upgrade.
- Per `AGENTS.md`: after install, re-read the installed guides in `node_modules/next/dist/docs/` for proxy, server actions, caching and config — they change with the version.
- `build` uses `--webpack`; confirm that flag is still supported in 16.4.5.

## 4. Zod supply-chain note

In Sept–Oct 2026 a malicious commit landed in Zod's GitHub history and appeared on the v4.6.6 GitHub release page. The maintainers state no npm release was published from it (publishing used environment-scoped trusted publishing). Before accepting the new version: run `npm audit signatures`, confirm the npm provenance attestation points at the official repo's release workflow, and record the resolved `integrity` hash in the PR.

## 5. Verification gate (Done when)

`npm ci` (fresh) → `npm audit --omit=dev` → `npm run typecheck` → `npm run lint` → `npm run test:unit` → `npm run build` → migrations against a disposable DB → `npm run test:e2e`.
Any remaining advisory gets a row below with an owner, applicability and remediation date.

| Remaining advisory | Package | Applicability | Owner | Remediation date |
|--------------------|---------|---------------|-------|------------------|
| | | | | |

## 6. Progress log

**2026-11-06 — baseline (before upgrade):** `npm ci` reported 18 vulnerabilities (1 critical, 5 high, 12 moderate). The planned
`before-*.json` audit snapshots were not captured; the console output above is the recorded baseline.

**2026-11-06 — resolved after install (verified with `npm ls`, not the manifest):**

| Package | Resolved |
|---------|----------|
| next / eslint-config-next | 16.4.5 / 16.4.5 (exact) |
| react / react-dom | 19.3.1 / 19.3.1 (exact). `next@16.4.5` accepts `^19.0.0`; 19.3.1 also carries the Oct RSC fix. Peers checked: @react-pdf/renderer, lucide-react, next-auth all accept ^19. `@types/react` stays 19.2.x — confirm with typecheck. |
| zod | 4.6.7 (single copy, deduped with eslint-plugin-react-hooks) |
| sharp | 0.35.5 (single copy, under next) |
| source-map-js | 1.2.1 — **still vulnerable** (GHSA-68fv-2mgg-jv7q / CVE-2026-93749, high, fixed in 1.2.2). All dependents allow `^1.2.1`, so `npm update source-map-js` resolves it without overrides. Applicability: build/dev tooling (postcss, Tailwind) parsing the app's own source maps — not reachable from production request input; fix anyway. |

`npm audit signatures`: 468 packages with verified registry signatures, 122 with verified attestations.

Process note: the upgrade was first applied before the baseline commit existed. The working tree's `package.json` and lockfile were restored byte-for-byte from the pre-change backup so the baseline commit is honest; the upgraded files are kept in `.work/upgrade-1.1/` and are re-applied on the `fix/1.1-dependency-security` branch.

**2026-11-06 — on branch `fix/1.1-dependency-security` (from baseline `09b3bee`):**
- `npm update source-map-js` → 1.2.2 everywhere (single copy). GHSA-68fv-2mgg-jv7q resolved.
- Committed as `1b38a3f`. After a fresh `npm ci`: **`npm audit --omit=dev` → found 0 vulnerabilities.**
- Fresh `npm ci`: OK. Remaining full-tree audit: 14 (12 moderate, 2 high), all dev-only — to be triaged from `after-all.json`.
- `npm run build` with `--webpack` on 16.4.5: **compiles**; fails only at the type-check step because of the missing `vitest` dev dependency (pre-existing, see MASTER-PLAN §7). Not caused by this upgrade.
- `npm run lint`: 0 errors, 3 pre-existing `no-img-element` warnings (MASTER-PLAN §7).
- Vitest install (WP-0.3 completion) blocked by ERESOLVE: `vitest@5.1.0` peer-requires `@types/node` `^22 || >=24`, project pins `^20.19.43`.
  The runtime is Node 24 (local v24.14.0; CI `node-version: 24`), so the correct fix is `@types/node@^24` — types matching the runtime —
  not `--legacy-peer-deps`/`--force`. Vitest 5 requires Node `^22.12 || ^24`, so `engines.node` narrows from `>=20.9 <25` to `^22.12.0 || ^24.0.0`.

## Sources

- Netlify changelog, Next.js November 2026 security release (16.4.5 / 15.5.29): https://www.netlify.com/changelog/2026-11-03-nextjs-security-vulnerabilities/
- October 2026 Next.js security update walkthrough (16.4.1, sharp 0.35.5, React fixes): https://dev.to/kunalvohra/nextjs-security-update-october-2026-cve-2026-96889-the-use-cache-rce-and-how-to-fix-your-app-4o2p
- August 2026 release (16.3.3 / 15.5.24; Windows and AVIF RCEs): https://centralcsp.com/en/blog/nextjs-vulnerabilities-2026
- Zod advisory GHSA-mrhx-c7xc-m3w5: https://github.com/advisories/GHSA-mrhx-c7xc-m3w5
- Zod 4.6.6 supply-chain discussion: https://brianlovin.com/hn/50052814
- Next.js 16.4 migration notes: https://dev.to/mudassirworks/nextjs-164-is-a-migration-release-not-a-version-bump-118p
