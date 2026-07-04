# Release Z.1 - Implementation Plan

Status: planning only. Do not implement until architecture approval is received.

## Objective

Transform the desktop experience into a premium knowledge workspace while preserving the current mobile and tablet layouts exactly.

The implementation must not copy a social-media layout. Reading remains primary.

## Scope boundaries

Allowed after approval:

- Desktop-only adaptive shell at widths above 1400px.
- Sticky left and right rails.
- Center reading column constrained to 760-820px.
- Presentational rail modules using already-loaded/local data.
- Small route-owned selector helpers if needed.

Not allowed:

- Firestore schema changes.
- New Firestore listeners.
- Repeated queries for rail data.
- Polling or intervals.
- New dependencies.
- Feed ranking changes.
- SmartTalk logic changes.
- Profile logic changes.
- Explore logic changes beyond route-local presentation.
- Routing changes.
- Notebook/Highlight changes.
- Downloader, SEO, Authentication, Notifications behavior changes.

## Recommended architecture

Use a shared presentational `DesktopWorkspaceShell` plus route-owned rail data.

```text
DesktopWorkspaceShell
  leftRail: ReactNode
  center: ReactNode
  rightRail: ReactNode
```

Behavior:

- Hidden below 1400px.
- Below 1400px, render the current route content exactly as today.
- At/above 1400px, render:
  - left rail: 220-260px;
  - center: 760-820px;
  - right rail: 260-320px.
- Keep the browser window as the only primary scroll container.
- Rails use sticky positioning with a top offset below the fixed header.

## Recommended file ownership after approval

Minimal likely files:

- `src/App.tsx`
  - Keep route lazy loading.
  - Avoid global data loading.
  - Optionally provide a desktop shell wrapper only if it can remain presentational.

- `src/components/KnowledgeFeed/KnowledgeFeed.tsx`
  - Own feed-derived rail selectors.
  - Pass loaded data into desktop rail modules.
  - Do not add reads/listeners.

- `src/components/KnowledgeFeed/FeedRenderer.tsx`
  - Place the desktop workspace around existing feed content.
  - Keep `KnowledgeCardList` unchanged.
  - Keep current mobile/tablet markup path intact.

- New small presentational components, if approved:
  - `src/components/DesktopWorkspaceShell.tsx`
  - `src/components/KnowledgeFeed/DesktopFeedRails.tsx`

Avoid touching:

- `src/components/KnowledgeCardList.tsx` unless a measured bug appears.
- `src/components/KnowledgeCard/*`.
- `src/components/SmartTalk.tsx`.
- `src/components/Profile.tsx`.
- `src/components/Explore.tsx` logic.
- `src/context/NotebookContext.tsx`.
- Firestore utility modules.

## Proposed implementation phases

### Phase 0 - Approval gate

No code changes before approval.

Required approval item:

- Confirm the recommended route-owned desktop shell architecture.

### Phase 1 - Layout shell

Create a tiny presentational shell:

- Uses CSS/Tailwind only.
- Activates at `min-width: 1400px`.
- Keeps existing single-column markup for smaller widths.
- Uses a max workspace width that can fit:
  - left 240px;
  - center 780-800px;
  - right 280px;
  - gaps 24-32px.

Implementation rule:

- Do not move the virtualized list into an independent scroll container.
- Do not change card width on tablet/mobile.

### Phase 2 - Feed rail data selectors

Inside `KnowledgeFeed`, derive small memoized rail view models from existing state:

- current visible/focused entry;
- loaded `visibleEntries` / `filteredEntries`;
- loaded `journeyQuestions`;
- active category/topic;
- selected hashtag;
- local identity.

Selectors should return small display models:

```text
{ id, label, title, description, href/action }
```

Do not store duplicate full entries in rail state.

### Phase 3 - Left rail modules

Recommended first-release left rail:

- Quick Navigation
- Continue Reading
- Reading Progress
- Trending Categories / Tags from loaded entries

Rules:

- Use only local loaded data.
- Limit to small item counts.
- No Firestore imports.
- No timers.
- No social metrics panel.

### Phase 4 - Right rail modules

Recommended first-release right rail:

- Knowledge Journey for current/focused entry.
- Related Posts from loaded entries.
- Related SmartTalk from existing `journeyQuestions`.
- Same Author from loaded entries.
- Continue Learning via existing category/topic metadata.

Rules:

- Do not render full `KnowledgeCard`.
- Use compact rows.
- Avoid updating on every scroll frame.

### Phase 5 - Route handling

Initial desktop behavior:

- Knowledge Feed gets full left/center/right workspace because it owns reusable loaded data.
- Explore, SmartTalk, and Profile keep current content behavior and can remain centered inside the desktop shell unless route-local rails are implemented with existing route data only.

If route-local rails are added in Z.1, they must be presentation-only:

- Explore: derived from its own loaded `entries`, `questions`, `profiles`, and topic stats.
- SmartTalk: derived from already-loaded `questions`.
- Profile: derived from already-loaded `profile`, `sharedEntries`, and `smartTalkSummary`.

Do not preload route data globally.

### Phase 6 - Responsive preservation

Required invariants:

- Mobile layout remains pixel-identical.
- Tablet layout remains pixel-identical.
- Desktop center column remains 760-820px.
- Existing mobile bottom navigation remains unchanged.
- Existing route overlays remain unchanged.

Implementation check:

- All desktop-only classes must be gated at 1400px+.
- Existing `sm`, `md`, and regular classes must not be rewritten unless necessary.

### Phase 7 - Validation

Required commands after implementation approval:

```bash
npm run build
npx tsc --noEmit
git diff --check
```

Required QA:

- Desktop >1400px:
  - three-column adaptive shell;
  - center width 760-820px;
  - sticky rails;
  - feed virtualization still works;
  - no console errors.
- Tablet:
  - current layout unchanged.
- Mobile:
  - current layout unchanged.
- Route QA:
  - Home feed.
  - Focused post.
  - Explore.
  - SmartTalk.
  - Profile.
  - Profile My Notes remains lazy.

## Acceptance criteria

Z.1 is implementation-ready only if:

- no new dependency is added;
- no rail component imports Firestore;
- no new listener/query exists for rails;
- mobile/tablet rendering is unchanged;
- center reading width stays within 760-820px on desktop;
- rails are sticky and calm;
- virtualization remains window-scroll based;
- build, strict TypeScript, and diff check pass.

## Stop condition

Stop here until architecture approval is received.
