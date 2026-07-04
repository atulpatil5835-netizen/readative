# Production SEO Architecture Audit

Audit date: 2026-07-04
Release: Phase 1 — Production SEO & Trust Foundation
Status: Audit complete; implementation not started

## Scope and evidence

This audit covers the current working tree and does not modify production code, routing, Firestore, SmartTalk logic, the feed, Notebook, Downloader, or performance architecture.

Primary evidence:

- `src/App.tsx`
- `src/components/SEO.tsx`
- `src/components/AppShell.tsx`
- `src/components/AppPanels.tsx`
- `src/components/Header.tsx`
- `src/components/KnowledgeFeed/KnowledgeFeed.tsx`
- `src/components/KnowledgeFeed/feedHelpers.ts`
- `src/components/SmartTalk.tsx`
- `src/components/Explore.tsx`
- `src/components/Profile.tsx`
- `src/utils/routes.ts`
- `src/utils/seoSchemas.ts`
- `src/utils/seoTaxonomy.ts`
- `api/_seoData.ts`
- `api/discovery.ts`
- `api/smarttalks.ts`
- `api/sitemap.xml.ts`
- `vercel.json`, `public/_redirects`, `public/robots.txt`, `index.html`

The repository's most recent recorded live verification is `PRODUCTION_SITEMAP_FIX_REPORT.md` dated 2026-06-18. It records a healthy dynamic sitemap with 981 URLs. A fresh public-browser check on 2026-07-04 was blocked by the browser client, so current deployment parity is not independently confirmed by this audit. All findings below are therefore code-architecture findings unless explicitly identified as recorded production evidence.

## Executive verdict

Readative has useful SEO building blocks, but it is not yet one coherent crawlable publishing system.

The current architecture has three separate delivery paths:

1. The Vite SPA serves `index.html` for posts, categories, topics, tags, and profiles. Unique metadata and content arrive only after JavaScript and Firestore hydration.
2. Vercel serverless endpoints serve crawler-readable `/posts`, `/smarttalks`, and `/smarttalks/{id}` documents.
3. A Firestore-backed sitemap independently decides which posts, profiles, tags, categories, topics, and questions are public.

These paths disagree about canonical URLs, content eligibility, structured data, and navigation. That disagreement is the principal production risk.

Production readiness for this foundation: **not ready** until the critical URL, eligibility, server-rendering, and trust-page gaps are resolved in staged releases.

## Current architecture map

| Surface | Browser route | Initial response | Dynamic data | Canonical source | Indexing source |
| --- | --- | --- | --- | --- | --- |
| Home/feed | `/` | Generic `index.html` | Client Firestore | Client Helmet | SPA plus sitemap |
| Knowledge post | `/post/{documentId}` | Generic `index.html` | Client `getDoc`/feed cache | Client Helmet | Sitemap and `/posts` |
| SmartTalk app | `/smarttalk?id={id}` | Generic `index.html` | Client Firestore | Defaults to `/smarttalk` | App links only |
| SmartTalk category question | `/category/{slug}?id={id}` | Generic `index.html` | Client Firestore | Defaults to category path | App links only |
| SmartTalk crawl document | `/smarttalks/{id}` | Server HTML | Server Firestore loader | Server HTML | Sitemap and `/smarttalks` |
| Category | `/category/{slug}` | Generic `index.html` | SmartTalk client filter | Client pathname | Sitemap and `/posts` |
| Topic | `/topic/{slug}` | Generic `index.html` | Explore client queries | Explicit client URL | Sitemap and `/posts` |
| Tag | `/tag/{slug}` | Generic `index.html` | Feed client filter | Explicit client URL | Sitemap and `/posts`, but client emits `noindex` |
| Author | `/profile/{authorId}` | Generic `index.html` | Client Firestore | Explicit client URL | Sitemap and `/posts` |
| Discovery index | `/posts` | Server HTML | Full server SEO dataset | Server HTML | Sitemap |
| Legal/trust content | No routes | Lazy modal only | Local component content | None | Not crawlable |

## Priority findings

