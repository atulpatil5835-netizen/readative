# Release H7 Username SEO Report

Generated: 2026-07-11T07:17:22.997Z

## Summary

- Sitemap URL: https://www.readative.com/sitemap.xml
- Crawlable discovery index: https://www.readative.com/posts
- Crawlable SmartTalk index: https://www.readative.com/smarttalks
- Canonical post shape: https://www.readative.com/posts/{seo-slug}--{documentId}
- Canonical SmartTalk shape: https://www.readative.com/smarttalk/{seo-slug}--{documentId}
- Canonical profile shape: https://www.readative.com/@{username}
- Firestore SEO data source: rest
- Published post URLs discovered: 337
- SmartTalk discussions discovered: 109
- Profile URLs discovered: 33
- Tag URLs discovered: 551
- Total sitemap URLs generated: 513

## Files Changed

- api/_seoData.ts
- api/discovery.ts
- api/post.ts
- api/profile.ts
- api/smarttalk.ts
- api/smarttalks.ts
- src/components/Explore.tsx
- src/components/KnowledgeCard/CardContent.tsx
- src/components/KnowledgeCard/KnowledgeCard.tsx
- src/components/KnowledgeFeed/FeedRenderer.tsx
- src/components/KnowledgeFeed/KnowledgeFeed.tsx
- src/components/KnowledgeFeed/KnowledgeJourney.tsx
- src/components/KnowledgeFeed/feedHelpers.ts
- src/components/Profile.tsx
- src/components/ProfileMyNotes.tsx
- src/components/SmartTalk.tsx
- src/utils/loadThirdPartyScripts.ts
- src/utils/routes.ts
- src/utils/seoUrls.ts
- src/utils/usernames.ts
- src/utils/userProfiles.ts
- public/_redirects
- vercel.json
- scripts/verify-seo-recovery.ts
- username_audit.md
- seo_report.md
- walkthrough.md
- task.md
- final_report.md

## Sitemap Coverage

- Published posts in sitemap: 337 / 337
- Missing post URLs: 0
- SmartTalk discussions in sitemap: 109 / 109
- Missing SmartTalk URLs: 0
- Profiles in sitemap: 33 / 33
- Missing profile URLs: 0
- Categories in sitemap: 8
- Topics in sitemap: 7
- Tags in sitemap: 0
- Profiles in sitemap: 33
- Important pages in sitemap: 19

## Canonical Verification

- Canonical host: https://www.readative.com
- Sitemap canonical status: PASS - all sitemap URLs use https://www.readative.com
- Duplicate sitemap URLs: PASS
- Duplicate usernames: PASS
- Profile handle status: PASS - every public profile sitemap URL uses /@username
- Duplicate URL redirects:
  - /knowledge/:id -> /post/:id legacy bridge: PASS
  - /knowledge -> /: PASS
  - /jobs -> /explore: PASS
- Dynamic sitemap rewrite: PASS
- Discovery index rewrite: PASS
- Canonical post rewrite (/posts/:slug--id): PASS
- Legacy post rewrite (/post/:id): PASS
- SmartTalk index rewrite: PASS
- Canonical SmartTalk rewrite (/smarttalk/:slug--id): PASS
- Legacy SmartTalk rewrite (/smarttalks/:id): PASS
- Canonical profile rewrite (/@:username): PASS
- Legacy profile rewrite (/profile/:id): PASS
- Static _redirects profile parity: PASS

## Profile Metadata Verification

- Profile canonical URLs: PASS
- Profile URL shape: PASS - every public profile sitemap URL uses /@username
- Profile JSON-LD: PASS - server-rendered profile pages emit Person, ProfilePage, BreadcrumbList, and ItemList JSON-LD.
- Profile OpenGraph/Twitter tags: PASS - server-rendered profile pages emit profile OG tags, Twitter card tags, and canonical URL.
- Legacy profile redirect: PASS - /profile/:id resolves through the profile SEO handler and redirects to /@username.

## Post Metadata Verification

- Unique post titles: PASS
- Unique post meta descriptions: PASS
- Open Graph/Twitter tags: PASS - shared SEO component emits title, description, image, canonical URL, OG tags, and Twitter tags for route pages.
- Article schema: PASS - focused post pages emit Article JSON-LD through the route SEO builder.

## Crawlability And Indexability

- Every published post has sitemap coverage: PASS
- Every public SmartTalk has sitemap coverage: PASS
- Every public profile has sitemap coverage: PASS
- Every published post has at least one crawlable inbound link: PASS
- Inbound source: https://www.readative.com/posts links every /posts/{slug}--{id} with real HTML anchors.
- Related/recent post links: PASS - focused post pages render crawlable related and recent /posts/{slug}--{id} anchors.
- Category/topic/tag/profile links: PASS - discovery index plus in-app surfaces expose real anchors, with profiles linked as /@username when profile data is available.
- robots.txt allows crawling: PASS
- Post noindex check: PASS - post routes use focused-entry SEO with robots=index; no post URL is emitted with noindex.
- 404 noindex: PASS - not-found route emits robots=noindex.

## Firestore Safety

- Username uniqueness path: one Firestore transaction writes userProfiles/{authorId} and usernames/{username}; no polling and no listeners.
- Username route resolution: one-shot usernames/{username} lookup, with a one-shot userProfiles usernameLower fallback only for legacy profiles missing a mapping document.
- Username changes do not scan or rewrite knowledge, SmartTalk, notification, bookmark, or analytics collections.
- Author identity surfaces reuse already-loaded profile data where available; no new background listeners were added.

## Blocking Failures

- None.

## Google Search Console Action

1. Submit https://www.readative.com/sitemap.xml in the www/domain property.
2. Inspect https://www.readative.com/posts and confirm Google sees the post anchor list.
3. Inspect a few /posts/{slug}--{id} URLs from the sitemap.
4. Inspect https://www.readative.com/smarttalks to seed SmartTalk discussion discovery.
5. Inspect several https://www.readative.com/@username profile URLs from the sitemap.
6. Watch Page indexing for "Discovered - currently not indexed" to move into crawled/indexed over the next crawl cycles.

## Notes

- Existing post URLs, legacy profile URLs, Firebase collections, and the Vite/React framework were preserved.
- No Next.js migration or major architecture rewrite was introduced.
- Legacy post, SmartTalk item, and profile URLs are preserved as redirect-compatible inputs.
