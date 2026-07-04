# SmartTalk SEO Architecture Audit

Audit date: 2026-07-04
Status: Audit complete; SmartTalk logic and routing unchanged

## Executive finding

SmartTalk has a good server-rendered question document, but the product does not use that document as its route contract.

The result is a split system:

- readers interact with `/smarttalk?id={questionId}` or `/category/{slug}?id={questionId}`;
- crawlers are sent to `/smarttalks/{questionId}`;
- client schema points most questions back to `/smarttalk`;
- the sitemap points questions to `/smarttalks/{questionId}`.

This is the exact SmartTalk SEO root cause. One question can have multiple discovery URLs, while the interactive view has no unique canonical metadata.

## Current route matrix

| Use case | URL | Render path | Canonical/schema behavior |
| --- | --- | --- | --- |
| SmartTalk app hub | `/smarttalk` | SPA | Client canonical defaults to `/smarttalk` |
| Filtered category hub | `/category/{slug}` | SPA SmartTalk filter | Client canonical is pathname, but schema identifies `/smarttalk` |
| Focused app question | `/smarttalk?id={id}` | SPA | Query is omitted from default canonical; generic hub metadata remains |
| Focused category question | `/category/{slug}?id={id}` | SPA | Query is omitted; canonical becomes category hub |
| Crawlable question | `/smarttalks/{id}` | Vercel serverless HTML | Unique self-canonical, OG/Twitter, DiscussionForumPosting |
| Crawlable question index | `/smarttalks` | Vercel serverless HTML | Unique self-canonical CollectionPage |

## Routing trace

1. `buildPublicPath("smarttalk", { focusedEntryId })` uses an `id` query parameter.
2. Adding `selectedTopic` moves the question under `/category/{slug}?id={id}`.
3. `parseRouteFromLocation()` understands those query forms.
4. It does not parse `/smarttalks/{id}` into the interactive SmartTalk component.
5. Vercel rewrites `/smarttalks/{id}` to `api/smarttalks.ts`.
6. App question cards, Explore, Knowledge Journey, notifications, and profile activity use interactive query URLs.
7. The server discovery index and sitemap use `/smarttalks/{id}`.

## Discoverability audit

### Positive paths

- Every qualifying question is added to the dynamic sitemap.
- `/smarttalks` renders real question anchors in server HTML.
- `/posts` links every SmartTalk question using the crawlable route.
- Each server question page links back to `/smarttalks`, its author when available, and its category when available.
- Missing `/smarttalks/{id}` documents return a real 404 response with `noindex`.

### Gaps

- The visible app never naturally navigates to the canonical server question route.
- Server question pages do not provide an explicit route back to the same interactive question.
- Header navigation points to `/smarttalk`, not `/smarttalks`.
- Link equity from in-app question anchors accumulates on noncanonical query URLs.
- The two hubs are both indexable and overlap heavily.
- The crawlable index is not linked from the footer or normal navigation.

## Metadata audit

### Server question document

`api/smarttalks.ts` emits:

- unique title and description;
- `index, follow` robots;
- self-canonical `/smarttalks/{id}`;
- article Open Graph and Twitter Card tags;
- BreadcrumbList;
- DiscussionForumPosting with author, dates, answer count, and answer comments.

This is the strongest current SEO surface and should not be discarded casually.

Remaining server gaps:

- The image is always the generic logo.
- No image alt/dimension/type metadata is emitted.
- Question titles are excerpts of question content, so similar questions can collide.
- Only the first five answer snippets are normalized into server data while `answerCount` includes all answers.
- Questions with no answers or extremely short content are still eligible.
- Answer-level moderation/visibility is not checked by the SEO normalizer.

### Client SmartTalk document

`SmartTalk.tsx` emits one generic page title and description regardless of focused question or category.

Its structured data:

- creates a CollectionPage at `/smarttalk`;
- gives every ItemList question the URL `/smarttalk`;
- creates up to ten DiscussionForumPosting entities with the same URL `/smarttalk`;
- does not change to a focused-question entity when a question is open.

On `/category/{slug}`, the document canonical can be the category pathname while JSON-LD says the page is `/smarttalk`. This is an exact canonical/schema mismatch.

## Indexability audit

### Eligibility logic

`api/_seoData.ts` includes a SmartTalk question when:

