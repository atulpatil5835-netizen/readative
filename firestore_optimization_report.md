# Release H3 Firestore Optimization Report

Status: audit complete; exact profile reads added without duplicate user reads; authenticated write QA blocked.
Date: 2026-07-08

## H3 Read/Listener/Transaction Measurement

Measured from code audit and local browser smoke:

| Area | Reads | Writes | Listeners | Transactions | H3 result |
| --- | --- | --- | --- | --- | --- |
| Home feed first page | `knowledge` one-shot `getDocs`, limit 10 unless fresh cache is used. | None on read. | None for public feed first page. | None. | Unchanged from H2 containment. |
| Home feed pagination | `knowledge` one-shot `getDocs`, limit 5 per page. | None. | None. | None. | Unchanged. |
| Feed author profiles | New exact `userProfiles` id query for profile ids visible in rendered feed entries/comments/mentions, chunked at 30 ids. | None. | None. | None. | Added to fix missing avatars. Loaded/loading id sets prevent duplicate profile reads in the session. |
| Profile mention directory | `userProfiles` one-shot directory query, limit 80, only after composer opens. | None. | None. | None. | Now merges with exact feed profiles instead of replacing them. |
| Profile edit/photo/banner/details | Existing `userProfiles/{uid}` writes only. | One profile write per save. | None added. | None. | Same-session event updates feed profile cache without rereading. |
| Edit Post | Existing `knowledge/{postId}` update. | One post update per save. | None added. | None. | Parent feed state updates after successful write; no schema change. |
| Helpful | Transaction reads/writes `knowledge/{postId}`. Best-effort profile tracking write after transaction. | One primary post transaction; optional profile tracking write. | None added. | One transaction. | Notification/profile failures remain unable to roll back the primary trust write. |
| Misleading | Transaction reads/writes `knowledge/{postId}`. Optional profile cleanup write when needed. | One primary post transaction; optional profile cleanup write. | None added. | One transaction. | Same behavior; browser-auth QA blocked. |
| Notifications | Existing signed-in listener. | Existing notification writes best-effort. | One signed-in notification listener with fallback behavior. | None. | Unchanged. |
| GA | No Firestore activity. | None. | None. | None. | GA script remains deduped after consent. |

## Duplicate Read Verification

Confirmed duplicate-read protections:

- `loadedProfileIdsRef` prevents rereading a profile id after it has loaded.
- `loadingProfileIdsRef` prevents concurrent duplicate reads for the same profile id while a query is in flight.
- Profile directory results add ids to the loaded set and merge into existing exact profiles.
- Same-session profile changes dispatch `readative:user-profile-updated` after Firestore success and update the feed profile list without another `getDoc`.
- Existing fresh feed cache and deferred composer directory behavior remain intact.

## Firestore Schema

No Firestore schema changes were made.

No routing, SEO architecture, AdSense, or SmartTalk logic changes were made.

## H3 Validation Gap

Authenticated browser QA for Helpful/Misleading/Edit/Publish/Comments could not be completed because Google sign-in failed in local preview with Firebase auth handler text: `The requested action is invalid`.

## H3 Firestore Verdict

Read duplication around feed profile images is fixed in code. Primary write paths remain scoped and best-effort side effects remain decoupled. However, release is not approved until authenticated Firestore browser QA passes.

# Release H2 Firestore Optimization Report

Status: audit complete; safe write reductions and live read containment applied.
Date: 2026-07-06

## Read Audit Summary

| Area | Current read/listener behavior | H2 action |
| --- | --- | --- |
| Home feed | Previously kept one realtime listener on `knowledge`, ordered by `createdAt`, limited to 10 initial docs. Pagination reads 5 docs per page. One background prefetch page could read 5 extra docs after idle delay. | Replaced the public home listener with a one-shot `getDocs` page load, reused fresh feed cache instead of immediately rereading, and disabled automatic background prefetch. |
| Feed cache | Memory/localStorage feed cache existed, but the home listener still opened even when fresh cache was available. | Fresh cache now prevents the initial server read for returning visitors while preserving pagination through a cached cursor. |
| Journey SmartTalk preview | One `getDocs` call to `smarttalk`, limit 50, guarded by `hasLoadedJourneySmartTalkRef`. | Reduced to 12 docs and added a 6-hour memory/localStorage preview cache. |
| Profile directory for mentions | One idle `getDocs` call to `userProfiles`, limit 80, guarded by `hasLoadedProfilesDirectoryRef`. | Deferred until the composer is opened, so normal readers no longer pay this read cost on landing. |
| SmartTalk list | One realtime listener on first page, limit 50. Category ordered-query fallback uses a single fallback listener if an index is missing. | Left unchanged. |
| SmartTalk total count | One `getCountFromServer()` call for total count. Quota failure does not block the list because the UI can fall back to loaded question count. | Hardened: count failure now logs a warning instead of a console error and leaves pagination/list rendering intact. |
| SmartTalk pagination | `getDocs` reads next 50 docs only on load-more. | Left unchanged. |
| Focused SmartTalk | Uses existing list data when present; attaches a single doc listener only when focused item is not already loaded. | Left unchanged. |
| Notifications | One listener after enough engagement/sign-in, ordered by `createdAt`, limit 20. Fallback listener is limited to 60 if an index is missing. | Left unchanged. |
| Notebook highlights | Focused post reads one notebook doc; My Notes first page reads up to 12 notebook docs plus matching knowledge docs. | Left unchanged. |
| Profile pages | Profile loaders use bounded queries where present, but some migration/stat paths still scan broad collections. | Recommendation only; not changed in H2. |

