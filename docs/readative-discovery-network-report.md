# Readative Discovery Network Report

Date: 2026-05-31

## 1. Discovery Audit

- Home is stable and fast, but discovery is mostly linear. Users can search posts and choose categories, yet deeper topic discovery is easy to miss.
- Explore had the right bounded data sources, but topic cards were not navigable and old content was not strongly resurfaced.
- SmartTalk has good answer ranking and discussion blocks, but its knowledge is isolated from wider discovery.
- Search existed as local page search, not unified discovery across posts, questions, topics, and people.
- Categories and topics were duplicated as feed filters and Explore cards without dedicated topic landing pages.

## 2. Search Improvements

- Added unified search inside Explore across posts, SmartTalk questions, topics, and contributors.
- Results are grouped by Posts, Questions, Topics, and People.
- Search uses the existing bounded Explore reads only. No new collections, indexes, migrations, or external search service were added.
- Search clears when navigating between topic pages so users land on a clean topic view.

## 3. Explore Improvements

- Trending topics now use a blended score: post count, discussion count, answers, helpful signals, recency, and misleading penalties.
- Active discussions prioritize unanswered, recently active, and helpful answer threads.
- Most helpful posts prioritize community trust, helpful count, comments, quality score, and recency.
- Top contributors are ranked from loaded posts, answers, best answers, profile counters, and trust signals.
- Added Today's Pulse with new insights, active discussions, trending topic count, and top topic today.
- Added content resurfacing: Popular This Month, Recommended Reads, and You Might Have Missed.

## 4. Topic Page Implementation

- Added safe dynamic topic routes such as `/topic/ai`, `/topic/startups`, `/topic/cybersecurity`, and `/topic/productivity`.
- Topic pages reuse Explore's existing bounded reads and show Top Posts, Latest Posts, Active Discussions, Top Contributors, and Learning Collections.
- Unknown topic slugs are handled safely as dynamic topic pages instead of requiring schema changes.
- Added host rewrites for `/explore` and `/topic/*` in `public/_redirects` and `vercel.json`.

## 5. Performance Report

- No new dependencies were added.
- No Firestore collection names, writes, or document fields were changed.
- Explore remains three bounded reads: `knowledge`, `smarttalk`, and `userProfiles`.
- Ranking and search are memoized client-side over capped result sets.
- Route-level lazy loading remains intact; the Explore production chunk is about 27.9 kB before gzip and 7.76 kB gzip.

## 6. Dead Code Report

Safe to remove after another production verification pass:
- Old profile liked-post tab state and helpers are still guarded and hidden, but retained for compatibility.

Needs verification:
- Header sign-in entry points after menu cleanup.
- Duplicate topic keyword lists between Home feed, Explore, and Profile expertise inference.

Protected:
- Legacy `likes`, `dislikes`, `likedKnowledgeIds`, and current Helpful/Misleading trust fields.
- Existing `knowledge`, `smarttalk`, `userProfiles`, and `notifications` collections.
- `/jobs` route alias to Explore.

## 7. Verification Checklist

- TypeScript: `npx tsc --noEmit --pretty false` passed.
- Production build: `npm run build` passed.
- Browser verified Explore at `/explore`.
- Browser verified topic page at `/topic/ai`.
- Browser verified unified search and topic result navigation.
- Browser verified profile discovery on `/profile/jkOhEZiEWHWRsn9EvjrQztjIiNn2`.
- Browser verified Home feed still loads search, Helpful labels, and mobile Explore navigation.
- Browser verified SmartTalk still loads search, Helpful labels, and Ask flow entry.
- Browser console check found no warnings or errors.
