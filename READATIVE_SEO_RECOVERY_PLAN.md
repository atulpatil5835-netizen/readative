# Readative.com SEO Recovery Plan

**Plan date:** June 16, 2026  
**Status:** Production-safe roadmap (no implementation yet)  
**Content baseline:** ~270 posts, 64 profiles, 9 SmartTalk discussions  
**Current state:** Production LIVE, Google indexing only a few pages

---

## 1. Root Cause Analysis

### Primary Root Cause: Posts are architecturally invisible to crawlers

The causal chain preventing Google from indexing the 270+ post corpus:

```
270 posts in Firebase Firestore
        ↓
Sitemap lists 28 hub URLs, 0 post URLs (0% post coverage)
        ↓
No <a href> links to /post/{id} anywhere in HTML (all navigation is onClick)
        ↓
Homepage renders max 10 posts via JavaScript after Firebase fetch
        ↓
Crawler must execute JS + scroll + Firebase for each additional post
        ↓
Most post URLs are never discovered or queued for rendering
        ↓
Even discovered post URLs return identical index.html shell with homepage meta
        ↓
Google indexes ~28 hub pages + handful of posts it happened to render
```

### Secondary Amplifiers

- **100% client-side rendering:** Every `/post/{id}` returns the same `index.html` shell. Post content, meta tags, and structured data are invisible in initial HTML.
- **Canonical host inconsistency:** Sitemap uses `www.readative.com`; code defaults to `readative.com`. Production redirects non-www → www, splitting canonical signals.
- **Duplicate URL patterns:** `/post/{id}` and `/knowledge/{id}` serve same content without server-side 301 redirects.
- **Client-only meta injection:** react-helmet-async injects tags after React hydrates, so crawlers see homepage metadata for all URLs.

### Architecture Assessment

| Question | Answer | Rationale |
|---|---|---|
| Can Vite remain? | **YES** | Vite can be extended with prerendering plugins or Vercel ISR functions. No need to abandon the build tool. |
| Is prerendering enough? | **PARTIALLY** | Prerendering solves the HTML content issue, but posts still need discovery paths (sitemap + links). |
| Is SSR required? | **NOT NECESSARILY** | Dynamic rendering (Vercel ISR) or build-time prerendering can provide server-rendered HTML without full SSR architecture. |
| Is Next.js migration necessary? | **NO** | While Next.js would be cleaner long-term, it's not required to fix the immediate indexing problem. The recovery can be done within the current Vite stack. |

---

## 2. Recovery Phases

### Phase 1: Lowest Risk, Maximum Indexing Gain (Production-Safe)

**Goal:** Unblock Google's ability to discover and crawl all 270+ posts with minimal code changes.

**Risk Level:** LOW  
**Development Effort:** 2-3 days  
**Expected Indexing Improvement:** 200-250+ additional posts indexed within 4-6 weeks

#### Changes Required

##### 1.1 Generate Dynamic Post Sitemap

**Problem:** Current sitemap has 0 post URLs. Google has no machine-readable list of articles.

**Solution:** Create a Vercel serverless function that dynamically generates sitemap XML from Firestore.

**New file:** `api/sitemap.xml.ts` (Vercel function)
- Query Firestore `knowledge` collection for all public posts
- Generate XML with `/post/{id}` URLs
- Include `lastmod` from `updatedAt` or `createdAt`
- Set appropriate `changefreq` and `priority`
- Return with `Content-Type: application/xml`

**Modified file:** `vercel.json`
- Add rewrite: `{ "source": "/sitemap.xml", "destination": "/api/sitemap.xml" }`
- Remove or rename static `public/sitemap.xml` to `public/sitemap-static.xml` (backup)

**Alternative (if Vercel functions not desired):** Build-time script
- New file: `scripts/generate-sitemap.ts`
- Run after `vite build` in `package.json`
- Output to `dist/sitemap.xml`

**Files to change:**
- `api/sitemap.xml.ts` (NEW)
- `vercel.json` (MODIFY - add rewrite)
- `package.json` (MODIFY - if using build script approach)

---

