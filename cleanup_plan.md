# Release R1 Final Refinement - Safe Cleanup Plan

## Scope lock

This plan is for future implementation releases. Nothing in this audit phase was implemented.

Every future release must preserve:

- desktop Release Z.2 layout
- legal route behavior
- Firestore schema
- feed ranking
- SmartTalk behavior
- Notebook behavior
- auth behavior
- API contracts
- production route parity

## Cleanup principles

1. Prefer deletion of confirmed non-runtime artifacts before touching app code.
2. Prefer tests/reports before route or metadata consolidation.
3. Avoid changing data ownership and presentation in the same release.
4. Avoid changing lazy-loading boundaries unless bundle output is measured.
5. Keep each cleanup release independently deployable and reversible.
6. If a cleanup touches desktop files, compare against `cb9a763` and run desktop width QA.

## Ranked implementation order

### Release C1 - Audit artifact cleanup

Risk: Low.

Goal: remove or archive files that are confirmed not to be imported, served, or needed by production.

Candidate areas:

- obsolete root markdown reports
- historical CSV/JSON migration outputs
- SmartTalk migration run folders
- Python cache files
- one-off migration scripts after acceptance

Required validation:

- `rg` import/path scan for every removed file or folder
- `npm run build`
- `npx tsc --noEmit`
- `git diff --check`

Expected impact:

- bundle savings: 0 KB gzip
- file reduction: 10-25 files, possibly more if old reports are archived
- repo footprint reduction: at least 901 KB from SmartTalk run artifacts if approved
- regression risk: Low

### Release C2 - Dependency classification cleanup

Risk: Low to Medium.

Goal: remove or reclassify dependencies only when confirmed unused or local-only.

Candidate:

- `nodemailer` appears unused in current source.

Do not remove:

- `cors`, `dotenv`, `express` unless local server strategy is changed or they are intentionally moved.
- `firebase-admin`; it is used by server SEO data.
- `react-helmet-async`; it is used by client SEO component.
- `lucide-react`; it is used broadly.

Required validation:

- source scan
- `npm install` or lockfile-safe package workflow
- `npm run build`
- `npx tsc --noEmit`
- production serverless smoke if lockfile changes affect Vercel install

Expected impact:

- bundle savings: likely 0 KB client gzip
- package/install reduction: small to medium
- regression risk: Low to Medium

### Release C3 - Import bridge cleanup

Risk: Medium.

Goal: update imports to direct component-folder targets, then remove compatibility bridges only after all imports are verified.

Candidate bridge files:

- `src/components/KnowledgeFeed.tsx`
- `src/components/KnowledgeCard.tsx`

Required validation:

- import scan before and after
- bundle chunk comparison
- route smoke for knowledge feed and post card rendering
- `npm run build`
- `npx tsc --noEmit`
- `git diff --check`

Expected impact:

- bundle savings: 0-1 KB gzip
- file reduction: 2 files
- duplicate reduction: Low
- regression risk: Medium

### Release C4 - Visual primitive documentation before CSS cleanup

Risk: Low if documentation-only; Medium if implementation changes.

Goal: document repeated card/button/badge/link patterns before replacing class clusters.

Candidate patterns:

- premium cards
- metadata pills
- trust badges
- legal/footer links
- focus-visible states
- desktop rail cards
- empty states

Required validation before implementation:

- desktop/tablet/mobile screenshots
- focus-state QA
- hover-state QA
- no DOM behavior changes

Expected impact:

- bundle savings: 0-3 KB gzip if CSS output shrinks
- duplicate reduction: Medium
- regression risk: Medium

### Release C5 - Server metadata helper consolidation

Risk: Medium to High.

Goal: reduce repeated API head/schema patterns without changing rendered output.

Candidate files:

- `api/post.ts`
- `api/smarttalks.ts`
- `api/legal.ts`
- `api/discovery.ts`
- `api/_document.ts`

Required validation:

- snapshot current HTML head for `/post/:id`, `/smarttalks`, `/smarttalks/:id`, `/posts`, and legal pages
- compare canonical, OG, Twitter, JSON-LD, and breadcrumbs before/after
- production-compatible serverless execution
- sitemap smoke
- robots smoke

Expected impact:

- bundle savings: mostly server/source only
- duplicate reduction: Medium to High
- regression risk: Medium to High

### Release C6 - Legal renderer consolidation

Risk: Medium to High.

Goal: keep `src/content/legalPages.ts` as the content source of truth while reducing duplicated server/client legal rendering.

Rules:

- do not change legal copy
- do not change SEO
- do not change routes
- do not create duplicate pages
- keep SPA and server-rendered content equivalent

Required validation:

- `/about`
- `/contact`
- `/privacy`
- `/terms`
- `/disclaimer`
- `/support`
- direct URL
- refresh
- local Vite
- production serverless output

Expected impact:

- bundle savings: 0-2 KB gzip
- duplicate reduction: Medium
- regression risk: Medium to High

### Release C7 - Presentational extraction from oversized surfaces

Risk: High.

Goal: reduce file size without changing data flow or behavior.

Candidate sequence:

1. Extract pure presentational sections from `Explore.tsx`.
2. Extract pure presentational sections from `SmartTalk.tsx`.
3. Extract profile sub-sections from `Profile.tsx`.
4. Extract feed-only presentational panels from `KnowledgeFeed.tsx`.

Rules:

- no Firestore query changes
- no listener changes
- no ranking changes
- no auth changes
- no Notebook changes
- no route changes

Required validation:

- full route QA
- interaction smoke
- console QA
- build/typecheck
- desktop/tablet/mobile QA

Expected impact:

- bundle savings: usually neutral
- duplicate reduction: Medium
- maintainability improvement: High
- regression risk: High

### Release C8 - Route ownership consolidation

Risk: High.

Goal: reduce route drift only after route tests exist.

Required precondition:

- route inventory test or generated route map covering SPA routes, Vercel rewrites, redirects, server handlers, legal slugs, sitemap eligibility, and canonical builders.

Candidate consolidation:

- shared constants for public legal routes
- shared canonical route builders
- generated route audit output

Do not attempt this before lower-risk cleanup is complete.

Expected impact:

- bundle savings: minimal
- duplicate reduction: High
- maintainability improvement: High
- regression risk: High

## Estimates

| Metric | Conservative estimate | Optimistic estimate | Notes |
| --- | ---: | ---: | --- |
| Client bundle savings | 0-3 KB gzip | 3-6 KB gzip | Most cleanup is maintainability, not bundle reduction |
| File reduction | 12-20 files | 25+ files | Depends on approval to archive old reports and migration artifacts |
| Duplicate reduction | 10-20% | 25-35% | Higher only if metadata/legal/route helpers are consolidated |
| Maintainability improvement | Medium | High | Biggest gains come from oversized surface extraction |
| Regression risk | Low if C1-C2 only | High if route/product surfaces are touched | Risk must be managed by release order |

## Stop conditions for future cleanup releases

Stop the release and document the blocker if:

- a footer/legal route reaches 404 or 500
- desktop rails disappear at 1400px+
- center reading width changes without approval
- a Firestore query/listener is added accidentally
- feed order/ranking changes
- SmartTalk focused question behavior changes
- Notebook Highlight behavior changes
- bundle increases unexpectedly
- serverless route output changes outside the approved scope

## Plan conclusion

The safest path is not one large cleanup. It is a sequence of small releases: artifacts, dependencies, import bridges, visual primitives, metadata helpers, legal rendering, presentational extraction, and only then route ownership cleanup. This minimizes regression risk while still making Readative cleaner and easier to maintain.