| ID | Severity | Finding | Exact impact |
| --- | --- | --- | --- |
| SEO-01 | Critical | Posts, profiles, categories, and topics return the same generic SPA shell before JavaScript. | Search and social crawlers do not receive route-specific content, title, canonical, OG, Twitter, or schema in the initial document. |
| SEO-02 | Critical | Interactive SmartTalk URLs and crawlable SmartTalk URLs are different systems. | Link equity, sharing, canonical signals, analytics, and user navigation are split between `/smarttalk`, `/category/...?...`, and `/smarttalks/{id}`. |
| SEO-03 | Critical | The server SEO loader can expose profiles and SmartTalk data using weaker visibility rules than posts. | Profiles can fall back to an email address or document ID, and `visibility: private` is not checked for profiles or SmartTalk questions. |
| SEO-04 | High | Sitemap entries include every tag while every client tag page emits `noindex`. | The sitemap directly contradicts page indexing directives and wastes crawl budget. |
| SEO-05 | High | Empty taxonomy pages and profiles can be sitemapped with generated-at timestamps. | Thin pages are advertised as indexable and newly modified even when no qualifying content exists. |
| SEO-06 | High | Category, topic, and knowledge-filter URLs overlap and sometimes canonicalize to redirects or the wrong schema URL. | Google may consolidate the wrong page, ignore declared canonicals, or treat hubs as duplicates. |
| SEO-07 | High | About, Privacy, Terms, Disclaimer, Community, and Contact are button-opened modal sections with no URLs. | Trust content cannot be linked, shared, indexed, cited, or reached without interaction. |
| SEO-08 | High | Invalid SPA resources return the app shell and only become a client-side not-found state. | Search engines may encounter soft 404s and spend rendering resources on invalid URLs. |
| SEO-09 | High | The dynamic sitemap can silently degrade to a static taxonomy-only result with HTTP 200. | A Firestore access failure can remove all posts, profiles, and questions without an obvious transport failure. |
| SEO-10 | Medium | `/posts` and `/smarttalks` are unpaginated, machine-oriented, indexable documents. | Responses grow without bounds and may be treated as low-quality doorway or duplicate hubs. |
| SEO-11 | Medium | The SEO verification script asserts several outcomes from code presence rather than rendered responses. | Reports can pass while initial HTML, canonical parity, status codes, or actual inbound links are wrong. |
| SEO-12 | Medium | Vercel, Netlify-style `_redirects`, the Express dev server, and client routing have different route sets. | Local and alternate-host behavior can diverge from production without being detected. |

## SEO and meta-tag architecture

### What exists

- `react-helmet-async` is installed and `HelmetProvider` wraps the app.
- `SEO.tsx` emits title, description, keywords, canonical, robots, Open Graph, Twitter Card, optional AMP, and JSON-LD tags.
- Canonical helpers consistently use `https://www.readative.com` in `routes.ts`, `seoSchemas.ts`, and the server SEO layer.
- Feed, SmartTalk, Explore, Profile, and client not-found states use the shared SEO component.
- The static shell contains homepage title, description, OG/Twitter tags, and WebSite/WebApplication JSON-LD.

### Gaps

- Helmet runs only after the React bundle loads. Dynamic routes initially expose homepage metadata.
- Social preview crawlers commonly do not execute the app, so post and profile shares can receive the generic Readative image/title.
- `index.html` has no static canonical. The canonical depends on client execution.
- Client metadata and server metadata are implemented twice and can drift.
- `meta keywords` adds no meaningful modern search value and increases duplication without solving discovery.
- Client OG supports image alt text, but neither client nor server provides complete image dimension/type metadata.
- Article-specific Open Graph properties such as publication time, modified time, section, and author are absent.
- The default `summary_large_image` card often falls back to the square logo.

## Canonical URL audit

### Stable canonical host

The main codebase uses `https://www.readative.com`. This is a positive foundation.

One exception remains: `public/amp/index.html` declares `https://readative.com/` without `www` and links to the non-`www` host. The homepage emits an AMP link to `/amp/`, so this mismatch creates an avoidable redirect/canonical inconsistency.

### Canonical conflicts

1. SmartTalk questions:
   - Interactive URL: `/smarttalk?id={id}`.
   - Category interactive URL: `/category/{slug}?id={id}`.
   - Crawl URL: `/smarttalks/{id}`.
   - The client SEO component omits query parameters by default and emits generic SmartTalk schema URLs.

2. Knowledge topic filters:
   - `buildPublicPath("knowledge", { selectedTopic })` produces `/knowledge?topic={slug}`.
   - `vercel.json` permanently redirects `/knowledge` to `/`.
   - The client can therefore declare a canonical URL that itself redirects.

3. Category aliases:
   - Aliases such as `/category/tech` normalize internally to `technology`.
   - The URL is not replaced and SmartTalk does not pass an explicit canonical URL.
   - Alias pages can self-canonicalize instead of consolidating to `/category/technology`.

4. Taxonomy overlap:
   - `/category/ai`, `/topic/ai`, `/?topic=ai`, and `/knowledge?topic=ai` can represent overlapping AI collections.
   - `/category/ai` currently emphasizes SmartTalk while `/topic/ai` mixes posts and discussions, but the distinction is not consistently stated in metadata or linking.

