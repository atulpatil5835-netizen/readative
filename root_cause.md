# Readative Release X.1 Root Cause

Date: 2026-06-27

## Incident

Explore -> Most Helpful Posts displayed a white rounded artifact on the left side of each post row.

## Exact DOM Element

The artifact came from the post link rendered by `DiscoveryPostList` in `src/components/Explore.tsx`:

```tsx
<a href={`/post/${entry.id}`} className="w-full ... bg-white ... rounded-2xl ...">
```

The browser computed this anchor as `display: inline`. Although the class included `w-full`, CSS width does not size a normal inline element as a full-width row. Its white background, border, padding, and radius were painted across multiple inline fragments.

Before the fix, the first post link produced three client rectangles: a 13 px left fragment, a 736 px content fragment, and another 13 px left fragment. Those narrow painted fragments were the visible white rounded blocks.

## Source Trace

- `KnowledgeCardList`: not involved. Explore uses its local `DiscoveryPostList`.
- `Skeleton`: not involved. The artifact remained after content loaded.
- `Avatar`: not involved. Most Helpful Posts does not render an avatar.
- Shared Card component: not involved. The row is a local anchor element.
- Shared CSS token: not involved. The row does not use `readative-card-surface`.
- Root cause: missing block display on the local `DiscoveryPostList` anchor.

## Home Feed Comparison

Home Feed renders each knowledge card as a block-level `<article>` using `readative-card-surface`. Browser measurement showed one 736 px client rectangle matching its parent, so its background and border paint as one complete card.

## Fix

Added the existing Tailwind `block` utility to the affected anchor. No CSS override, shared component change, or behavior change was introduced.

After the fix, the link computes to `display: block` and produces one 736 px client rectangle matching its parent.

## Regression Risk

Low. The change affects only the display mode of Explore post links inside `DiscoveryPostList`. Navigation, content, event handling, data queries, and all other routes remain unchanged.