##### 1.2 Add Crawlable `<a href>` Links to Posts

**Problem:** All navigation uses `onClick` handlers. Crawlers cannot follow links to discover posts.

**Solution:** Replace click-only navigation with real anchor links in KnowledgeCard components.

**Modified file:** `src/components/KnowledgeCard.tsx` (or similar card component)
- Change title from `<button onClick={...}>` to `<a href="/post/{id}">`
- Preserve client-side routing via event.preventDefault() or use `<Link>` wrapper if available
- Ensure links work without JavaScript (progressive enhancement)

**Modified file:** `src/components/KnowledgeFeed.tsx`
- Update category/topic buttons to use `<a href="/category/{slug}">` instead of onClick
- Update hashtag links to use `<a href="/tag/{slug}">` (with noindex meta already in place)

**Modified file:** `src/components/Explore.tsx`
- Update post list items to use `<a href="/post/{id}">` for titles

**Files to change:**
- `src/components/KnowledgeCard.tsx` (MODIFY)
- `src/components/KnowledgeFeed.tsx` (MODIFY)
- `src/components/Explore.tsx` (MODIFY)

---

##### 1.3 Fix Canonical Host Inconsistency

**Problem:** Sitemap uses `www.readative.com`; code defaults to `readative.com`. This splits canonical signals.

**Solution:** Standardize on `https://www.readative.com` everywhere.

**Modified file:** `src/utils/routes.ts`
- Change line 404: `origin = typeof window === "undefined" ? "https://www.readative.com" : window.location.origin`

**Modified file:** `src/utils/seoSchemas.ts`
- Change `SITE_URL` constant to `"https://www.readative.com"`

**Modified file:** `src/components/SEO.tsx`
- Change line 21: `return "https://www.readative.com${pathOrUrl...`
- Change line 41: `"https://www.readative.com"`

**Modified file:** `index.html`
- Update all OG URL references to use `https://www.readative.com`

**Files to change:**
- `src/utils/routes.ts` (MODIFY - 1 line)
- `src/utils/seoSchemas.ts` (MODIFY - 1 line)
- `src/components/SEO.tsx` (MODIFY - 2 lines)
- `index.html` (MODIFY - OG URLs)

---

##### 1.4 Add Server-Side 301 Redirects for Duplicate URLs

**Problem:** `/knowledge/{id}` and `/post/{id}` serve same content without canonicalization.

**Solution:** Add Vercel redirects to consolidate signals.

**Modified file:** `vercel.json`
- Add to `redirects` array:
  ```json
  { "source": "/knowledge/:id", "destination": "/post/:id", "permanent": true },
  { "source": "/knowledge", "destination": "/", "permanent": true },
  { "source": "/jobs", "destination": "/explore", "permanent": true }
  ```

**Files to change:**
- `vercel.json` (MODIFY - add 3 redirects)

---

##### 1.5 Add noindex to 404 Page

**Problem:** `NotFoundRoute` lacks explicit noindex, risking soft-404 signals.

**Solution:** Add SEO component with noindex to 404 route.

**Modified file:** `src/components/NotFoundRoute.tsx` (or similar)
- Import SEO component
- Add `<SEO robots="noindex" title="Page Not Found" description="..." />`

**Files to change:**
- `src/components/NotFoundRoute.tsx` (MODIFY - add SEO component)

---

#### Phase 1 Deployment Order

1. Deploy canonical host fixes (routes.ts, seoSchemas.ts, SEO.tsx, index.html)
2. Deploy 301 redirects (vercel.json)
3. Deploy dynamic sitemap (api/sitemap.xml.ts + vercel.json rewrite)
4. Deploy anchor link changes (KnowledgeCard.tsx, KnowledgeFeed.tsx, Explore.tsx)
5. Deploy 404 noindex (NotFoundRoute.tsx)
6. Submit new sitemap to Google Search Console (www property)
7. Monitor Coverage report for "Discovered – currently not indexed" → "Crawled – currently not indexed" → "Indexed"

**Rollback plan:** Each change can be reverted independently. The sitemap change can be disabled by removing the rewrite and restoring static sitemap.

