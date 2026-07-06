# Release H2 Task Checklist

Status: code fixes applied; local validation passed; authenticated Firestore E2E QA remains blocked by missing signed-in browser credentials.
Date: 2026-07-06

## Root trace

- [x] Trace `KnowledgeCard -> updateHelpful -> toggleKnowledgeEntryLike -> runTransaction -> Firestore -> repository result -> UI update`.
- [x] Trace `KnowledgeCard -> updateMisleading -> toggleKnowledgeEntryMisleading -> runTransaction -> Firestore -> repository result -> UI update`.
- [x] Capture collection and document paths in repository results.
- [x] Capture transaction callback attempt counts in touched transaction paths.
- [x] Document notification side-effect paths.
- [x] Document UI rollback behavior.
- [x] Fix confirmed Helpful/Misleading defects only.

## Firestore read audit

- [x] Enumerate `getDoc`, `getDocs`, `onSnapshot`, and `runTransaction` call sites.
- [x] Verify feed listener and pagination limits.
- [x] Verify SmartTalk listener and pagination limits.
- [x] Verify notification listener limit and fallback behavior.
- [x] Verify notebook read paths.
- [x] Verify profile read paths.
- [x] Leave broad read/cache redesign as recommendation only.

## Firestore write audit

- [x] Helpful write path repaired.
- [x] Misleading write path repaired.
- [x] Save write path repaired.
- [x] Comment write path repaired.
- [x] Publish notification coupling repaired.
- [x] SmartTalk vote duplicate-click and silent-failure path repaired.
- [x] SmartTalk save duplicate-click and silent-failure path repaired.
- [x] Test helper now deletes its temporary Firestore post after execution.

## Interaction integrity

- [x] Helpful code path repaired.
- [x] Helpful remove code path repaired.
- [x] Misleading code path repaired.
- [x] Misleading remove code path repaired.
- [x] Comment code path repaired.
- [x] Bookmark/save code path repaired.
- [x] SmartTalk Helpful/Misleading vote code path repaired.
- [x] SmartTalk save code path repaired.
- [x] SmartTalk answer/reply error handling repaired.
- [x] Confirm standalone post reply is not implemented.
- [x] Confirm standalone SmartTalk comment/like surfaces are not implemented.
- [ ] Authenticated Helpful E2E after refresh.
- [ ] Authenticated Misleading E2E after refresh.
- [ ] Authenticated Save E2E after refresh.
- [ ] Authenticated Comment E2E after refresh.
- [ ] Authenticated SmartTalk vote/save/reply E2E after refresh.
- [ ] Authenticated Notebook save/delete/sync E2E after refresh.
- [ ] Authenticated Profile counters E2E after refresh.
- [ ] Authenticated Notifications E2E with existing notifications.

## Validation

- [x] `npm run build`
- [x] `npx tsc --noEmit`
- [x] `npx tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false`
- [x] `git diff --check`
- [x] Desktop smoke QA on production preview.
- [x] Tablet smoke QA on production preview.
- [x] Mobile smoke QA on production preview.
- [x] Console-error smoke QA on Home, SmartTalk, Explore, and Profile.

## Reports

- [x] `firestore_trace.md`
- [x] `firestore_optimization_report.md`
- [x] `interaction_audit.md`
- [x] `performance_report.md`
- [x] `walkthrough.md`
- [x] `task.md`
- [x] `final_report.md`

## Stop condition

H2 should not be marked fully production-complete until the implemented signed-in interactions are verified end-to-end with a real authenticated session after refresh. Local build/type/browser smoke gates are clean.
