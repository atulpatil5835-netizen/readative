# Release H5 Walkthrough

Status: PASS.
Date: 2026-07-10

## Objective

Release H5 upgrades Readative's public post and SmartTalk item URLs to human-readable SEO paths while keeping every document ID in the URL and preserving legacy route compatibility.

## What Changed

1. Shared SEO URL utility

- Added `src/utils/seoUrls.ts`.
- Centralized slug generation, canonical post path creation, canonical SmartTalk path creation, and legacy segment ID extraction.
- No second slug implementation was introduced.

2. App route parsing

- `/posts/<slug>--<id>` opens the same focused post as `/post/<id>`.
- `/smarttalk/<slug>--<id>` opens the same focused question as `/smarttalk/<id>` and `/smarttalks/<id>`.
- `/posts` remains the post discovery page.
- `/smarttalks` remains the SmartTalk discovery page.
- Client fallback URLs are replaced with title/content slugs after the focused document loads.

3. Internal linking

- Feed, card title, share/copy, desktop rails, journey actions, Explore cards, Explore search, Profile schema, saved SmartTalk, My Notes, and SmartTalk related links now use canonical builders.
- Button-only open flows continue to work with IDs and canonicalize after load when title/content becomes available.

4. Server SEO documents

- `api/post.ts` now renders canonical `/posts/<slug>--<id>` metadata and redirects legacy `/post/<id>` requests to canonical after lookup.
- `api/smarttalks.ts` now renders canonical `/smarttalk/<slug>--<id>` metadata and redirects plural legacy item requests to canonical.
- `api/smarttalk.ts` now redirects old query-style SmartTalk entry links to canonical URLs.

5. Sitemap and discovery

- `api/_seoData.ts` emits canonical post and SmartTalk sitemap entries.
- `api/discovery.ts` emits canonical anchors and canonical structured data item URLs.
- `scripts/verify-seo-recovery.ts` now validates canonical slug URLs and writes `seo_report.md`.

## Compatibility Walkthrough

- Old post URL request: `/post/<id>` -> server resolves post -> 301 to `/posts/<title-slug>--<id>`.
- New post URL request: `/posts/<title-slug>--<id>` -> server renders focused post document.
- Old SmartTalk URL request: `/smarttalks/<id>` -> server resolves question -> 301 to `/smarttalk/<question-slug>--<id>`.
- New SmartTalk URL request: `/smarttalk/<question-slug>--<id>` -> server renders focused SmartTalk document.
- Client-side old/fallback route open -> focused document loads -> route is replaced with canonical title/content slug.

## Validation Plan

Commands from `C:\Users\Atul\OneDrive\Documents\readative (1)`:

```text
npm run build
npx tsc --noEmit
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npm run verify:seo
git diff --check
```

Route smoke targets:

```text
/post/<id>
/posts/<slug>--<id>
/smarttalk/<id>
/smarttalks/<id>
/smarttalk/<slug>--<id>
/posts
/smarttalks
/sitemap.xml
/robots.txt
```

## Final Evidence

- `npx tsc --noEmit`: PASS.
- `npm run build`: PASS.
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`: PASS.
- `npm run verify:seo`: PASS.
- `git diff --check`: PASS; line-ending warnings only.
- SEO verifier: 336 post URLs, 109 SmartTalk URLs, 512 sitemap URLs, 0 missing post URLs, 0 missing SmartTalk URLs, 0 duplicate sitemap URL groups.
- Handler smoke: canonical post and SmartTalk URLs returned 200.
- Handler smoke: `/post/<id>`, `/smarttalks/<id>`, `/smarttalk/<id>`, and `/smarttalk?id=<id>` returned 301 to canonical slug URLs.
- Browser smoke: Home desktop, Explore mobile, canonical post, canonical SmartTalk, post refresh, browser back, and browser forward passed on the built preview bundle.
- Browser smoke: old client `/post/<id>` and `/smarttalk/<id>` canonicalized to slug URLs.
- Browser console: no errors on the fresh preview origin used for final verification.

## QA Notes

- SmartTalk index metadata was verified on tablet; the index did not expose `data-publisher-content="smarttalk-question"` markers in the smoke target, so focused SmartTalk route markers were used for item-route validation.
- Auth-personalized Bookmarks and Notifications were not exercised with a signed-in browser account. Their H5 URL behavior is covered by code-path/static verification: saved post surfaces reuse canonical card links, saved SmartTalk passes question content into `navigateToRoute`, and notification opens resolve by ID then canonicalize after the focused document loads.
