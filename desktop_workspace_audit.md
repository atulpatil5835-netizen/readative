# Release R1 Final Refinement - Desktop Workspace Audit

## Scope lock

This document audits the desktop workspace only. It does not authorize UI redesign, layout changes, route changes, feed behavior changes, Notebook changes, SmartTalk changes, or implementation work.

## Baseline

The stable desktop workspace reference used for this audit is commit `cb9a763`, the same Release Z.2 reference used during production recovery.

Static comparison was run against the restored desktop files:

```text
git diff --exit-code cb9a763 -- src/components/KnowledgeFeed/FeedRenderer.tsx src/components/KnowledgeFeed/KnowledgeJourney.tsx
```

Result: no source diff for the restored desktop workspace files. Git emitted only a line-ending warning for `KnowledgeJourney.tsx`.

## Current desktop workspace implementation

| Requirement | Current source evidence | Audit result |
| --- | --- | --- |
| Left rail | `FeedRenderer.tsx` renders `aria-label="Desktop reading workspace"` | Present |
| Center reading column | `FeedRenderer.tsx` uses `min-[1400px]:w-[780px]` for the feed column | Present |
| Right rail | `FeedRenderer.tsx` renders `aria-label="Desktop learning context"` | Present |
| Sticky behavior | Both rail wrappers use `sticky top-24` | Present |
| Desktop breakpoint | Rails use `hidden min-[1400px]:block` | Present |
| Desktop grid | Main workspace uses `min-[1400px]:grid-cols-[240px_780px_280px]` | Present |
| Route wrapper width | `App.tsx` uses `min-[1400px]:max-w-[1400px] min-[1400px]:px-6` for knowledge route | Present |

## Breakpoint behavior

| Width | Expected behavior | Static audit result |
| --- | --- | --- |
| Below 1400px | Single-column reading experience; desktop rails hidden | Supported by `hidden min-[1400px]:block` |
| 1400px and above | Left rail, 780px center, right rail visible | Supported by explicit desktop grid |
| 1600px | Same restored workspace with extra viewport breathing room | Supported by fixed desktop grid inside max-width shell |
| 1920px | Same restored workspace centered, rails sticky | Supported by fixed grid and `max-w-[1400px]` shell |

## Reading width

The restored center reading column is fixed at `780px` at the desktop workspace breakpoint. This matches the Release Z.2 desktop workspace intent and should not be changed during cleanup.

## Sticky behavior

Both rails use the same sticky offset:

- Left rail: `sticky top-24`
- Right rail: `sticky top-24`

No sticky mismatch was found in the restored desktop source.

## Regression list

### Critical

None confirmed.

### High

None confirmed against the restored Release Z.2 desktop files.

### Medium

#### D1 - Desktop layout depends on hard-coded grid numbers

The desktop workspace currently depends on explicit `240px / 780px / 280px` columns and a `1400px` shell. This is stable and intentional, but any future cleanup that extracts layout primitives must preserve these exact numbers unless a separate UI release approves otherwise.

Regression risk if touched: High.

#### D2 - Desktop rail content is coupled to feed renderer state

`FeedRenderer.tsx` owns the desktop rail rendering and receives a large prop surface from `KnowledgeFeed.tsx`. The layout is restored, but extracting rail components later must avoid changing which entries, journey actions, or status states appear.

Regression risk if touched: Medium to High.

### Low

#### D3 - Rail card rhythm could be documented as tokens

Spacing, radius, borders, and accent treatments are consistent by convention. This is a future polish/documentation opportunity only, not a defect.

#### D4 - Browser QA should be repeated before any implementation release

This audit confirms source parity and static breakpoint behavior. Any future code change touching desktop files should repeat visual QA at 1400px+, 1600px, and 1920px.

## Desktop polish opportunities only

These are not implementation tasks for this audit phase:

- Preserve the current 780px reading rhythm.
- Preserve `top-24` sticky offsets unless a separate desktop release approves a change.
- Keep left and right rail card density balanced.
- Avoid introducing new cards or desktop-only features.
- If extracting components later, keep class output and DOM order stable.

## Desktop audit conclusion

The desktop workspace source is restored to the Release Z.2 baseline for the files that own the rail layout and knowledge journey. No current desktop regression was confirmed in this audit. Future cleanup should treat `FeedRenderer.tsx`, `KnowledgeJourney.tsx`, and the knowledge route shell in `App.tsx` as high-sensitivity files.