---

### Phase 2: Medium Risk Changes (Expected SEO Impact)

**Goal:** Improve content quality signals and rendering for discovered posts.

**Risk Level:** MEDIUM  
**Development Effort:** 3-5 days  
**Expected Indexing Improvement:** Better rankings, richer snippets, faster indexing

#### Changes Required

##### 2.1 Implement Prerendering for Post Pages

**Problem:** Even after discovery, Google sees empty shell HTML for posts until JS executes.

**Solution:** Add build-time or ISR prerendering for post pages.

**Option A: Vite Prerender Plugin (Recommended for Phase 2)**
- Install: `vite-plugin-prerender` or similar
- Configure in `vite.config.ts` to prerender top 50-100 posts by popularity/recency
- Output static HTML files in `dist/post/{id}/index.html`

**Option B: Vercel ISR Functions**
- Create `api/post/[id].ts` Vercel edge function
- Fetch post from Firestore
- Return server-rendered HTML with post content, meta tags, and structured data
- Cache with revalidation (e.g., 1 hour)

**Option C: Prerender.io Service**
- Sign up for prerender.io
- Add middleware to detect crawler user-agents
- Proxy requests to prerender service for static HTML

**Recommendation for Phase 2:** Start with Option A (Vite prerender plugin) for top posts. It's build-time, no runtime dependencies, and low risk.

**Files to change:**
- `vite.config.ts` (MODIFY - add prerender plugin config)
- `package.json` (MODIFY - add prerender plugin dependency)
- `vercel.json` (MODIFY - add rewrites for prerendered paths if needed)

---

##### 2.2 Extend Prerendering to Category/Topic Hub Pages

**Problem:** Category and topic pages also return shell HTML, limiting their SEO value.

**Solution:** Prerender hub pages with embedded post link lists.

**Modified file:** `vite.config.ts`
- Extend prerender config to include `/category/{slug}` and `/topic/{slug}` routes
- Ensure prerendered HTML includes full post lists (not just 10 items)

**Files to change:**
- `vite.config.ts` (MODIFY - extend prerender routes)

---

##### 2.3 Add Profile URLs to Sitemap

**Problem:** 64 public profiles have no sitemap discovery path.

**Solution:** Extend dynamic sitemap to include profile URLs.

**Modified file:** `api/sitemap.xml.ts`
- Query Firestore `users` collection for public profiles
- Add `/profile/{authorId}` URLs to sitemap
- Set appropriate priority (lower than posts)

**Files to change:**
- `api/sitemap.xml.ts` (MODIFY - add profile query)

---

##### 2.4 Add SmartTalk Discussion URLs (Optional)

**Problem:** All SmartTalk equity concentrates on `/smarttalk` single page.

**Solution:** Either add individual discussion routes or add to sitemap as hub.

**Option A:** Create `/smarttalk/{id}` routes (requires routing changes)
**Option B:** Add `/smarttalk` to sitemap with higher priority (quick win)

**Recommendation:** Option B for Phase 2 (quick win). Option A for Phase 3.

**Files to change:**
- `api/sitemap.xml.ts` (MODIFY - add smarttalk URL)
- OR `src/utils/routes.ts` (MODIFY - add smarttalk discussion routing)

---

#### Phase 2 Deployment Order

1. Implement prerendering for top 50 posts (vite.config.ts + package.json)
2. Test prerendered output locally
3. Deploy prerendering changes
4. Extend prerendering to category/topic pages
5. Extend sitemap to include profiles
6. Add SmartTalk to sitemap
7. Monitor URL Inspection for sample posts to confirm rendered HTML contains content

**Rollback plan:** Remove prerender plugin from vite.config.ts and revert to CSR-only build.

---

### Phase 3: Long-Term Architecture Improvements

**Goal:** Future-proof the architecture for scale and maintainability.

**Risk Level:** HIGH (architecture changes)  
**Development Effort:** 2-4 weeks  
**Expected Indexing Improvement:** Marginal over Phase 2 (quality of life, not indexing volume)

#### Changes Required

