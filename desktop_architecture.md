# Release Z.1 - Desktop UX Architecture Audit

Status: architecture audit complete. Production code was not modified.

## Executive summary

Readative's current desktop experience is a mobile/tablet-centered reading app placed in the middle of a wide viewport. The center reading column is already close to the requested target reading width, but the rest of the desktop canvas is unused.

The correct Z.1 direction is not to widen the feed or copy a social layout. The safest architecture is a desktop-only adaptive workspace shell above 1400px, with:

- a protected center reading column kept between 760px and 820px;
- sticky left and right rails outside the virtualized feed;
- rail content derived only from data already loaded by the active route;
- no new Firestore listeners, no polling, no intervals, and no routing/schema changes.

Mobile and tablet should continue using the existing single-column layout.

## Current top-level layout

### App shell

Source inspected: `src/App.tsx`, `src/components/AppShell.tsx`, `src/components/Header.tsx`, `src/index.css`.

Current structure:

```text
HelmetProvider
  NotebookProvider
    min-h-screen app background
      fixed Header
      main: mx-auto max-w-3xl px-3 pb-28 pt-20 sm:px-4
        active route
      AppFooter: mx-auto max-w-5xl
      lazy overlay panels
      fixed mobile bottom nav: md:hidden
```

Findings:

- `App.tsx` wraps every route in one centered `main` with `max-w-3xl`.
- `Header.tsx` is fixed and uses `max-w-5xl`, wider than the body.
- `AppFooter` also uses `max-w-5xl`.
- The mobile bottom navigation is fixed and hidden at `md`.
- Route components are lazy-loaded, which is good for startup cost.
- There is no persistent desktop rail, no desktop grid shell, and no route-level desktop layout contract.

Desktop effect:

- The feed is readable, but the desktop canvas feels underused.
- At 1400px+, the app presents as a mobile column rather than a knowledge workspace.
- The header and footer visually imply a wider system than the body provides.

## Header audit

Source inspected: `src/components/Header.tsx`.

Current behavior:

- Fixed header across the viewport.
- Header content is centered in `max-w-5xl`.
- Desktop navigation appears at `md` and above.
- Account/actions menu uses an absolutely positioned dropdown with its own focus management.
- Notification button opens the separate notifications overlay.

Risks for Z.1:

- Widening only the body without aligning the header will create a disconnected desktop composition.
- Adding rail navigation inside the header would increase clutter and compete with reading.
- Header account menu focus logic should not be touched for Z.1.

Recommendation:

- Keep header logic unchanged.
- In implementation, align header content width visually with the future desktop workspace max width only if the change can be done with responsive classes and no behavioral edits.
- Keep primary reading/navigation calm; do not create a social-media command bar.

## Feed container and KnowledgeFeed audit

Sources inspected: `src/components/KnowledgeFeed/KnowledgeFeed.tsx`, `src/components/KnowledgeFeed/FeedRenderer.tsx`, `src/components/KnowledgeFeed/feedHelpers.ts`.

Current responsibilities in `KnowledgeFeed`:

- Reads initial feed cache from local storage.
- Maintains loaded knowledge entries, profile directory data, SmartTalk preview data, filtering state, pagination state, and search state.
- Owns Firestore reads/listeners for the home feed and route-scoped independent feeds.
- Persists/restores feed scroll position using the window scroll position.
- Passes loaded data to `FeedRenderer`.

Current data already available for possible desktop rails:

- `entries`
- `visibleEntries`
- `filteredEntries`
- `focusedEntry`
- `profiles`
- `journeyQuestions`
- active category/topic state
- selected hashtag/search state
- local feed activity snapshot through existing personalization utilities

Important current Firestore behavior:

- Home feed uses one realtime listener on `knowledge` while the feed is active.
- Pagination uses `getDocs`.
- Independent topic/hashtag feeds use `getDocs`.
- SmartTalk preview for Knowledge Journey loads a limited one-shot `smarttalk` query while the feed is active.
- Profile directory loads one-shot after idle.

Z.1 implication:

- Left/right rails should be derived from these already-loaded arrays.
- Do not mount Explore, SmartTalk, or Profile data loaders to feed the rails.
- Do not add rail-specific listeners.

## SVG/canvas/Notebook/Highlight boundary

Sources observed: `src/App.tsx`, `src/context/NotebookContext.tsx`, `src/index.css`, existing Z.1 "do not touch" scope.

Z.1 must not touch Notebook, Highlight, or Ink-related files. The current desktop architecture can be changed independently of Notebook because Notebook state is provided above the route surface through `NotebookProvider`.