5. SmartTalk hubs:
   - `/smarttalk` and `/smarttalks` are both indexable, self-canonical hubs containing overlapping question inventory.

6. `/index.html`:
   - The client parses it as home and later emits the root canonical, but the initial response has no canonical or permanent redirect.

## Structured-data audit

### Knowledge posts

The client builds Organization, WebSite, CollectionPage, BreadcrumbList, and Article objects.

Gaps:

- Article JSON-LD is client-only.
- Article has `mainEntityOfPage` but no explicit `url` field.
- Author is a name only; it is not linked to the author profile entity.
- The breadcrumb is usually only Home → Post and omits category/topic context.
- The same Organization and WebSite objects are repeated without stable `@id` values.
- Article image is omitted for data URLs and falls back to no image in schema.

### SmartTalk

The server `/smarttalks/{id}` document has the strongest current schema: BreadcrumbList plus DiscussionForumPosting, answer comments, author link, dates, and answer count.

The client SmartTalk schema is materially weaker:

- Every list item points to `/smarttalk` rather than an individual question.
- Up to ten DiscussionForumPosting objects share the same `/smarttalk` URL.
- Focused questions do not receive unique title, description, canonical, or focused schema.
- Category pages declare a pathname canonical while their CollectionPage and breadcrumb schema identify `/smarttalk`.

### Topics and categories

- Topic pages have CollectionPage, ItemList, and breadcrumbs, but SmartTalk items inside those schemas point to the generic `/smarttalk` URL.
- Category pages reuse the generic SmartTalk schema instead of category-specific CollectionPage data.

### Authors

- Profile pages emit a client-only Person object.
- The Person object can include `sameAs`, which is useful.
- It lacks a breadcrumb, image, stable entity ID, and links from authored Article/Discussion entities.
- The profile meta description is generic rather than the profile bio.

## Knowledge-post SEO audit

| Requirement | Current state | Risk |
| --- | --- | --- |
| Canonical | Correct after focused entry hydrates | Not in initial HTML |
| Unique title/description | Correct after hydration | Generic initial document |
| Article JSON-LD | Present after hydration | Client-only and incomplete author linkage |
| Author | Visible anchor and schema name | No schema URL/entity relationship |
| Breadcrumb | JSON-LD present | Minimal hierarchy; no visible breadcrumb |
| OG/Twitter | Unique after hydration | Social crawlers can receive generic shell metadata |
| Share URL | Correct `/post/{id}` | Preview metadata still generic without rendering |
| HTTP 404 | Client transitions to `/404?...` | Initial supported-route rewrite remains HTTP 200 |
| URL quality | Stable opaque Firestore ID | Durable but not descriptive; changing it is not required for Phase 1 |

The post ID URL should remain stable during this foundation release. A title-slug migration would add redirect and synchronization risk without addressing the dominant server-rendering problem.

## Category-page audit

Current behavior:

- Known `/category/{slug}` routes open SmartTalk filtered by category.
- Sitemap category last modification is derived from both knowledge posts and SmartTalk questions.
- Discovery describes categories as broad knowledge pillars.
- Category metadata and schema remain generic SmartTalk metadata.

SEO value:

- Broad, curated category hubs can become strong internal-linking and discovery pages.
- They can connect posts, questions, topics, authors, and editorial context.

Current duplicate/thin-content risks:

- Category and topic intent overlaps.
- Alias category URLs can self-canonicalize.
- Empty categories are still sitemapped with a current timestamp.
- Initial content is client-only.
- Category schema points to `/smarttalk`, not the category URL.

Recommendation for later implementation: define categories as broad permanent pillars and topics as narrower subcollections. Do not index a category until it has unique introductory copy and a minimum amount of qualifying content.

## Author-page audit

Current behavior:

- `/profile/{authorId}` is a client route backed by `userProfiles`.
- Sitemap includes every non-deleted profile whose `status` is not in the private-status set.
- `/posts` links profiles and post cards link authors with real anchors.

Critical eligibility issues:

- `_seoData.normalizeProfile()` does not check a `visibility` field.
- Display name falls back to `email`, then document ID.
- Profiles with zero public posts and zero public SmartTalk questions can be sitemapped.
- Authors referenced by content but missing a `userProfiles` document are not synthesized into the sitemap, even though client cards can link to their profile URL.

Future SEO value:

- Public author pages can establish expertise, connect Article and Discussion entities, and create durable internal links.
- Only intentionally public, non-thin profiles should be indexable.

## Internal-linking audit