##### 3.1 Consider Next.js Migration

**Rationale:** Next.js provides built-in SSR/ISR, better SEO defaults, and Vercel optimization.

**Migration approach:**
- Create new Next.js project alongside existing Vite app
- Migrate components incrementally
- Use Next.js App Router for new routing
- Implement ISR for post pages
- Implement dynamic sitemap via Next.js app directory
- Migrate Firebase integration

**Trade-offs:**
- **Pros:** Built-in SSR/ISR, better SEO defaults, Vercel native, larger ecosystem
- **Cons:** High migration effort, potential bugs during transition, learning curve

**Recommendation:** Only migrate if Phase 1+2 achieve indexing goals but technical debt becomes unmanageable. Otherwise, stay with Vite + prerendering.

---

##### 3.2 Implement Slug-Based Post URLs

**Problem:** Current URLs use opaque Firebase IDs (`/post/xK9m2pLqR`), not keyword-rich slugs.

**Solution:** Add slug field to Firestore documents and generate URLs like `/post/{slug}-{id}`.

**Database migration:**
- Add `slug` field to all knowledge documents
- Generate slugs from titles (unique, with collision handling)
- Update `buildPublicPath` in routes.ts to use slug pattern
- Add 301 redirects from old ID-only URLs to new slug URLs

**Files to change:**
- Firestore database (migration script)
- `src/types.ts` (MODIFY - add slug field)
- `src/utils/routes.ts` (MODIFY - update URL generation)
- `vercel.json` (MODIFY - add legacy redirects)

---

##### 3.3 Add RSS Feed

**Problem:** No RSS feed for post discovery by aggregators and readers.

**Solution:** Create `/feed.xml` endpoint with recent posts.

**New file:** `api/feed.xml.ts`
- Query recent 50 posts from Firestore
- Generate RSS 2.0 XML
- Include post titles, excerpts, links, pubDates

**Modified file:** `vercel.json`
- Add rewrite: `{ "source": "/feed.xml", "destination": "/api/feed.xml" }`

**Files to change:**
- `api/feed.xml.ts` (NEW)
- `vercel.json` (MODIFY - add rewrite)

---

##### 3.4 Add Individual SmartTalk Discussion Routes

**Problem:** SmartTalk discussions have no permalinks.

**Solution:** Create `/smarttalk/{id}` routes for each discussion.

**Modified file:** `src/utils/routes.ts`
- Add parseSmartTalkDiscussionRoute function
- Add buildSmartTalkDiscussionPath function

**Modified file:** `src/components/SmartTalk.tsx`
- Update to handle focused discussion state
- Add SEO component per discussion

**Files to change:**
- `src/utils/routes.ts` (MODIFY)
- `src/components/SmartTalk.tsx` (MODIFY)
- `vercel.json` (MODIFY - add rewrite)

---

##### 3.5 Add hreflang for Multilingual Support

**Problem:** Profiles have `preferredLanguage` field but no hreflang tags.

**Solution:** Add hreflang tags when multilingual content exists.

**Modified file:** `src/components/SEO.tsx`
- Add `hreflang` prop
- Generate hreflang links for supported languages

**Files to change:**
- `src/components/SEO.tsx` (MODIFY - add hreflang support)

---

#### Phase 3 Deployment Order

1. Implement RSS feed (independent, low risk)
2. Add SmartTalk discussion routes (medium risk, requires testing)
3. Implement slug-based URLs (high risk, requires database migration)
4. Consider Next.js migration (highest risk, separate project)
5. Add hreflang support (low risk, when multilingual content exists)

**Rollback plan:** Each feature can be reverted independently. Next.js migration would require maintaining both apps during transition.

---

## 3. Architecture Decision Summary

### Can Vite Remain?

**YES.** Vite is a build tool, not a rendering strategy. The current Vite + React setup can be extended with:
- Prerendering plugins (vite-plugin-prerender, vite-ssg)
- Vercel ISR functions for dynamic rendering
- Build-time sitemap generation

**Recommendation:** Keep Vite. Add prerendering in Phase 2. Only consider Next.js migration in Phase 3 if technical debt becomes problematic.

