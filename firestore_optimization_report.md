# Release H2 Firestore Optimization Report

Status: audit complete; safe write reductions applied; broad read redesign deferred as recommendation only.
Date: 2026-07-06

## Read Audit Summary

| Area | Current read/listener behavior | H2 action |
| --- | --- | --- |
| Home feed | One realtime listener on `knowledge`, ordered by `createdAt`, limited to 10 initial docs. Pagination reads 5 docs per page. One background prefetch page may read 5 extra docs after idle delay. | Left unchanged. It is bounded and product-visible. Removing prefetch would change perceived feed behavior. |
| Feed cache | Memory/localStorage feed cache is already used before waiting on fresh data. Cache writes are delayed. | Left unchanged. |
| Journey SmartTalk preview | One `getDocs` call to `smarttalk`, limit 50, guarded by `hasLoadedJourneySmartTalkRef`. | Left unchanged. |
| Profile directory for mentions | One idle `getDocs` call to `userProfiles`, limit 80, guarded by `hasLoadedProfilesDirectoryRef`. | Left unchanged. |
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
| Helpful | One post transaction plus a separate best-effort profile update. UI changed before persistence. | Profile tracking moved into the same transaction. UI updates only from transaction-returned arrays. Duplicate clicks blocked while trust write is in flight. |
| Helpful remove | Post transaction plus separate profile update. UI changed before persistence. | Same transaction handles post arrays and profile removal. UI updates only from transaction result. |
| Misleading | Post transaction could remove Helpful from post while profile cleanup happened separately. UI changed before persistence. | Helpful cleanup in post arrays and profile cleanup happen in the transaction when needed. UI updates only from transaction result. |
| Save | UI/count changed before the save transaction returned. | Transaction returns persisted `savedBy` and `saveCount`; UI updates from committed values only. |
| SmartTalk save | Save failures could be swallowed and duplicate submits were possible. | Shared awaited save helper blocks duplicate writes and surfaces visible failure messages. |
| SmartTalk vote | Missing docs silently returned; duplicate clicks could run concurrent transactions. | Missing docs throw, duplicate vote clicks are disabled, and failed persistence shows visible messaging. |
| Comment | Comment appeared optimistically before the `knowledge` update. Notification failure could affect perceived success. | Comment appears only after `updateDoc` succeeds. Notifications run best-effort afterward. |
| Publish | Mention notification writes were awaited inside primary publish success path. | Primary post success depends on `knowledge` write. Mention notifications run best-effort afterward. |
| Test helper | Created temporary public posts without cleanup. | Future runs delete the temporary post in `finally`. |

## Reduction Estimate

Read reduction: no broad read reduction was claimed. Existing reads are already bounded in the main feed/SmartTalk/notification surfaces, and the remaining heavier profile/stat paths need a separate design-safe data model pass.

Write reduction: duplicate and unnecessary writes were reduced in interaction failure paths:

- Helpful no longer performs a second independent profile write after a successful post transaction; profile tracking is part of the transaction boundary.
- Misleading no longer performs profile Helpful cleanup outside the transaction.
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
