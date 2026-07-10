# Release H5 SEO URL Report

Generated: 2026-07-10T04:42:51.586Z

## Summary

- Sitemap URL: https://www.readative.com/sitemap.xml
- Crawlable discovery index: https://www.readative.com/posts
- Crawlable SmartTalk index: https://www.readative.com/smarttalks
- Canonical post shape: https://www.readative.com/posts/{seo-slug}--{documentId}
- Canonical SmartTalk shape: https://www.readative.com/smarttalk/{seo-slug}--{documentId}
- Firestore SEO data source: rest
- Published post URLs discovered: 336
- SmartTalk discussions discovered: 109
- Profile URLs discovered: 33
- Tag URLs discovered: 549
- Total sitemap URLs generated: 512

## Files Changed

- api/_seoData.ts
- api/discovery.ts
- api/post.ts
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
- public/_redirects
- vercel.json
- scripts/verify-seo-recovery.ts
- seo_url_audit.md
- seo_report.md
- walkthrough.md
- task.md
- final_report.md

## Sitemap Coverage

- Published posts in sitemap: 336 / 336
- Missing post URLs: 0
- SmartTalk discussions in sitemap: 109 / 109
- Missing SmartTalk URLs: 0
- Categories in sitemap: 8
- Topics in sitemap: 7
- Tags in sitemap: 0
- Profiles in sitemap: 33
- Important pages in sitemap: 19

## Canonical Verification

- Canonical host: https://www.readative.com
- Sitemap canonical status: PASS - all sitemap URLs use https://www.readative.com
- Duplicate sitemap URLs: PASS
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

## Post Metadata Verification

- Unique post titles: PASS
- Unique post meta descriptions: PASS
- Open Graph/Twitter tags: PASS - shared SEO component emits title, description, image, canonical URL, OG tags, and Twitter tags for route pages.
- Article schema: PASS - focused post pages emit Article JSON-LD through the route SEO builder.

## Crawlability And Indexability

- Every published post has sitemap coverage: PASS
- Every public SmartTalk has sitemap coverage: PASS
- Every published post has at least one crawlable inbound link: PASS
- Inbound source: https://www.readative.com/posts links every /posts/{slug}--{id} with real HTML anchors.
- Related/recent post links: PASS - focused post pages render crawlable related and recent /posts/{slug}--{id} anchors.
- Category/topic/tag/profile links: PASS - discovery index plus in-app surfaces expose real anchors.
- robots.txt allows crawling: PASS
- Post noindex check: PASS - post routes use focused-entry SEO with robots=index; no post URL is emitted with noindex.
- 404 noindex: PASS - not-found route emits robots=noindex.

## Google Search Console Action

1. Submit https://www.readative.com/sitemap.xml in the www/domain property.
2. Inspect https://www.readative.com/posts and confirm Google sees the post anchor list.
3. Inspect a few /posts/{slug}--{id} URLs from the sitemap.
4. Inspect https://www.readative.com/smarttalks to seed SmartTalk discussion discovery.
5. Watch Page indexing for "Discovered - currently not indexed" to move into crawled/indexed over the next crawl cycles.

## Notes

- Existing post URLs, profile URLs, Firebase collections, and the Vite/React framework were preserved.
- No Next.js migration or major architecture rewrite was introduced.
- Legacy post and SmartTalk item URLs are preserved as redirect-compatible inputs.
