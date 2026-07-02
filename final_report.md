# Readative Release Y.1 — Final Report

Date: 2026-07-01

## Final Result

The old Highlight feature has been fully removed from production source and replaced by the engineering-first Ink System.

Ink is route-scoped, SVG-based, lazy-loaded, private, and reading-first. Feed cards never mount annotation SVGs. My Notes uses stored vectors for previews and canonical post documents for title/author.

## Bundle Impact

- Main app: **+0.72 kB gzip** versus clean HEAD.
- Focused Ink lazy path: approximately **4.89 kB gzip** including shared repository/geometry.
- My Notes lazy path: approximately **4.10 kB gzip** including shared repository/geometry.
- All new lazy Ink assets combined: **7.20 kB gzip**.
- Profile base chunk: **-0.36 kB gzip** because My Notes moved behind its own lazy boundary.
- CSS: **+0.25 kB gzip**.
- New dependencies: **0**.

## Firestore Impact

- One user Ink index read per signed-in identity session.
- Zero per-post feed reads.
- Zero Ink realtime listeners.
- One focused user/post read when Ink is activated or known to exist.
- One write per completed stroke on an existing post.
- Two writes in one batch for the first stroke on a post.
- My Notes reads at most 12 Ink documents plus 12 canonical post documents per page.
- No duplicated post content, selected snippets, screenshots, or bitmaps.

## Rendering Impact

- No Ink SVG in the ordinary feed.
- One SVG for the focused annotated/active post.
- Lightweight preview SVGs only on My Notes.
- At most 15 grouped committed paths on the focused surface.
- One direct DOM path update per animation frame during drawing.
- One React update per completed stroke.
- No Canvas, hidden renderer, or Ink `html-to-image` usage.

## Memory Impact

- Global memory contains only the post-ID index, active post ID, and settings.
- Stroke vectors load for one focused post, not every feed card.
- My Notes is paginated in groups of 12 and unmounts outside the section.
- Gesture and stored geometry have explicit point/character/stroke caps.
- Desktop Home QA contained 381 DOM elements, 0 Ink overlays, 0 previews, and 0 canvases.
- Heap was not directly measurable through the available browser QA surface, so no unsupported heap claim is made.

## Migration

Migration uses the safe archive branch.

- Existing `userHighlights` documents remain untouched as an external archive.
- Production source no longer reads or writes them.
- Automatic conversion was rejected because legacy text offsets cannot safely reconstruct responsive freehand vectors after post edits/reflow.
- Ink starts clean, preventing misplaced or duplicated marks.

## Regression Risk

Current risk: **Medium**.

Reduced risks:

- No app-wide annotation subscription.
- No per-pointer React renders.
- No feed overlays.
- No legacy snippet exposure.
- No new package.
- Explicit cancellation and storage caps.
- Build, strict TypeScript, geometry, responsive routes, overflow, scroll, and console checks pass.

Residual risks:

- Real signed-in touch arbitration on physical mobile hardware.
- Firestore persistence/offline behavior under real credentials.
- Populated My Notes behavior.
- High-stroke-count mobile rendering.

## Production Readiness

**Code readiness: PASS.**

**Static/build readiness: PASS.**

**Signed-out responsive browser readiness: PASS.**

**Authenticated end-to-end readiness: NOT YET VERIFIED.**

Production recommendation: **Conditional hold.** The implementation is ready for an authenticated staging/device pass, but it should not be declared fully production-verified until a signed-in user completes stroke persistence, My Notes, offline/reconnect, and physical touch QA.

## Verification Summary

- Production build: passed.
- TypeScript: passed.
- Strict unused code check: passed.
- Diff whitespace check: passed.
- Desktop/tablet/mobile named routes: passed.
- Console warnings/errors: zero in tested routes.
- Feed Ink overlays/canvases: zero.
- Mobile scrolling: passed in signed-out reading mode.
- Authenticated Ink/My Notes persistence: blocked by signed-out browser session and intentionally not bypassed.

## Release Status

Release Y.1 implementation is complete. All obsolete Highlight source is removed. Final production approval waits only on the authenticated runtime checklist documented in `task.md`.
