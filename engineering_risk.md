# Release Z.1 - Engineering Risk

Status: risk audit complete. Production code was not modified.

## Risk summary

The release is feasible, but the primary risks are not visual. They are scroll, virtualization, and hidden data-loading regressions.

The safest implementation is desktop-only, route-owned, and presentational. Rails must be outside the virtualized card list and must use only already-loaded data.

## Risk register

| Risk | Severity | Why it matters | Mitigation |
|---|---:|---|---|
| Mobile/tablet layout regression | High | Current app is mobile/tablet-first and all routes share one `main` container. | Gate all new layout behavior above 1400px. Do not rewrite existing `sm`/`md` behavior. |
| Feed virtualization breakage | High | `KnowledgeCardList` measures row heights and uses window scroll. Width or scroll-container changes can cause jumps. | Keep the center column stable. Do not place rails inside `KnowledgeCardList`. Do not create nested main scroll containers. |
| Extra Firestore reads/listeners | High | Rails could accidentally become new data surfaces. | Rail components must not import Firestore. Pass already-loaded route data as props. |
| Startup bundle growth over 2KB gzip | Medium | A broad shell/module set could add more JS than the budget. | Use tiny presentational components, existing icons only if already in the chunk, no dependency, no full card duplication. |
| Re-render churn during scroll | Medium | Sticky rails tied to visible-entry updates can render too often. | Use memoized selectors, cap item counts, avoid per-scroll state updates for rails. |
| Duplicate heavy card rendering | High | Rendering full cards in rails defeats virtualization and increases memory. | Rails must render compact text/link rows only. |
| Header/body/footer visual mismatch | Medium | Current header/footer are wider than body; new desktop shell can worsen imbalance if not aligned. | Align desktop workspace visually without changing header behavior. |
| Sticky rail overflow | Medium | Tall rails can create unusable columns or nested scroll conflicts. | Cap rail content. Prefer compact modules. Avoid independent rail scrolling in the first implementation unless necessary. |
| Route data coupling | High | App does not own feed/profile/explore/smarttalk data. Global rails could force broad architecture changes. | Use route-owned rail data. Keep App shell presentational. |
| SmartTalk/Profile logic regression | High | Both routes have listeners, pagination, and focused-route scroll behavior. | Do not modify their data logic. Any rails must be route-local and use existing state. |
| Explore preload regression | Medium | Explore currently loads three collections when mounted. Preloading it for desktop rails would violate performance rules. | Never mount Explore just to populate desktop rails. |
| My Notes lazy-load regression | Medium | My Notes currently loads only from the Profile notes tab. | Do not touch Profile My Notes loading in Z.1. |
| Accessibility/focus regression | Medium | New side rails add more keyboard targets before/after reading content. | Keep center content first in source order where practical; provide semantic `aside` labels; avoid focus traps. |
| Social-media layout drift | Product risk | Dense sidebars could make Readative feel like LinkedIn/Reddit. | Rail modules should be calm, knowledge-oriented, compact, and reading-supportive. |

## Root technical hazards

### 1. Window-scroll dependency

The feed virtualizer, feed scroll persistence, focused post navigation, SmartTalk focused question behavior, and Profile author-change behavior all assume the browser window is the primary scroll container.

Regression pattern:

```text
New desktop shell adds nested scroll
  -> window scroll no longer represents content scroll
  -> virtualization window is wrong
  -> focused/restore scroll behavior is wrong
```

Mitigation:

- Keep page scroll on the window.
- Use sticky rails inside the normal document flow.
- Do not put the center column in `overflow-y-auto`.

### 2. Center width changes

`KnowledgeCardList` estimates card height and then measures actual card height. Changing center width changes text wrapping and media layout, which can trigger measurement churn.

Mitigation:

- Keep center width in the same practical range as today's `max-w-3xl`.
- Avoid dynamic width changes based on rail content.
- Test at 1400px, 1440px, 1536px, and larger desktop widths.

### 3. Data ownership leakage

App owns routing, identity, notifications, panels, and lazy routes. It does not own feed entries, Explore entries, SmartTalk questions, or Profile entries.

Mitigation:

- Do not introduce a global desktop data store.
- Do not import route data loaders in App.
- Let route components pass already-loaded data to desktop rail modules.

### 4. Rail over-rendering

A rail tied to scroll position can re-render on every scroll animation frame.

Mitigation:

- Rail modules should update on loaded data, focused entry, route, search/topic changes, or coarse visible-entry changes only.
- Cap derived arrays and memoize them.

## Files with highest regression sensitivity

- `src/App.tsx`
  - Top-level layout, route rendering, panels, mobile nav.
- `src/components/KnowledgeFeed/KnowledgeFeed.tsx`
  - Feed data lifecycle, scroll restoration, route filters, pagination.
- `src/components/KnowledgeFeed/FeedRenderer.tsx`
  - Feed UI composition, category controls, card list placement.
- `src/components/KnowledgeCardList.tsx`
  - Virtualization and measurement.
- `src/components/Header.tsx`
  - Fixed header and account/notification controls.
- `src/components/Explore.tsx`
  - Discovery route data loading and derived sections.
- `src/components/SmartTalk.tsx`
  - Route listeners, count query, focused-question scroll.
- `src/components/Profile.tsx`
  - Profile listeners, virtualized shared/saved sections, My Notes tab.

## Regression risk by surface

### Home feed

Risk: high.

Reason:

- It is the primary reading surface and uses virtualization, scroll persistence, focus scroll, pagination, and already-loaded SmartTalk/profile preview data.

Control:

- Implement rails outside the virtualized list.
- Use KnowledgeFeed-owned selectors.

### Focused post

Risk: medium-high.

Reason:

- Focused post route scrolls the target into view.
- Desktop rails should not alter focus scroll behavior.

Control:

- Test focused post open from feed and direct route.
- Do not add route-level scroll restoration changes.

### Explore

Risk: medium.

Reason:

- Explore has route-local one-shot reads and many derived sections.

Control:

- Do not preload Explore.
- Preserve single-column behavior below 1400px.

### SmartTalk

Risk: medium-high.

Reason:

- SmartTalk uses listeners, count query, pagination, and focused-question scroll.

Control:

- Do not change SmartTalk data logic.
- Avoid global SmartTalk rail subscriptions.

### Profile

Risk: medium-high.

Reason:

- Profile combines document listeners, post listeners, saved item reads, lazy My Notes, and virtualized card lists.

Control:

- Do not change profile data logic.
- Confirm My Notes remains lazy.

## Recommended minimal implementation risk posture

1. Build the desktop shell as presentational.
2. Keep route data ownership unchanged.
3. Complete the Knowledge Feed workspace first.
4. Keep other route rails minimal or absent unless they can be derived from route-local state without new reads.
5. Validate mobile/tablet before judging desktop polish.

## Production readiness gate after implementation

Production readiness requires:

- `npm run build` passes.
- `npx tsc --noEmit` passes.
- `git diff --check` passes.
- Desktop/tablet/mobile QA passes.
- No added dependencies.
- No new Firestore reads/listeners for rails.
- Center reading column remains 760-820px.
- Virtualization behavior is unchanged.
