# Release Y.2.3 Root Cause - Notebook Auto-Scroll

Status: root cause identified and fixed in source.

## Bug

Scenario:

```text
Highlight Post A
-> scroll to Post B
-> enable Notebook Highlight
-> page auto-scrolls
```

Notebook activation must never move the page.

## Root cause

The scroll was route-driven, not Firestore-driven and not caused by the highlight renderer.

Before Y.2.3, `KnowledgeCard.handleToggleNotebookMode()` did this when the visible card was not already route-focused:

```text
Notebook button click
-> onOpenEntry(entry.id)
-> App navigates to /post/{entry.id}
-> focusedEntryId changes
-> KnowledgeFeed focused-entry effect runs
-> target.scrollIntoView({ behavior: "smooth", block: "center" })
-> viewport jumps
```

Files involved:

- `src/components/KnowledgeCard/KnowledgeCard.tsx`
- `src/App.tsx`
- `src/context/NotebookContext.tsx`
- `src/components/KnowledgeFeed/KnowledgeFeed.tsx`

The direct scroll call remains valid for explicit post navigation, but Notebook activation must not create that navigation.

## Audited scroll/focus sources

Searched for:

- `scrollIntoView`
- `focus()`
- Selection API
- Range API
- `window.scrollTo`
- element `scrollTo`
- `requestAnimationFrame` scroll
- layout restoration
- virtualization callbacks
- `IntersectionObserver` callbacks

Relevant findings:

| Source | Finding |
| --- | --- |
| `KnowledgeFeed` focused route scroll | Real root cause after Notebook activation changed the route. |
| `KnowledgeFeed` saved scroll restoration | Only runs when no focused entry exists; not caused by Notebook activation. |
| `KnowledgeCardList` virtualization `scrollBy` | Only compensates measured height changes above viewport; Notebook margin does not change card height. |
| `CardContent` Selection/Range | Used only after a paragraph is armed and text is selected; not activation-time scrolling. |
| `CardContent` `requestAnimationFrame` | Schedules selection capture after mouse/touch/key release; no scroll. |
| Programmatic focus in comments/composer/header | Unrelated to Notebook activation. |
| `IntersectionObserver` | Visibility/activity callbacks only; no Notebook activation scroll. |

## Fix

Notebook activation is now passive:

```text
Notebook button click
-> clear any stale browser selection
-> activate Notebook state for the visible card
-> do not route
-> do not call focus()
-> do not call scrollIntoView()
```

Provider state was adjusted so Notebook can be active on a visible knowledge-feed card when there is no route-focused post. It still exits when leaving the knowledge surface, opening another focused post, or closing a previously focused post back to the feed.

## Regression risk

Low to medium.

Low because the fix removes an activation-time route change instead of changing highlight storage, rendering, or Firestore.

Medium only around Notebook lifecycle semantics: allowing passive activation on the current visible card required `NotebookProvider` to distinguish "knowledge feed with no focused post" from "left the knowledge surface." A guard preserves auto-exit when closing an actually focused post.

## Production readiness

Automated build/type checks passed. Browser scroll checks showed zero scroll delta across desktop, tablet, and mobile in the available signed-out browser session. Full authenticated "Highlight Post A -> scroll to Post B -> enable Notebook" validation remains pending because the in-app browser is signed out.