## Write Optimization Summary

| Area | Before | H2 result |
| --- | --- | --- |
| Helpful | UI changed before persistence. Profile tracking was coupled tightly enough to block the primary interaction. | UI updates only from transaction-returned post arrays. Profile tracking is best-effort after the post transaction. Duplicate clicks blocked while trust write is in flight. |
| Helpful remove | Post transaction plus separate profile update. UI changed before persistence. | Same transaction handles post arrays and profile removal. UI updates only from transaction result. |
| Misleading | UI changed before persistence. Profile cleanup could block the primary interaction if coupled to the transaction. | Helpful cleanup in post arrays happens in the post transaction. Profile cleanup is best-effort after the transaction. UI updates only from transaction result. |
| Save | UI/count changed before the save transaction returned. | Transaction returns persisted `savedBy` and `saveCount`; UI updates from committed values only. |
| SmartTalk save | Save failures could be swallowed and duplicate submits were possible. | Shared awaited save helper blocks duplicate writes and surfaces visible failure messages. |
| SmartTalk vote | Missing docs silently returned; duplicate clicks could run concurrent transactions. | Missing docs throw, duplicate vote clicks are disabled, and failed persistence shows visible messaging. |
| Comment | Comment appeared optimistically before the `knowledge` update. Notification failure could affect perceived success. | Comment appears only after `updateDoc` succeeds. Notifications run best-effort afterward. |
| Publish | Mention notification writes were awaited inside primary publish success path. | Primary post success depends on `knowledge` write. Mention notifications run best-effort afterward. |
| Test helper | Created temporary public posts without cleanup. | Future runs delete the temporary post in `finally`. |

## Reduction Estimate

Read reduction: live home/feed reads were reduced without changing routing or interaction behavior.

- Removed the always-open public home feed listener.
- Disabled the automatic background prefetch page.
- Made fresh feed cache skip the immediate initial server read for returning visitors.
- Reduced SmartTalk journey preview reads from 50 to 12 and cached the preview for 6 hours.
- Deferred the 80-profile mention directory query until the composer is opened.

Remaining heavier profile/stat paths still need a separate design-safe data model pass.

Write reduction: duplicate and unnecessary writes were reduced in interaction failure paths:

- Helpful/Misleading no longer let profile tracking failures roll back the primary post trust transaction.
- Misleading post Helpful cleanup remains synchronized on the post document; profile cleanup is best-effort.
- Duplicate trust/vote/save clicks are blocked while the write is in flight.
- Notification writes no longer determine primary comment/publish success and cannot create false retries of the primary interaction.
- The temporary notification test helper no longer leaves a permanent test post behind.

## Structure Audit

| Structure | Finding | Recommendation |
| --- | --- | --- |
| `knowledge/{postId}.helpfulIds` / `misleadingIds` | Arrays are easy to transact but can become hot and grow with high engagement. | Keep for H2. For scale, consider subcollections or sharded counters in a future schema release. |
| `knowledge/{postId}.savedBy` | Same array-growth risk as trust arrays. | Keep for H2. Consider per-user save docs later. |
| `knowledge/{postId}.comments` | Array comments keep reads simple but grow document size and write contention. | Keep for H2. Consider comments subcollection later. |
| `smarttalk/{questionId}.answers` | Voting rewrites the answers array on a hot question. | Keep for H2. Consider answer subcollection later. |
| `notifications/{notificationId}` | Deterministic ids for likes reduce duplicates. Other notifications use direct set/update calls. | Keep; no notification architecture change in H2. |
| `userNotebook/{uid}/posts/{postId}` | One notebook document per user/post avoids large global documents. | Keep. |

## Deferred Recommendations

1. Replace high-growth engagement arrays with per-user reaction documents plus aggregate counters in a future schema release.
2. Move post comments to a subcollection once comment volume grows enough to risk document-size limits.
3. Add an emulator-backed Firestore interaction test suite so Helpful/Misleading/Save/SmartTalk transaction attempts and error codes can be asserted without touching production data.
4. Review profile stat loaders and migration paths separately; some broad collection scans are not safe to change during this stabilization pass.
5. Clean up any existing live `Temporary Test Post` artifacts manually after confirming the target project and document id.
