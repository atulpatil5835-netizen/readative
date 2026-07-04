# Release Z.1.1 — Living Desktop Workspace Audit

Status: architecture audit complete. No production implementation has started.

## Scope inspected

- `src/App.tsx`
- `src/components/AppShell.tsx`
- `src/components/Header.tsx`
- `src/components/KnowledgeFeed/FeedRenderer.tsx`
- `src/components/KnowledgeFeed/KnowledgeFeed.tsx`
- `src/components/KnowledgeFeed/KnowledgeJourney.tsx`
- `src/components/KnowledgeCardList.tsx`
- `src/components/KnowledgeCard/KnowledgeCard.tsx`
- `src/components/KnowledgeCard/cardHelpers.ts`

## Current desktop shell

The desktop workspace is activated only for the Knowledge tab at `min-[1400px]`.

- `App.tsx` gives the Knowledge route `max-w-[1400px]` and `px-6` only at `min-[1400px]`.
- `Header.tsx` and `AppShell.tsx` also use `min-[1400px]:max-w-[1400px]`.
- `FeedRenderer.tsx` creates the desktop grid:
  - left rail: `240px`
  - center: `780px`
  - right rail: `280px`
  - gap: `24px`
- Tablet and mobile use the existing single-column feed because both rails are hidden with `hidden min-[1400px]:block`.

## Current rail architecture

### Shared rail primitives

`DesktopRailSection` is a small local component inside `FeedRenderer.tsx`.

Current behavior:

- Always renders a card-like section.
- Uses fixed visual rhythm: rounded section, border, white background, shadow.
- Has no built-in empty-state filtering.

`DesktopRailList` also lives inside `FeedRenderer.tsx`.

Current behavior:

- If items exist, renders links/buttons.
- If items are empty, renders placeholder text: `More context will appear as posts load.`
- This violates the Z.1.1 rule to never render empty cards or placeholders.

### Left rail

`DesktopLeftRail` currently renders:

1. Quick Navigation
2. Reading Progress
3. Continue Reading
4. Trending Categories

Current data sources:

- `desktopEntries`
- `desktopContextEntry`
- `desktopProgressLabel`
- `todayLoadedCount`
- `desktopTagStats`

Current limitations:

- The module order is static.
- `Continue Reading` uses `entries.slice(0, 3)`, which can duplicate the current center article.
- There is no Recently Viewed module.
- There is no Knowledge Stats module.
- There is no reliable Reading Streak signal from existing local data.
- Trending Categories renders placeholder copy when no tags exist.
- The rail is finite and usually shorter than long articles, leaving blank desktop column space below the module stack.

### Right rail

`DesktopRightRail` currently renders:

1. Knowledge Journey
2. Related Posts
3. Same Author
4. Popular Tags

Current data sources:

- `contextEntry`
- `journeyEntries`
- `journeyQuestions`
- `desktopRelatedEntries`
- `desktopSameAuthorEntries`
- `desktopTagStats`

Current limitations:

- The context entry is `focusedEntry || desktopEntries[0] || null`.
- During normal feed scrolling, the rail context does not follow the currently read post unless a focused route is open.
- Related Posts and Same Author render placeholder copy when empty.
- Popular Tags can duplicate the left rail.
- There is no lifecycle from contextual modules to next-step modules.
- There is no distinction between "before article end" and "after article end."
- Some modules can duplicate visible center content.

## Sticky behavior

Both rails use:

```tsx
<div className="sticky top-24 space-y-4">
```

Current behavior:

- The whole rail stack sticks near the top of the viewport.
- There is no rail max-height.
- There is no internal rail scroll.
- There is no module replacement as the user scrolls.
- If the rail stack is shorter than the article, the rest of the left/right columns are visually empty.

Root cause of the reported problem:

- The center feed can contain long articles and virtualized content far taller than the rail stacks.
- The rails are static finite stacks.
- No lifecycle or replenishment logic exists to keep useful modules visible through long reading sessions.

## Scroll containers

The feed uses the window as the primary scroll container.

Existing scroll-related behavior:

- `KnowledgeFeed.tsx` has a scroll listener for the Back-to-Top/Refresh affordance.
- `KnowledgeFeed.tsx` persists feed scroll position with a scroll listener and `requestAnimationFrame`.
- `KnowledgeCardList.tsx` listens to window scroll/resize for virtualization.
- `KnowledgeCardList.tsx` uses `ResizeObserver` to measure card rows.
- The desktop rails do not have their own scroll lifecycle.

Z.1.1 implication:

- Adding new scroll listeners, polling, timers, or intervals would violate the release rules.
- A safe implementation must reuse existing loaded data and existing visibility signals instead of adding another scroll-observation system.

## Virtualization

The center feed is virtualized by `KnowledgeCardList`.

Important details:

- Rows are absolutely positioned.
- Row height is estimated first, then measured.
- `renderAfterCard` inserts an inline `KnowledgeJourney` after each card.
- `estimateAfterCardHeight` includes the estimated Knowledge Journey height.
- When measured height changes above the viewport, `KnowledgeCardList` scroll-compensates with `window.scrollBy`.

Z.1.1 implication:

- Rails live outside the virtualized center column and can be improved without changing virtualizer internals.
- Do not move rail content into virtualized rows.
- Do not change `KnowledgeCardList` measuring, offsets, overscan, or row positioning.

## Existing cached and loaded data

Safe available data:

- `filteredEntries`
- `visibleEntries`
- `desktopEntries`
- `focusedEntry`
- `journeyEntries`
- `journeyQuestions`
- `profiles`
- `activeFeedTopic`
- `activeCategory`
- `selectedHashtag`
- loaded entry metadata: author, authorId, category, hashtags, comments, createdAt, updatedAt

Potential derived modules from existing data:

- Recently Viewed: can be derived from the existing `onVisibleEntry` path if we store a tiny in-memory list of recently visible entry ids.
- Knowledge Stats: can be derived from loaded entry counts, unique authors, tag count, and topic/category count.
- More From Author: already derivable from loaded entries.
- Related Posts: already derivable from loaded entries.
- Popular Discussions: derivable from loaded `journeyQuestions`.
- Top Contributors: derivable from loaded entries plus already loaded profiles.
- Explore Category: derivable from `activeCategory` or the current entry category.
- Recommended Reading / Continue Learning / What's Next: derivable from loaded entries excluding the current center/context entry.

Unsafe or unavailable without changing scope:

- True reading streak across days, unless an existing reliable local/account activity signal is already available.
- Exact article-section progress or article-end detection, unless adding new observation logic.
- Any recommendations requiring Firestore reads or external data.

## Existing visibility lifecycle

`KnowledgeCard` already observes card visibility once:

- `KnowledgeCard` calls `observeEntryVisibilityOnce`.
- It calls `onVisible(entry)` the first time the card becomes visible.
- `KnowledgeCardList` passes that up.
- `FeedRenderer` passes `onVisibleEntry` down.
- `KnowledgeFeed.handleVisibleEntry` currently uses it for:
  - marking an entry seen
  - deciding whether to auto-load more entries

Z.1.1 opportunity:

- The existing visibility callback can be reused to update a small desktop context/recently-viewed state without adding new listeners.

Z.1.1 limitation:

- The callback is card-level and fires once per card.
- It cannot precisely detect lower sections of a long article.
- Precise paragraph/section progress would require new scroll/IntersectionObserver work and should not be implemented under the strict performance rules.

## Root causes

1. Rails are static finite stacks.
2. Rail content is not driven by the currently visible/reading context.
3. Empty data paths render placeholder text instead of hiding modules.
4. Right rail duplicates or exhausts context quickly.
5. Left rail lacks progressive modules such as recently viewed and stats.
6. Sticky rails have no lifecycle or replenishment strategy.
7. The current implementation has no safe article-lower-section signal.

## Recommended minimal architecture

After approval, implement Z.1.1 as a desktop-only rail composition improvement.

Core principles:

- Keep the existing `min-[1400px]` gate.
- Keep the 240 / 780 / 280 desktop grid.
- Keep the center feed and virtualization untouched.
- Reuse already loaded entries, questions, profiles, and current feed state.
- Reuse the existing card visibility callback if dynamic context is required.
- Filter out empty modules instead of rendering placeholders.
- Exclude the current context entry from recommendation lists.
- Avoid duplicate modules between left and right rails.
- Do not implement precise article-end tracking if it requires new listeners or observers.

## Recommended module strategy

Left rail:

1. Quick Navigation
2. Reading Progress
3. Continue Reading
4. Recently Viewed
5. Trending Categories
6. Knowledge Stats

Conditionally skip:

- Recently Viewed when no recent visible entries exist.
- Trending Categories when no tag/category stats exist.
- Knowledge Stats only if fewer than two stats are available.
- Reading Streak unless a real existing signal is found.

Right rail:

Primary contextual modules:

1. Knowledge Journey
2. Related Posts
3. More From Author
4. Related SmartTalk / Popular Discussions

Follow-up modules:

1. What's Next
2. Continue Learning
3. Explore Category
4. Recommended Reading
5. Top Contributors

Conditionally skip:

- Any module with no real loaded data.
- Modules duplicating the current center article.
- Modules duplicating an already rendered rail section.

## Audit conclusion

The desktop workspace can be made to feel alive without new Firestore reads, listeners, polling, timers, routing changes, or virtualization changes.

The safest implementation is a desktop-only rail module composition pass in `FeedRenderer.tsx`, with an optional small recently-viewed/context state addition in `KnowledgeFeed.tsx` that reuses the existing card visibility callback.
