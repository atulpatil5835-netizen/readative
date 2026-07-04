# Production SEO and Trust Implementation Plan

Plan date: 2026-07-04
Status: Proposed only; awaiting architecture approval

## Release principles

- No implementation begins until this audit is approved.
- Preserve existing product behavior while changing document delivery and URL contracts.
- Make one canonical route represent one public resource.
- Make public eligibility identical across page rendering, sitemap, discovery, and schema.
- Prefer the current Vite/Vercel stack; do not introduce a framework or dependency unless a later architecture gate proves it necessary.
- Deploy the smallest reversible release and verify live responses before continuing.
- Do not mix legal copy changes, route migrations, post rendering, and sitemap cleanup in one deployment.

## Dependency order

```text
Public eligibility contract
        ↓
Phase 1.1 Legal and trust pages
        ↓
Phase 1.2 SmartTalk canonical consolidation
        ↓
Phase 1.3 Knowledge post documents
        ↓
Phase 1.4 Internal linking and taxonomy
        ↓
Phase 1.5 Google index optimization
        ↓
Phase 1.6 Live production validation
```

## Pre-implementation architecture gate

Approve these decisions first:

1. Canonical SmartTalk family: recommended `/smarttalks` and `/smarttalks/{id}`.
2. Categories are broad pillars; topics are narrower collections; tags remain `noindex` until quality criteria are met.
3. Post IDs remain the canonical identifiers for this release.
4. Public author pages require intentional public eligibility and qualifying content.
5. Dedicated legal/trust pages become the authoritative source; modal text becomes summary/navigation only.
6. Server-delivered initial HTML is required for indexable dynamic content.
7. `/posts` and `/smarttalks` must be explicitly classified as canonical user hubs or `noindex, follow` support indexes.
8. AMP is either normalized to the canonical `www` host and maintained, or removed with a deliberate migration.

No code should be written until these decisions are accepted.

## Phase 1.1 — Professional legal and trust pages

### Objective

Create stable, crawlable, legally reviewed trust documents without redesigning the product.

### Scope

- `/about`
- `/contact`
- `/privacy`
- `/terms`
- `/community-guidelines`
- `/disclaimer`
- `/editorial-policy`
- `/corrections-policy`
- `/cookie-policy` when required by actual cookie/advertising use

### Work

1. Establish a single source for approved policy copy.
2. Add dedicated routes with direct-load support and semantic HTML.
3. Add self-canonical metadata and appropriate WebPage/AboutPage/ContactPage schema.
4. Replace footer and header trust buttons with anchors.
5. Keep the current info panel only as a temporary summary that links to full documents.
6. Add approved pages to sitemap generation with real modification dates.
7. Clearly identify the Readative operator and policy contact.

### Release gate

- Legal review completed.
- Every page works with JavaScript disabled and on refresh.
- Footer anchors are present in initial or reliably server-delivered HTML.
- No duplicate authoritative policy copy remains in JSX.
- No product UI redesign.

### Rollback

Restore footer buttons/panel entry points while leaving route code disabled. Do not remove already-public policy URLs without redirects once indexed.

## Phase 1.2 — SmartTalk SEO

### Objective

Unify product, crawler, sitemap, schema, and share URLs for each question.

### Work

1. Create a shared SmartTalk public-eligibility predicate:
   - exclude private/hidden/draft/deleted/archived content;
   - exclude moderated/hidden answers;
   - define minimum content quality for indexing.
2. Support the approved canonical question path in the client and on direct refresh.
3. Generate unique focused-question title, description, canonical, OG/Twitter, and DiscussionForumPosting data.
4. Update question anchors in SmartTalk, Explore, Knowledge Journey, Profile, and Notifications.
5. Consolidate the duplicate hub intentionally.
6. Add redirects only after canonical direct routes pass.
7. Update sitemap and discovery URLs in the same release as redirects.
8. Return 404/410 plus `noindex` for missing, deleted, or non-public questions.

### Release gate

- One URL per public question across all surfaces.
- Initial HTML contains question content and matching metadata.
- No private SmartTalk data is present in the SEO dataset.
- Old URL cohort redirects exactly once to the canonical target.
- SmartTalk business logic is unchanged.

### Rollback

Keep old handlers available, revert link generation, and temporarily preserve both route parsers. Never remove redirects before restoring old canonical/sitemap values.

## Phase 1.3 — Knowledge post SEO

### Objective

Make `/post/{id}` a complete public document in the initial response while preserving the existing interactive reading experience.

### Architecture spike

Before production work, prototype one post using the existing stack and choose between:

- a Vercel server document that injects post metadata and crawlable article content while booting the existing SPA; or
- deploy-time prerendered post documents with the existing client bundle.

Selection criteria:

- no new framework;
- no duplicate user-facing article after hydration;
- direct per-document Firestore read rather than a full collection scan;
- real 404/410 status;
- cache and invalidation strategy;
- exact metadata/schema parity with the hydrated client;
- no feed, ranking, Notebook, Downloader, or virtualization changes.

### Work after spike approval

