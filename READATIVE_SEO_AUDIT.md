# Readative.com SEO Architecture Audit

**Audit date:** June 16, 2026  
**Scope:** Read-only codebase and configuration review (no changes made)  
**Content baseline:** ~266 public knowledge posts, 64 profiles, 9 SmartTalk discussions (per internal docs)

---

## A. Current Architecture Score

### **3 / 10**

Readative is a **Vite + React 18 single-page application (SPA)** deployed on Vercel with Firebase Firestore as the content backend. Routing, meta tags, and structured data are implemented entirely on the client.

| Layer | Implementation | SEO impact |
|---|---|---|
| Build | `vite build` → static assets | No HTML per route |
| Rendering | CSR only (`createRoot`, lazy routes) | Post content absent from initial HTML |
| Routing | Custom `routes.ts` + `history.pushState` | URLs exist but are not server-rendered |
| Meta tags | `react-helmet-async` | Injected after JavaScript executes |
| Content API | Firebase Firestore client SDK | Crawlers must run JS + authenticate to public rules |
| Hosting | Vercel SPA rewrites → `/index.html` | All routes return the same shell HTML |

There is **no SSR, SSG, prerendering, or dynamic rendering** anywhere in the stack (`package.json`, `vite.config.ts`, `vercel.json`).

---

## B. SEO Score

### **4 / 10**

The project has thoughtful **SEO intent** (taxonomy, schema helpers, route-level Helmet, canonical strategy docs) but the **execution layer is client-only**, which limits how much of that intent reaches crawlers.

### What exists and works in code

| Area | Status | Evidence |
|---|---|---|
| Route taxonomy | Good | `/post/:id`, `/category/:slug`, `/topic/:slug`, `/tag/:slug`, `/profile/:id` |
| Meta tag component | Present | `src/components/SEO.tsx` — title, description, keywords, canonical, OG, Twitter, robots |
| Structured data helpers | Present | `src/utils/seoSchemas.ts` — Article, CollectionPage, ItemList, BreadcrumbList, etc. |
| Category/topic briefs | Present | Visible on-page copy in KnowledgeFeed / Explore |
| Legacy URL handling | Partial | `/knowledge/:id` parses; hash routes normalize to path routes |
| robots.txt | Permissive | `Allow: /` with sitemap declarations |
| Analytics | Present | GA4 `G-09CXBVC580` in `index.html` and route-change tracking |

### What undermines SEO effectiveness

| Area | Issue |
|---|---|
| Meta tags | Only injected client-side; initial HTML is always the homepage default |
| Canonical host | Mixed `readative.com` vs `www.readative.com` across files |
| Sitemap | 28 static URLs; **zero post URLs** |
| Internal links | **No `<a href>` links** to posts, categories, topics, or profiles in app UI |
| Post URLs | Opaque Firebase document IDs (`/post/abc123xyz`), no slug URLs |
| AMP | Single static `/amp/` page for homepage only; `amphtml` link on home feed only |
| Duplicate URLs | `/` vs `/knowledge`, `/post/:id` vs `/knowledge/:id`, `/explore` vs `/jobs` |

---

## C. Indexing Readiness Score

### **2 / 10**

The site is **not ready** to have all ~266 posts indexed reliably. Only a small subset of hub pages and whatever posts Google discovers through limited JS rendering on the homepage are likely to enter the index.

---

## Detailed Analysis (20 Areas)

### 1. Routing Architecture

- **Custom client router** in `src/utils/routes.ts` — not React Router.
- Parses `window.location` on load and listens to `popstate` / custom `readative:routechange`.
- Hash routes (`#knowledge/...`) are **replaced** with clean path URLs on first load (`App.tsx` lines 217–227).
- Vercel rewrites map all app paths to `/index.html` (`vercel.json` lines 43–57).
- `public/_redirects` covers fewer routes than `vercel.json` (missing `/post/*`, `/category/*`, `/tag/*`).

**Verdict:** URLs are human-readable at the path level, but every route serves identical shell HTML.

---

### 2. URL Structure