Recommendation:

- Treat Notebook/Highlight as out of scope.
- Do not use rail changes to alter card paragraph layout, highlight rendering, or Notebook controls.

## Virtualization audit

Source inspected: `src/components/KnowledgeCardList.tsx`.

Current behavior:

- `KnowledgeCardList` lazy-loads `KnowledgeCard`.
- It estimates row heights, measures real row heights, and renders only the virtual window plus overscan.
- The virtual list uses the browser window as the scroll container.
- Rows are absolutely positioned inside a relative container whose height equals the measured total.
- `ResizeObserver` tracks row height changes.
- If a row above the viewport changes height, it compensates with `window.scrollBy`.

Risks:

- Any desktop change that changes the center column width can change card text wrapping and measured heights.
- Placing rails inside the virtualized list would corrupt row measurements.
- Adding full post cards inside rails would duplicate heavy card rendering and increase memory/render work.
- Nested desktop scroll containers would break the current window-scroll assumptions.

Recommendation:

- Keep the virtualized feed column intact.
- Put desktop rails outside `KnowledgeCardList`.
- Keep the center column width stable between 760px and 820px.
- Rail modules must use compact rows, not `KnowledgeCard`.

## Card rendering audit

Sources inspected: `src/components/KnowledgeCard/KnowledgeCard.tsx`, `src/components/KnowledgeCard/CardContent.tsx`, `src/components/KnowledgeCardList.tsx`.

Current behavior:

- Cards are heavy, media-aware, profile-aware, comment-aware, and Notebook-aware.
- `KnowledgeCard` is lazy-loaded through `KnowledgeCardList`.
- Card width depends on the route container width.
- Card measurement feeds the virtualization model.

Risks:

- A desktop shell that changes center width per route or per rail state can force height recalculation and scroll compensation.
- Reusing full cards inside rails would duplicate heavy card subtrees and defeat the purpose of virtualization.

Recommendation:

- Treat `KnowledgeCard` as center-column-only.
- Rail previews should be small text/link modules derived from `KnowledgeEntry` fields.

## Knowledge Journey audit

Source inspected: `src/components/KnowledgeFeed/KnowledgeJourney.tsx`.

Current behavior:

- Computes actions from already-loaded feed entries and limited SmartTalk preview questions.
- Existing action types already match the requested right rail candidates:
  - Continue Reading
  - Related Posts
  - Related SmartTalk
  - Same Author
  - Browse Category / Continue Learning
- Currently rendered after each card inside the virtualized list.

Opportunity:

- This is the strongest existing seam for a desktop right rail.
- The action-computation helpers can inform a right-rail module without new Firestore reads.

Risk:

- Rendering Knowledge Journey after every card plus in a right rail may duplicate contextual UI.

Recommendation:

- For Z.1 implementation, derive the desktop right rail from the current focused/visible entry and already-loaded `journeyEntries`.
- Keep any duplicate in-card journey behavior unchanged unless explicitly approved later.

## Explore audit

Source inspected: `src/components/Explore.tsx`.

Current behavior:

- Single-column route inside the app's `max-w-3xl` main.
- Loads its own one-shot batches:
  - `knowledge`
  - `smarttalk`
  - `userProfiles`
- Builds rich derived sections: Daily Pulse, Trending Topics, Top Posts, Active Discussions, Top Contributors, Learning Collections, Resurfacing Grid, and unified search.

Findings:

- Explore already behaves like a discovery workspace, but it is constrained to the same centered column.
- It should not be mounted early to supply feed rails.
- Its derived data could support desktop route-local rails only when the user is already on Explore.

Recommendation:

- In Z.1, do not change Explore data loading or logic.
- If desktop rails are added to Explore, they must be presentational and derived from Explore's already-loaded arrays.
- Preserve the current mobile/tablet Explore layout exactly.

## SmartTalk audit

Source inspected: `src/components/SmartTalk.tsx`.

Current behavior:

- Single-column route inside the app's `max-w-3xl` main.
- Uses route-local realtime listeners for SmartTalk first-page data.
- Uses count queries and pagination.
- Uses a focused-question mode that scrolls to top when a question is opened.

Findings:

- SmartTalk has its own logic-heavy data lifecycle.
- Desktop rails must not subscribe to SmartTalk data outside the SmartTalk route.
- Feed right rail may reference only already-loaded `journeyQuestions`, not SmartTalk's live route listener.

Recommendation:

- Do not change SmartTalk logic in Z.1.
- Do not introduce global SmartTalk side data for the desktop shell.

## Profile audit

