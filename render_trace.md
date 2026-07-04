# Release Y.2.1 Render Trace

Status: audit only; no rendering code changed.

## React tree

```text
App
-> NotebookProvider
   -> KnowledgeFeed / Profile / Explore / SmartTalk
      -> KnowledgeCard
         -> CardTrust
         -> CardContent
            -> highlightNotebookReactTree
```

Evidence:

- `src/App.tsx:413-688`
- `src/components/KnowledgeCard/KnowledgeCard.tsx:111-152`
- `src/components/KnowledgeCard/KnowledgeCard.tsx:1330-1358`
- `src/components/KnowledgeCard/CardContent.tsx:35-394`

## Notebook mode render path

1. `KnowledgeCard` reads `activePostId` from `NotebookContext`.
   - `src/components/KnowledgeCard/KnowledgeCard.tsx:125-131`
2. Notebook mode is true only when the card is focused and active.
   - `KnowledgeCard.tsx:131`
3. `CardTrust` renders the toolbar icon.
   - `src/components/KnowledgeCard/CardTrust.tsx:48-67`
4. `CardContent` renders the tiny margin indicator only when `isFocusedPost && isNotebookMode`.
   - `src/components/KnowledgeCard/CardContent.tsx:252-263`
5. Paragraph text itself is not repositioned; the indicator is absolutely positioned outside the paragraph block.
   - `CardContent.tsx:251-264`
   - `src/index.css:93-112`

## Normal mode render path

Normal mode has no notebook margin controls. Existing paragraph separators remain driven by:

- `src/components/KnowledgeCard/CardContent.tsx:244-250`

The highlight CSS itself uses zero margin, zero border, zero padding, inherited font/line-height, and a flat translucent yellow background:

- `src/index.css:78-91`

That is consistent with the zero layout-shift requirement.

## Highlight hydration path

1. `highlights` starts as local component state.
   - `CardContent.tsx:52`
2. Load effect clears highlights when not focused or no current user.
   - `CardContent.tsx:61-67`
3. Focused signed-in card loads persisted highlights.
   - `CardContent.tsx:70-75`
4. Paragraph ids are built from `contentSections`.
   - `CardContent.tsx:56-59`
   - `src/highlights/paragraphs.ts:23-31`
5. Each paragraph filters highlights by id and rendered length.
   - `CardContent.tsx:230-236`
6. If any valid highlights remain, `highlightNotebookReactTree()` clones/render-splits the rich text tree with `<mark>` nodes.
   - `CardContent.tsx:282-287`
   - `src/highlights/highlightReactTree.tsx:26-88`

## Exact render failure points

| Failure | Exact component | Evidence |
| --- | --- | --- |
| No read after refresh | `CardContent` load effect | `CardContent.tsx:61-88` |
| Read occurs but state is empty | `repository.normalizeHighlights()` | `repository.ts:37-44` |
| State exists but no paragraph highlight | `CardContent` paragraph filter | `CardContent.tsx:232-236` |
| Paragraph highlight exists but no mark | `highlightNotebookReactTree()` range intersection | `highlightReactTree.tsx:34-63` |
| My Notes preview unavailable | `getNotebookPreview()` | `paragraphs.ts:80-107` |

## Pointer and gesture handling

The new interaction no longer uses the Y.1 freehand layer. Current pointer/selection behavior is:

- Margin button arms one paragraph.
- Selection capture runs on mouse/touch/key release for that paragraph.
- Selection outside the armed paragraph is cleared.
- No SVG/canvas/freehand stroke preview code is involved in `CardContent`.

Evidence:

- `src/components/KnowledgeCard/CardContent.tsx:101-154`
- `src/components/KnowledgeCard/CardContent.tsx:264-280`

Potential conflict:

- The paragraph class becomes `select-none` while notebook mode is active but the paragraph is not armed (`CardContent.tsx:276-280`).
- This avoids accidental text selection across paragraphs, but if touch selection handles fire delayed events, the save attempt may happen after notebook mode has already exited.

## Focus and auto-exit trace

Auto-exit is handled by `NotebookContext` and unmount cleanup:

- Focused post mismatch clears active notebook mode (`src/context/NotebookContext.tsx:44-47`).
- Escape clears active notebook mode (`NotebookContext.tsx:49-56`).
- `CardContent` unmount exits notebook mode if active (`src/components/KnowledgeCard/CardContent.tsx:94-99`).
- Route changes update `activeTab`/`focusedEntryId`, which changes provider `focusedPostId` (`src/App.tsx:125-133`, `src/App.tsx:415-418`).

## Render bottlenecks

| Area | Cost | Current scope |
| --- | --- | --- |
| Focused post hydration | One Firestore doc read and paragraph filtering. | Bounded to focused card. |
| Paragraph highlight rendering | Recursively clones rich text tree when highlights exist. | Bounded by paragraph text/highlight count. |
| My Notes previews | Splits content and rebuilds paragraph ids per row render. | Up to 12 rows per page, repeated on rerender. |
| Count badge | Provider value updates whenever count refreshes. | Global provider, can rerender consumers. |

## Virtualization risk

The current implementation preserves virtualization by avoiding per-card highlight reads in the ordinary feed. If a future fix renders persisted highlights in all feed cards, that change must include caching and viewport-aware reads; otherwise it risks N reads per visible/virtualized card.