---

### Is Prerendering Enough?

**PARTIALLY.** Prerendering solves the HTML content problem (Google sees post content in initial response), but posts still need discovery paths. Without sitemap entries and crawlable links, Google won't know which URLs to prerender/crawl.

**Recommendation:** Prerendering is necessary but not sufficient. Must be combined with Phase 1 discovery fixes (sitemap + anchor links).

---

### Is SSR Required?

**NOT NECESSARILY.** Full SSR (server renders HTML on every request) is overkill for a mostly-static content site. Alternatives:
- **Build-time prerendering:** Generate static HTML at build time (sufficient for 270 posts)
- **ISR (Incremental Static Regeneration):** Revalidate cached HTML periodically (good balance)
- **Dynamic rendering:** Serve static HTML to crawlers, CSR to users (complex)

**Recommendation:** Start with build-time prerendering for top posts (Phase 2). Move to ISR if content updates frequently. Full SSR not required.

---

### Is Next.js Migration Necessary?

**NO.** Next.js would provide a cleaner architecture with built-in SSR/ISR, but it's not required to fix the immediate indexing problem. The current Vite stack can achieve the same SEO outcomes with:
- Dynamic sitemap (Vercel function)
- Prerendering plugin
- Anchor link changes
- Canonical fixes

**Recommendation:** Defer Next.js migration to Phase 3. Only pursue if Phase 1+2 succeed but technical debt (custom router, manual SEO) becomes unmanageable.

---

## 4. Effort, Risk, and Impact Estimates

### Phase 1 Summary

| Metric | Estimate |
|---|---|
| Development effort | 2-3 days |
| Risk level | LOW (each change independent, reversible) |
| Files to modify | 8-10 files |
| New files | 1-2 files |
| Deployment complexity | LOW (standard Vercel deploy) |
| Expected indexing improvement | 200-250+ additional posts indexed within 4-6 weeks |
| Time to see results | 2-6 weeks (Google crawl latency) |

**Risk mitigation:**
- Deploy changes incrementally (canonical → redirects → sitemap → links → 404)
- Monitor Search Console Coverage report after each deploy
- Keep static sitemap as backup during dynamic sitemap rollout

---

### Phase 2 Summary

| Metric | Estimate |
|---|---|
| Development effort | 3-5 days |
| Risk level | MEDIUM (build configuration changes) |
| Files to modify | 3-5 files |
| New files | 0-1 files |
| Deployment complexity | MEDIUM (build process changes) |
| Expected indexing improvement | Better rankings, richer snippets, faster indexing |
| Time to see results | 4-8 weeks |

**Risk mitigation:**
- Test prerendering locally before deployment
- Start with top 50 posts only (not all 270)
- Monitor build times and bundle sizes
- Have rollback plan (remove prerender plugin)

---

### Phase 3 Summary

| Metric | Estimate |
|---|---|
| Development effort | 2-4 weeks |
| Risk level | HIGH (architecture changes) |
| Files to modify | 10-20 files (or complete rewrite for Next.js) |
| New files | 5-10 files |
| Deployment complexity | HIGH (potential breaking changes) |
| Expected indexing improvement | Marginal over Phase 2 |
| Time to see results | 4-12 weeks |

**Risk mitigation:**
- Treat each item as independent project
- Next.js migration requires parallel running apps
- Slug URL migration requires database migration script
- Extensive testing before production deploy

---

## 5. Exact Files to Change

### Phase 1 Files

**New files:**
- `api/sitemap.xml.ts` - Dynamic sitemap generation

**Modified files:**
- `vercel.json` - Add sitemap rewrite, add 301 redirects
- `src/utils/routes.ts` - Fix canonical host (1 line)
- `src/utils/seoSchemas.ts` - Fix SITE_URL (1 line)
- `src/components/SEO.tsx` - Fix canonical host (2 lines)
- `index.html` - Fix OG URLs
- `src/components/KnowledgeCard.tsx` - Add `<a href>` links
- `src/components/KnowledgeFeed.tsx` - Add `<a href>` links for categories/topics
- `src/components/Explore.tsx` - Add `<a href>` links for posts
- `src/components/NotFoundRoute.tsx` - Add noindex SEO