Source inspected: `src/components/Profile.tsx`, `src/components/ProfileMyNotes.tsx`.

Current behavior:

- Single-column route inside the app's `max-w-3xl` main.
- Uses profile document listener and shared-post listener.
- Loads profile SmartTalk summary with a one-shot query.
- Loads profile directory once.
- Loads saved items only when the Saved tab is active.
- Lazy-loads My Notes only inside the My Notes tab.
- Shared/saved post sections reuse `KnowledgeCardList`.

Findings:

- Profile already has route-local data and virtualization.
- Desktop shell should not alter profile logic or cause My Notes to load before its tab.
- Profile route has explicit top scroll on author changes; nested desktop scroll containers would conflict with that assumption.

Recommendation:

- Do not modify Profile logic in Z.1.
- Any profile desktop rail must be route-local and derived from existing `profile`, `sharedEntries`, and `smartTalkSummary` only after the profile route has mounted.

## Existing side panels

Source inspected: `src/components/AppPanels.tsx`.

Current panels:

- `InfoPanel`
- `NotificationsPanel`

Findings:

- These are modal overlays with backdrop, dialog semantics, fixed positioning, and z-index ownership.
- They are not persistent side rails.
- They should not be repurposed as desktop workspace columns.

Recommendation:

- Keep panels unchanged.
- New desktop rails should be normal page layout regions, not overlays.

## Desktop breakpoint audit

Current breakpoint behavior:

- Most app-level changes use `sm` and `md`.
- There is no current 1400px+ desktop layout breakpoint.
- Mobile bottom nav disappears at `md`.
- Route content remains capped at `max-w-3xl` at every desktop width.

Recommended breakpoint:

- Use a desktop-only threshold equivalent to `min-width: 1400px`.
- Below 1400px, render the existing single-column layout.
- At 1400px and above, render the adaptive three-column workspace.

Target desktop grid:

```text
left rail:   220-260px
gap:          24-32px
center:      760-820px
gap:          24-32px
right rail:  260-320px
```

At 1400px, a practical starting track set is:

```text
240px | 780px | 280px + two 24px gaps = 1348px
```

This fits within a 1400px viewport with modest side padding.

## Wasted whitespace and layout imbalance

Observed issues:

- On wide desktop, the app body remains a narrow centered column.
- Header/footer are wider than the main feed, creating visual imbalance.
- The feed controls, search, category filters, post cards, Explore, SmartTalk, and Profile all compete in the same vertical stack.
- Desktop has no persistent reading context, learning path, progress, or continuation surface.
- The current centered feed is calm, but not workspace-like.

What should not change:

- Do not widen reading text beyond the requested center width.
- Do not add dense social sidebars.
- Do not add algorithmic social feeds in rails.
- Do not duplicate post cards in rails.

## Opportunities to reuse already-loaded data

### Left rail candidates

Use only local/current-route data:

- Quick Navigation from existing route names.
- Continue Reading from currently loaded feed order or recent visible entry.
- Reading Progress from current visible index / loaded entry count.
- Today's Reading from local session/feed cache state.
- Trending Categories from loaded `visibleEntries` / `filteredEntries` category and hashtag counts.
- Reading Streak only if already available locally; otherwise defer.

### Right rail candidates

Use active feed context:

- Knowledge Journey actions derived from focused/visible entry.
- Related Posts from loaded entries sharing category/hashtags.
- Related SmartTalk from existing `journeyQuestions`.
- Same Author from loaded entries.
- Popular Tags from loaded entries.
- Continue Learning from existing category/topic metadata.

Non-goals:

- No extra `knowledge` read.
- No extra `smarttalk` listener.
- No `userProfiles` read solely for rails.
- No Explore data preload.
- No profile preload.

## Render and repaint audit

Current likely repaint/render pressure:

- Feed virtualization reduces card count, but each visible card is still heavy.
- Row measurement via `ResizeObserver` can trigger state updates when card height changes.
- Feed scroll listeners update virtual window and back-to-top state.
- Knowledge Journey after-card content contributes to row height.
- Explore and Profile perform many `useMemo` derivations but only after route mount.

Z.1 repaint risks:

- Sticky rails with many dynamic children could repaint during scroll.
- Rails that depend on rapidly changing scroll state could cause frequent React renders.
- Changing center width at desktop can alter card wrapping and cause virtualization measurement churn.

Recommendation:

- Rail content should update on route/data/focused-entry changes, not every scroll tick.
- If visible-entry context is needed, reuse existing `onVisibleEntry` or a coarse focused-entry signal; do not add new IntersectionObservers for rails unless unavoidable.
- Keep rail modules small, text-only, and memoized.