| Page type | Canonical pattern | Indexed by design? |
|---|---|---|
| Home feed | `/` | Yes |
| Post | `/post/{firebaseDocId}` | Yes |
| Category | `/category/{slug}` (8 fixed) | Yes |
| Topic | `/topic/{slug}` | Yes (when content exists) |
| Tag | `/tag/{slug}` | **No** (noindex) |
| Profile | `/profile/{authorId}` | Yes (public profiles) |
| SmartTalk | `/smarttalk` | Yes (when discussions exist) |
| Explore | `/explore` | Yes |
| Legacy post | `/knowledge/{id}` | Parses, but canonical targets `/post/{id}` |
| Filtered feed | `/knowledge?tag=x&topic=y` | Mixed; tag-only uses `/tag/{slug}` |

---

### 3. Post URL Generation

```344:347:src/utils/routes.ts
export function buildPublicPath(tab: AppTab, options: RouteOptions = {}) {
  if (tab === "knowledge" && options.focusedEntryId) {
    return `/post/${encodeURIComponent(options.focusedEntryId)}`;
  }
```

- Post URLs use the **Firestore document ID** — not a title slug.
- Share links, canonical URLs, and JSON-LD all use this pattern via `buildAbsoluteRouteUrl`.
- No slug field on `KnowledgeEntry` type (`src/types.ts`).
- Legacy `/knowledge/{id}` still resolves but navigation canonicalizes to `/post/{id}`.

---

### 4. Dynamic Routes

- All dynamic segments (`:id`, `:slug`) are **client-resolved** after Firebase fetch.
- Direct navigation to `/post/{id}` triggers `resolveFocusedKnowledgeEntrySnapshot()` in `KnowledgeFeed.tsx` (Firestore `getDoc`).
- Invalid IDs navigate to `/404?from=...` via `navigateToNotFound`.
- **No server-side route handler** returns post-specific HTML or headers.

---

### 5. Sitemap Generation

**File:** `public/sitemap.xml` — **static, manually maintained**

| Content | Count |
|---|---:|
| Total URLs | 28 |
| Post URLs (`/post/`) | **0** |
| Profile URLs | **0** |
| Tag URLs | **0** (intentionally excluded) |
| Category URLs | 8 |
| Topic URLs | ~17 |
| Hub pages | 3 (home, explore, smarttalk) |

Internal architecture doc explicitly states:

> *"Dynamic post sitemap generation is recommended once server-side post slug support exists."*  
> — `docs/readative-seo-geo-architecture.md`

**Verdict:** Sitemap is **incomplete** for a content site with 266 posts. Google has no sitemap signal for individual articles.

---

### 6. robots.txt

**File:** `public/robots.txt`

```
User-agent: *
Allow: /

Sitemap: https://readative.com/sitemap.xml
Sitemap: https://www.readative.com/sitemap.xml
```

- Nothing blocked for crawlers.
- Production note (internal doc): non-www redirects to www; Cloudflare may prepend managed rules.
- **robots.txt is not the indexing bottleneck.**

---

### 7. Meta Tags

**Initial HTML (`index.html`):** Static homepage title, description, keywords, OG, Twitter — same for every route.

**Runtime (`SEO.tsx` via Helmet):** Route-specific title, description, keywords, robots — **only after React hydrates and data loads**.

Fallback URL logic in `SEO.tsx` uses `window.location.origin + pathname` when no explicit `url` prop is passed, which can inherit the **non-canonical host** if the user landed on `readative.com` instead of `www.readative.com`.

---

### 8. OpenGraph Tags

Implemented in `SEO.tsx` (lines 64–71):

- `og:type`, `og:title`, `og:description`, `og:image`, `og:url`, `og:site_name`, `og:locale`
- Post pages pass `type="article"` and post-specific image when available
- **All OG tags are client-injected** — social crawlers and Google's initial fetch see homepage OG tags from `index.html`

---

### 9. Canonical Tags

```61:61:src/components/SEO.tsx
      <link rel="canonical" href={resolvedUrl} />
```

