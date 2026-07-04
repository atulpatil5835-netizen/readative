# Production SEO Migration Plan

Plan date: 2026-07-04
Status: Proposed; no migration executed

## Migration objective

Move Readative from separate SPA, crawler-support, and sitemap URL systems to one canonical public-document contract without changing content IDs, Firestore schema, or product behavior.

## Non-negotiable rules

- Add target support before changing links or redirects.
- Never change canonical, sitemap, and redirects in unrelated deployments.
- Preserve existing post document IDs.
- Do not migrate Firestore content for this foundation unless a separately approved data contract requires it.
- Do not expose a profile/question merely to preserve sitemap counts.
- Keep old public routes redirecting after migration; do not create chains.
- Validate source HTML and HTTP status before Search Console submission.

## Current-to-target URL map

| Resource | Current public forms | Recommended target | Migration action |
| --- | --- | --- | --- |
| Home | `/`, `/index.html`, legacy `/knowledge` | `/` | 301 `/index.html` and `/knowledge` to `/` |
| Post | `/post/{id}`, legacy `/knowledge/{id}` | `/post/{id}` | Preserve target; keep one-hop legacy 301 |
| SmartTalk hub | `/smarttalk`, `/smarttalks` | `/smarttalks` | Support target in product, then 301 singular hub |
| SmartTalk question | `/smarttalk?id={id}`, `/category/{slug}?id={id}`, `/smarttalks/{id}` | `/smarttalks/{id}` | Support direct target, update anchors/sitemap/schema, then redirect legacy query forms where technically safe |
| Category | `/category/{slug}` plus aliases | `/category/{canonicalSlug}` | 301 aliases; distinct broad-pillar content |
| Topic | `/topic/{slug}`, `/?topic={slug}`, `/knowledge?topic={slug}` | `/topic/{canonicalSlug}` | Update links and canonicals; redirect legacy filter paths where safe |
| Tag | `/tag/{slug}` | Same, `noindex` initially | Remove from sitemap until indexable quality threshold exists |
| Author | `/profile/{authorId}` | Same | Preserve URL; index only intentionally public, substantial profiles |
| Discovery support | `/posts` | Decision required | User-grade canonical hub or `noindex, follow` support index |
| About | Modal state | `/about` | Create page; panel links to it |
| Contact | Modal state | `/contact` | Create page; panel links to it |
| Privacy | Modal state | `/privacy` | Create page; panel links to it |
| Terms | Modal state | `/terms` | Create page; panel links to it |
| Community | Modal state | `/community-guidelines` | Create page; panel links to it |
| Disclaimer | Modal state | `/disclaimer` | Create page; panel links to it |
| Editorial | Missing | `/editorial-policy` | Create reviewed page |
| Corrections | Missing | `/corrections-policy` | Create reviewed page |
| Cookie | Missing | `/cookie-policy` | Create when actual cookie/ads obligations require it |

## Stage 0 — Baseline and freeze

Before the first implementation deployment:

1. Export the current canonical sitemap URL set and URL-type counts.
2. Record representative live response headers and source HTML.
3. Record current redirect behavior for legacy post/tag/home URLs.
4. Select canonical cohorts for posts, questions, categories, topics, authors, and invalid/private resources.
5. Freeze new public URL patterns until the route contract is approved.
6. Preserve the last known good sitemap output and deployment alias.

Exit criterion: repeatable baseline with rollback artifacts.

## Stage 1 — Legal/trust routes

1. Publish dedicated reviewed documents at final paths.
2. Keep modal sections available during transition.
3. Change footer/header controls to real page anchors.
4. Make modal summaries link to authoritative pages.
5. Add indexable trust pages to the sitemap only after direct-load validation.

No redirects are needed because modal state had no public URLs.

Exit criterion: every trust page is directly addressable, canonical, crawlable, and linked.

## Stage 2 — SmartTalk route convergence

### Deployment A: target support

- Make `/smarttalks` and `/smarttalks/{id}` usable as approved reader routes.
- Preserve existing `/smarttalk` behavior.
- Align server/client eligibility and metadata.
- Do not redirect yet.

### Deployment B: link and sitemap switch

- Change all internal question anchors, notification destinations, schema URLs, shares, and sitemap entries to `/smarttalks/{id}`.
- Change primary hub navigation to `/smarttalks`.
- Keep old URLs functional.

### Deployment C: redirects

- Add one-hop permanent redirects from `/smarttalk` to `/smarttalks` once the target is stable.
- Where legacy query question URLs are externally reachable, resolve them to the question target without losing the ID.
- Do not redirect category hubs that contain no question ID.

### Deployment D: cleanup

- Remove duplicate hub indexability.
- Retain legacy parser/redirect coverage for an agreed long-term period.

