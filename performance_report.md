# Release Y.2.2 Performance Report

Status: automated validation passed; authenticated runtime QA pending sign-in.

## Bundle impact

No new dependency was added.

Build output remains split:

- `ProfileMyNotes` is still lazy-loaded.
- `src/highlights/repository.ts` is still dynamically imported by notebook cache actions.
- No drawing, canvas, SVG editor, Konva, Fabric, RoughJS, or html2canvas dependency was introduced.

Observed build: `npm run build` passed.

## Firestore reads before vs after

| Surface | Before Y.2.2 | After Y.2.2 |
| --- | --- | --- |
| Highlight creation | 1 transaction read + 1 write, but UI rendered before durability. | Same transaction read/write, but UI renders only after successful commit. |
| Focused post refresh | 1 post highlight doc read if focused and signed in. | 1 post highlight doc read for the rendered visible card if cache is cold. |
| Non-focused visible feed card | 0 reads, but no restored highlight display. | 1 read per rendered/virtualized visible card on cold cache; in-flight/cache dedupe prevents repeat reads for the same post. |
| Entire feed | Not hydrated. | Still not hydrated; only rendered virtual window hydrates. |
| My Notes first open | Up to 12 notebook docs + up to 12 `knowledge` docs. | Same first load. |
| My Notes reopen while Profile/context cache valid | Repeated first-page reads every mount. | 0 Firestore reads; reuses cached first page. |
| Count badge | Aggregation on provider identity load and refresh after mark/delete. | Aggregation once when count unknown; local increment/decrement when cache is known. |

## Firestore writes before vs after

| Action | Before | After |
| --- | --- | --- |
| Create highlight | One transaction write after optimistic render. | One transaction write before render. |
| Failed create | Phantom mark could appear until rollback. | No new mark is rendered. |
| Delete notes post | One document delete. | Same one document delete; cache invalidates locally. |

No Firestore schema change was made.

## Render count before vs after

Approximate React behavior:

| Scenario | Before | After |
| --- | --- | --- |
| Successful highlight create | Optimistic mark render, then save-status render. | Saving-status render, then confirmed mark render. |
| Failed highlight create | Optimistic mark render, rollback render, failure-status render. | Failure-status render only; no phantom mark render. |
| Visible card hydration | Focused card only. | Rendered virtual-window cards hydrate; cold load sets state once, cached load reuses provider data. |
| My Notes reopen | Skeleton/loading render plus loaded render each time. | Cached state is used immediately while cache is valid. |
| Count refresh | Provider value updates after aggregation refresh. | Provider value reuses cached total; save/delete updates locally when known. |

The post-hydration cache intentionally does not bump the global cache version after ordinary Firestore reads, avoiding a fan-out rerender across all mounted cards.

## Listener/polling audit

Patched notebook files do not introduce:

- `onSnapshot`
- polling
- intervals
- `selectionchange`
- SVG/canvas drawing surface
- Ink preview/surface

Existing unrelated listeners in feed/profile/notifications/SmartTalk were not touched.

## Regression risk

| Risk | Level | Mitigation |
| --- | --- | --- |
| More Firestore reads for visible non-focused cards | Medium | Bounded by existing virtualization and provider cache/in-flight dedupe. |
| Save feels slightly less instant | Low | Prevents phantom highlights and preserves calm UI. |
| My Notes cache stale after changes | Low | Invalidates on new highlight, delete, logout/user change. |
| Count drift | Low | Local increment/decrement only when cached total exists; otherwise falls back to aggregation. |
| Authenticated Firestore rules issue | High until tested | Requires signed-in browser QA against deployed rules. |

## Production readiness

Code is build-ready, but production readiness is conditional until authenticated QA verifies real Firestore persistence after refresh/logout/login/other browser/delete.