- Post pages set explicit canonical via `buildAbsoluteRouteUrl` → `https://readative.com/post/{id}` (default origin **without www**).
- Sitemap uses `https://www.readative.com/...` exclusively.
- Production redirects non-www → www (per internal recovery report).
- **Host mismatch risk:** canonical may declare `readative.com` while Google treats `www.readative.com` as canonical after redirect.

Duplicate URL pairs without server-side 301:

| URL A | URL B | Same content? |
|---|---|---|
| `/post/{id}` | `/knowledge/{id}` | Yes |
| `/` | `/knowledge` | Yes (home feed) |
| `/explore` | `/jobs` | Yes |

---

### 10. Structured Data

**Static (in initial HTML):** WebSite + WebApplication JSON-LD in `index.html`.

**Dynamic (client-side via Helmet):**

| Page | Schema types |
|---|---|
| Home / category / topic feed | Organization, WebSite, CollectionPage, ItemList, BreadcrumbList |
| Focused post | Above + **Article** |
| Explore / topic | CollectionPage, ItemList, BreadcrumbList, DiscussionForumPosting |
| SmartTalk | CollectionPage, DiscussionForumPosting (loaded questions) |
| Profile | ProfilePage-style object |

`seoSchemas.ts` hardcodes `SITE_URL = "https://readative.com"` (no www) — another host inconsistency.

ItemList on feed pages includes at most **10 post URLs** from currently loaded entries — not the full corpus.

---

### 11. SSR / SSG / CSR Architecture

| Strategy | Used? |
|---|---|
| SSR (server renders HTML per request) | **No** |
| SSG (build-time static pages) | **No** |
| ISR / prerender | **No** |
| CSR (client fetches and renders) | **Yes — exclusively** |

Build pipeline: `vite build` produces a single `index.html` shell + JS bundles. No prerender plugin, no Vercel `render` functions for pages.

---

### 12. React Rendering Strategy

- `ReactDOM.createRoot` — full client mount.
- Route components **lazy-loaded** (`React.lazy` + `Suspense`) — additional delay before SEO component mounts.
- `KnowledgeFeed` hidden with `aria-hidden` when inactive but still mounted when on other tabs.
- Meta updates depend on: JS download → parse → React boot → lazy chunk load → Firebase fetch → Helmet render.

**Googlebot can execute JavaScript**, but rendering is queued, rate-limited, and not guaranteed for every URL in a 266-post corpus.

---

### 13. Crawlability

**Critical finding: the application has zero internal `<a href="...">` links to its own content pages.**

Navigation pattern throughout the app:

- `onClick` handlers → `navigateToRoute()` → `history.pushState`
- Used in: `KnowledgeCard.tsx`, `Explore.tsx`, `Profile.tsx`, category/topic buttons in `KnowledgeFeed.tsx`

Crawlers discover URLs primarily through:

1. `<a href>` links in HTML (**missing for internal content**)
2. Sitemap (**posts not listed**)
3. External backlinks / shares
4. JSON-LD ItemList (**max 10 URLs**, client-injected)

The feed loads **10 posts initially**, then 5 per scroll page (`FEED_INITIAL_PAGE_SIZE = 10`, `FEED_NEXT_PAGE_SIZE = 5`). Even with JS rendering, **256+ posts are never linked** from the homepage without infinite scroll execution.

---

### 14. Internal Linking

**Designed model (docs):** Category → Topic → Post → SmartTalk

**Implemented model:**

- Category briefs link to topics via `navigateToRoute` buttons (not anchors)
- Explore lists posts via click handlers (not anchors)
- KnowledgeCard titles, hashtags, author names — all buttons
- JSON-LD breadcrumbs and ItemList contain URLs but are client-injected and limited to visible entries
- Footer / AppPanels only link externally (LinkedIn, mailto)

**Verdict:** Internal linking architecture exists in data/schema but **not in crawlable HTML links**.

---

### 15. Category Pages

