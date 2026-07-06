# Release H2 Firestore Trace

Status: code-level trace complete; authenticated runtime write trace still requires a signed-in browser session.
Date: 2026-07-06

## Helpful path

Execution path:

1. `KnowledgeCard` receives a Helpful click through `handleHelpful()`.
2. `handleHelpful()` resolves the current `KnowledgeIdentity`.
3. `updateHelpful(shouldLike, actorIdentity)` blocks duplicate trust writes with `isUpdatingTrust`.
4. `toggleKnowledgeEntryLike()` opens a Firestore transaction.
5. Transaction reads `knowledge/{entry.id}`.
6. Transaction writes synchronized trust fields on `knowledge/{entry.id}`:
   - `likes`
   - `likeCount`
   - `helpfulIds`
   - `helpfulCount`
   - `dislikes`
   - `dislikeCount`
   - `misleadingIds`
   - `misleadingCount`
7. Repository returns persisted arrays plus trace metadata.
8. UI updates local Helpful/Misleading arrays and counts from the repository result only.
9. Profile `likedKnowledgeIds` tracking runs best-effort after the primary post transaction.
10. Like and milestone notifications run best-effort after the primary transaction.

Repository result shape now includes:

```ts
{
  collectionName: "knowledge",
  documentPath: "knowledge/{entryId}",
  helpfulIds: string[],
  misleadingIds: string[],
  profileDocumentPath: "userProfiles/{actorId}",
  transactionAttempts: number
}
```

## Misleading path

Execution path:

1. `KnowledgeCard` receives a Misleading click through `handleMisleading()`.
2. `handleMisleading()` resolves the current `KnowledgeIdentity`.
3. `updateMisleading(shouldMarkMisleading, actorIdentity)` blocks duplicate trust writes with `isUpdatingTrust`.
4. `toggleKnowledgeEntryMisleading()` opens a Firestore transaction.
5. Transaction reads `knowledge/{entry.id}`.
6. Transaction writes synchronized trust fields on `knowledge/{entry.id}`.
7. Repository returns persisted Helpful/Misleading arrays plus trace metadata.
8. UI updates local Helpful/Misleading arrays and counts from the repository result only.
9. If the actor previously marked the post Helpful, profile cleanup runs best-effort after the primary post transaction.

Repository result shape now includes:

```ts
{
  collectionName: "knowledge",
  documentPath: "knowledge/{entryId}",
  helpfulIds: string[],
  misleadingIds: string[],
  profileDocumentPath: "userProfiles/{actorId}",
  transactionAttempts: number
}
```

## Captured Fields

| Field | H2 result |
| --- | --- |
| Current authenticated UID | Passed as `actorIdentity.authorId`; for Google sessions this is Firebase `user.uid`. A concrete live UID was not captured because signed-in QA is credential-blocked. |
| Helpful document path | `knowledge/{entry.id}` |
| Helpful collection name | `knowledge` |
| Misleading document path | `knowledge/{entry.id}` |
| Misleading collection name | `knowledge` |
| Profile document path | `userProfiles/{actorId}` |
| Transaction retries | `transactionAttempts` increments each time the Firestore transaction callback executes. A value above 1 means the SDK retried the transaction callback. |
| Firestore error code | Original Firestore/Firebase error object is preserved in the catch path. No Firestore write error was produced in unauthenticated smoke QA because no write was attempted. |
| Firestore error message | Original error message is preserved in the catch path and user-facing fallback text is shown. |
| Repository return value | Helpful/Misleading now return persisted arrays and trace metadata instead of `void`. |
| Profile tracking path | `userProfiles/{actorId}.likedKnowledgeIds` is best-effort after the post trust transaction so profile-rule failures cannot block Helpful/Misleading. |
| Notification execution path | Notifications run after the transaction with dynamic imports and are best-effort. Notification failure logs a warning and does not roll back the primary write. |
| UI rollback path | There is no optimistic trust update to roll back. On failure, existing UI state is left unchanged and a visible message is shown. |

## Other touched transaction paths

`toggleKnowledgeSave()` now returns:

```ts
{
  collectionName: "knowledge",
  documentPath: "knowledge/{entryId}",
  profileDocumentPath: "userProfiles/{actorId}",
  savedBy: string[],
  saveCount: number,
  transactionAttempts: number
}
```

`toggleSmartTalkSave()` now returns:

```ts
{
  collectionName: "smarttalk",
  documentPath: "smarttalk/{questionId}",
  profileDocumentPath: "userProfiles/{actorId}",
  savedBy: string[],
  saveCount: number,
  transactionAttempts: number
}
```

SmartTalk answer voting now returns an internal result object:

```ts
{
  collectionName: "smarttalk",
  documentPath: "smarttalk/{questionId}",
  saved: boolean,
  transactionAttempts: number
}
```

## Confirmed Root Causes

1. Post Helpful and Misleading used optimistic local UI/count updates before the Firestore transaction result was known.
2. Production rules can reject the profile tracking write; when that write is inside the same transaction it causes the primary Helpful/Misleading post update to fail.
3. Post Save used optimistic UI/count updates before the Firestore transaction result was known.
4. Comment and publish success paths awaited notification writes inside primary write success flows, so notification failure could falsely appear as primary interaction failure.
5. SmartTalk answer voting silently returned when a discussion document was missing and did not block duplicate vote clicks.
6. SmartTalk save and post-sign-in continuation swallowed failures with console-only handling.
7. The temporary Firestore test helper created a public `Temporary Test Post` without cleanup; future runs now delete their test document.

## Runtime QA Limitation

Production preview smoke QA was read-only and did not perform real Helpful/Misleading writes. A signed-in browser session is still required to capture a concrete UID, live transaction attempts, Firestore error code/message if any, refresh persistence, and another-session visibility.
