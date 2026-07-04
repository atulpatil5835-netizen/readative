# Production SEO Engineering Risk Register

Audit date: 2026-07-04
Status: Pre-implementation risk assessment

## Risk scale

- Critical: can expose private data, deindex the corpus, or break public routes.
- High: can fragment canonical signals, create widespread crawl failures, or regress core navigation.
- Medium: can reduce quality, increase cost, or create operational drift.
- Low: localized quality issue with straightforward rollback.

## Risk register

| ID | Severity | Risk | Current trigger | Required mitigation | Rollback signal |
| --- | --- | --- | --- | --- | --- |
| R-01 | Critical | Private/profile data enters SEO output | Profiles and SmartTalk do not check `visibility`; profile name can fall back to email | Shared public predicate; prohibit email/ID fallback; private-data fixtures | Any private/email value in sitemap, discovery HTML, schema, or page source |
| R-02 | Critical | Canonical question migration breaks SmartTalk direct loads | Product and server use different question URLs | Add target support first, then links/sitemap, then redirects | 404/loop/hydration mismatch on old or new cohort |
| R-03 | Critical | Sitemap silently loses dynamic URLs | Loader falls back to static data with HTTP 200 | Minimum-count guard, last-known-good artifact, alerting, source header checks | Post/profile/question counts collapse unexpectedly |
| R-04 | High | Post document delivery breaks interactive app | `/post/{id}` currently relies on SPA rewrite | One-route spike, hydration parity tests, feature flag or route rollback | Duplicate content, blank app, console hydration errors |
| R-05 | High | Search sees cloaked or inconsistent content | Separate crawler/server and reader/client documents | Same canonical content and eligibility for all clients; no user-agent branching | Material source-vs-hydrated content mismatch |
| R-06 | High | Redirect loops or chains | `/knowledge` already redirects; aliases and new SmartTalk redirects may overlap rewrites | Route table tests and one-hop redirect budget | More than one redirect or target returns another redirect |
| R-07 | High | Indexable soft 404s remain | SPA patterns return `index.html` before client not-found | Server resource check and real 404/410 | Invalid route returns 200/index |
| R-08 | High | Legal pages publish inaccurate claims | Current content is brief and not legally reviewed | Legal/operator review against actual data flows | Any mismatch with Firebase, Google auth, analytics, ads, cookies, or UGC practice |
| R-09 | High | Category/topic cannibalization | Overlapping AI/category/topic/filter URLs | Taxonomy contract, canonical paths, unique copy, qualification thresholds | Multiple indexable URLs target same intent/content |
| R-10 | High | CDN serves stale canonical/sitemap after migration | One-hour shared caches and stale-while-revalidate | Versioned rollout, purge plan, live cache/header checks | Old canonical persists after redirect/sitemap change |
| R-11 | Medium | Firestore cost/latency grows with SEO traffic | Each SEO endpoint loads entire collections on cache miss | Direct document reads, shared cache/last-known-good data, endpoint budgets | Full scans per post request or serverless timeouts |
| R-12 | Medium | Discovery pages exceed function/HTML limits | `/posts` and `/smarttalks` are unbounded | Pagination/splitting, response-size budgets | Response size/latency crosses agreed threshold |
| R-13 | Medium | Client and server normalization drift | Separate metadata/schema code paths | Shared pure normalizers and parity fixtures | Same resource produces different title/status/canonical |
| R-14 | Medium | Alternate hosting behaves differently | `vercel.json`, `_redirects`, Express, and Vite route sets differ | Declare supported production host; route manifest or parity tests | Route passes locally but fails on deployed host |
| R-15 | Medium | False `lastmod` wastes crawl budget | Generated time used as fallback | Omit unknown `lastmod`; use real persisted timestamps | Unchanged URL timestamp moves between runs |
| R-16 | Medium | Verification reports false success | Current script infers links/meta from code | Fetch and parse built/live responses | Script passes while representative response fails |
| R-17 | Medium | Support hubs are classified as doorway pages | Machine-oriented full inventories are indexable | Make them useful user hubs or `noindex, follow` | Low engagement, duplication, quality exclusions |
| R-18 | Medium | Author links lead to missing profiles | Content author IDs are not synthesized into profile SEO data | Validate public profile destination before linking/indexing | Authored content links to profile 404 |
| R-19 | Medium | AMP creates host/canonical conflict | AMP canonical uses non-`www` | Normalize and validate AMP or retire it deliberately | AMP validator/canonical chain failure |
| R-20 | Low | Rich preview quality remains generic | Logo fallback and missing dimensions | Content image validation and complete OG metadata | Preview debugger shows wrong/generic asset |

