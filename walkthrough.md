# Release H7 Walkthrough

Status: PASS
Date: 2026-07-11

## Objective

Release H7 adds durable premium profile identity to Readative with canonical `/@username` URLs, global username uniqueness, crawlable author profile pages, and consistent author linking without redesigning the product or expanding Firestore listeners.

## What Changed

1. Username engine

- Added `src/utils/usernames.ts`.
- Centralized normalization, validation, reserved-word checks, profile path building, and handle parsing.
- Tightened validation so leading/trailing underscores, reserved handles, too-short handles, and emoji-derived invalid handles reject.

2. Username uniqueness

- Added a lightweight `usernames/{username}` mapping.
- Profile creation and username changes now reserve usernames inside a single Firestore transaction.
- Removed the old username duplicate query against `userProfiles`.
- Removed username-change scans that rewrote knowledge and notification documents.

3. Profile routing

- `/@username` opens profile routes.
- `/profile/:authorId` still works and canonicalizes to `/@username`.
- Mixed-case handles canonicalize to lowercase in the app and server handler.
- Vercel and `_redirects` route profile handles through the profile SEO handler.

4. Profile SEO

- Added `api/profile.ts` to render crawlable profile pages.
- Profile pages emit unique title, description, canonical, OpenGraph, Twitter, Person JSON-LD, ProfilePage JSON-LD, BreadcrumbList, and ItemList.
- Sitemap profile URLs now use `/@username`.
- Discovery, post, and SmartTalk server-rendered documents link authors to canonical profile handles when profile data exists.

5. Author surfaces

- Knowledge card headers, comments, mention chips, inline rich-text mentions, Explore contributors, Profile shared posts, saved posts, and Notifications now route with username when trusted profile data is available.
- SmartTalk in-app author links use the stable legacy author ID route when no trusted current profile is loaded, letting the profile page canonicalize to the current handle and avoiding stale stored username dead ends.

6. Search and share

- Feed search now matches current profile username, display name, and already-loaded identity fields.
- Explore people search continues to support username/display name.
- Profile Copy Link uses the canonical `/@username` absolute URL.

## Firestore Safety Walkthrough

Username creation/change:

```text
validate username
run one transaction
read usernames/{username}
reject if owned by another author
write usernames/{username}
merge userProfiles/{authorId}
delete previous username mapping when owned by same author
```

No polling, no listeners, no knowledge collection scans, and no notification collection scans are used for username changes.

Direct `/@username` page load:

```text
read usernames/{username}
load userProfiles/{authorId}
legacy fallback query only if mapping is missing
```

## Validation Evidence

Commands from `C:\Users\Atul\OneDrive\Documents\readative (1)`:

```text
npm run build
npx tsc --noEmit
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npm run verify:seo
git diff --check
```

Browser/profile smoke:

- Desktop in-app browser: `/@atul_hinge` rendered Atul Hinge, `@atul_hinge`, canonical `https://www.readative.com/@atul_hinge`, OG URL match, console errors 0.
- Legacy route: `/profile/wGp2Tb5R6Mcfw7N34sXQnimb9PS2` canonicalized to `/@atul_hinge`.
- Mixed-case route: `/@Atul_Hinge` canonicalized to `/@atul_hinge`.
- Headless Chrome mobile `390x844`: profile rendered, no horizontal overflow, canonical/OG matched, errors 0.
- Headless Chrome tablet `768x1024`: profile rendered, no horizontal overflow, canonical/OG matched, errors 0.

SEO verifier evidence:

- Firestore SEO data source: `rest`.
- Published post URLs: 337.
- SmartTalk URLs: 109.
- Profile URLs: 33.
- Sitemap URLs: 513.
- Missing profile URLs: 0.
- Duplicate username groups: 0.
- Blocking failures: 0.

## QA Limits

- No real production username creation or duplicate-username write was performed. The engine behavior and transaction implementation were verified without creating live test accounts.
- Browser automation could not read clipboard contents after clicking Copy Link, but the Copy Link control was present and canonical URL generation was verified.