**Total:** 1 new file, 10 modified files

---

### Phase 2 Files

**New files:**
- None (using existing vite.config.ts)

**Modified files:**
- `vite.config.ts` - Add prerender plugin config
- `package.json` - Add prerender plugin dependency
- `api/sitemap.xml.ts` - Add profile URLs
- (Optional) `vercel.json` - Add prerender rewrites if needed

**Total:** 0 new files, 3-4 modified files

---

### Phase 3 Files

**New files:**
- `api/feed.xml.ts` - RSS feed generation
- (If Next.js migration) Entire new Next.js project

**Modified files:**
- Firestore database - Add slug field (migration)
- `src/types.ts` - Add slug field
- `src/utils/routes.ts` - Add slug URL generation, SmartTalk routes
- `src/components/SmartTalk.tsx` - Add discussion routing
- `src/components/SEO.tsx` - Add hreflang support
- `vercel.json` - Add legacy redirects, feed rewrite

**Total:** 1-2 new files, 5-6 modified files (or complete rewrite for Next.js)

---

## 6. Deployment Order

### Phase 1 Deployment Sequence

1. **Deploy canonical host fixes** (routes.ts, seoSchemas.ts, SEO.tsx, index.html)
   - Risk: LOW
   - Impact: Fixes signal split
   - Verification: Check canonical tags in browser dev tools

2. **Deploy 301 redirects** (vercel.json)
   - Risk: LOW
   - Impact: Consolidates duplicate URL signals
   - Verification: Test redirects with curl or browser

3. **Deploy dynamic sitemap** (api/sitemap.xml.ts + vercel.json rewrite)
   - Risk: LOW
   - Impact: Tells Google about all 270+ posts
   - Verification: Access /sitemap.xml, confirm post URLs present

4. **Deploy anchor link changes** (KnowledgeCard.tsx, KnowledgeFeed.tsx, Explore.tsx)
   - Risk: LOW-MEDIUM
   - Impact: Enables crawler discovery
   - Verification: View page source, confirm `<a href="/post/...">` present

5. **Deploy 404 noindex** (NotFoundRoute.tsx)
   - Risk: LOW
   - Impact: Prevents soft-404 signals
   - Verification: Access invalid URL, check meta robots tag

6. **Submit sitemap to Google Search Console** (manual action)
   - Risk: NONE
   - Impact: Triggers crawl of post URLs
   - Verification: Monitor Sitemap report in GSC

7. **Monitor Coverage report** (ongoing)
   - Watch for "Discovered – currently not indexed" → "Crawled – currently not indexed" → "Indexed"

---

### Phase 2 Deployment Sequence

1. **Implement prerendering for top 50 posts** (vite.config.ts + package.json)
   - Risk: MEDIUM
   - Impact: Google sees post content in initial HTML
   - Verification: Build locally, check dist/post/{id}/index.html

2. **Test prerendered output locally**
   - Risk: NONE
   - Impact: Confirms build process works
   - Verification: Preview prerendered files, check for post content

3. **Deploy prerendering changes**
   - Risk: MEDIUM
   - Impact: Production serves static HTML for top posts
   - Verification: URL Inspection in GSC for sample post

4. **Extend prerendering to category/topic pages** (vite.config.ts)
   - Risk: MEDIUM
   - Impact: Hub pages have static HTML with full post lists
   - Verification: Check /category/ai source for post links

5. **Extend sitemap to include profiles** (api/sitemap.xml.ts)
   - Risk: LOW
   - Impact: Google discovers profile pages
   - Verification: Check sitemap for /profile/ URLs

6. **Add SmartTalk to sitemap** (api/sitemap.xml.ts)
   - Risk: LOW
   - Impact: SmartTalk page gets crawl signal
   - Verification: Check sitemap for /smarttalk URL

7. **Monitor URL Inspection** (ongoing)
   - Watch for rendered HTML to contain post content, meta tags, schema