1. Extract shared post normalization and public-eligibility logic.
2. Server-deliver title, description, canonical, robots, OG/Twitter, and Article schema.
3. Server-deliver readable article content and author/category/tag anchors.
4. Link Article author to the canonical public profile entity.
5. Add category-aware breadcrumbs.
6. Use a valid remote content image when available and a correct fallback otherwise.
7. Return 404/410 for missing, private, deleted, or archived posts.
8. Keep `/post/{documentId}` stable; preserve `/knowledge/{id}` permanent redirects.

### Release gate

- Representative post source HTML is unique without JavaScript.
- Social preview metadata is post-specific.
- Hydrated UI is behaviorally unchanged.
- Direct loads, reloads, and shares work.
- No full-collection read is introduced per post request.

### Rollback

Remove the dynamic/prerender route and restore the SPA rewrite while keeping post URLs unchanged.

## Phase 1.4 — Internal linking and taxonomy

### Objective

Make the visible product graph and canonical crawl graph identical.

### Work

1. Define category and topic intent in code and copy.
2. Canonicalize category aliases to canonical slugs.
3. Replace redirecting `/knowledge?topic=...` SEO links with approved topic/category destinations.
4. Use real canonical anchors for related posts, questions, authors, categories, and topics.
5. Link legal/trust pages from the footer.
6. Link the canonical content hubs from appropriate navigation surfaces.
7. Ensure public authors are linked only when a valid public destination exists.
8. Add visible breadcrumbs where they help readers; keep schema parity.
9. Prevent duplicate recommendations from creating excessive repeated links.

### Release gate

- Every sitemapped content URL has a natural inbound link.
- No internal anchor points to a redirecting URL.
- No question anchor points to a noncanonical query URL.
- Category aliases redirect to canonical slugs.
- Mobile and tablet behavior remains functionally unchanged unless separately approved.

### Rollback

Revert link generators independently; retain redirects that protect already-published URLs.

## Phase 1.5 — Google index optimization

### Objective

Make the sitemap, robots directives, status codes, and quality thresholds describe the same public corpus.

### Work

1. Remove all `noindex` URLs from the sitemap.
2. Exclude empty categories/topics and thin/non-public authors/questions.
3. Use real modification timestamps only.
4. Decide whether tags become substantial indexable pages; otherwise keep them out of sitemap.
5. Classify `/posts` and `/smarttalks` as canonical hubs or `noindex, follow` support documents.
6. Paginate or split unbounded discovery documents.
7. Add sitemap count-collapse detection and last-known-good behavior.
8. Split into a sitemap index by content type when operationally useful and before protocol limits.
9. Normalize `/index.html`, trailing slashes, aliases, and AMP host behavior.
10. Extend verification to live response status, initial HTML, canonical, robots, schema, and sitemap parity.

### Release gate

- Sitemap contains only canonical 200 indexable URLs.
- No false `lastmod` generation.
- Missing/private routes never return indexable 200 documents.
- Dataset collapse is observable and blocks an unhealthy release.
- Live cache headers and CDN behavior are verified.

### Rollback

Restore the last known good sitemap artifact and previous endpoint routing. Do not restore known private/thin URLs merely to recover counts.

## Phase 1.6 — Final validation

### Repository validation

Run only after implementation is approved and complete:

- `npm run build`
- `npx tsc --noEmit`
- `git diff --check`
- SEO verification suite
- route and schema contract tests

### Live validation

For representative cohorts, verify:

- GET and HEAD status;
- redirects and final URL;
- initial HTML content;
- exactly one canonical;
- robots directive;
- title/description;
- OG/Twitter;
- schema parse and entity URLs;
- sitemap membership;
- response caching;
- no console errors after hydration.

### External validation

- Rich Results/Schema validator where applicable.
- Social preview debuggers.
- Google Search Console URL Inspection.
- Sitemap submission and processed-URL count.
- Monitor indexed, duplicate, soft-404, discovered-not-indexed, and crawled-not-indexed cohorts.

### Production gate

Production ready only when:

- canonical and sitemap parity is 100% for the sampled corpus;
- no private or email-fallback author data is exposed;
- valid routes return 200 and invalid routes return 404/410;
- legal/trust pages are reviewed and directly reachable;
- rollback artifacts are prepared;
- no prohibited product subsystem changed.

## Expected impact

| Area | Expected impact |
| --- | --- |
| Bundle | Target 0 KB for server/document work; route page code should remain lazy |
| Firestore | Fewer wasteful full scans after endpoint consolidation; direct reads for dynamic documents |
| Crawl efficiency | Major improvement from canonical/sitemap parity and thin-page removal |
| Render behavior | No additional feed/card renders; SEO document work occurs outside feed virtualization |
| Memory | Reduced server response pressure after discovery pagination/splitting |
| Regression risk | High if route migration is combined; medium-to-low when staged with redirects and live gates |

## Out of scope

- Firestore schema redesign
- Feed ranking
- Notebook/Highlight logic
- SmartTalk business logic
- Authentication
- Downloader
- UI redesign
- Framework migration without a separate approved decision

Related documents:

- [production_seo_audit.md](production_seo_audit.md)
- [legal_pages_audit.md](legal_pages_audit.md)
- [smarttalk_seo_audit.md](smarttalk_seo_audit.md)
- [google_indexing_audit.md](google_indexing_audit.md)
- [engineering_risk.md](engineering_risk.md)
- [migration_plan.md](migration_plan.md)
