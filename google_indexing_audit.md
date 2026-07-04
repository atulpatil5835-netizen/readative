# Google Indexing Audit

Audit date: 2026-07-04
Status: Architecture audit only; no Search Console or production changes

## Executive finding

Google is allowed to crawl Readative, and a dynamic sitemap/discovery layer exists. The main indexing risk is content delivery quality, not a robots block.

Most valuable routes still require Google to:

1. download the generic Vite shell;
2. download and execute React/Firebase code;
3. wait for Firestore;
4. allow Helmet to replace metadata;
5. decide whether the resulting page is unique, canonical, and substantial.

At the same time, the sitemap advertises several thin, noindex, duplicate, or potentially non-public pages. That combination can produce “discovered — currently not indexed,” “crawled — currently not indexed,” duplicate canonical selection, and soft 404 outcomes.

## Crawlability assessment

### Robots

`public/robots.txt`:

- allows all crawling;
- advertises `https://www.readative.com/sitemap.xml`;
- does not block posts, questions, profiles, categories, topics, or static assets.

Conclusion: robots is not the root blocker.

### Sitemap

The current generator can expose posts, profiles, questions, categories, topics, and tags. The most recent repository-recorded production check, dated 2026-06-18, reported 981 URLs and healthy dynamic headers.

Current architecture concerns:

- tag URLs are sitemapped but client pages emit `noindex`;
- empty taxonomy pages are sitemapped;
- all qualifying profile documents are sitemapped, including thin profiles;
- every SmartTalk question with nonempty content is sitemapped, even with zero answers;
- false current `lastmod` values are generated for static/empty content;
- total data failure can silently produce a taxonomy-only 200 sitemap.

### Navigation depth

- Header routes are shallow and mostly real anchors on desktop.
- Post titles, authors, mentions, tags, topic cards, and Explore content provide client-rendered anchors.
- `/posts` provides a server-rendered full inventory.
- `/smarttalks` provides a server-rendered question inventory.

However:

- support indexes are not linked from normal visible navigation;
- legal/trust destinations have no anchors or URLs;
- SmartTalk app links do not target the sitemap canonical URLs;
- profile SmartTalk activity can be button-only;
- client-only anchors require rendering before Google sees them.

## Initial HTML audit

### SPA routes

The following routes are rewritten to `index.html`:

- `/post/*`
- `/profile/*`
- `/smarttalk`
- `/explore/*`
- `/category/*`
- `/topic/*`
- `/tag/*`
- legacy `/knowledge/*`

Their initial HTML contains homepage-level metadata and a root container with no route content. Unique content and metadata are client-generated.

Indexing consequences:

- first-wave crawling sees duplicate shells;
- rendering is delayed and resource-dependent;
- Firestore failures can leave thin/error states;
- social crawlers receive generic previews;
- client `noindex` and canonical decisions may arrive after initial discovery;
- invalid IDs initially look like successful app pages.

### Server SEO routes

`/posts`, `/smarttalks`, and `/smarttalks/{id}` provide server HTML. These are crawlable without JavaScript, but they are a parallel document system rather than the product's primary route system.

## Reasons Google may skip or de-prioritize pages

### 1. Thin content

High-risk examples:

- zero-content categories/topics still in sitemap;
- zero-count seeded tags;
- all tag pages are `noindex` despite sitemap inclusion;
- profiles with no public contributions;
- profiles using default biography text;
- SmartTalk questions with no answers or very short prompts;
- machine-oriented `/posts` and `/smarttalks` hubs;
- unknown dynamic topics that render an empty collection before client `noindex` settles.

### 2. Duplicate and overlapping content

- `/smarttalk` versus `/smarttalks` hubs;
- interactive question query URLs versus `/smarttalks/{id}`;
- category aliases versus canonical category slugs;
- category/topic/knowledge-filter overlap;
- `/index.html` versus `/`;
- repeated recent posts within the all-posts discovery index;
- post excerpts duplicated at scale on `/posts`.

### 3. Canonical conflicts

- SmartTalk client canonical omits question query identifiers.
- Category JSON-LD identifies `/smarttalk` while canonical identifies `/category/{slug}`.
- Knowledge topic canonical can point to `/knowledge?topic=...`, which is subject to a permanent redirect.
- AMP canonical uses the non-`www` host while the rest of the system uses `www`.
- Category aliases are not explicitly canonicalized to canonical slugs.

### 4. Soft 404 risk

- Supported SPA patterns return `index.html` with HTTP 200 even for missing resources.
- Post failures later navigate to a client `/404` route, but the server status remains 200.
- Missing focused SmartTalk questions can display a not-found message while remaining indexable as a populated hub.
- Unknown profile/topic/tag routes can initially emit index directives during loading.

### 5. JavaScript rendering dependency

- Unique post, profile, topic, category, and interactive SmartTalk content requires React and Firestore.
- Metadata requires Helmet after data hydration.
- Client Firestore access, security rules, bundle errors, or timeouts can prevent the final document state.
- The Express development server does not reproduce production SEO routes, so problems can escape local checks.

### 6. Orphan or machine-only pages