---

### Phase 3 Deployment Sequence

1. **Implement RSS feed** (api/feed.xml.ts + vercel.json)
   - Risk: LOW
   - Impact: Enables aggregator discovery
   - Verification: Access /feed.xml, validate RSS format

2. **Add SmartTalk discussion routes** (routes.ts + SmartTalk.tsx + vercel.json)
   - Risk: MEDIUM
   - Impact: Individual discussions have permalinks
   - Verification: Test /smarttalk/{id} routes

3. **Implement slug-based URLs** (database migration + routes.ts + types.ts + vercel.json)
   - Risk: HIGH
   - Impact: Keyword-rich URLs, better CTR
   - Verification: Test redirects from old to new URLs

4. **Consider Next.js migration** (separate project)
   - Risk: VERY HIGH
   - Impact: Cleaner architecture long-term
   - Verification: Extensive testing before cutover

5. **Add hreflang support** (SEO.tsx)
   - Risk: LOW
   - Impact: Multilingual SEO when content exists
   - Verification: Check hreflang tags on multilingual pages

---

## 7. Final Recommendation

### Minimum-Change Solution for Immediate Indexing Recovery

**The minimum-change solution that can get all 270+ posts properly discoverable and indexable by Google is Phase 1 only.**

**Rationale:**
- Phase 1 addresses the root cause: posts are invisible to crawlers
- Dynamic sitemap gives Google a complete list of post URLs
- Anchor links enable crawler discovery through internal linking
- Canonical fixes prevent signal dilution
- 301 redirects consolidate duplicate URL signals
- All changes are low-risk, reversible, and can be deployed incrementally
- No architecture changes required (Vite remains, no SSR needed yet)

**Expected outcome with Phase 1 only:**
- Google discovers all 270+ post URLs via sitemap
- Google can crawl posts via anchor links
- Google indexes 200-250+ posts within 4-6 weeks
- Content quality (CSR-only) may limit rankings, but indexing volume should recover

**When to proceed to Phase 2:**
- If Phase 1 achieves indexing goals but rankings are poor
- If Google Search Console shows "Crawled – currently not indexed" for many posts (indicates rendering issues)
- If social media previews show incorrect metadata (indicates client-side meta problem)

**When to proceed to Phase 3:**
- If Phase 1+2 succeed but technical debt becomes unmanageable
- If the custom router and manual SEO components become maintenance burden
- If the team wants to standardize on Next.js for future features

---

### Critical Success Factors

1. **Submit the new sitemap to Google Search Console immediately after deployment.** This is the single highest-impact action.
2. **Monitor the Coverage report weekly.** Watch the transition from "Discovered" → "Crawled" → "Indexed".
3. **Use URL Inspection on sample posts.** Confirm Google sees post content, not just shell HTML.
4. **Don't expect instant results.** Google's crawl and index cycle takes 2-6 weeks for bulk changes.
5. **Keep the static sitemap as backup.** If dynamic sitemap has issues, revert to static immediately.

---

### What NOT to Do

- **Do not migrate to Next.js before trying Phase 1.** The indexing problem is solvable within the current stack.
- **Do not implement full SSR before trying prerendering.** SSR is overkill for a mostly-static content site.
- **Do not add slug URLs before fixing discovery.** Pretty URLs don't matter if Google can't find the posts.
- **Do not expect instant indexing.** SEO changes take weeks to propagate through Google's systems.

---

## 8. Next Steps (When Ready to Implement)

1. **Review this plan with the team** to confirm approach and timeline
2. **Create a staging branch** for Phase 1 implementation
3. **Implement Phase 1 changes incrementally** following the deployment order
4. **Test each change locally** before deploying to production
5. **Deploy to production** following the sequence in Section 6
6. **Submit new sitemap to Google Search Console**
7. **Monitor Coverage report** weekly for 6 weeks
8. **Evaluate Phase 2** based on Phase 1 results
9. **Defer Phase 3** until technical debt justifies the effort

---

**End of recovery plan. No files were modified. This document is for planning purposes only.**