## Memory audit

Current memory-sensitive areas:

- Feed caches loaded entries in React state and local storage.
- Profile/Explore/SmartTalk maintain route-local arrays.
- `KnowledgeCardList` builds maps for profile lookup and author reputation.
- Cards are lazy-loaded and virtualized.

Z.1 memory risks:

- Duplicating full entries in rail state.
- Rendering full card components in rails.
- Creating independent rail caches.

Recommendation:

- Rail selectors should return small arrays of IDs and minimal display strings.
- Cap rail item counts, usually 3-6 items per module.
- Do not create new persistent caches for rail content in Z.1.

## Firestore audit

Current relevant reads/listeners:

- App-level notifications listener for authenticated users.
- Feed `knowledge` realtime listener while knowledge route is active.
- Feed pagination/independent-feed `getDocs`.
- Feed SmartTalk preview one-shot `getDocs`.
- Feed profile directory one-shot idle `getDocs`.
- Explore one-shot data batch when Explore route mounts.
- SmartTalk route realtime listener and count query when SmartTalk route mounts.
- Profile route profile/shared-post listeners and tab-specific saved item reads.
- My Notes lazy-loaded only when profile notes tab is active.

Z.1 Firestore rule:

- No new Firestore listeners.
- No repeated queries.
- No polling.
- No intervals.
- No schema changes.

Recommended enforcement:

- Rails receive data as props from route components.
- Rail components must not import `db`, `firebase/firestore`, or data-loading helpers that perform network reads.

## Scroll and sticky audit

Current scroll model:

- The browser window is the primary scroll container.
- Feed, Profile, and SmartTalk use programmatic window scroll for route/focus behavior.
- Feed virtualization computes viewport from container rect and `window.innerHeight`.
- Info/notification/modal panels are separate fixed overlays with internal scroll.

Z.1 sticky requirements:

- Rails should be `position: sticky` relative to the window scroll.
- Rails should use a top offset below the fixed header.
- Avoid independent rail scroll containers in the initial release unless content overflows; cap content instead.

Risk:

- Nested scroll containers would break existing scroll restoration, focused post scroll, and virtualization expectations.

## Architecture recommendation

Recommended option: route-owned desktop workspace shell with presentational rails.

Why:

- Keeps mobile/tablet unchanged.
- Keeps feed virtualization untouched.
- Lets KnowledgeFeed provide cached/loaded data to rails without global data coupling.
- Prevents App-level rails from accidentally importing route data loaders.
- Allows Explore/Profile/SmartTalk to opt in later using route-local data only.

High-level model:

```text
Below 1400px:
  Existing App main -> existing route content

At/above 1400px:
  DesktopWorkspaceShell
    LeftRail: local/navigation/feed-derived modules
    Center: existing route content, fixed reading width
    RightRail: context derived from active route's already-loaded data
```

The first implementation should prioritize the Knowledge Feed route because it owns the richest loaded data and is the primary reading surface. Other routes can remain center-only inside the same desktop shell or receive only static/local rails until a later approved release.

## Architecture options considered

### Option A - App-level global rails

Pros:

- Consistent shell across all routes.
- Centralized layout.

Cons:

- App currently does not own feed/explore/profile data.
- Easy to accidentally introduce global queries.
- Harder to keep SmartTalk/Profile logic untouched.

Verdict: not recommended for Z.1 except for a purely presentational wrapper.

### Option B - Route-owned rails inside a shared desktop shell

Pros:

- Data remains owned by the route that already loaded it.
- No extra Firestore required.
- Lower risk to virtualization.
- Allows KnowledgeFeed to be the first complete workspace surface.

Cons:

- Some route-to-route rail inconsistency until later polish.

Verdict: recommended.

### Option C - CSS-only width/gap adjustment

Pros:

- Tiny bundle impact.
- Very low data risk.

Cons:

- Does not create a knowledge workspace.
- Leaves data reuse opportunity unused.
- Feels like cosmetic widening rather than a desktop experience.

Verdict: insufficient for Z.1.

### Option D - Persistent global desktop data store

Pros:

- Rails could show richer cross-route context.

Cons:

- Violates performance constraints unless extremely carefully scoped.
- High risk of extra reads/listeners.
- Broad architecture change.

Verdict: reject for Z.1.

## Audit conclusion

The current architecture can support a premium desktop workspace without changing the mobile/tablet product. The safest path is a desktop-only, route-owned shell that keeps the center reading column stable and moves contextual learning/navigation into sticky rails derived from already-loaded data.

Implementation should wait for approval.
