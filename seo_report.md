# Release H7 Username SEO Report

Generated: 2026-09-06T05:48:17.959Z

## Summary

- Sitemap URL: https://www.readative.com/sitemap.xml
- Crawlable discovery index: https://www.readative.com/posts
- Crawlable SmartTalk index: https://www.readative.com/smarttalks
- Canonical post shape: https://www.readative.com/posts/{seo-slug}--{documentId}
- Canonical SmartTalk shape: https://www.readative.com/smarttalk/{seo-slug}--{documentId}
- Canonical profile shape: https://www.readative.com/@{username}
- SEO architecture mode: v1
- SEO V2 schema version: 1
- SEO V2 projection version: 1
- Firestore SEO data source: admin
- Published post URLs discovered: 365
- Indexable post URLs expected in sitemap: 86
- SmartTalk discussions discovered: 109
- Indexable SmartTalk URLs expected in sitemap: 34
- Profile URLs discovered: 35
- Indexable profile URLs expected in sitemap: 14
- Tag URLs discovered: 586
- Indexable high-volume tag URLs expected in sitemap: 10
- Total sitemap URLs generated: 170

## Files Changed

- api/_seoData.ts
- api/_document.ts
- api/discovery.ts
- api/post.ts
- api/profile.ts
- api/smarttalk.ts
- api/smarttalks.ts
- api/taxonomy.ts
- index.html
- public/amp/index.html
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

- Published posts in sitemap: 86 / 86
- Missing post URLs: 0
- SmartTalk discussions in sitemap: 34 / 34
- Missing SmartTalk URLs: 0
- Profiles in sitemap: 14 / 14
- Missing profile URLs: 0
- High-volume tags in sitemap (5+ posts): 10 / 10
- Missing tag URLs: 0
- Categories in sitemap: 6
- Topics in sitemap: 0 (expected 0; topic shortcuts are noindex/follow)
- Tags in sitemap: 10
- Profiles in sitemap: 14
- Important pages in sitemap: 20

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
- Explore taxonomy rewrite: PASS
- Category taxonomy rewrite: PASS
- Topic taxonomy rewrite: PASS
- Tag taxonomy rewrite: PASS
- Canonical profile rewrite (/@:username): PASS
- Legacy profile rewrite (/profile/:id): PASS
- Static _redirects profile parity: PASS
- Static _redirects taxonomy parity: PASS

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

- Every indexable published post has sitemap coverage: PASS
- Every indexable public SmartTalk has sitemap coverage: PASS
- Every profile with indexable content has sitemap coverage: PASS
- Every high-volume public tag has sitemap coverage: PASS
- Every indexable published post has at least one crawlable inbound link: PASS
- Inbound source: https://www.readative.com/posts links every /posts/{slug}--{id} with real HTML anchors.
- Related/recent post links: PASS - focused post pages render crawlable related and recent /posts/{slug}--{id} anchors.
- Category/tag/profile links: PASS - discovery index plus server-rendered taxonomy pages expose real anchors, with profiles linked as /@username when profile data is available.
- Topic shortcut handling: PASS - topic pages stay crawlable through internal links but are noindex/follow and excluded from the sitemap so posts carry search priority.
- Static homepage canonical: PASS - the Vite shell served at / includes https://www.readative.com/ as its canonical URL.
- Static homepage robots: PASS - the Vite shell served at / is index/follow.
- Static homepage discovery links: PASS - the no-JavaScript fallback links Posts, SmartTalk, and Explore.
- robots.txt allows crawling: PASS
- robots.txt canonical sitemap directive: PASS
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
6. Inspect several https://www.readative.com/tag/{slug} pages from the sitemap and one https://www.readative.com/topic/{slug} page to confirm it emits noindex/follow.
7. Watch Page indexing for "Discovered - currently not indexed" to move into crawled/indexed over the next crawl cycles.

## Notes

- Existing post URLs, legacy profile URLs, Firebase collections, and the Vite/React framework were preserved.
- No Next.js migration or major architecture rewrite was introduced.
- Legacy post, SmartTalk item, and profile URLs are preserved as redirect-compatible inputs.