- Routes: `/category/{slug}` for 8 permanent categories (`seoTaxonomy.ts`)
- Rewrites: supported in `vercel.json`
- SEO: index when content exists; CollectionPage + category brief visible content
- In sitemap: all 8 categories included
- Navigation: select dropdown + route parsing — no static `<a href="/category/ai">` links in HTML

---

### 16. Tag Pages

- Routes: `/tag/{slug}`
- **Explicitly noindex:**

```3577:3583:src/components/KnowledgeFeed.tsx
  const shouldNoIndexKnowledgePage =
    Boolean(selectedHashtag) ||
    !shouldShowInitialFeedSkeleton &&
    ...
    filteredEntries.length === 0;
```

- Excluded from sitemap (by design)
- Legacy `/tags/*` → `/tag/*` 301 redirects in `vercel.json`
- **Correct strategy for tag sprawl** — not an indexing bug

---

### 17. Author Pages

- Routes: `/profile/{authorId}` (Firebase UID)
- Public profiles: `robots="index"` with profile schema
- Unsigned `/profile` (no ID): **noindex**
- Missing profile after load: **noindex**
- **Not in sitemap** (0 profile URLs)
- Navigation: click-only, no crawlable profile links between posts (author buttons, not anchors)

---

### 18. Feed Architecture

- **Data source:** Firebase Firestore `knowledge` collection
- **Initial load:** 10 posts, ordered by `createdAt desc`
- **Pagination:** 5 posts per subsequent page, infinite scroll
- **Realtime:** `onSnapshot` listener on first page
- **Focused post:** separate `getDoc` fetch by ID
- **Visibility:** public posts only for anonymous viewers (`canViewKnowledgeEntry`)
- **Topic/category feeds:** client-side filtering or Firestore `array-contains` for hashtags

Posts exist only in JS state after fetch — never serialized into initial HTML.

---

### 19. Search Console Readiness

| Check | Status |
|---|---|
| GA4 installed | Yes |
| robots.txt accessible | Yes (both host variants declared) |
| Sitemap submittable | Yes, but **incomplete** |
| URL Inspection for posts | Will show homepage shell HTML without post content |
| Coverage gaps expected | Yes — posts not in sitemap, weak discovery |
| Host property consistency | **Risk** — split canonical signals between www and non-www |
| Legacy 404 recovery | `/tags/*` redirects implemented |
| 404 page SEO | `NotFoundRoute` has **no SEO/noindex component** — may inherit index defaults |

---

### 20. Indexability of All Post Pages

| Question | Answer |
|---|---|
| Can Google crawl every post? | **Not reliably** — no sitemap entries, no href links, JS-dependent content |
| Does every post have its own URL? | **Yes** — `/post/{firestoreId}` |
| Is content in initial HTML? | **No** |
| Is content JS-only? | **Yes** |
| noindex issues? | Tag pages yes (intended); possible transient noindex on empty loading states; unsigned profile noindex |
| Canonical issues? | **Yes** — www vs non-www; `/knowledge/` vs `/post/` duplicates |
| Duplicate content? | **Yes** — duplicate route patterns, same shell HTML for all URLs |
| Sitemap complete? | **No** — 28/266+ content URLs (~10.5% hub coverage, 0% post coverage) |
| robots.txt blocking? | **No** |

---

## Verification Summary

| Check | Result |
|---|---|
| Can Google crawl every post? | **No** — discovery paths are broken for bulk of corpus |
| Does every post have its own URL? | **Yes** |
| Is content present in initial HTML? | **No** |
| Is content loaded only through JavaScript? | **Yes** (Firebase + React) |
| Any noindex issue? | **Minor** — intentional tag noindex; 404 lacks noindex |
| Any canonical issue? | **Yes** — host mismatch, duplicate legacy routes |
| Any duplicate content issue? | **Yes** — multiple URLs per page, identical shell HTML |
| Is sitemap complete? | **No** |
| Is robots.txt blocking anything? | **No** |

---

## D. Critical Issues

1. **100% client-side rendering with no prerender/SSR**  
   Every `/post/{id}` request returns the same homepage `index.html`. Post title, body, meta tags, and Article schema are invisible in the initial response.