- `/posts` and `/smarttalks` are primarily sitemap-discovered.
- Legal and policy content has no route at all.
- The app and server SmartTalk graphs do not reinforce the same URLs.

### 7. Public-eligibility ambiguity

- Profiles do not check `visibility` and can use email as a public name fallback.
- SmartTalk questions do not check `visibility`.
- Embedded answers do not have SEO-level moderation filtering.
- Profile indexing does not require a public contribution threshold.

This is both an indexing-quality and privacy risk.

## Route-level indexing matrix

| Route type | Intended state | Current state | Recommendation |
| --- | --- | --- | --- |
| Home | Index | Client canonical/meta after JS | Server-deliver stable home metadata/canonical |
| Post | Index if public/substantial | Sitemap + client-only document | Server-deliver unique document and real status |
| SmartTalk question | Index if public/substantial | Server route exists; app uses other URLs | Unify canonical route and eligibility |
| Category | Index if curated/nonempty | Always sitemapped, client-only, generic schema | Require distinct purpose/content threshold |
| Topic | Index if curated/nonempty | Always sitemapped; client noindex only after empty load | Sitemap only qualifying topics |
| Tag | Current app says noindex | Still in sitemap | Remove from sitemap until deliberately indexable |
| Public author | Index if explicitly public/substantial | Broad profile inclusion, client-only | Enforce public eligibility and server document |
| Own profile root | Noindex | Signed-out path noindex; user-dependent | Keep out of sitemap and canonical public graph |
| Search/filter state | Noindex/canonicalize | Mixed query routes and redirect targets | Normalize and exclude from sitemap |
| Legal/trust pages | Index/crawlable | No routes | Create dedicated documents |
| Not found/deleted | 404/410 + noindex | Client 200 for SPA patterns | Return server status before app hydration |
| Discovery support index | Deliberate | Indexable | Make user-grade canonical hub or `noindex, follow` |

## Sitemap quality audit

### False freshness

The generator uses request-time `generatedAt` when real modification data is unavailable. This affects:

- static pages;
- empty categories;
- empty topics;
- zero-count tags;
- profiles without timestamps;
- content with missing timestamps.

This can cause unchanged URLs to look newly modified every hour, reducing trust in `lastmod` and encouraging unproductive recrawling.

### Dataset failure behavior

The loader tries Admin SDK, then REST, then returns a static dataset. Because the static result is still valid data to the handler, the sitemap can return HTTP 200 while losing all dynamic URLs.

Recommended later gate:

- fail visibly or serve the last known good sitemap when dynamic counts collapse unexpectedly;
- emit operational metrics and minimum-count assertions;
- do not generate new timestamps for missing content;
- compare live URL-type counts to a previous healthy deployment.

### Scale

The recorded 981 URLs are well below protocol limits. The architecture still needs a threshold-based move to a sitemap index before either:

- 50,000 URLs per sitemap; or
- 50 MB uncompressed per sitemap.

Splitting by stable content type earlier can improve observability even before protocol limits.

## Google-facing trust audit

Google can discover author names and profile links, but Readative lacks crawlable pages explaining:

- who operates the platform;
- how editorial and user-generated content differ;
- how trust badges/community signals are calculated and limited;
- how corrections work;
- how moderation and content reporting work;
- how cookies, analytics, advertising, and personal data are handled.

This does not mechanically guarantee or prevent ranking, but it materially affects user trust and the clarity of site identity.

## Recommended optimization order

1. Fix public eligibility/privacy predicates before exposing more pages.
2. Publish dedicated legal/trust documents and crawlable footer links.
3. Unify SmartTalk URLs and focused-question metadata.
4. Server-deliver post-specific HTML, metadata, and status codes.
5. Resolve category/topic/filter canonicals and alias redirects.
6. Remove `noindex` and empty URLs from the sitemap.
7. Make author pages intentional and substantial.
8. Decide the indexing role of support indexes.
9. Add live response and count-collapse validation.
10. Submit and monitor controlled URL cohorts in Search Console.

## Final validation requirements

Phase 1.6 should inspect live responses, not only the client DOM:

- status code;
- content type;
- redirect chain;
- canonical count and target;
- robots directive;
- initial HTML title and description;
- visible main content without JavaScript;
- OG/Twitter values;
- JSON-LD parse and entity URLs;
- sitemap membership versus page indexability;
- no private/thin content leakage;
- Search Console URL Inspection for representative cohorts.

Representative cohorts:

- 5 long posts, 5 short posts, 5 image posts;
- 5 answered and 5 unanswered SmartTalk questions;
- every category plus 5 topics;
- 5 substantial and 5 thin/missing profiles;
- valid, deleted, private, malformed, and legacy URLs.

## Production readiness

Current indexing foundation: **high risk**.

The sitemap and discovery work are valuable, but they cannot compensate for generic initial HTML, URL disagreement, weak eligibility, and absent trust pages. The staged release plan is in [implementation_plan.md](implementation_plan.md).

Related documents:

- [production_seo_audit.md](production_seo_audit.md)
- [smarttalk_seo_audit.md](smarttalk_seo_audit.md)
- [legal_pages_audit.md](legal_pages_audit.md)
- [engineering_risk.md](engineering_risk.md)
