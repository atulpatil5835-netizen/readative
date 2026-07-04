# Release P1 — Production SEO Foundation Walkthrough

Status: implemented and validated.
Date: 2026-07-04

## Objective

Readative now exposes crawlable production URLs for trust pages, SmartTalk questions, post detail pages, and discovery surfaces while preserving existing product behavior.

No business logic, Firestore schema, feed ranking, SmartTalk functionality, Notebook behavior, authentication, virtualization, polling, timers, intervals, or listeners were changed.

## Routes added or hardened

Dedicated legal and trust pages:

- `/about`
- `/contact`
- `/privacy`
- `/terms`
- `/disclaimer`
- `/community`

SEO and discovery routes:

- `/smarttalks`
- `/smarttalks/{questionId}`
- `/post/{postId}`
- `/sitemap.xml`

Compatibility routes:

- `/smarttalk` redirects to `/smarttalks`.
- `/smarttalk?id={questionId}` redirects to `/smarttalks/{questionId}`.
- `/smarttalk/{questionId}` redirects to `/smarttalks/{questionId}`.
- `/community-guidelines` redirects to `/community`.
- Existing category query SmartTalk aliases remain resolved by the SPA to avoid stealing the category route from its current product owner.

## Legal pages

The previous footer/legal side-panel behavior was replaced as the primary experience by dedicated server-rendered pages.

Each legal page includes:

- unique title
- unique meta description
- canonical URL
- Open Graph tags
- Twitter Card tags
- JSON-LD page schema
- Breadcrumb schema
- responsive Readative-styled document layout
- links to the other legal/trust pages

The old `InfoPanel` remains only as a lightweight optional preview shell and now links out to the authoritative public page. Duplicated legal copy and obsolete panel helpers were removed.

## SmartTalk SEO

SmartTalk questions now have permanent production URLs at:

```text
/smarttalks/{questionId}
```

Each server-rendered SmartTalk detail page includes:

- self-canonical URL
- Open Graph and Twitter Card metadata
- FAQ schema
- DiscussionForumPosting schema
- Breadcrumb schema
- related questions
- related posts fallback
- category link
- author attribution when available
- next reading link

Client-side SmartTalk schema and internal links now use the same canonical route family. Explore schema SmartTalk item URLs were also normalized to `/smarttalks/{questionId}`.

## Knowledge post SEO

Post detail pages now have server-rendered production documents at:

```text
/post/{postId}
```

Each document includes:

- self-canonical URL
- title and meta description
- Open Graph and Twitter Card metadata
- Article schema
- Breadcrumb schema
- author/person schema when an author id is available
- category, author, tags, related posts, related SmartTalk, and Knowledge Journey links

The existing SPA route still hydrates after the crawlable HTML loads.

## Indexing and sitemap

The sitemap loader now fails closed with HTTP 503 if dynamic SEO data is unavailable instead of silently returning a thin fallback sitemap with HTTP 200.

Local dynamic SEO QA loaded:

- source: REST
- public posts: 328
- public SmartTalk questions: 109
- public profiles: 33
- sitemap URLs: 495

Sitemap QA confirmed:

- legal pages are included
- post detail URLs are included
- SmartTalk detail URLs are included
- legacy `/smarttalk` URLs are not included
- `/tag/` URLs are not included
- unknown lastmod values are omitted instead of synthesized

Robots remains consistent:

```text
User-agent: *
Allow: /

Sitemap: https://www.readative.com/sitemap.xml
```

## Browser QA

Browser QA was run against a local production-style server wired to the built `dist` app and the same API handlers used by the Vercel rewrites.

Checked desktop, tablet, and mobile viewports:

- desktop: 1280 × 720
- tablet: 768 × 1024
- mobile: 390 × 844

Routes checked in-browser:

- `/about`
- `/contact`
- `/privacy`
- `/terms`
- `/disclaimer`
- `/community`
- `/smarttalks/import_q100`
- `/post/4ELsdHoS5ra5PJkDQbgk`

Results:

- 24 route/viewport checks passed.
- No browser console errors from the app origin.
- No horizontal overflow.
- Legal pages rendered the correct H1/title/canonical/schema.
- Hydrated SmartTalk and post pages retained exactly one canonical, one description, one OG URL, and one Twitter Card.
- Legacy `/smarttalk?id=import_q100` reached `/smarttalks/import_q100`.

## Files changed for this SEO release

- `api/_document.ts`
- `api/_seoData.ts`
- `api/discovery.ts`
- `api/legal.ts`
- `api/post.ts`
- `api/sitemap.xml.ts`
- `api/smarttalk.ts`
- `api/smarttalks.ts`
- `public/404.html`
- `public/_redirects`
- `public/amp/index.html`
- `src/App.tsx`
- `src/components/AppPanels.tsx`
- `src/components/AppShell.tsx`
- `src/components/Explore.tsx`
- `src/components/Header.tsx`
- `src/components/KnowledgeFeed/feedHelpers.ts`
- `src/components/SmartTalk.tsx`
- `src/utils/loadThirdPartyScripts.ts`
- `src/utils/routes.ts`
- `src/utils/seoSchemas.ts`
- `vercel.json`
- `walkthrough.md`
- `performance_report.md`
- `migration_report.md`
- `task.md`
- `final_report.md`

Unrelated pre-existing working-tree edits in reading/card surfaces were preserved and not folded into this SEO release scope.
