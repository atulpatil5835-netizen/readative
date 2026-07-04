# Release Y.2.1 Firestore Trace

Status: audit only; no Firestore data was written or migrated.

## Storage path

The current semantic highlight storage is:

```text
userNotebook/{userId}/posts/{postId}
```

The document stores:

```ts
{
  highlights: NotebookHighlight[]
}
```

Each highlight contains only:

```text
postId
paragraphId
startOffset
endOffset
color
createdAt
```

Evidence:

- `src/highlights/types.ts:4-15`
- `src/highlights/types.ts:17-49`
- `src/highlights/repository.ts:29-35`
- `src/highlights/repository.ts:74-78`

No pixels, SVG paths, pointer geometry, canvas data, or coordinates are stored in the new repository.

## Highlight creation trace

1. User toggles Notebook Highlight from the card trust row.
   - `src/components/KnowledgeCard/CardTrust.tsx:48-67`
   - `src/components/KnowledgeCard/KnowledgeCard.tsx:136-152`
2. If the card is not focused, the card opens as focused before activation.
   - `KnowledgeCard.tsx:147-151`
3. Margin indicator arms a paragraph.
   - `src/components/KnowledgeCard/CardContent.tsx:252-262`
4. Selection is captured only inside the armed paragraph.
   - `CardContent.tsx:101-154`
5. A semantic highlight object is created.
   - `CardContent.tsx:155-162`
6. React state is updated optimistically.
   - `CardContent.tsx:169-172`
7. Repository is lazy imported and `saveNotebookHighlight(currentUserId, entry.id, highlight)` is called.
   - `CardContent.tsx:174-177`
8. Firestore transaction reads the current post document.
   - `src/highlights/repository.ts:62-67`
9. Transaction rejects duplicates and per-post cap overflow.
   - `repository.ts:68-73`
10. Transaction writes the updated `highlights` array.
   - `repository.ts:74-80`
11. If this is the first highlight for the post, the provider refreshes notebook post count.
   - `CardContent.tsx:178-180`
   - `src/context/NotebookContext.tsx:86-91`

## Per-highlight verification matrix

| Check | Code-level answer | Notes |
| --- | --- | --- |
| Did Firestore receive a write attempt? | Yes after a valid selection when `currentUserId`, focus, notebook mode, armed paragraph, and ready state are all true. | `CardContent.tsx:101-109`, `CardContent.tsx:174-177` |
| Was the document created? | Not in the failing persistence scenario. | The most likely blocker is missing/undeployed owner rules for `userNotebook`, plus possible auth-state mismatch during local identity bootstrap. |
| Correct collection? | Yes. | `userNotebook` in `repository.ts:29-35`. |
| Correct user? | Yes after Google auth reconciliation; risky before auth is confirmed. | App starts from localStorage identity at `App.tsx:109-111`; Google profile maps to `user.uid` at `googleAuth.ts:121-126` and `userProfiles.ts:487-565`. |
| Correct postId? | Yes. | Save/read both use `entry.id`; routes build `/post/{focusedEntryId}`. |
| Correct paragraph? | Yes for unchanged content. | `buildNotebookParagraphIds()` hashes normalized section text and occurrence. |

## Page refresh trace

### Route and focus

1. Route parsing extracts `/post/{id}` into `focusedEntryId`.
   - `src/utils/routes.ts:258-271`
2. App syncs route state and stores `focusedEntryId` only for knowledge routes.
   - `src/App.tsx:125-133`
3. `NotebookProvider` receives `focusedPostId={activeTab === "knowledge" ? focusedEntryId : null}`.
   - `src/App.tsx:415-418`

### Firestore read

1. `CardContent` runs its load effect.
   - `src/components/KnowledgeCard/CardContent.tsx:61-88`
2. If `!isFocusedPost || !currentUserId`, it clears local highlights and exits.
   - `CardContent.tsx:61-67`
3. Otherwise it lazy imports the repository and calls `loadNotebookPost(currentUserId, entry.id)`.
   - `CardContent.tsx:70-72`
4. Repository performs one `getDoc()` against `userNotebook/{uid}/posts/{postId}`.
   - `src/highlights/repository.ts:52-55`
5. The document is normalized and filtered to highlights matching the post id.
   - `repository.ts:37-44`

### React hydration and rendering

1. Loaded highlights enter local React state.
   - `CardContent.tsx:73-75`
2. Each paragraph computes its id and rendered text length.
   - `CardContent.tsx:230-236`
3. Highlights for that paragraph are filtered by `paragraphId` and `endOffset`.
   - `CardContent.tsx:232-236`
4. Valid highlights are rendered through `highlightNotebookReactTree()`.
   - `CardContent.tsx:282-287`
   - `src/highlights/highlightReactTree.tsx:26-88`

## Page refresh verification matrix

| Step | YES/NO | Reason |
| --- | --- | --- |
| Does Firestore read execute after refresh? | Yes only on a focused post with a current user id. No for home feed/profile/non-focused cards. | `CardContent.tsx:61-88` |
| Does query return data? | Only if `userNotebook/{uid}/posts/{postId}` exists and deployed rules allow read. | `repository.ts:52-55` |
| Does React receive data? | Yes if the promise resolves with normalized highlights. | `CardContent.tsx:73-75` |
| Does renderer receive data? | Yes only after paragraph id and offset validation. | `CardContent.tsx:232-287` |
| If rendering fails, exact component? | `CardContent` first, then `highlightNotebookReactTree` if no mark segments intersect text nodes. | `CardContent.tsx:61-88`, `CardContent.tsx:232-287`, `highlightReactTree.tsx:26-88` |

## Post identifier matching

| Identifier | Usage | Match status |
| --- | --- | --- |
| `postId` | Stored inside each highlight. | Matches `entry.id` at creation. |
| `entry.id` | Firestore post document id and route id. | Save and read use the same value. |
| `slug` | Not used by notebook persistence. | No slug mismatch found. |
| `route` | `/post/{entry.id}` or knowledge focused route. | Routes preserve the id as `focusedEntryId`. |
| `collection` | `knowledge` for posts, `userNotebook` for highlights. | Correct separation. |

## My Notes Firestore trace

Opening My Notes performs:

1. One query to `userNotebook/{uid}/posts`, ordered by document id, limit 12.
   - `src/highlights/repository.ts:87-108`
2. One query to `knowledge` with the returned post ids.
   - `repository.ts:111-123`

It does not fetch every post individually. It does not attach a listener.

Returning to My Notes repeats those reads because no cache is retained.

## Firestore impact

- Maximum one notebook document per user/post.
- One transaction per new highlight.
- One document read plus one document write inside that transaction.
- My Notes first page: up to 12 notebook document reads plus up to 12 knowledge document reads.
- No extra Firestore listeners introduced by Notebook Highlight.
- Count badge: one aggregation query when provider refreshes the count.
