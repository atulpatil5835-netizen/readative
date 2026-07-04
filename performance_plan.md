# Release Z.1.1 — Performance Plan

Status: performance plan complete. No implementation started.

## Budget

- Startup bundle target: 0 KB.
- Startup bundle maximum: under 1 KB gzip.
- New dependencies: none.
- Firestore reads: 0.
- Firestore writes: 0.
- Firestore listeners: 0.
- Polling: none.
- Timers/intervals: none.
- New scroll listeners: none.

## Data policy

Use only data already loaded in the current feed session:

- `filteredEntries`
- `visibleEntries`
- `desktopEntries`
- `focusedEntry`
- `journeyEntries`
- `journeyQuestions`
- `profiles`
- active category/topic/hashtag state

Do not fetch:

- additional posts
- contributor records
- SmartTalk questions
- profile details
- recommendation documents

## Render strategy

- Use `useMemo` for derived rail data.
- Keep item counts low:
  - 3–4 continue/recommended posts
  - 3 related posts
  - 2 same-author posts
  - 5 tags/categories
  - 3 discussions/contributors
- Filter empty modules before render.
- Render no placeholder cards.
- Avoid broad per-render loops beyond already loaded arrays.
- Do not introduce new component state unless reusing the existing visibility callback for a tiny recent/context list.

## Memory strategy

Expected memory impact after approval:

- Near zero if rails are derived only from existing arrays.
- If recently viewed is implemented, keep a bounded in-memory list of ids, for example no more than 5.

No persistent storage should be added.

## Listener/timer strategy

Do not add:

- scroll listeners
- resize listeners
- IntersectionObservers
- polling
- timers
- intervals

Allowed:

- Reusing the existing card visibility callback path that already exists in the feed.
- CSS-only transitions for visual replacement.

## Bundle strategy

Keep implementation local and compact:

- No new dependency.
- No new route/module split.
- Prefer local helpers inside `FeedRenderer.tsx`.
- Avoid large icon additions unless already imported or necessary.
- Reuse existing rail primitives and existing `KnowledgeJourney`.

Expected bundle impact: under 1 KB gzip.

## Validation plan after approval

Commands:

- `npm run build`
- `npx tsc --noEmit`
- `git diff --check`

Desktop QA:

- Long article.
- Short article.
- Article end.
- Multiple consecutive posts.
- No empty desktop columns.
- Sticky behavior.
- No layout shift.
- Console clean.

Tablet QA:

- Existing layout unchanged.
- Rails hidden.
- No horizontal overflow.

Mobile QA:

- Existing layout unchanged.
- Rails hidden.
- No horizontal overflow.

## Success criteria

- Desktop rails remain useful during long reading.
- No empty modules or placeholder rail cards are visible.
- No extra Firestore or listener cost.
- No virtualization changes.
- No mobile/tablet behavior change.
