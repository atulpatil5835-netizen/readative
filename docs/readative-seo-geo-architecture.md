# Readative SEO and GEO Architecture

Audit date: June 2, 2026

Readative is treated as a Business, AI, Marketing, Startup, Productivity, Development, Cybersecurity, and Technology knowledge platform. This architecture keeps categories permanent, topics scalable, and tags lightweight.

## 1. Content Taxonomy Report

Read-only Firebase audit results:

| Area | Count |
| --- | ---: |
| Knowledge posts | 266 |
| Public posts | 266 |
| Private posts | 0 |
| SmartTalk discussions | 9 |
| SmartTalk answers | 20 |
| User profiles | 64 |
| Helpful signals on posts | 2,251 |

Top inferred categories:

| Category | Posts | SmartTalk | Helpful | Comments |
| --- | ---: | ---: | ---: | ---: |
| Technology | 84 | 0 | 706 | 7 |
| AI | 65 | 3 | 599 | 10 |
| Productivity | 39 | 2 | 338 | 1 |
| Cybersecurity | 29 | 1 | 244 | 0 |
| Business | 18 | 0 | 154 | 0 |
| Marketing | 14 | 0 | 117 | 1 |
| Development | 11 | 1 | 79 | 0 |
| Startup | 6 | 1 | 56 | 0 |
| Uncategorized | 0 | 1 | 6 | 0 |

Top topic clusters:

| Topic | Category | Posts | SmartTalk | Helpful |
| --- | --- | ---: | ---: | ---: |
| AI | AI | 158 | 4 | 1,415 |
| Software Tools | Technology | 156 | 3 | 1,360 |
| Productivity Tools | Productivity | 131 | 2 | 1,158 |
| Mobile Apps | Technology | 85 | 1 | 693 |
| Automation | Productivity | 70 | 2 | 622 |
| AI Automation | AI | 69 | 1 | 614 |
| Programming Resources | Development | 68 | 1 | 575 |
| Email Marketing | Marketing | 59 | 3 | 523 |
| Growth | Business | 53 | 0 | 453 |
| ChatGPT | AI | 50 | 0 | 433 |
| Founder Playbook | Startup | 47 | 1 | 390 |
| Social Media Marketing | Marketing | 43 | 0 | 372 |
| Privacy | Cybersecurity | 40 | 0 | 327 |
| Product-Market Fit | Startup | 33 | 0 | 293 |
| Business Strategy | Business | 33 | 0 | 284 |

Top raw tags:

`productivity` 63, `techhacks` 60, `ai` 55, `techtips` 51, `automation` 35, `passiveincome` 24, `efficiency` 23, `nocode` 21, `futuretech` 20, `cybersecurity` 19, `sidehustle` 19, `aihacks` 15, `aitools` 15, `futureofwork` 15, `lifehacks` 14.

Growth pattern:

| Month | Posts |
| --- | ---: |
| 2026-04 | 33 |
| 2026-05 | 232 |
| 2026-06 | 1 |

The current content base is tool-heavy, with the strongest density in Technology, AI, and Productivity. Marketing, Development, Startup, and Business have enough signal to remain permanent pillars but need more evergreen cluster work.

## 2. Category Governance Report

Permanent categories:

1. AI
2. Technology
3. Business
4. Marketing
5. Startup
6. Productivity
7. Development
8. Cybersecurity

Governance rules:

- Do not add new primary categories for products, apps, hashtags, trends, or single tools.
- Fit future content into one of the eight pillars.
- Use topics for unlimited concepts such as ChatGPT, Cursor, SEO, Supabase, Vercel, AI Tools, and Programming Resources.
- Use tags only as supporting metadata.
- Legacy labels such as `programming`, `software`, `apps`, `tools`, and `startups` are mapped into permanent categories instead of becoming separate pillars.

## 3. Topic Architecture Report

Topics are unlimited and live under a permanent category. Current high-value topic architecture includes:

- AI: AI, ChatGPT, Claude, Gemini, AI Tools, Prompt Engineering, AI Automation.
- Technology: Software Tools, Mobile Apps, Vercel, Supabase, SaaS, Technology Guides.
- Marketing: SEO, Digital Marketing, Social Media Marketing, Content Marketing, Email Marketing, Marketing Tools.
- Startup: Startup Tools, MVP, Fundraising, Product-Market Fit, Founder Playbook.
- Productivity: Productivity Tools, Automation, Notion, Workflow Systems, Templates.
- Development: Cursor, React, TypeScript, Python, Programming Resources, API Development, GitHub.
- Cybersecurity: Privacy, Authentication, Passwords, Security Tools, Risk Management.
- Business: Business Strategy, Operations, Pricing, Growth.

Topic pages use `/topic/:slug`, include a topic brief, show related topics, and noindex themselves when empty.

## 4. Tag Architecture Report

Tags remain lightweight metadata, not primary SEO landing pages.

Canonical examples:

- `free-tools`
- `automation`
- `growth`
- `social-media`
- `prompt-engineering`
- `coding`
- `privacy`
- `seo`

Tag pages use `/tag/:slug`, are intentionally `noindex`, and are omitted from the sitemap. Tags should help feed filtering and user discovery, not create crawlable page sprawl.

## 5. URL Architecture Report

Implemented canonical URL layers:

- Home feed: `/`
- Category pages: `/category/ai`, `/category/marketing`, `/category/development`
- Topic pages: `/topic/chatgpt`, `/topic/cursor`, `/topic/seo`
- Tag pages: `/tag/free-tools`
- Post pages: `/post/:id`
- SmartTalk: `/smarttalk`
- Explore: `/explore`

Legacy routes are preserved:

- `/knowledge/:id` still parses as a post route.
- `/knowledge?tag=x&topic=y` still parses as a filtered feed route.
- Hash routes still normalize through the existing route handler.

Vercel rewrites now support hard refreshes on category, topic, tag, post, profile, knowledge, SmartTalk, and Explore paths.

## 6. GEO Strategy Report

Category and topic pages now answer:

- What the page covers.
- Why the page matters.
- Who it helps.
- Benefits of the content cluster.
- Examples of included topics.
- Related topics for follow-on discovery.

These briefs are visible page content, not hidden metadata. They help Google AI Overview, ChatGPT, Gemini, Claude, and Perplexity identify the role of each page in the knowledge graph.

Structured data supports the same intent with Organization, WebSite, CollectionPage, ItemList, BreadcrumbList, Article, and DiscussionForumPosting JSON-LD.

## 7. SmartTalk SEO Report

SmartTalk remains functionally unchanged. The SEO layer now treats it as a discussion collection:

- `/smarttalk` has CollectionPage and BreadcrumbList schema.
- Loaded questions emit DiscussionForumPosting schema.
- Category labels are normalized through the permanent taxonomy.
- A compact SmartTalk brief explains that questions and answers are organized around the permanent knowledge pillars.

Audit signal:

- 9 discussions.
- 20 answers.
- 1 unanswered discussion.
- 1 discussion currently uncategorized.

Recommended next step: add individual SmartTalk discussion URLs later, such as `/smarttalk/:id`, when routing and moderation policy are ready.

## 8. Schema Strategy Report

Reusable schema helpers now support:

- Organization
- WebSite
- Article
- FAQPage
- DiscussionForumPosting
- BreadcrumbList
- CollectionPage
- ItemList

Usage:

- Home/category/tag/post feed pages emit collection, breadcrumb, and article schema where appropriate.
- Explore/topic pages emit collection, item list, breadcrumb, and discussion schema.
- SmartTalk emits discussion forum schema for loaded questions.
- FAQPage support is available for future curated FAQ pages without adding another dependency.

## 9. Internal Linking Report

Implemented linking model:

Category -> Topic -> Post

Category -> Topic -> SmartTalk Discussion

Current links:

- Category pages show related topic buttons.
- Topic pages show parent category and related topic buttons.
- Explore lists top posts, active discussions, learning collections, and related topic results.
- SmartTalk carries normalized category context.

Recommended future links:

- Add topic chips to KnowledgeCard footers when a post has a strong inferred topic.
- Add `Related SmartTalk` sections on topic pages when individual discussion routes exist.
- Add `Related Posts` on focused post pages using topic and tag overlap.

## 10. Indexing Strategy Report

Index:

- `/`
- `/explore`
- `/smarttalk` when it has discussions
- `/category/:category` when matching content exists
- `/topic/:topic` when matching content exists
- `/post/:id` for public posts

Noindex:

- Empty category/topic views
- `/tag/:slug`
- Empty SmartTalk
- Private or non-viewable posts
- Search/filter states that are only user-session views

Sitemap:

- Includes home, Explore, SmartTalk, all permanent category pages, and high-value topic pages.
- Excludes tag pages because they are noindex support pages.
- Dynamic post sitemap generation is recommended once server-side post slug support exists.

## 11. Content Opportunity Report

Highest-value opportunities based on existing density:

1. AI Tools and ChatGPT guides.
2. Software Tools and Technology Guides.
3. Productivity Tools and Automation workflows.
4. Cybersecurity and Privacy explainers.
5. Marketing Tools, Email Marketing, and Social Media Marketing.
6. Founder Playbook, Startup Tools, and Product-Market Fit.
7. Programming Resources and Cursor guides.
8. Business Strategy and Growth playbooks.

Content gaps:

- Development has useful signal but needs more specific guides.
- Startup has good helpful density but low volume.
- Marketing has cluster potential but needs more SEO and tools content.
- One SmartTalk discussion needs category cleanup.

## 12. Performance Report

Performance safeguards:

- No new npm dependencies.
- No Firebase configuration changes.
- No auth changes.
- No storage changes.
- No SmartTalk logic changes.
- No Knowledge Feed ranking or polling changes.
- Full taxonomy is kept out of eager route code; route aliases use a small local map.
- The build keeps the full taxonomy/schema work in lazy-loaded page chunks.

Latest build snapshot:

- Eager `index` chunk: 66.45 kB, gzip 19.80 kB.
- KnowledgeFeed chunk: 61.46 kB, gzip 18.86 kB.
- Explore chunk: 31.98 kB, gzip 8.71 kB.
- SmartTalk chunk: 25.30 kB, gzip 7.84 kB.

## 13. Files Modified

- `src/utils/seoTaxonomy.ts`
- `src/utils/seoSchemas.ts`
- `src/utils/contentIntelligence.ts`
- `src/utils/routes.ts`
- `src/components/KnowledgeFeed.tsx`
- `src/components/Explore.tsx`
- `src/components/SmartTalk.tsx`
- `public/sitemap.xml`
- `vercel.json`
- `index.html`
- `docs/readative-seo-geo-architecture.md`

## 14. Verification Checklist

- Read-only Firebase count audit completed.
- Read-only full content scan completed because live volume was 266 posts and 9 discussions.
- `npm run build` passed.
- `npm run lint` could not be run because the project has no `lint` script.
- In-app browser route verification passed for `/category/ai`, `/topic/chatgpt`, `/tag/automation`, `/post/i2Heuzoyi40ToLR47BSG`, and `/smarttalk`.
- `/tag/automation` verified as `noindex`; category, topic, post, and SmartTalk routes verified as `index`.
- No Firebase writes were performed.
- No Firebase, auth, storage, SmartTalk voting, Knowledge Feed ranking, Trust System, or Profile System logic was changed.
- Route support added for `/category/*`, `/tag/*`, and `/post/*` while preserving legacy route parsing.

External references consulted:

- Google Search Central structured data gallery: https://developers.google.com/search/docs/guides/search-gallery
- Google Search Central crawling and indexing: https://developers.google.com/search/docs/crawling-indexing
- Google Search Central URL structure: https://developers.google.com/search/docs/crawling-indexing/url-structure
- Google Search Central discussion forum structured data: https://developers.google.com/search/docs/appearance/structured-data/discussion-forum
- Schema.org DiscussionForumPosting: https://schema.org/DiscussionForumPosting
