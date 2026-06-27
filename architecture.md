# Readative Content Architecture Audit

## Executive Summary

Readative is a Single Page Application (SPA) built using React, Vite, and TypeScript. The frontend interacts directly with Google Cloud Firestore via the Firebase Web SDK. For search engine optimization (SEO) and bots, a Vercel Serverless API layer (`/api/...`) fetches and pre-renders static HTML pages using the Firebase Admin SDK or Firestore REST API.

This document presents a complete audit of the content architecture of Readative (Release G). It details the current lifecycle, relationships, and performance of posts, SmartTalk, categories, search, explore, and personalization, identifies architectural problems, and proposes a target architecture for future releases.

---

## Phase 1 — Deep Audit

### 1. Feed Architecture
*   **Source File(s):** [KnowledgeFeed.tsx](file:///c:/Users/Atul/OneDrive/Documents/readative%20(1)/src/components/KnowledgeFeed/KnowledgeFeed.tsx), [feedHelpers.ts](file:///c:/Users/Atul/OneDrive/Documents/readative%20(1)/src/components/KnowledgeFeed/feedHelpers.ts), [feedFilters.tsx](file:///c:/Users/Atul/OneDrive/Documents/readative%20(1)/src/components/KnowledgeFeed/feedFilters.tsx)
*   **Loading Mechanism:**
    *   The primary "All" (home) feed queries the `knowledge` collection in Firestore. It establishes a real-time subscription (`onSnapshot`) for the first page (`FEED_INITIAL_PAGE_SIZE = 10` documents) sorted by `createdAt` desc.
    *   Subsequent pages are loaded on demand via `getDocs` queries, starting after the document snapshot cursor (`paginationCursorRef.current`) and fetching `FEED_NEXT_PAGE_SIZE = 5` documents at a time.
    *   Filtered feeds (by topic or hashtag) bypass real-time subscription and are loaded on demand via `getDocs`. It attempts to run ordered queries (`createdAt` desc).
    *   If composite indexes are missing (causing a Firestore `failed-precondition` or "requires an index" error), the system falls back to unordered/limit-free queries using `getDocsWithIndexFallback` and performs sorting and filtering in memory.
*   **Personalization & Sorting:**
    *   The home feed sorting is processed entirely client-side using a scoring and ranking algorithm in [feedPersonalization.ts](file:///c:/Users/Atul/OneDrive/Documents/readative%20(1)/src/utils/feedPersonalization.ts).
    *   A user's interaction history (views, opens, likes, comments, shares, author/hashtag affinities) is stored in the browser's `localStorage` (`readativeKnowledgeFeedActivity:v2` and `readativeKnowledgeSeenEntries:v3`).
    *   `rankKnowledgeEntries` calculates a dynamic score based on recency, quality (word count/images/mentions), user affinities, novelty, and cooldowns/penalties for already-seen or liked posts.
    *   A client-side diversification algorithm (`diversifyRankedEntries`) prevents consecutive posts from the same author or topic.

### 2. SmartTalk Architecture
*   **Source File(s):** [SmartTalk.tsx](file:///c:/Users/Atul/OneDrive/Documents/readative%20(1)/src/components/SmartTalk.tsx), [Skeletons.tsx](file:///c:/Users/Atul/OneDrive/Documents/readative%20(1)/src/components/Skeletons.tsx)
*   **Loading Mechanism:**
    *   The SmartTalk feed subscribes to the `smarttalk` Firestore collection using a real-time `onSnapshot` query ordered by `createdAt` desc, limited to `SMART_TALK_PAGE_SIZE = 50` documents.
    *   Subsequent pages are loaded via `getDocs` starting after the last query snapshot.
*   **Data Structure:**
    *   SmartTalk questions contain answers as a nested array of maps (`answers`) directly within the question document in Firestore.
    *   Upvoting or downvoting ("helpful" / "misleading") of answers is performed via Firestore transactions (`runTransaction`) that fetch the question, toggle the vote in the nested answers array, recalculate the "best answer" status (highest helpful score), and update the parent question document.
    *   Saves are toggled using transactions that update the `savedBy` array and `saveCount` on the question, and update `savedSmartTalkIds` on the user's profile document.
*   **Search & Filtering:**
    *   Search on the SmartTalk feed is done entirely in-memory client-side using `matchesSmartTalkSearch(question, terms)` on the questions that have been loaded.

### 3. Category Architecture
*   **Source File(s):** [seoTaxonomy.ts](file:///c:/Users/Atul/OneDrive/Documents/readative%20(1)/src/utils/seoTaxonomy.ts), [contentIntelligence.ts](file:///c:/Users/Atul/OneDrive/Documents/readative%20(1)/src/utils/contentIntelligence.ts)
*   **Definitions:**
    *   Categories (e.g., AI, Technology, Business, Marketing, Startup, Productivity, Development, Cybersecurity) are statically defined in `seoTaxonomy.ts`.
    *   Each category has associated path slugs, descriptions, topic slugs, tag slugs, keywords, and aliases.
*   **Content Association:**
    *   Posts store category IDs in a `category` field. The creator suggests categories based on text classification rules (`suggestKnowledgeCategory` in `contentIntelligence.ts`).
    *   SmartTalk questions also contain a `category` field suggested or selected by the user.
    *   Explore calculations match posts and discussions to categories and topics using tag match rules (`matchesTopicEntry` and `matchesTopicQuestion`).

### 4. Search Architecture
*   **Source File(s):** [DiscoverySearch.tsx](file:///c:/Users/Atul/OneDrive/Documents/readative%20(1)/src/components/DiscoverySearch.tsx), [feedHelpers.ts](file:///c:/Users/Atul/OneDrive/Documents/readative%20(1)/src/components/KnowledgeFeed/feedHelpers.ts)
*   **Implementation:**
    *   Search is entirely in-memory and client-side. The application does not issue server-side search queries or use search indexers (e.g. Algolia/Elasticsearch).
    *   For posts, `matchesKnowledgeSearch` checks `title`, `content`, `author`, `hashtags`, comments, and mentions against search terms.
    *   For questions, `matchesSmartTalkSearch` checks `author`, `content`, and answer text.
    *   Users cannot search across documents that have not been loaded or cached in the current browser session.

### 5. Explore Architecture
*   **Source File(s):** [Explore.tsx](file:///c:/Users/Atul/OneDrive/Documents/readative%20(1)/src/components/Explore.tsx)
*   **Loading & Calculations:**
    *   When the Explore tab mounts, it queries the `knowledge` collection (limit 80), `smarttalk` collection (limit 50), and `userProfiles` collection (limit 80) in parallel via `getDocs`.
    *   It filters, matches, and ranks categories, topics, active discussions, top posts, and top contributors entirely in-memory using React `useMemo` blocks.
    *   It calculates dynamic scores for topics based on post count, discussion count, answers count, helpfulness ratings, and recency.
    *   It generates contributor leaderboards based on the combined post/answer activity and helpfulness scores of profiles.

### 6. Trending Calculation
*   **Formula for Posts:**
    *   Calculated client-side in `getKnowledgeTrendingScore(entry)`:
        $$\text{Trending Score} = (\text{likesCount} \times 8) + (\text{commentsCount} \times 4) + \text{qualityBoost} + \text{recencyBoost}$$
        *   `recencyBoost` decays based on age: $\max(0, 6 - \text{ageHours}/18)$.
        *   `qualityBoost` is based on `qualityScore/25`.
*   **Formula for Discussions:**
    *   Calculated client-side in `getDiscussionActivity(question)`:
        $$\text{Discussion Score} = (\text{answersCount} \times 6) + (\text{helpfulAnswersScore} \times 4) + \text{bestAnswerBonus} + \text{unansweredBonus} + \text{recencyBoost}$$
        *   `unansweredBonus` adds 18 to encourage contributions on unanswered questions.
        *   `bestAnswerBonus` adds 16 if a best answer exists.
*   **Trending Query:**
    *   In the database feed helpers (`loadTrendingKnowledgeEntries`), it queries Firestore sorted by `likeCount` desc, with index fallback to query sorting by `createdAt` desc.

### 7. Firestore Collections
The database relies on five primary collections:
1.  `knowledge`: Stores posts. Fields include `title`, `content`, `author`, `authorId`, `category`, `hashtags`, `likes`, `likeCount`, `helpfulIds`, `helpfulCount`, `dislikes`, `dislikeCount`, `comments` (nested array), `mentions`, `images`, `imageLayout`, `excerpt`, `readingMinutes`, `qualityScore`, `savedBy`, and `saveCount`.
2.  `smarttalk`: Stores questions. Fields include `author`, `authorId`, `content`, `category`, `difficulty`, `savedBy`, `saveCount`, `createdAt`, and `answers` (nested array of maps containing `id`, `author`, `authorId`, `content`, `likes`, `dislikes`, `bestAnswer`, `createdAt`).
3.  `userProfiles`: Stores user profiles. Fields include `displayName`, `username`, `usernameLower`, `email`, `bio`, `socialLinks`, `likedKnowledgeIds`, `savedKnowledgeIds`, `savedSmartTalkIds`, `reputationScore`, `helpfulCount`, `misleadingCount`, and `bestAnswerCount`.
4.  `notifications`: Stores user notifications. Fields include `targetAuthorId`, `actorAuthorId`, `actorUsername`, `type` (like, comment, tag, milestone, etc.), `entryId`, `entryTitle`, `preview`, `read`, and `createdAt`.
5.  `userHighlights`: Stores highlights associated with posts.

### 8. Firestore Indexes
Composite indexes are utilized for several ordered filters:
*   `knowledge`: `hashtags` (array-contains) + `createdAt` (desc)
*   `knowledge`: `likeCount` (desc) + `createdAt` (desc)
*   `knowledge`: `hashtags` (array-contains-any) + `createdAt` (desc)
*   `notifications`: `targetAuthorId` (asc) + `createdAt` (desc)

The client uses fallback queries without orderBy constraints when composite indexes are missing to prevent query execution failures.

### 9. Data Relationships
*   **Posts and Profiles:** A post document contains `authorId` referencing `userProfiles`. A user profile records arrays of liked post IDs (`likedKnowledgeIds`) and saved post IDs (`savedKnowledgeIds`).
*   **Discussions and Profiles:** A question contains `authorId`. Nested answers within questions reference an `authorId`. A profile document maintains saved discussion IDs (`savedSmartTalkIds`).
*   **Comments/Answers:** Comments on posts are stored in a nested array `comments` inside the `knowledge` post document. Answers on questions are stored in a nested array `answers` inside the `smarttalk` question document.
*   **Highlights:** Highlight documents in `userHighlights` contain reference fields linking a user profile and a post in the `knowledge` collection.
*   **Notifications:** Notification documents link a target user (`targetAuthorId`), an actor (`actorAuthorId`), and a post (`entryId`).

### 10. Current Routing
*   **Client-Side:** Single Page App (SPA) hash-based/pathname-based routing in the browser using custom popstate and hashchange event handlers, alongside a custom window event `readative:routechange`.
*   **Server-Side:** Custom rewrites in `vercel.json` rewrite clean routes (e.g. `/post/:id`, `/profile/:id`, `/smarttalk`, `/explore`) to `/index.html` to keep SPA history functionality working on manual refreshes.
*   **SEO Routes:** Vercel serverless functions intercept bots at `/posts` (discovery page) and `/smarttalks` / `/smarttalks/:id` (static HTML representation of questions and answers).

### 11. Current Content Lifecycle
*   **Creation:** Creators write content (posts, questions, answers, comments) in the browser. Before submission, the content is evaluated client-side.
*   **Moderation Check:** Local pattern rules in `contentModeration.ts` block spam, adult, or abusive terms, and verify length.
*   **Storage:** If passed, the document is written directly to Firestore using the client SDK.
*   **Retrieval:** The feed retrieves content using client-side Firestore queries (`onSnapshot` / `getDocs`).
*   **Modification/Deletion:** Posts are updated or archived using `deletedAt` metadata timestamps.

### 12. Current Moderation Flow
*   Executed entirely on the client before submission using `moderateContent` in `contentModeration.ts`.
*   Applies RegEx checks for explicit language (`EXPLICIT_RULES`), promotions (`PROMO_RULES`), casual chat (`CHAT_RULES`), and abuse/harassment (`ABUSE_RULES`).
*   Computes a `knowledgeScore` based on text depth, word counts, sentence count, and formatting triggers.
*   If hard-blocked or the knowledge score is below the pass threshold, the write is aborted, and suggestions are displayed to the user. No backend validation or server-side security rules enforce these constraints during database writes.

### 13. Current Recommendation Logic
*   Managed in the browser via `feedPersonalization.ts`.
*   Logs user activities (likes, opens, comments, shares, views) locally.
*   Maps interests (affinities) to authors and hashtags.
*   Ranks candidates using personalization, freshness, recency, quality, and cooldown filters to calculate a sorting score, then runs a author/topic diversification loop.

### 14. Current Caching
*   Home feed posts are cached client-side in memory (`knowledgeFeedMemoryCache`) and in `localStorage` (`readativeKnowledgeFeedCache:v2`).
*   Features a 6-hour cache TTL.
*   To fit local storage constraints, the cache size is capped (120 entries in memory, 32 entries in localStorage) and inline image data URLs are stripped if they exceed a budget of 900,000 characters.

### 15. Current Pagination
*   Loads an initial page (`FEED_INITIAL_PAGE_SIZE = 10`) via query subscriptions.
*   Loads next pages (`FEED_NEXT_PAGE_SIZE = 5`) on-demand via `getDocs` using `startAfter(paginationCursorRef.current)`.
*   Under idle conditions, it performs a background prefetch of one page using `requestIdleCallback` (or a 350ms timeout backup).

### 16. Current Duplicate Logic
*   To prevent duplicate logs, the client checks incoming actions against recent logs in a rolling time window (e.g. view duplicate window: 6 hours, open duplicate window: 30 minutes) using `isDuplicateActivity`.

### 17. Current Reusable Logic
*   **Trust System:** Metrics for helpfulness and misleading count calculations.
*   **Bookmarks:** `getSaveMetrics` and `toggleKnowledgeSave`/`toggleSmartTalkSave` update profiles and target documents.
*   **SeoTaxonomy:** Defines taxonomy helper mappings for categories, topics, and tags.
*   **SeoSchemas:** Generates sitemap, breadcrumb, and posting JSON-LD schemas.

---

## Phase 2 — Find Problems

### 1. SmartTalk Data Structure Scaling Limit (Critical Risk)
*   **Problem:** SmartTalk questions store answers as a nested array of maps directly within the question document.
*   **Risk:** Firestore has a hard limit of 1MB per document. If a discussion becomes highly popular (many answers, comments, or votes), the question document will exceed 1MB, throwing database write errors and preventing further answers.
*   **Implication:** Scaling bottleneck and data loss risk for active discussions.

### 2. Lack of Backend Security and Moderation Enforcement
*   **Problem:** Content moderation and spam filtering are executed exclusively client-side in the browser.
*   **Risk:** Users can bypass client-side validation by calling the Firebase API directly, writing unmoderated, inappropriate, or malicious content.
*   **Implication:** Security and quality vulnerabilities.

### 3. Client-Side Only Search (No Global Database Search)
*   **Problem:** Search matching is processed client-side in-memory using `matchesKnowledgeSearch` and `matchesSmartTalkSearch`.
*   **Risk:** Users can only search items currently loaded or cached in the client feed. They cannot search the entire historical database of posts and questions.
*   **Implication:** Severely limited search functionality as the platform grows.

### 4. Poor Performance and Heavy Queries in Explore Tab
*   **Problem:** The Explore tab loads the entire set of posts (limit 80), questions (limit 50), and profiles (limit 80) on mount, performing stats calculations, contributor rankings, and topic matching in-memory.
*   **Risk:** High bandwidth consumption, long rendering blocks, and sluggish page loads.
*   **Implication:** Degraded UX on mobile and slower connections.

### 5. Duplicated Code and Redundant State Logic
*   **Problem:** Type definitions (`Answer` vs `SmartAnswer`, `Question` vs `SmartQuestion`) and core text parsing utilities (e.g. `tokenizeSearch`) are copy-pasted and redefined across `SmartTalk.tsx`, `Explore.tsx`, and `types.ts`.
*   **Risk:** Harder to maintain, higher risk of drift or regression, and testing complexity.
*   **Implication:** Code debt.

### 6. Unused/Dead Backend APIs
*   **Problem:** `server.ts`, `api/posts.ts`, and `api/profile/[id].ts` run Express endpoints and serverless functions using temporary in-memory arrays. The frontend, however, uses direct client SDK calls and never fetches from these endpoints.
*   **Risk:** Extra maintenance overhead and confusion for developers.
*   **Implication:** Bloated repository.

### 7. Device-Locked Feed Personalization
*   **Problem:** Personalization logic, activity logs, and seen history are stored exclusively in the browser's `localStorage`.
*   **Risk:** If a user logs in on a new device or clears browser cache, their feed personalization is reset.
*   **Implication:** Broken omni-channel user experience.

---

## Phase 3 — Target Architecture

### 1. How should SmartTalk work?
SmartTalk should separate Questions and Answers into a relational schema.
*   **Questions:** Stored in a top-level `/smarttalk` collection. Question documents hold reference fields (category, difficulty, authorId, etc.) and metrics (saveCount, totalAnswersCount).
*   **Answers:** Stored in a subcollection under the parent question: `/smarttalk/{questionId}/answers/{answerId}`.
*   This schema eliminates the 1MB document limit, enables efficient pagination of answers, and simplifies querying.

### 2. SmartTalk Ownership Boundaries
*   **Questions & Answers:** Owned entirely by the SmartTalk module.
*   **Categories & Tags:** Managed through a shared, centralized registry module (e.g., `seoTaxonomy.ts`). Questions and answers select category keys from this shared taxonomy.
*   **Trending & Scores:** SmartTalk owns its discussion activity rating formula, but it should share standard recency, engagement, and normalization functions with the main post feed.
*   **Search:** Integrated into a unified search index (such as Algolia or a unified search serverless function) rather than client-side in-memory search.
*   **Recommendations:** SmartTalk question views and answers should trigger activity signals that feed into a unified user interest profile.

### 3. Integration with the Feed
*   The main feed component (`KnowledgeFeed`) and the SmartTalk feed component (`SmartTalk`) should be isolated.
*   The main feed can display discussion cards by fetching from `/smarttalk` using a common card renderer or content interface wrapper, preserving clear boundary separation.

### 4. Explore Interaction
*   Instead of fetching raw collections and aggregating statistics in the browser, the Explore tab should query a pre-aggregated statistics collection (e.g. `/exploreStats/{topicId}`) compiled by backend triggers or fetch from paginated indexes.

### 5. Sharing vs. Isolation
*   **Shared Code:**
    *   Taxonomy mappings, slug validation, and tag normalization.
    *   Trust system scoring rules (helpful, misleading metrics, user reputation calculation).
    *   Shared utility functions: text excerpting, reading time estimation, date formats.
    *   Bookmark/save transaction utilities.
*   **Isolated Code:**
    *   Feed ranking logic and diversification filters (unique to posts).
    *   Best-answer recalculation algorithms and discussion scores (unique to SmartTalk).
    *   Component-specific visual styling and layout logic.
