# Release Y.2.1 Performance Audit

Status: audit only; no optimization or source refactor performed.

Measurement note: this audit used static source-level tracing and Firestore call counting. No authenticated browser profiling session or admin Firestore inspection was available in this turn, so live document creation/read confirmation remains a required approval-stage QA step.

## Summary

My Notes is not using realtime listeners and is not doing one Firestore query per post. The heavier feel comes from:

1. A global notebook count aggregation that runs when app identity exists, not only when My Notes is opened.
2. My Notes refetching its first page every time the notes section remounts.
3. A second Firestore query for the corresponding `knowledge` posts on every page load.
4. Multiple React state updates during load, pagination, and delete.
5. Development `StrictMode` can double-run mount effects in local/dev testing.

## Firestore reads and writes

### Initial app/profile load

`NotebookProvider` is mounted around the entire app (`src/App.tsx:415-687`). When `identity?.authorId` exists, it calls `loadNotebookPostCount()` through a dynamic import (`src/context/NotebookContext.tsx:58-84`).

Effect:

- One aggregation query against `userNotebook/{uid}/posts`.
- This can happen before the user opens Profile or My Notes.
- This is not a realtime listener.
- It can also run while identity is still being reconciled from localStorage to Firebase auth.

### Opening My Notes

`ProfileMyNotes` is lazy imported (`src/components/Profile.tsx:90`) and rendered only for:

```text
section === "notes" && isOwnProfile && currentIdentity?.authorId
```

Evidence: `src/components/Profile.tsx:1974-1981`.

On mount:

1. `loadMyNotes(userId)` runs once (`src/components/ProfileMyNotes.tsx:32-55`).
2. `loadMyNotes()` performs one query to `userNotebook/{uid}/posts`, ordered by document id, limited to 12 (`src/highlights/repository.ts:87-108`).
3. `loadNotePosts(postIds)` performs one `knowledge` query with `where(documentId(), "in", postIds.slice(0, 12))` (`src/highlights/repository.ts:111-123`).

First page cost:

| Source | Query count | Document reads |
| --- | ---: | ---: |
| Notebook post docs | 1 | Up to 12 |
| Knowledge post docs | 1 | Up to 12 |
| Count badge | 0 additional on open if already loaded; otherwise one aggregation from provider | Aggregation billed separately |

This is not an N+1 query pattern. It is a two-query page load.

### Load more

`handleLoadMore()` repeats the same two-query pattern for the next page (`src/components/ProfileMyNotes.tsx:57-75`).

The implementation deduplicates rows by `postId` before appending (`ProfileMyNotes.tsx:63-66`).

### Delete

`handleDelete()` deletes the notebook post document (`ProfileMyNotes.tsx:78-96`) and then calls `unmarkPostHasHighlights()`, which refreshes the global count (`NotebookContext.tsx:86-91`).

Write behavior:

- One delete against `userNotebook/{uid}/posts/{postId}`.
- One count aggregation refresh after delete.

### Highlight creation

`saveNotebookHighlight()` uses a transaction (`src/highlights/repository.ts:57-80`):

- Reads the existing notebook post document.
- Appends/sorts one semantic highlight in the in-document `highlights` array.
- Writes the whole updated document.

No writes occur during pointer movement. No `selectionchange` listener writes exist.

## Listener audit

Notebook/highlight-specific listeners:

- `src/highlights/repository.ts`: no `onSnapshot`.
- `src/components/ProfileMyNotes.tsx`: no `onSnapshot`.
- `src/components/KnowledgeCard/CardContent.tsx`: no `onSnapshot`.
- `src/context/NotebookContext.tsx`: no `onSnapshot`.

Existing app listeners remain in unrelated surfaces such as notifications, feed, SmartTalk, and Profile. This audit did not change or optimize those because they are outside Y.2.1 scope.

## Duplicate query risks

| Risk | Cause | Severity |
| --- | --- | --- |
| Count aggregation before My Notes opens | Provider refreshes count globally when identity exists. | Medium |
| Repeated first-page reads on returning to My Notes | `ProfileMyNotes` unmounts/remounts and has no cache. | Medium |
| Dev-only duplicate loads | React `StrictMode` wraps App in `src/main.tsx:10-16`. | Low in production, noisy in local QA |
| Auth reconciliation read failures | Local identity exists before Firebase auth state is confirmed. | Medium |
| One `in` query with 12 ids | Page size is 12; current Firebase SDK supports larger `in` lists, but this should remain a watched limit. | Low |

## React render audit

### Profile initial render

My Notes component code is lazy and not rendered until the notes section is selected. Profile still reads notebook count through `useInk()` compatibility naming (`src/components/Profile.tsx:88`, `src/components/Profile.tsx:836`, `src/components/Profile.tsx:1923-1929`), backed by `NotebookContext`.

### My Notes mount

Expected render phases:

1. Initial render with skeleton/loading.
2. State updates for notes, posts, cursor, hasMore.
3. Final loading state update.

React may batch some updates, but there is no memoization of note rows. Every parent state update recomputes previews:

- `src/components/ProfileMyNotes.tsx:131-134` calls `getNotebookPreview()` for each visible row.
- `src/highlights/paragraphs.ts:80-107` splits content, rebuilds paragraph ids, sorts highlights, and slices text.

For 12 rows this is acceptable, but it is work repeated on every My Notes rerender.

### Feed scrolling and highlight restoration

Focused card restoration is bounded:

- `CardContent` reads notebook data only when `isFocusedPost && currentUserId` (`src/components/KnowledgeCard/CardContent.tsx:61-88`).
- Ordinary feed cards do not read highlight docs.
- Virtualization/pagination is therefore preserved, but saved highlights are not displayed in non-focused cards.

## Expected savings from minimal fixes

| Fix | Firestore savings | Render savings | Bundle impact |
| --- | --- | --- | --- |
| Defer notebook count until Profile/My Notes badge is visible or cache it after first load | Avoids one aggregation on unrelated startup/profile paths | Fewer provider value updates | Near 0 |
| Cache My Notes first page for the current user while Profile is mounted | Saves repeated first-page notebook and knowledge queries on tab return | Avoids skeleton/load rerenders | Near 0 |
| Memoize note row preview by `post.id + highlights` | None | Avoids repeated preview parsing on state-only rerenders | Near 0 |
| Gate reads/writes on confirmed Firebase auth state | Avoids denied reads/writes caused by stale local identity | Fewer error-state rerenders | Near 0 |

## Bundle impact

No package changes were found in `package.json` or `package-lock.json` for the Y.2 notebook implementation. The notebook repository remains dynamically imported from focused card and provider paths. My Notes is lazy loaded from Profile.

Expected bundle impact for the recommended minimal fixes: under 1 KB gzip, likely effectively zero, because the changes are rules/auth gating, caching/memoization, and no new dependency.

## Production readiness

Not production-ready until the P0 persistence gate is verified with a signed-in account against deployed Firestore rules.
