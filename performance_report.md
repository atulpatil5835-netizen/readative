# Release P1 — Performance Report

Status: implemented and validated.
Date: 2026-07-04

## Validation commands

- `npx tsc --noEmit` — passed.
- `npm run build` — passed.
- `git diff --check` — passed after report updates.

## Bundle impact

No dependencies were added.

Final relevant production assets:

- CSS: gzip 14.21 kB.
- Main app chunk: gzip 23.57 kB.
- SmartTalk chunk: gzip 10.26 kB.
- KnowledgeFeed chunk: gzip 23.14 kB.
- Explore chunk: gzip 8.87 kB.
- AppPanels chunk: gzip 3.63 kB.

Compared with the captured pre-release baseline:

- SmartTalk: 9.62 kB → 10.26 kB gzip, +0.64 kB.
- KnowledgeFeed: 23.11 kB → 23.14 kB gzip, +0.03 kB.
- Main app: 23.69 kB → 23.57 kB gzip, -0.12 kB.
- CSS: 14.26 kB → 14.21 kB gzip, -0.05 kB.
- AppPanels: 5.63 kB → 3.63 kB gzip after removing duplicate legal panel content.

Net app-bundle regression is below the 2 kB gzip ceiling.

## Server-rendering impact

New server-rendered documents are produced by existing Vercel-compatible API functions and built app shell reuse.

Added function surfaces:

- `api/legal.ts`
- `api/post.ts`
- `api/smarttalk.ts`
- shared `api/_document.ts`

Hardened function surfaces:

- `api/smarttalks.ts`
- `api/sitemap.xml.ts`
- `api/discovery.ts`
- `api/_seoData.ts`

No polling, timers, intervals, listeners, or client-side background loops were added.

## Data-loading impact

The sitemap and discovery data loaders now apply stricter public-eligibility filtering and fail closed on dynamic sitemap data errors.

Post detail SEO uses direct document reads and small category-limited related-content queries rather than scanning all posts for every request.

No Firestore schema change was made.

## Hydration impact

Server-injected app-page SEO tags are marked for React Helmet ownership. This prevents hydration from stacking duplicate canonicals, descriptions, OG URLs, Twitter Cards, or JSON-LD tags.

Browser QA confirmed hydrated SmartTalk and post routes retain:

- one canonical
- one meta description
- one OG URL
- one Twitter Card
- one JSON-LD payload

## Runtime and console QA

Desktop, tablet, and mobile route QA passed on a local production-style server:

- 24 route/viewport checks
- no horizontal overflow
- no app-origin console errors
- no duplicate canonical after hydration

## Regression risk

Risk: low to medium.

Primary watch areas:

- Vercel rewrite precedence for legal and post routes.
- Dynamic SEO data availability for sitemap generation.
- SmartTalk legacy links from external surfaces.

Mitigations:

- Existing SPA route parsing still resolves legacy SmartTalk query URLs.
- `/smarttalk` and `/smarttalk?id=...` now have server redirects.
- `/category/{slug}?id=...` remains client-resolved to avoid breaking category ownership.
- Sitemap returns 503 when dynamic data is unavailable, preventing silent thin sitemap indexing.

## Production readiness

Ready for production within the P1 SEO foundation scope.
