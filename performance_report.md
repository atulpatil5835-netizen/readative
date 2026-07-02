# Readative Release Y.1 — Performance Report

Date: 2026-07-01

## Build Comparison

Baseline was built from clean Git HEAD `7793a6b` with the same installed dependency tree. Release Y.1 was then built from the implementation worktree.

| Asset | Baseline raw / gzip | Y.1 raw / gzip | Delta raw / gzip |
| --- | ---: | ---: | ---: |
| Main app chunk | 76.89 / 22.61 kB | 79.21 / 23.33 kB | **+2.32 / +0.72 kB** |
| KnowledgeCard | 52.32 / 15.27 kB | 52.41 / 15.18 kB | +0.09 / **-0.09 kB** |
| Profile | 55.17 / 15.76 kB | 53.80 / 15.40 kB | **-1.37 / -0.36 kB** |
| KnowledgeFeed | 69.89 / 21.83 kB | 69.99 / 21.87 kB | +0.10 / +0.04 kB |
| CSS | 75.81 / 13.38 kB | 77.30 / 13.63 kB | +1.49 / +0.25 kB |

New lazy assets:

| Lazy asset | Raw | Gzip |
| --- | ---: | ---: |
| `InkSurface` | 7.85 kB | 3.10 kB |
| Shared vector geometry | 1.57 kB | 0.80 kB |
| Shared Ink repository | 2.16 kB | 0.99 kB |
| `ProfileMyNotes` + preview UI | 5.40 kB | 2.31 kB |

Interpretation:

- Startup cost is limited to +0.72 kB gzip.
- The focused-post Ink path loads approximately 4.89 kB gzip across surface + shared geometry/repository chunks.
- The My Notes path loads approximately 4.10 kB gzip across My Notes + shared geometry/repository chunks.
- All four new lazy assets total 7.20 kB gzip when both surfaces have been visited.
- No drawing dependency was added.

The Firebase app/firestore code redistributed between manual chunks because the repository is dynamically imported. Combined raw/gzip size remained effectively flat; this is chunk placement, not a new Firebase payload.

## Firestore Impact

| Event | Reads | Writes | Listener |
| --- | ---: | ---: | --- |
| Signed-in app identity load | 1 user Ink index document | 0 | None |
| Feed card render | 0 per post | 0 | None |
| Focused unannotated post before Ink | 0 until activation | 0 | None |
| Activate/focus Ink surface | 1 user/post Ink document | 0 | None |
| Completed stroke on existing Ink post | 0 additional reads | 1 document write | None |
| First stroke on a post | 0 additional reads after surface load | 2 writes in one batch | None |
| My Notes page | Up to 12 Ink docs + up to 12 canonical post docs | 0 | None |
| Load more notes | Same bounded page cost | 0 | None |
| Delete notes from a post | 0 | 2 writes in one batch | None |

No post content is duplicated into Ink. Feed indicators use the one user index, so they do not require one read or subscription per card.

## Rendering Impact

- Base feed: zero Ink SVG overlays.
- Focused post: one absolute SVG only when Ink is active or the focused post is known to contain Ink.
- My Notes: one small preview SVG per visible note card.
- Committed focused-post vectors group into at most 15 paths—five colors × three widths.
- Active drawing updates one DOM path at animation-frame cadence.
- React state changes once per completed stroke, not per pointer sample.
- Geometry is simplified and capped at 256 persisted points.
- No Canvas, screenshot, image generator, hidden DOM renderer, or `html-to-image` path is used by Ink.
- SVG and settings popover are absolutely positioned, avoiding content layout shifts.

## Memory Impact

Runtime structure:

- Global Ink context retains one `Set<string>` of annotated post IDs, one active ID, and two small preference enums.
- It does not retain all stroke documents globally.
- The focused surface retains strokes for one post only and unmounts when the post is left.
- My Notes retains only loaded 12-document pages and unmounts when the section is left.
- A live gesture is capped at 1,024 raw points; persistence is capped at 256 points.
- One post is capped at 600 strokes and 450,000 geometry characters.

Browser DOM sample on desktop Home:

- 381 total elements.
- 0 Ink overlays.
- 0 Ink previews.
- 0 Canvas elements.

The browser tool did not expose a supported heap measurement, so no synthetic heap number is claimed. Based on the explicit geometry cap, vector strings are bounded below roughly 0.9 MB of UTF-16 character storage per maximum-size active document before object overhead; normal posts should be substantially lower.

## Scrolling and Responsive QA

| Viewport | Routes | Overflow | Console |
| --- | --- | --- | --- |
| Desktop 1280×720 | Home, Post, Explore, SmartTalk, Profile | 0 px | 0 warnings/errors |
| Tablet 768×1024 | Home, Post, Explore, SmartTalk, Profile | 0 px | 0 warnings/errors |
| Mobile 390×844 | Home, Post, Explore, SmartTalk, Profile | Explore/SmartTalk/Profile 0 px; Home/Post 4 px existing tolerance | 0 warnings/errors |

Mobile post scrolling moved from `scrollY 0` to `600` normally. No Ink SVG was mounted in guest mode during the scroll.

## Performance Risk

Residual risk is concentrated in authenticated runtime behavior:

- Real touch-hold arbitration while signed in.
- Firestore write latency/offline acknowledgement.
- Large populated My Notes pages.
- Rendering a real 200–600 stroke post on target mobile hardware.

Static architecture and build results are within budget, but these cases still require authenticated device QA before production approval.
