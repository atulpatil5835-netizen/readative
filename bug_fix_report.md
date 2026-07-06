# Release H2 Bug Fix Report

Status: confirmed code defects repaired; authenticated E2E QA still required.
Date: 2026-07-06

## Confirmed Defects Fixed

| # | Defect | Root cause | Repair | Files |
| --- | --- | --- | --- | --- |
| 1 | Post Helpful could show false success | `KnowledgeCard` updated local counts before `toggleKnowledgeEntryLike()` completed. | UI/counts now update only from transaction-returned arrays. | `src/components/KnowledgeCard/KnowledgeCard.tsx`, `src/utils/knowledgeFeedData.ts` |
| 2 | Post Misleading could show false success | `KnowledgeCard` updated local counts before `toggleKnowledgeEntryMisleading()` completed. | UI/counts now update only from transaction-returned arrays. | `src/components/KnowledgeCard/KnowledgeCard.tsx`, `src/utils/knowledgeFeedData.ts` |
| 3 | Helpful/profile state could desynchronize | Profile `likedKnowledgeIds` was written best-effort after the post transaction. | Profile tracking moved into the same Firestore transaction. | `src/utils/knowledgeFeedData.ts` |
| 4 | Save could show false success | Post save toggled local saved state/count before repository persistence. | `toggleKnowledgeSave()` returns persisted `savedBy`/`saveCount`; UI updates from committed result. | `src/components/KnowledgeCard/KnowledgeCard.tsx`, `src/utils/bookmarks.ts` |
| 5 | Comment success depended on notifications | Notification writes were awaited after the Firestore comment write in the primary success path. | Comment appears after the comment write succeeds; notifications run best-effort afterward. | `src/components/KnowledgeCard/KnowledgeCard.tsx` |
| 6 | Publish could show false failure | Tag notifications were awaited inside the primary publish success path. | Publish success now depends on the `knowledge` write; tag notifications are best-effort. | `src/components/KnowledgeFeed/KnowledgeFeed.tsx` |
| 7 | SmartTalk votes could silently fail | Missing discussion docs returned silently and duplicate clicks were allowed. | Missing docs throw, duplicate vote buttons disable, and visible failure messages are shown. | `src/components/SmartTalk.tsx` |
| 8 | SmartTalk save could silently fail | Save and post-sign-in continuation swallowed failures with console-only handling. | Shared awaited save helper blocks duplicates and surfaces failures. | `src/components/SmartTalk.tsx`, `src/utils/bookmarks.ts` |
| 9 | SmartTalk validation could stall | Moderation/runtime failures were not caught around question/answer submission. | Validation failures clean up loading state and show visible messages. | `src/components/SmartTalk.tsx` |
| 10 | Login/session restore could race auth persistence | Sign-in used `void authPersistenceReady`; listener subscribed before persistence was confirmed. | Sign-in and listener now wait for persistence and surface restore errors. | `src/utils/googleAuth.ts`, `src/firebase/firebase.ts` |
| 11 | Logout could silently fail or duplicate-submit | Sign-out dialog had no in-flight state or visible failure path. | Sign-out is awaited, controls disable while in flight, and failure text is shown. | `src/App.tsx` |
| 12 | Transaction trace lacked retry visibility | Firestore retries transaction callbacks internally, but touched paths did not expose attempts. | Touched transaction paths now count callback attempts and return/report metadata. | `src/utils/knowledgeFeedData.ts`, `src/utils/bookmarks.ts`, `src/components/SmartTalk.tsx` |
| 13 | Firestore test helper left data artifacts | `test-notifications.ts` created a temporary post without cleanup. | Added `deleteDoc()` cleanup in `finally`. | `test-notifications.ts` |
| 14 | SmartTalk count quota produced a console error | `getCountFromServer()` failure was logged as an error even though the list can continue from loaded questions. | Downgraded the non-critical count failure to a warning and kept loaded-count fallback behavior. | `src/components/SmartTalk.tsx` |

## Scope Control

No new product features were added. No Firestore schema redesign, routing change, SEO change, desktop workspace change, cookie behavior change, or notification architecture redesign was performed.

## Remaining Verification Gap

Authenticated end-to-end QA is still required for:

- Helpful and Helpful remove.
- Misleading and Misleading remove.
- Save and unsave.
- Comment.
- SmartTalk vote/save/answer.
- Notebook save/delete/sync.
- Profile counters.
- Notifications.
- Refresh persistence and another-session visibility.
