# Release H7 Task Checklist

Status: PASS
Date: 2026-07-11

## Audit

- [x] Profile routing audited.
- [x] Authentication/profile creation audited.
- [x] Author rendering audited across feed, cards, comments, mentions, Explore, SmartTalk, Profile, Bookmarks, and Notifications.
- [x] Search, share URLs, canonical tags, OpenGraph, Twitter, JSON-LD, and sitemap audited.
- [x] Firestore profile model audited.
- [x] `username_audit.md` created.

## Username Engine

- [x] One reusable engine in `src/utils/usernames.ts`.
- [x] 3-20 character validation.
- [x] Lowercase canonical usernames.
- [x] Letters, numbers, and underscore only.
- [x] Whitespace normalization.
- [x] Duplicate underscore collapse.
- [x] Leading/trailing underscore rejection.
- [x] Reserved word rejection.
- [x] Emoji/invalid input rejection verified.

## Uniqueness

- [x] Added `usernames/{username}` mapping.
- [x] Username creation/change uses one transaction.
- [x] Duplicate username rejects in the transaction.
- [x] Removed username-change collection scans.
- [x] No username polling.
- [x] No username listeners.

## Profile URLs

- [x] Canonical `/@username` route.
- [x] Legacy `/profile/:id` route support.
- [x] Legacy profile route canonicalizes to `/@username`.
- [x] Mixed-case handle canonicalizes to lowercase.
- [x] Vercel rewrites updated.
- [x] `_redirects` parity updated.

## Author Experience

- [x] Knowledge card author links.
- [x] Comment author links.
- [x] Mention chips and inline mentions.
- [x] Feed schema author URL.
- [x] Explore contributor cards.
- [x] Profile share/copy URL generation.
- [x] Notifications profile opens with available actor username.
- [x] SmartTalk avoids stale stored usernames by using author ID fallback when current profile data is not loaded.

## SEO

- [x] Profile server SEO handler.
- [x] Profile title and description.
- [x] Profile canonical tag.
- [x] Profile OpenGraph.
- [x] Profile Twitter tags.
- [x] Profile Person JSON-LD.
- [x] ProfilePage JSON-LD.
- [x] BreadcrumbList JSON-LD.
- [x] ItemList JSON-LD.
- [x] Sitemap profile entries use `/@username`.
- [x] SEO verifier updated for H7 profile handles.

## Validation

- [x] `npm run build`
- [x] `npx tsc --noEmit`
- [x] `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`
- [x] `npm run verify:seo`
- [x] `git diff --check`
- [x] Username engine smoke.
- [x] Profile canonical smoke.
- [x] Browser desktop profile route smoke.
- [x] Headless Chrome mobile viewport smoke.
- [x] Headless Chrome tablet viewport smoke.

## Production Safety

- [x] No feed ranking change.
- [x] No SmartTalk logic change.
- [x] No Notebook change.
- [x] No Analytics change.
- [x] No Cookies change.
- [x] No Desktop Workspace change.
- [x] No new background listeners.
- [x] No username-change content rewrite scans.
- [x] Firestore schema change limited to username mapping.

## QA Notes

- Production username creation/duplicate/reserved flows were not executed as real writes against live Firestore. The username engine and transaction code path were verified statically and with local smoke checks.
- Browser clipboard contents could not be read by automation after clicking Copy Link, but the profile URL generation, Copy Link button visibility, and canonical profile URL were verified.
