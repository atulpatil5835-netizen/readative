# Readative Release X.2 Root Cause

Date: 2026-06-28

## Incident

White rounded fragments appeared along the left edge of loaded rows in Explore's Most Helpful Posts and Active Discussions lists.

## Exact DOM Node

The painted node was the live row anchor in each list:

```html
<section class="space-y-3">
  <div class="space-y-2">
    <a class="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 ...">
      ...loaded content...
    </a>
  </div>
</section>
```

It was not a child placeholder. Browser inspection found the row `<a>` was the only node in either list combining a white background with rounded corners.

## Exact React Source

The same row markup had been implemented independently in three places in `src/components/Explore.tsx`:

- Most Helpful Posts: `DiscoveryPostList`.
- Active Discussions: the `activeDiscussions` branch inside `Explore`.
- Search question results: the questions branch inside `UnifiedSearchResults`.

There was no shared row component before X.2. Release X.2 consolidates these branches into the local `DiscoveryListRow` component.

## Exact CSS Class

The affected discussion anchors used:

```text
w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/50
```

The shared base class now begins with `block w-full`. `block` is part of the source component's layout contract, not a stylesheet override.

## Why The Artifact Appeared

An `<a>` is inline by default. `w-full` does not make a normal inline anchor establish a full-width box. The browser therefore painted `bg-white`, `border`, `rounded-2xl`, `px-3`, and `shadow-sm` across the anchor's inline fragments.

Before X.2, an Active Discussions row produced three client rectangles at desktop and tablet widths:

- 13 px leading fragment.
- 736 px content fragment.
- 13 px trailing fragment painted back at the left edge.

At 390 px mobile width the same sequence was 13 px, 351 px, and 13 px. The narrow white rounded fragments were the visible artifacts.

## Why It Remained After Loading

The artifact was part of the real loaded anchor, so completing the data request could not remove it. After loading, the page had zero `.animate-pulse` nodes and zero `aria-busy="true"` regions. Neither affected section contained an image or avatar, and both anchor pseudo-elements had `content: none`.

## Why X.1 Was Insufficient

X.1 correctly identified the inline-fragment painting mechanism but added block layout only to `DiscoveryPostList`. Active Discussions used a separate copy of the same anchor pattern, and unified question search contained a third copy. Those copies remained inline, so the defect survived outside the post-list branch.

## Permanent Resolution

`DiscoveryListRow` now owns the anchor element and its block-level base class. Most Helpful Posts, Active Discussions, and unified question results all render through this one component while retaining their original hrefs, click handlers, content, and hover colors.

After the fix, both primary Explore rows produce exactly one client rectangle matching the parent width on desktop, tablet, and mobile. No element is hidden, no CSS override was added, and no `!important` rule is used.

## Regression Risk

Low. The change is local to existing Explore discovery row markup and preserves routing, data access, event handling, copy, and visible design.