| Source | Current link quality | Gap |
| --- | --- | --- |
| Desktop header | Real anchors for Home, SmartTalk, Explore, Profile | Profile root is user-dependent; legal links are buttons in a menu |
| Mobile navigation | Buttons | No crawlable anchors |
| Footer | Buttons that open modal sections | No crawlable legal/trust destinations |
| Post title | Real `/post/{id}` anchor | Client-rendered only |
| Post author/mentions/comments | Real profile anchors | Can target non-public or missing profiles |
| Post tags | Real tag anchors | Destination is `noindex` while in sitemap |
| Knowledge Journey | Real anchors | SmartTalk actions use noncanonical interactive query URLs; category action can use redirecting `/knowledge?topic=` |
| Explore | Many real topic, post, profile, and SmartTalk anchors | SmartTalk links use noncanonical query URLs |
| Profile activity | Post cards contain anchors | SmartTalk activity uses buttons, not canonical links |
| `/posts` | Server HTML links all inventory | Not linked from the visible app; unpaginated and duplicates posts in Recent and All sections |
| `/smarttalks` | Server HTML links all questions | Duplicates `/smarttalk`; not part of normal app navigation |

The strongest crawl graph currently lives in support endpoints that ordinary users do not naturally reach. A production knowledge platform should make its visible navigation and canonical crawl graph the same graph.

## Footer audit

Positive foundations:

- Semantic `<footer>` element.
- Consistent placement across app routes.
- Clear labels for six trust topics.
- Contact address exists inside the information panel.

Professional and SEO gaps:

- Every trust link is a `<button>`, not an anchor.
- No trust section has a URL, title, canonical, or indexable document.
- The modal component is lazy-loaded and absent until a user action; crawlers do not see its content in normal page rendering.
- Editorial Policy, Corrections Policy, Content Policy, and Cookie Policy are absent.
- There is no crawlable link to the post or SmartTalk discovery index.
- Business/entity identity is unclear: the About panel references Readative, Innovation InfoHub, and the founder without defining the legal/operator relationship.
- Copyright/takedown and reporting paths are not prominent for a user-generated-content platform.

Detailed legal findings are in [legal_pages_audit.md](legal_pages_audit.md).

## Sitemap and SEO endpoint audit

### Endpoint inventory

| Endpoint | Runtime | Purpose | SEO status |
| --- | --- | --- | --- |
| `/sitemap.xml` → `api/sitemap.xml.ts` | Vercel function | Dynamic XML URL inventory | Core SEO endpoint |
| `/posts` → `api/discovery.ts` | Vercel function | Server-rendered links to posts, questions, profiles, taxonomy | Crawl-support endpoint; currently indexable |
| `/smarttalks` → `api/smarttalks.ts` | Vercel function | Server-rendered question index | Crawl-support/canonical hub overlap |
| `/smarttalks/{id}` → `api/smarttalks.ts?id={id}` | Vercel function | Server-rendered question document | Strongest current dynamic SEO document |
| `/api/posts` → `api/posts.ts` | Vercel function | In-memory CRUD-style post API | Not connected to Firestore SEO data and not an SEO document |
| `/api/profile/{id}` → `api/profile/[id].ts` | Vercel function | In-memory profile helper | Not used by sitemap/profile SEO rendering |
| Express routes in `server.ts` | Local development | In-memory posts/profiles | Does not reproduce production SEO endpoints |

The coexistence of in-memory API helpers, client Firestore reads, and server SEO Firestore reads makes ownership unclear. The production SEO corpus is sourced by `api/_seoData.ts`, not by `api/posts.ts`, `api/profile/[id].ts`, or `server.ts`.

### Current sitemap generation

`api/sitemap.xml.ts` calls `loadSeoData()` and emits:

- 5 static pages
- 8 categories
- 45 taxonomy topics
- seeded and discovered tags
- every qualifying post
- every qualifying profile
- every qualifying SmartTalk question

Positive foundations:

- Correct XML namespace and absolute canonical-host URLs.
- `lastmod`, `changefreq`, and priority fields are emitted.
- Data can load through Admin SDK or Firestore REST.
- The endpoint uses CDN caching and supports `HEAD`.
- Post, profile, and SmartTalk URLs are included in the recorded healthy deployment.

Risks:

