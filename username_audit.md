# Release H7 Username Audit

Status: PASS
Date: 2026-07-11

## Scope

Readative now has one canonical public profile identity shape:

- Profile URL: `https://www.readative.com/@username`
- Legacy profile URL: `/profile/:authorId`
- Username mapping collection: `usernames/{username}`
- Existing profile document: `userProfiles/{authorId}`

No feed ranking, SmartTalk logic, Notebook, Notifications listeners, Analytics, Cookies, performance loading strategy, or Desktop Workspace behavior was redesigned.

## Current Identity Model

- `userProfiles` remains the profile source of truth for display name, username, bio, images, trust metrics, saved IDs, and social links.
- `src/utils/usernames.ts` is the single reusable username engine.
- `src/utils/userProfiles.ts` owns profile creation, username changes, and the `usernames/{username}` uniqueness transaction.
- Local `KnowledgeIdentity.displayName` continues to store the public username used for content authorship.
- Existing content author strings are not batch-rewritten on username changes; rendering resolves through already-loaded profile data where available.

## Username Engine

Rules implemented:

- 3 to 20 characters.
- Lowercase canonical output.
- Letters, numbers, and underscores only.
- Whitespace input normalizes to `_`.
- Duplicate `_` collapses.
- Leading/trailing `_` is rejected.
- Emoji and unsupported characters are rejected after normalization because they create invalid leading/trailing or non-canonical handles.
- Reserved words are blocked.

Validated examples:

- `Atul  Hinge` -> `atul_hinge`
- `atul__hinge` -> `atul_hinge`
- `WINDOWSLAB` -> `windowslab`
- `ab`, `_atul`, `atul_`, `admin`, and `john` plus emoji input reject.

## Uniqueness And Firestore Safety

Username creation and username change use one Firestore transaction:

- Read `usernames/{username}`.
- Reject immediately if it belongs to another author.
- Write `usernames/{username}` and merge `userProfiles/{authorId}`.
- Delete the previous username mapping when it belongs to the same author.

Removed from username changes:

- No `userProfiles` duplicate query.
- No knowledge collection scan for username rewrite.
- No notifications query for actor username rewrite.
- No polling.
- No listeners.

Route resolution uses a one-shot `usernames/{username}` read. A one-shot `userProfiles where usernameLower == username limit(1)` fallback remains only for legacy profiles that do not yet have a mapping document.

## Routing And SEO

- `/@username` parses as a profile route.
- `/profile/:authorId` remains supported and canonicalizes to `/@username` after profile load.
- Server SEO handler `api/profile.ts` renders crawlable profile HTML.
- Server profile metadata includes title, description, canonical, OpenGraph, Twitter, Person JSON-LD, ProfilePage JSON-LD, BreadcrumbList, and ItemList.
- Sitemap profile entries now emit `/@username`.
- Discovery, post, and SmartTalk server documents link authors to `/@username` when profile data is available.

Live SEO data audit:

- Firestore SEO source: `rest`.
- Public profile URLs discovered: 33.
- Duplicate username groups: 0.
- Missing profile sitemap URLs: 0.
- Profile handle status: PASS.

## Author Surfaces

Updated or verified:

- Knowledge card header.
- Knowledge comments.
- Knowledge mentions.
- Inline rich-text mentions.
- Knowledge feed search identity matching.
- Continue Reading / feed schema author URL.
- Explore contributor cards and people search.
- Profile shared posts.
- Bookmarks / saved posts via shared card rendering.
- Notifications actor profile opens when a username is already present.
- SmartTalk focused author links use the legacy ID route when no trusted profile record is loaded, then canonicalize through the profile page to avoid stale `@oldname` dead ends.
- Server-rendered SmartTalk author links use profile data and emit `/@username`.

## Search

Knowledge feed search now matches:

- Stored author text.
- Current profile username.
- Current profile display name.
- Profile email where already loaded.
- Mentions and comment authors.

Explore people search already uses contributor display name, username, job title, and bio.

## Share

Profile share/copy URL generation uses:

- `buildAbsoluteRouteUrl("profile", { profileAuthorId, profileUsername })`
- Result: `https://www.readative.com/@username`

Browser smoke confirmed the Copy Link button is visible on profile pages. Clipboard write could not be externally read in the automation sandbox, so the URL generation and UI state were verified instead of a production clipboard side effect.

## Firestore Regression Summary

- Background listeners added: 0.
- Username uniqueness listeners: 0.
- Username uniqueness polling: 0.
- Username uniqueness collection scans: 0.
- Username change collection rewrite scans: 0.
- New collection: `usernames` mapping only.

The only new read path is the intentional one-shot username mapping lookup for direct `/@username` routes, plus the legacy fallback query only when a mapping document is missing.
