# Readative Release X.2 Walkthrough

Date: 2026-06-28

## Scope

Release X.2 investigates and permanently resolves the white rounded fragments in Explore's loaded post and discussion lists. It contains no redesign, feature work, routing change, data change, CSS override, hidden element, or `!important` rule.

## Files Modified

- `src/components/Explore.tsx`
- `root_cause.md`
- `walkthrough.md`

## Investigation

Rendered-DOM inspection covered Most Helpful Posts and Active Discussions after their content loaded.

- The exact painted node was each row's `<a>` element.
- The original React sources were `DiscoveryPostList`, the Active Discussions branch in `Explore`, and the question branch in `UnifiedSearchResults`.
- The shared utility set was `w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left shadow-sm transition-colors` plus the branch-specific hover classes.
- The row anchors had no generated pseudo-element content.
- The affected lists contained no avatars, images, or skeleton nodes after loading.
- `ExploreSkeleton` was unmounted when the loaded rows were present.

The remaining Active Discussions anchor computed to `display: inline` and produced three painted client rectangles. The two 13 px fragments at the left edge carried the white background, border, radius, padding, and shadow.

## Implementation

Added a local `DiscoveryListRow` component that renders the existing anchor with a shared block-level base class. The component is now used by:

- Most Helpful Posts and topic post results.
- Active Discussions.
- Unified search question results.

Existing hrefs, navigation handlers, content, metadata, colors, and hover behavior were preserved.

## Why X.1 Was Incomplete

X.1 changed only the anchor inside `DiscoveryPostList`. Active Discussions and unified question results had independent copies of the same row markup, so their anchors stayed inline. X.2 removes that duplication at the element boundary and gives every discovery row the same layout contract.

## Regression Verification

- `npx tsc --noEmit`: passed.
- `npm run build`: passed; 1,770 modules transformed.
- Desktop, 1280 px: Explore rows each produced one 736 px rectangle; Home, Explore, Profile, and SmartTalk mounted with zero horizontal overflow.
- Tablet, 900 px: Explore rows each produced one 736 px rectangle; all four routes mounted with zero horizontal overflow.
- Mobile, 390 px: Explore rows each produced one 351 px rectangle; Explore, Profile, and SmartTalk had zero horizontal overflow.
- Mobile Home retained its previously documented 4 px overflow observation; this was unchanged and outside the Explore-only source change.
- Unified search question rows produced one full-width block rectangle.
- Browser console: no warnings or errors during the final route matrix.

## Production Readiness

Release X.2 is production-ready. The artifact source is centralized and corrected without hiding content or changing product behavior.