## Highest-risk files for later implementation

| Area | Files | Why sensitive |
| --- | --- | --- |
| Client route contract | `src/utils/routes.ts`, `src/App.tsx`, `vercel.json` | A mismatch can break every direct load or create redirects loops |
| SEO eligibility/data | `api/_seoData.ts` | Controls public exposure, sitemap counts, and server content |
| Post route delivery | `src/components/KnowledgeFeed/*`, future server handler | Must preserve reading, feed cache, Notebook, and virtualization behavior |
| SmartTalk route delivery | `src/components/SmartTalk.tsx`, `api/smarttalks.ts` | Two implementations must become one canonical resource without logic changes |
| Global metadata | `src/components/SEO.tsx`, `src/utils/seoSchemas.ts`, `index.html` | A global regression can affect every indexed URL |
| Footer/legal | `src/components/AppShell.tsx`, `src/components/AppPanels.tsx`, route layer | Must separate authoritative pages without breaking panel behavior |
| Sitemap/routing | `api/sitemap.xml.ts`, `vercel.json`, `public/_redirects` | Production-specific and highly cached |

## Required safeguards

### Public-content contract

Before expanding indexability, define one pure eligibility contract per resource:

- public visibility;
- published status;
- no deletion/moderation marker;
- required title/content fields;
- qualifying content threshold;
- valid canonical owner/author relationship;
- real timestamp handling.

The same predicate must drive sitemap, discovery, server document, client robots, and schema.

### Route contract tests

Every canonical family needs table-driven tests for:

- canonical route;
- legacy route;
- alias route;
- malformed identifier;
- missing resource;
- private/deleted resource;
- trailing slash;
- query-string variant;
- HEAD behavior;
- redirect count and destination.

### Deployment gates

Do not advance phases when:

- live sitemap counts collapse;
- any valid canonical returns non-200;
- any invalid/private route returns indexable 200;
- source HTML and hydrated canonical differ;
- server and client schema entity URLs differ;
- redirects exceed one hop;
- legal review is incomplete.

### Rollback assets

Prepare before each deploy:

- previous route/redirect manifest;
- previous sitemap output or last-known-good generator version;
- canonical URL cohort list;
- cache purge procedure;
- feature flag or rewrite rollback for server documents;
- Search Console annotation/date record.

## Regression risk by phase

| Phase | Risk | Reason |
| --- | --- | --- |
| 1.1 Legal pages | Medium | New route surface and content accuracy, but isolated from product logic |
| 1.2 SmartTalk SEO | High | Public URL and direct-load migration |
| 1.3 Post SEO | High | Changes initial document delivery for the core reading route |
| 1.4 Internal linking | Medium | Broad anchor changes can expose redirect or missing destinations |
| 1.5 Index optimization | High | Sitemap and status changes can add/remove hundreds of URLs |
| 1.6 Validation | Low | Read-only, but must be run against the actual deployment |

## Expected operational improvements

After the staged work:

- fewer repeated full-corpus SEO reads;
- smaller, more deliberate sitemap corpus;
- fewer unnecessary Google crawls of empty/noindex URLs;
- fewer client renders required for Google to understand a page;
- clearer failure detection when SEO data disappears;
- no expected increase in feed render count or startup bundle when server work remains isolated.

## Current production-readiness risk

Overall risk: **High**.

The privacy/eligibility findings must be addressed before aggressively increasing author or SmartTalk indexing. Canonical consolidation and server document delivery must be staged separately.

Related documents:

- [production_seo_audit.md](production_seo_audit.md)
- [implementation_plan.md](implementation_plan.md)
- [migration_plan.md](migration_plan.md)
- [google_indexing_audit.md](google_indexing_audit.md)
