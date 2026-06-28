# Readative Release X.1 Walkthrough

Date: 2026-06-27

## Scope

Release X.1 fixes only the Explore -> Most Helpful Posts white rounded layout artifact. No redesign, feature work, data changes, routing changes, or shared CSS overrides were included.

## Files Modified

- `src/components/Explore.tsx`
- `root_cause.md`
- `walkthrough.md`

## Resolution

The affected row was a local `<a>` element with `w-full`, white background, border, padding, and rounded corners, but without block-level display. Because anchors are inline by default, the browser painted the decoration across multiple inline fragments. The narrow first and last fragments appeared as white rounded blocks on the left.

Adding `block` to that anchor makes `w-full` effective and paints the row as one full-width rectangle. The fix does not change copy, click handling, navigation, queries, or visible behavior beyond removing the artifact.

## Component Trace

- `KnowledgeCardList`: excluded; Explore does not use it for this section.
- Skeleton: excluded; the issue was present on loaded content.
- Avatar: excluded; no avatar is rendered in the affected list.
- Shared Card component: excluded; the row is local to Explore.
- Shared CSS token: excluded; `readative-card-surface` is not applied.

## Verification

- Before: affected anchor was `display: inline` with three client rectangles, including two 13 px left-side fragments.
- After: affected anchor is `display: block` with one 736 px rectangle matching its parent.
- Home: feed search and knowledge card rendered; card remained block-level.
- Explore: Most Helpful Posts rendered with one full-width rectangle.
- Profile: guest profile and Google sign-in surface rendered.
- SmartTalk: heading, search, categories, and question list rendered.
- Browser console: no warnings or errors during regression checks.
- `npm run build`: passed; 1,770 modules transformed.
- `npx tsc --noEmit`: passed.

## Production Readiness

Release X.1 is production-ready. The root cause is fixed at the originating DOM element with a one-class change and a tightly limited regression surface.
