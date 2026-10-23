# Readative Interaction Function Audit

**Date:** 2026-10-23  
**Scope:** source trace of post reactions, comments, saves, SmartTalk votes/answers, notifications, and UI state propagation.  
**Validation boundary:** no production writes and no signed-in end-to-end session were used.

## Fixes made

### Prevent duplicate comments during moderation/write

The comment button disables during moderation, but Enter submits through a separate path. The async handler had no synchronous in-flight guard, so repeated Enter presses while moderation was pending could create multiple unique comment records. A per-card ref now guards the entire moderation plus persistence sequence and is released on moderation rejection, moderation failure, and write completion/failure.

### Keep comments/count in the feed after virtualization

After Firestore accepted a comment, the card updated only its local state. The parent feed entry was left stale; when virtualization unmounted/remounted the card, the comment and count could disappear until a later server refresh. Successful comments now update the parent feed entry through the existing `onEntryUpdated` callback as well as local state.

### Avoid redundant notification writes

“Mark all read” previously sent updates for every item in the currently loaded notification list, including already-read notifications. It now batches only unread notification IDs.

### Keep saved state after a card is virtualized

Post bookmark writes already returned committed `savedBy` and `saveCount`, but the parent feed entry was not updated. The bookmark could appear to revert after its card unmounted. The committed bookmark values now flow through the existing parent-entry update callback.

### Keep SmartTalk votes and bookmarks synchronized in paginated views

SmartTalk vote and bookmark transactions persisted to Firestore but discarded their committed values for questions loaded through pagination. Those rows could stay visually stale; clicking an apparently inactive vote again could toggle off the already-saved vote. The UI now applies committed answer arrays and bookmark counts to first-page, paginated, and focused-question state. Voting against an answer that no longer exists now fails explicitly rather than reporting a successful no-op.

### Retire non-persistent legacy post endpoints

`api/posts` still exposed in-memory post/like/rating/comment handlers. They were unauthenticated, lost state between serverless invocations, and had no callers in the app source. They now return `410 Gone` with a migration message. The active authenticated Tech News create/image routes in the same handler remain available.

## Paths reviewed

| Interaction | Persistence path | Result propagation / notification behavior |
|---|---|---|
| Helpful / Misleading | Firestore transaction on `knowledge/{id}`; profile tracking is best-effort | UI updates from transaction arrays via `onLikeChange`; like notification is deterministic and best-effort |
| Save | Firestore transaction on the post plus profile saved IDs | Committed values update card and parent feed; SmartTalk save values update all loaded question views |
| Comment | `arrayUnion` update on `knowledge/{id}` | Duplicate submission guarded; UI and parent feed update only after commit; author/tag alerts are best-effort |
| SmartTalk answer/vote | Question document writes, with duplicate answer and vote guards in source | Committed vote arrays update paginated/focused views; Best Answer alert is best-effort |
| Notification read | Single update or batch for mark-all | Realtime listener refreshes read state and unread badge |

## Remaining verification

The repository’s prior interaction audit reports that signed-in browser QA was blocked, so these paths are source-reviewed rather than end-to-end confirmed against the owner’s deployed Firestore rules. Verify one like/unlike, comment, mention alert, SmartTalk vote/answer, save, and mark-read flow with a test account before release. No production test records were created or changed here.
