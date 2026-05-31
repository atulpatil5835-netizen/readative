# Readative Production Audit

Date: 2026-05-31

## Audit Report

Readative is a Vite/React/Firebase application with good foundations: route-level lazy loading, feed virtualization, Firestore index fallbacks, image optimization, cached feed state, and profile hydration. The production risks found were concentrated around document hydration, trust vocabulary, mobile navigation, and inconsistent UI density.

### Legacy Data Loading Issues

- Knowledge documents assumed `likes`, `comments`, `hashtags`, and `mentions` were always arrays. Legacy or partially migrated documents could render badly or crash when a field was missing or malformed.
- Profile timestamps were not normalized from Firestore Timestamp values, so profile dates could degrade when loaded from older documents.
- SmartTalk answers only understood legacy `likes` and `dislikes`, with no path for current `helpfulIds` or `misleadingIds`.
- Guest-to-Google migration only rewrote `likes`, not the newer trust fields.

### Broken Rendering Risks

- Post cards displayed engagement as a heart/like model even though the product direction is trust-based.
- Trust counts could under-render when `likeCount` was more accurate than the `likes` array.
- SmartTalk showed "Top Answer" even though the requested system language is best-answer and helpful score.
- Some responsive navigation requirements were missing entirely: Create and Jobs were not present in the mobile primary nav.

### Schema Mismatches

- Knowledge posts now support both legacy `likes`/`likeCount` and current `helpfulIds`/`helpfulCount`.
- Knowledge posts now support both legacy `dislikes`/`dislikeCount` and current `misleadingIds`/`misleadingCount`.
- SmartTalk answers now support the same dual schema.
- User profiles keep `likedKnowledgeIds` for backward compatibility while UI presents those as helpful posts.

### Performance Bottlenecks

- Feed virtualization and module splitting were already present and preserved.
- Firestore reads still depend heavily on first-page realtime listeners and paged fetches. The implementation avoids adding extra feed reads for reputation by deriving contributor reputation from already-loaded entries and optional profile fields.
- Browser asset and build review show the main heavy chunk remains Firebase Firestore. No new large dependency was added.

### UI And Mobile Issues

- Existing cards used mixed radii and interaction styles. Key surfaces now use a tighter premium card style with subtle depth.
- Mobile bottom nav was incomplete and icon-only. It now has five labeled targets: Home, SmartTalk, Create, Jobs, Profile.
- Focus styles and base control typography were improved in CSS.

## Architecture Improvements

- Added `src/utils/trustSystem.ts` as the trust compatibility boundary.
- Kept legacy field names writable so older clients and existing queries continue working.
- Added current trust fields to types while leaving existing fields intact.
- Reputation is computed without new reads from loaded entries plus optional profile counters.
- SmartTalk vote ranking now uses helpful score derived from normalized trust metrics.

## UI/UX Implementation Plan

- Keep the feed as the first screen and improve hierarchy inside the post card.
- Replace Like/Dislike language with Helpful/Misleading in visible UI.
- Keep trust lightweight on post cards with compact trust and contributor-level indicators, without repeated metric blocks.
- Upgrade SmartTalk answers with best-answer badge, trust score, helpful score, and clearer answer controls.
- Add complete mobile bottom navigation and a safe Jobs route.
- Preserve existing profile and notification behavior with updated trust wording.

## Safe Migration Strategy

- Never delete legacy fields.
- On read, merge old and new arrays:
  - `likes` + `helpfulIds` become helpful feedback.
  - `dislikes` + `misleadingIds` become misleading feedback.
- On write, update both schemas:
  - `likes`, `likeCount`, `helpfulIds`, `helpfulCount`.
  - `dislikes`, `dislikeCount`, `misleadingIds`, `misleadingCount`.
- Keep `likedKnowledgeIds` as the profile compatibility field, but render it as Helpful in UI.
- Use Firestore transactions for post trust updates so Helpful and Misleading remain mutually exclusive per user.

## Exact Code Changes

- `src/utils/trustSystem.ts`: new normalization, trust metrics, helpful score, and contributor reputation helpers.
- `src/types.ts`: added optional current trust and reputation fields without removing legacy fields.
- `src/utils/knowledgeFeedData.ts`: trust transactions now write both legacy and current schema fields.
- `src/components/KnowledgeFeed.tsx`: safer knowledge hydration, current trust fields on new posts, optimistic trust state updates.
- `src/components/KnowledgeCard.tsx`: premium post card UI, Helpful/Misleading controls, compact trust badge, and contributor levels.
- `src/components/KnowledgeCardList.tsx`: contributor reputation map derived from loaded entries.
- `src/components/SmartTalk.tsx`: answer normalization supports both schemas, ranking uses helpful score, best-answer badge and trust UI added.
- `src/components/Profile.tsx`: safer hydration, Helpful language for the old liked-posts surface.
- `src/utils/profileData.ts`: Firestore timestamp-safe profile hydration.
- `src/utils/userProfiles.ts`: migration now carries helpful/misleading trust fields when moving guest activity to Google profiles.
- `src/App.tsx`, `src/components/Header.tsx`, `src/utils/routes.ts`, `src/components/AppShell.tsx`: Jobs route and five-item mobile nav.
- `src/components/Auth.tsx`, `src/components/AppPanels.tsx`, `src/utils/notifications.ts`: visible Like wording changed to Helpful.
- `src/index.css`, `src/components/KnowledgeImageCarousel.tsx`, `src/components/Skeletons.tsx`: base accessibility and card polish.

## Verification

- `npm run build` completed successfully.
- In-app browser verification passed on desktop and mobile widths.
- Checked Home, SmartTalk, Jobs, and Create flows.
- Browser console reported no warnings or errors during verification.
