# Release Z.1 - Performance Plan

Status: performance architecture plan complete. Production code was not modified.

## Performance budget

Hard constraints:

- Startup bundle increase: less than 2KB gzip.
- No new dependency.
- No new Firestore listeners.
- No repeated rail queries.
- No polling.
- No intervals.
- Reuse existing feed cache and loaded route data.
- Preserve virtualization.

## Current performance architecture

### Startup/loading

- Primary route components are lazy-loaded from `App.tsx`.
- App-level notifications listener is dynamically set up for authenticated users.
- Feed card rendering is lazy via `KnowledgeCardList`.
- My Notes is lazy-loaded inside Profile only when the Notes tab renders.

### Feed

- `KnowledgeFeed` reads local feed cache on initialization.
- Home feed uses a realtime listener for the first page of `knowledge`.
- Pagination uses `getDocs`.
- Independent topic/hashtag feeds use route-scoped `getDocs`.
- Profile directory loads after idle.
- SmartTalk preview loads as a limited one-shot for Knowledge Journey.
- Feed scroll persistence uses `requestAnimationFrame` and window scroll.
- `KnowledgeCardList` virtualizes cards and measures row heights.

### Explore

- Loads its own data only when Explore mounts.
- Performs one-shot parallel reads for knowledge, SmartTalk, and profile summaries.
- Uses `useMemo` heavily for local derivations.

### SmartTalk

- Loads only when SmartTalk route mounts.
- Uses route-local listener and count/pagination queries.

### Profile

- Loads only when Profile route mounts.
- Uses profile/shared-post listeners.
- Loads Saved only when saved tab is active.
- Loads My Notes only when notes tab is active.

## Z.1 performance strategy

### 1. Layout-only at App level

The top-level desktop shell should be presentational.

Allowed:

- responsive CSS/Tailwind classes;
- `aside` wrappers;
- sticky positioning;
- route children.

Not allowed:

- Firestore imports;
- route data fetches;
- global data store;
- background workers;
- timers.

### 2. Route-owned rail data

Rails should receive already-loaded route data.

For Knowledge Feed:

- derive from `filteredEntries`, `visibleEntries`, `focusedEntry`, `profiles`, `journeyQuestions`, and active topic state.

For Explore, if included:

- derive from Explore's already-loaded `entries`, `questions`, `profiles`, and topic stats.

For SmartTalk, if included:

- derive from SmartTalk's already-loaded `questions`.

For Profile, if included:

- derive from Profile's already-loaded `profile`, `sharedEntries`, and `smartTalkSummary`.

### 3. No full-card duplication

Rail modules must not render:

- `KnowledgeCard`;
- `KnowledgeCardList`;
- media carousels;
- comment previews;
- Notebook controls.

Use compact text/link rows only.

Expected savings:

- No duplicated card subtree.
- No duplicated image/media decoding.
- No extra card measurement work.

### 4. Memoized selectors

Use memoized derivations for rail models.

Selector output should be small:

- 3-6 items per module;
- strings, counts, IDs, links;
- no cloned full-entry arrays.

Expected render savings:

- Rails update when loaded data or route context changes, not on every scroll frame.

### 5. Sticky rails without nested scrolling

Preferred:

- `position: sticky`;
- top offset below the fixed header;
- capped modules.

Avoid:

- `overflow-y-auto` as the main rail behavior;
- making center content its own scroll container;
- scroll restoration inside the shell.

Reason:

- Current feed virtualization and route scroll behavior depend on window scroll.

## Firestore impact plan

Expected Z.1 Firestore impact:

| Surface | Before Z.1 | After approved Z.1 target |
|---|---|---|
| App notifications | Existing listener | Unchanged |
| Home feed | Existing knowledge listener + pagination | Unchanged |
| Feed rail data | None | 0 new reads/listeners |
| Right rail SmartTalk | Existing feed journey preview only | Reuse existing preview; 0 new listeners |
| Explore | Loads only when opened | Unchanged |
| SmartTalk | Loads only when opened | Unchanged |
| Profile | Loads only when opened | Unchanged |
| My Notes | Loads only when Profile notes tab opens | Unchanged |

Expected Firestore savings versus a naive desktop sidebar:

- Avoids route preloading.
- Avoids per-rail SmartTalk/category/profile reads.
- Avoids duplicate feed queries.
- Avoids polling/refresh loops.

## Render impact plan

Expected render changes:

- Desktop only:
  - adds small rail component trees;
  - center feed continues rendering through existing virtualized list.
- Tablet/mobile:
  - no render path changes intended.

Render guardrails:

- Do not pass freshly created large arrays unless memoized.
- Do not calculate expensive related content inside every rail row.
- Do not attach new scroll listeners for rail modules.
- Avoid using full entry objects as rail state.

## Memory impact plan

Expected memory impact:

- Low, if rails use small derived view models.

Memory guardrails:

- Cap rail sections.
- Store IDs/display strings, not cloned entry objects.
- Do not cache rail results in localStorage.
- Do not duplicate Explore/Profile/SmartTalk state globally.

## Bundle impact plan

Target:

- Less than 2KB gzip startup increase.

Guardrails:

- No dependency.
- No drawing/visualization libraries.
- No data library.
- Prefer existing Tailwind utilities.
- Keep new components small.
- Avoid importing large icon sets in shared startup code.
- If rail modules become non-trivial, keep them route-local so they live with existing route chunks.

Recommended measurement after implementation:

1. Run `npm run build`.
2. Compare generated asset sizes with the pre-implementation build.
3. Confirm gzip delta remains under 2KB for startup assets.
4. Document exact delta in `performance_report.md`.

## QA performance checklist after implementation

Desktop:

- Scroll feed through many cards.
- Confirm no scroll jump when rails become sticky.
- Confirm focused post route still scrolls correctly.
- Confirm feed restoration still works.
- Confirm rail interactions do not trigger extra network reads.

Tablet:

- Confirm old single-column layout.
- Confirm no rail markup visible.
- Confirm mobile/tablet bottom spacing unchanged.

Mobile:

- Confirm old single-column layout.
- Confirm bottom nav unchanged.
- Confirm no horizontal overflow.

DevTools checks:

- Console has no errors.
- Network does not show rail-specific Firestore reads.
- React rendering does not spike on scroll due to rails.

## Performance acceptance criteria

Z.1 is performance-ready only if:

- No new dependencies are added.
- No rail component performs Firestore reads.
- No new Firestore listener exists for desktop rails.
- No polling/intervals are introduced.
- Startup gzip delta is less than 2KB.
- Feed virtualization remains unchanged.
- Tablet/mobile render behavior is unchanged.