1. All seeded tags are emitted even at zero content count.
2. All categories and topics are emitted even when empty.
3. Client tag pages always emit `noindex`.
4. Static and empty pages use `generatedAt` as `lastmod`, making unchanged pages appear freshly modified every cache cycle.
5. Profiles without `updatedAt` also receive generated-time freshness.
6. Full `knowledge`, `userProfiles`, and `smarttalk` collections are read for each uncached SEO endpoint invocation.
7. `/posts` renders recent posts and all posts, repeating the latest entries twice.
8. `/posts` and `/smarttalks` are unbounded single documents.
9. When Admin and REST loading both fail, `loadSeoData()` returns `source: "static"` with HTTP 200 rather than failing closed or surfacing an operational alert.
10. The static fallback still emits taxonomy URLs with false current `lastmod` values.
11. The current scale is under the 50,000-URL sitemap limit, but no sitemap-index strategy exists for growth.

### Local/production parity

- `server.ts` does not implement the sitemap, discovery, or SmartTalk SEO handlers.
- Vite proxies `/api` to this Express server during normal development.
- The production SEO architecture therefore requires a Vercel-specific environment to test accurately.
- `public/_redirects` lacks `/smarttalks/:id` and `/sitemap.xml` mappings found in `vercel.json`.

### Verification-script limitations

`scripts/verify-seo-recovery.ts` is useful for dataset counts but overstates some checks:

- Inbound-link coverage is assigned from the post count instead of parsing the rendered discovery document.
- OG/Twitter and Article-schema checks are reported as pass based on component existence.
- It does not fetch representative deployed documents to verify initial HTML, status, canonical, robots, or schema parity.
- It does not detect sitemap URL versus `noindex` conflicts.
- It does not audit profile/SmartTalk visibility eligibility or email fallback.

## Robots and crawlability

`public/robots.txt` allows all paths and advertises the canonical sitemap. There is no robots-level block preventing indexing.

The principal crawlability problems are downstream:

- generic initial HTML for SPA routes;
- client-only content and metadata;
- canonical conflicts;
- soft 404 behavior;
- orphaned support hubs;
- noindex URLs in the sitemap;
- thin taxonomy/profile/question URLs;
- no dedicated trust pages.

Robots changes are not the first fix. Blocking URLs before canonical and rendering work could prevent consolidation signals from being seen.

## Duplicate-content risks

| Duplicate set | Risk level | Cause |
| --- | --- | --- |
| `/smarttalk` vs `/smarttalks` | High | Two indexable hubs with overlapping question inventory |
| Interactive question URLs vs `/smarttalks/{id}` | Critical | Different URLs for product and crawler documents |
| `/category/ai` vs `/topic/ai` vs knowledge topic filters | High | Overlapping taxonomy intent and inconsistent routing |
| Category aliases | High | Alias normalization without canonical URL replacement |
| `/knowledge?topic=...` vs `/?topic=...` | High | Declared path is subject to permanent redirect |
| `/posts` vs source post pages | Medium | Full excerpts duplicated in a machine-oriented index |
| Latest posts repeated inside `/posts` | Medium | Recent and All sections repeat the same documents |
| `/index.html` vs `/` | Low to medium | Both resolve as home; consolidation depends on client canonical |
| Trailing-slash variants | Low to medium | No comprehensive server normalization contract |

## What is already strong

- Canonical host is centralized and mostly consistent.
- Legacy `/knowledge/{id}` redirects to `/post/{id}`.
- Post and profile cards use meaningful real anchors in several surfaces.
- Dynamic sitemap discovery exists and has a recorded successful production deployment.
- Server-rendered SmartTalk question documents prove the existing stack can deliver crawler-readable HTML without a framework migration.
- Client 404 state emits `noindex`.
- Taxonomy definitions provide reusable descriptions, relationships, and stable slugs.
- No new dependency is required to address the foundation.

## Architecture decisions required before implementation

1. Adopt one canonical SmartTalk URL family and migrate every link, sitemap entry, schema URL, share URL, and route to it.
2. Define a server-delivered document strategy for posts, categories/topics, authors, and legal pages.
3. Define a public-index eligibility contract shared by client rendering, sitemap generation, discovery pages, and schemas.
4. Define category versus topic intent and remove redirecting/noncanonical knowledge filter URLs from SEO surfaces.
5. Decide whether `/posts` and `/smarttalks` are user-facing canonical hubs or `noindex, follow` crawl support documents.
6. Decide whether AMP is maintained with canonical parity or retired cleanly.
7. Establish deploy-time/live response validation as the production source of truth.

## Recommended release boundary

Do not combine all fixes into one deployment. Follow the staged plan in [implementation_plan.md](implementation_plan.md), the safeguards in [engineering_risk.md](engineering_risk.md), and the URL transition sequence in [migration_plan.md](migration_plan.md).

Related audits:

- [legal_pages_audit.md](legal_pages_audit.md)
- [smarttalk_seo_audit.md](smarttalk_seo_audit.md)
- [google_indexing_audit.md](google_indexing_audit.md)