2. **Sitemap contains zero post URLs (0 of ~266 posts)**  
   Google is not told that individual articles exist. This alone explains most indexing gaps.

3. **No crawlable internal `<a href>` links to posts, categories, topics, or profiles**  
   The entire app navigates via JavaScript click handlers. Crawlers cannot follow links to discover the post graph.

4. **Feed pagination hides 256+ posts from discovery surfaces**  
   Only 10 posts appear on first load; remaining posts require scroll-triggered JS fetches with no static links.

---

## E. High Priority Issues

5. **Canonical host inconsistency (`readative.com` vs `www.readative.com`)**  
   Sitemap uses www; `seoSchemas.ts` and default `buildAbsoluteRouteUrl` origin use non-www. Production redirects non-www → www, splitting signals.

6. **Duplicate URL patterns without 301 canonicalization**  
   `/knowledge/{id}` and `/post/{id}` both serve the same post. `/` and `/knowledge` both serve home. `/explore` and `/jobs` both serve explore.

7. **Client-side meta tags only (react-helmet-async)**  
   Google and social crawlers see generic homepage metadata in raw HTML for all URLs.

8. **Opaque post IDs with no slug URLs**  
   `/post/xK9m2pLqR` is valid but not keyword-rich; hurts CTR and shareability; complicates sitemap UX.

9. **Profile and SmartTalk discussion pages absent from sitemap**  
   64 profiles and 9 discussions have no sitemap discovery path.

10. **404 page lacks explicit noindex**  
    `NotFoundRoute` does not set `robots: noindex`; soft-404 risk for invalid post IDs.

---

## F. Medium Issues

11. **JSON-LD ItemList limited to 10 visible entries** — under-represents site depth even after JS render.

12. **AMP implementation is homepage-only** — `/amp/` canonicalizes to homepage; no post-level AMP.

13. **`public/_redirects` incomplete vs `vercel.json`** — missing `/post/*`, `/category/*`, `/tag/*` (matters if deployed on Netlify or dual-host).

14. **Post SEO depends on Firebase fetch latency** — brief window where `/post/{id}` may emit home-feed meta or empty-feed noindex before post loads.

15. **SmartTalk has no per-discussion URLs** — all Q&A equity concentrates on `/smarttalk`.

16. **`index.html` static meta duplicates/overrides Helmet until JS runs** — crawlers may cache wrong title/description.

---

## G. Nice To Have

17. Add `hreflang` if multilingual content expands (profiles have `preferredLanguage` field).

18. Add `lastmod` to sitemap URLs once dynamic sitemap generation exists.

19. Add post-level `Related Posts` and topic chips with real anchor links (recommended in internal docs, not yet implemented).

20. Slug-based post URLs (`/post/{slug}-{id}`) for readability.

21. RSS/Atom feed for posts (`/feed.xml`) — not present.

22. Individual SmartTalk discussion routes (`/smarttalk/{id}`).

23. Server-rendered category/topic hub pages as static shells with embedded post links.

24. Consolidate `keywords` meta (low Google weight, adds noise).

---

## H. Exact Root Cause of Why Google Is Indexing Only a Few Pages

Google is indexing only a small fraction of Readative because **the site has no reliable machine-readable discovery path for individual posts**, combined with **no server-delivered content for those posts**.

The causal chain:

```
266 posts in Firebase
        ↓
Sitemap lists 28 hub URLs, 0 post URLs
        ↓
No <a href> links to /post/{id} anywhere in static or SSR HTML
        ↓
Homepage feed renders max 10 posts via JavaScript after Firebase fetch
        ↓
Crawler must execute JS + scroll + Firebase for each additional post
        ↓
Most post URLs are never discovered or queued for rendering
        ↓
Even discovered post URLs return identical index.html shell with homepage meta
        ↓
Google indexes ~28 hub pages + handful of posts it happened to render
```

**The single dominant root cause is: posts are architecturally invisible to crawlers** — they are neither listed in the sitemap nor linked via crawlable HTML anchors, and their content exists only after client-side Firebase fetches complete.