Exit criterion: one canonical URL per question and no redirect chains.

## Stage 3 — Post document delivery

1. Keep `/post/{id}` unchanged.
2. Introduce server-delivered/prerendered source HTML behind the same URL.
3. Validate a small canary cohort before all posts.
4. Expand to the public corpus only after hydration and status-code parity.
5. Preserve `/knowledge/{id}` → `/post/{id}` permanent redirects.
6. Return 404/410 for missing, deleted, or private IDs.

No slug migration is included. If title slugs are ever desired, they require a separate migration and redirect strategy.

Exit criterion: source HTML is complete and the interactive reader remains unchanged.

## Stage 4 — Taxonomy normalization

1. Declare categories as broad pillars and topics as narrower collections.
2. Map every category alias to one canonical slug.
3. Replace internal `/knowledge?topic=` links with `/topic/{slug}` or `/category/{slug}` according to intent.
4. Ensure category/topic pages have unique copy and qualifying content.
5. Remove empty category/topic URLs from the sitemap.
6. Keep tags `noindex` and out of sitemap until a separate indexability decision.

Exit criterion: no indexable taxonomy pair has the same purpose or canonical mismatch.

## Stage 5 — Author eligibility migration

No Firestore schema change is assumed.

Initial eligibility can use existing fields and derived public contributions:

- exclude deleted/private/hidden/draft profiles;
- never publish email or document ID as display-name fallback;
- require a valid public display name/username;
- require at least one qualifying public post/question, or an explicit existing public indicator if trustworthy;
- ensure author links resolve to a valid public page.

If current fields cannot express intentional public profile consent safely, stop and request a separately approved data-contract/schema release rather than guessing.

Exit criterion: no thin, missing, email-fallback, or private profile is in the public SEO corpus.

## Stage 6 — Sitemap and support-index migration

1. Generate URLs only from the shared eligibility contract.
2. Remove `noindex`, redirecting, empty, and non-200 URLs.
3. Omit `lastmod` when no real modification timestamp exists.
4. Add minimum healthy counts and last-known-good fallback.
5. Split sitemaps by type when useful:
   - pages/legal;
   - posts;
   - SmartTalk;
   - authors;
   - taxonomy.
6. Decide whether `/posts` and `/smarttalks` are indexable user hubs or `noindex, follow` discovery support.
7. Paginate large indexes or stop duplicating full content excerpts.

Exit criterion: sitemap URL → final response is always one-hop 200, canonical, and indexable.

## AMP migration

Choose one:

### Maintain

- Change AMP canonical and all links to `https://www.readative.com`.
- Validate AMP markup and reciprocal `amphtml` relationship.
- Keep content and policy links current.

### Retire

- Remove the homepage `amphtml` link.
- Permanently redirect `/amp/` to `/`.
- Confirm no AMP URLs remain in sitemap or internal links.

Do not leave the current mixed-host state.

## Redirect rules

- Permanent only when the resource has permanently moved.
- Exactly one hop.
- Preserve resource identity and required query identifiers.
- Destination must return 200 and self-canonical.
- Do not redirect missing resources to home; return 404/410.
- Do not use client `pushState` as the only migration mechanism.
- Keep Vercel and any supported alternate-host route manifests synchronized.

## Cache and deployment sequence

For each route migration:

1. Deploy target response.
2. Verify uncached target source HTML.
3. Deploy internal links and schema.
4. Deploy sitemap changes.
5. Deploy redirects.
6. Purge/age out CDN cache.
7. Verify final live responses and counts.
8. Submit/inspect in Search Console.

## Rollback sequence

If a release fails:

1. Stop sitemap submission and preserve evidence.
2. Restore the previous rewrite/handler deployment.
3. Restore previous internal link generation if targets fail.
4. Restore the last known good sitemap.
5. Purge affected cache.
6. Recheck canonical cohorts.
7. Leave safe one-hop redirects in place only when their destinations work.

Never roll back by republishing private or known-thin content.

## Migration completion criteria

- One canonical URL per public resource.
- All canonical URLs return 200 with complete initial HTML.
- All invalid/private/deleted resources return 404/410 and are absent from sitemap.
- No sitemap URL redirects or emits `noindex`.
- Every public content URL has a natural internal anchor.
- Legal/trust documents have stable reviewed URLs.
- Client and server metadata/schema match.
- Production route behavior matches the declared route manifest.
- Search Console shows the new sitemap processed without systemic errors.

Related documents:

- [implementation_plan.md](implementation_plan.md)
- [engineering_risk.md](engineering_risk.md)
- [smarttalk_seo_audit.md](smarttalk_seo_audit.md)
- [legal_pages_audit.md](legal_pages_audit.md)
