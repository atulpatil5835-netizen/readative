# Release Y.2.3 Walkthrough - Notebook Auto-Scroll Fix

Status: implemented.

## Files changed

- `src/App.tsx`
- `src/context/NotebookContext.tsx`
- `src/components/KnowledgeCard/KnowledgeCard.tsx`
- `root_cause.md`
- `walkthrough.md`
- `task.md`
- `final_report.md`

No Firestore files, schemas, highlight persistence behavior, My Notes UI, or Notebook visual UI were changed.

## Before

When the user enabled Notebook Highlight on a non-focused visible card, the card first opened the post route:

```text
handleToggleNotebookMode
-> onOpenEntry(entry.id)
-> focusedEntryId updates
-> KnowledgeFeed scrollIntoView effect runs
```

That route scroll was useful for explicit post opening, but wrong for Notebook activation.

## After

Notebook activation stays in place:

```text
handleToggleNotebookMode
-> clear stale browser selection
-> activateNotebook(entry.id)
-> current scroll position remains unchanged
```

The pending sign-in `knowledge-action` path also activates Notebook without routing after sign-in.

## Notebook lifecycle preserved

`NotebookProvider` now receives `isKnowledgeActive`.

Rules:

- If the user leaves Knowledge, Notebook exits.
- If another focused post opens, Notebook exits unless it is that post.
- If a focused post is closed back to the feed, Notebook exits.
- If the user activates Notebook directly on a visible feed card, the provider allows it without forcing a route.

## Selection handling

Activation clears stale browser selection safely:

```ts
window.getSelection()?.removeAllRanges()
```

No `focus()` or `scrollIntoView()` is called. If selection cannot be read, activation remains passive.

## Validation

Automated:

- `npm run build` passed.
- `npx tsc --noEmit` passed.
- Scroll/focus audit rerun after patch.

Browser:

- Desktop viewport: Notebook button click produced `scrollY` delta `0`.
- Tablet viewport: Notebook button click produced `scrollY` delta `0`.
- Mobile viewport: Notebook button click produced `scrollY` delta `0`.
- Console errors: none observed.

Limit:

- The in-app browser is signed out. Clicks reached the sign-in prompt, so full authenticated highlight-then-scroll scenario still needs a signed-in pass.

## Preserved behavior

- Text highlighting preserved.
- Persistence preserved.
- Hydration preserved.
- My Notes preserved.
- Virtualization preserved.
- Notebook visual style preserved.
- Firestore untouched.