Secondary amplifiers:

- www/non-www canonical split dilutes authority across indexed pages
- Duplicate `/post/` vs `/knowledge/` URLs split signals for posts Google does find
- Client-only Helmet meta means indexed pages may store wrong titles/descriptions from the homepage shell

This is **not** primarily a robots.txt block, a noindex flag on posts, or a Firebase permissions issue (all 266 posts are public per internal audit). It is a **rendering and discovery architecture gap**.

---

## I. Recommended Fix Order

Fix in this order to maximize indexing impact before fine-tuning:

### Phase 1 — Discovery (unblocks indexing at scale)

1. **Generate a dynamic post sitemap** (`/sitemap-posts.xml` or sitemap index) listing all public `/post/{id}` URLs with `lastmod` from `updatedAt`/`createdAt`. Submit in Search Console.

2. **Add crawlable `<a href="/post/{id}">` links** in KnowledgeCard titles (and category/topic hub pages). Real anchors, not only `onClick` navigation. Ensure server-rendered or prerendered HTML includes them.

3. **Implement prerendering or SSR for `/post/:id`** (minimum viable: Vercel edge function, prerender.io, or build-time generation for top posts). Initial HTML must contain post title, excerpt, canonical, Article schema, and OG tags.

### Phase 2 — Canonical integrity

4. **Standardize on `https://www.readative.com`** everywhere: `seoSchemas.ts`, `buildAbsoluteRouteUrl` default origin, `index.html` OG URLs, canonical tags.

5. **301 redirect duplicate routes server-side:**
   - `/knowledge/{id}` → `/post/{id}`
   - `/knowledge` → `/`
   - `/jobs` → `/explore`

6. **Add `noindex` to 404 route** via SEO component.

### Phase 3 — Scale and quality

7. **Extend prerender/SSR to category and topic hub pages** with embedded post link lists (not just 10 JS-loaded items).

8. **Add sitemap entries for public profiles** and SmartTalk (or per-discussion URLs when built).

9. **Introduce slug-based post URLs** with ID fallback for legacy links.

10. **Add RSS feed** for post discovery by crawlers and aggregators.

### Phase 4 — Monitoring

11. Resubmit sitemap in Google Search Console (www property).

12. URL Inspection on sample `/post/{id}` pages — confirm rendered HTML contains post content and correct canonical.

13. Monitor Coverage report for "Crawled – currently not indexed" vs "Discovered – currently not indexed" to validate discovery fixes.

---

## Architecture Reference Diagram

```
Browser / Googlebot request: GET /post/{id}
                │
                ▼
         Vercel rewrite
                │
                ▼
         /index.html  ← same file for ALL routes
         (homepage meta, no post content)
                │
                ▼
         main.tsx → App.tsx (CSR)
                │
                ▼
         lazy load KnowledgeFeed.tsx
                │
                ▼
         Firebase getDoc("knowledge/{id}")
                │
                ▼
         react-helmet-async injects
         title, canonical, OG, Article JSON-LD
                │
                ▼
         React renders post in #root
         (invisible in initial HTML response)
```

---

## Key Source Files Reviewed

| File | Role |
|---|---|
| `src/utils/routes.ts` | URL parsing and generation |
| `src/components/SEO.tsx` | Meta, OG, canonical, JSON-LD injection |
| `src/components/KnowledgeFeed.tsx` | Post feed, focused post, SEO logic |
| `src/utils/seoSchemas.ts` | Structured data builders |
| `src/utils/seoTaxonomy.ts` | Category/topic/tag definitions |
| `public/sitemap.xml` | Static sitemap (28 URLs) |
| `public/robots.txt` | Crawler directives |
| `vercel.json` | SPA rewrites and legacy redirects |
| `index.html` | Static shell and default meta |
| `vite.config.ts` / `package.json` | CSR build configuration |
| `docs/readative-seo-geo-architecture.md` | Internal SEO strategy (266 posts) |
| `docs/readative-search-console-recovery-report.md` | Prior recovery work |

---

*End of audit. No files were modified except this report.*
