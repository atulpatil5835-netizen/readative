# Release H7 Final Report

Status: PASS
Date: 2026-07-11

## Summary

Release H7 implements Readative's premium username and author identity system with canonical `/@username` profile URLs, global username uniqueness through a lightweight mapping collection, crawlable profile SEO documents, and consistent author routing across the main app surfaces.

## Implemented

- Added `src/utils/usernames.ts` as the single username engine.
- Added `api/profile.ts` for server-rendered profile SEO pages.
- Added canonical profile routing for `/@username`.
- Preserved legacy `/profile/:id` and canonicalized it to `/@username`.
- Added `usernames/{username}` transaction-based uniqueness.
- Updated sitemap profile URLs to `/@username`.
- Updated author links in feed cards, comments, mentions, Explore, Profile, Notifications, and server-rendered SEO documents.
- Updated `npm run verify:seo` for H7 profile handle coverage.
- Updated `public/_redirects` and `vercel.json` profile rewrites.

## Firestore Safety

- Username uniqueness uses one transaction.
- Username change no longer scans or rewrites knowledge documents.
- Username change no longer scans notifications.
- No new background listeners were added.
- New schema surface is limited to `usernames/{username}` mapping documents.
- Existing content collections are not migrated or rewritten for usernames.

## Validation

- `npm run build`: PASS.
- `npx tsc --noEmit`: PASS.
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`: PASS.
- `npm run verify:seo`: PASS.
- `git diff --check`: PASS; line-ending warnings only.
- Username engine smoke: PASS.
- Profile canonical smoke: PASS.
- Browser route QA: PASS.

Measured SEO verifier output:

- Firestore SEO source: `rest`.
- Published post URLs discovered: 337.
- SmartTalk discussions discovered: 109.
- Profile URLs discovered: 33.
- Total sitemap URLs: 513.
- Missing post URLs: 0.
- Missing SmartTalk URLs: 0.
- Missing profile URLs: 0.
- Duplicate sitemap URL groups: 0.
- Duplicate username groups: 0.
- Profile handle status: PASS.
- Blocking failures: 0.

Browser QA:

- Desktop `/@atul_hinge`: rendered profile, canonical and OG matched, console errors 0.
- Legacy `/profile/wGp2Tb5R6Mcfw7N34sXQnimb9PS2`: canonicalized to `/@atul_hinge`.
- Mixed-case `/@Atul_Hinge`: canonicalized to `/@atul_hinge`.
- Mobile `390x844`: rendered profile, no horizontal overflow, canonical and OG matched, console errors 0.
- Tablet `768x1024`: rendered profile, no horizontal overflow, canonical and OG matched, console errors 0.

## Notes

- Production write QA for username creation, duplicate username rejection, and reserved username rejection was not executed against live Firestore. The username engine and transaction implementation were validated without creating production test users.
- Clipboard contents could not be read by browser automation after Copy Link, so the share URL generation and Copy Link control presence were verified instead.

## Verdict

PASS for Release H7 premium username and author identity implementation.
