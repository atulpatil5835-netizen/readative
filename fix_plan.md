# Release Y.2.1 Minimal Fix Plan

Status: proposed only. Do not implement until approved.

## Goals

- Restore highlight persistence after refresh/reopen.
- Keep the Y.2 semantic model unchanged.
- Keep My Notes lazy and bounded.
- Avoid routing, schema, UI redesign, dependency, ranking, SmartTalk, Explore, Profile logic, auth provider, SEO, downloader, or performance-architecture changes.

## Minimal fix sequence

### 1. Verify and deploy Firestore rules for `userNotebook`

Add or deploy owner-only access for:

```text
userNotebook/{uid}/posts/{postId}
```

Required rule behavior:

- Signed-in user can read their own notebook posts.
- Signed-in user can write their own notebook posts.
- User cannot read/write another user's notebook posts.
- Guest/unauthenticated requests are denied.

No schema change required.

Expected impact:

- Firestore writes become durable.
- Refresh reads return the same semantic highlights.
- Bundle impact: 0.
- Runtime render impact: 0.

### 2. Gate notebook reads/writes on confirmed Firebase auth

Current notebook logic trusts `KnowledgeIdentity` from localStorage. Minimal code change should ensure the notebook interaction is enabled only when Firebase auth has reconciled to the same user id.

Expected impact:

- Removes denied reads/writes caused by stale or pre-auth local identity.
- Reduces noisy Firestore errors and failed count aggregations.
- Bundle impact: near 0.

### 3. Make save success/failure deterministic

Keep the current calm UI. Do not add a toolbar or redesign.

Minimal acceptable options:

1. Keep optimistic mark, but guarantee rollback and status/error state are visible enough for QA.
2. Or apply the mark only after transaction success.

Recommendation: prefer option 1 if the rollback is reliable after auth/rules are fixed, because it preserves the current instant reading interaction.

Expected impact:

- Prevents false confidence when Firestore rejects the write.
- No schema change.
- No extra listener.

### 4. Keep restoration scoped to focused posts unless explicitly approved otherwise

Current performance depends on loading notebook documents only for the focused card.

If product expectation is "highlights must display on every feed card after refresh," that is a separate approved change because it increases read pressure and virtualization risk.

Minimal Y.2.1 recommendation:

- Restore on focused `/post/{id}`.
- My Notes previews continue to show highlighted posts.
- Ordinary feed cards stay read-free.

### 5. Reduce My Notes repeat reads without schema changes

Minimal performance fix:

- Cache the first My Notes page per current user while Profile/My Notes remains mounted.
- Memoize preview calculation per row.
- Avoid refreshing notebook count on unrelated startup surfaces if the badge is not visible, or cache count after first successful load.

No Firestore schema change.
No new dependency.
No listener.

## Validation plan after approval

1. Signed-in highlight creation on focused post.
2. Confirm Firestore document exists at `userNotebook/{uid}/posts/{postId}`.
3. Refresh `/post/{postId}` and confirm mark rehydrates.
4. Close/reopen app and confirm mark rehydrates after auth reconciliation.
5. Open My Notes and confirm one card per highlighted post.
6. Confirm My Notes first page does not refetch on simple tab return if cache is implemented.
7. Confirm no notebook `onSnapshot` listeners were added.
8. Confirm `npm run build`.
9. Confirm `npx tsc --noEmit`.
10. Confirm `git diff --check`.

## Regression risk

| Fix | Risk |
| --- | --- |
| Firestore rules deployment | Low code risk, high deployment importance. |
| Auth gating | Medium; must avoid breaking already signed-in flows. |
| Save success rollback/status | Low; localized to CardContent. |
| My Notes cache/memo | Low; localized to ProfileMyNotes or NotebookContext. |
| Feed-wide restoration | Medium/high; do not include in Y.2.1 unless separately approved. |

## Expected savings

- Firestore: one avoided denied count/read/write per stale identity startup; repeated My Notes tab returns can avoid the first-page two-query reload.
- React: fewer provider count updates and fewer repeated preview computations.
- Bundle: under 1 KB gzip; no new dependency.