- the document has an ID;
- `deletedAt` is absent;
- `status` is not archived/deleted/draft/hidden/private;
- `content` is nonempty.

Problems:

- `visibility: private` is not checked.
- No minimum content length or quality threshold exists.
- Zero-answer questions are indexable.
- Duplicate question title/description groups are not audited.
- Moderated/deleted answers embedded in `answers` are not filtered by answer status.
- `createdAt` falls back to the current time, which can generate false freshness.

### Missing-question behavior

- Server `/smarttalks/{badId}`: correct 404 and `noindex`.
- Client `/smarttalk?id={badId}`: renders “Question not found or has been deleted,” but the page robots directive is based on whether the overall question collection is empty. It can remain indexable and canonical to the hub.

## Category relationship

Categories currently serve two jobs:

1. SmartTalk filters in the product.
2. Broad SEO pillars in taxonomy and sitemap generation.

The category sitemap `lastmod` combines post and SmartTalk activity, but the category UI is SmartTalk-focused. That can create a mismatch between the page Google is promised and the content it receives.

Category aliases also normalize to a canonical category ID internally without replacing the path or emitting an explicit canonical. For example, an alias can display the canonical category content while remaining self-canonical at the alias URL.

## Internal-link audit

| Source | Current destination | SEO consequence |
| --- | --- | --- |
| SmartTalk question cards | `/smarttalk?id=...` or `/category/...?...` | Does not reinforce sitemap canonical |
| Explore question rows | Interactive query URL | Same split |
| Knowledge Journey | Interactive query URL | Same split |
| Notifications | Interactive query URL | Same split |
| Profile SmartTalk activity | Programmatic button | No crawlable question anchor |
| `/posts` | `/smarttalks/{id}` | Correct canonical discovery path |
| `/smarttalks` | `/smarttalks/{id}` | Correct canonical discovery path |
| Sitemap | `/smarttalks/{id}` | Correct relative to server document |

## Recommended canonical strategy

Recommended target: preserve the already-published plural route family.

- Canonical SmartTalk hub: `/smarttalks`
- Canonical question: `/smarttalks/{questionId}`
- Category hub: `/category/{canonicalSlug}`
- Legacy/product alias: `/smarttalk` transitions only after the canonical app route is supported

Why preserve `/smarttalks/{id}`:

- It is already in the sitemap.
- It already has server-rendered metadata and content.
- It already returns proper 404s.
- It avoids invalidating the recorded set of 109 public question URLs.

The long-term target must make the canonical URL both reader-usable and crawler-readable. Serving one URL to users and a different URL to crawlers should not become a permanent architecture.

## Minimal later fix sequence

No fix is implemented in this audit. The recommended Phase 1.2 sequence is:

1. Freeze a canonical route contract for hub, question, category, and aliases.
2. Make the public-index eligibility predicate shared and visibility-safe.
3. Add client understanding for the canonical question path without changing SmartTalk business logic.
4. Give focused questions unique client title, description, canonical, OG/Twitter, and schema matching the server document.
5. Change every real anchor, notification target, Knowledge Journey target, and profile activity target to the canonical question URL.
6. Add explicit permanent redirects only after the target route works for direct loads and refreshes.
7. Consolidate or deliberately `noindex, follow` the duplicate hub.
8. Rebuild the sitemap from only qualifying canonical questions.

## Validation requirements for Phase 1.2

- Direct GET and HEAD for hub, valid question, invalid question, category, and alias.
- Initial HTML contains the expected title, description, canonical, robots, visible question text, and JSON-LD without waiting for client Firestore.
- Every app question anchor has the same URL as the sitemap and schema.
- Valid question returns 200; missing/deleted/private question returns 404 or 410 and `noindex`.
- No duplicate hub remains indexable unintentionally.
- No visibility-private question or hidden answer appears in the SEO dataset.

## Severity and regression risk

Severity: **Critical** for canonical consistency; **High** for private/thin content eligibility.

Primary regression risk: changing public URLs before the app supports direct navigation and before redirects/sitemap updates are deployed in the correct order.

Use the staged sequence in [migration_plan.md](migration_plan.md) and the release gates in [engineering_risk.md](engineering_risk.md).

Related documents:

- [production_seo_audit.md](production_seo_audit.md)
- [google_indexing_audit.md](google_indexing_audit.md)
- [implementation_plan.md](implementation_plan.md)
