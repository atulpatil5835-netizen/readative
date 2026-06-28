# Readative Release X Task List

## Release Type

Engineering compression and production hardening for the live production application.

Release X preserves product behavior. It does not add features, redesign UI, change Firestore schema, alter routing, modify SEO, change SmartTalk logic, change feed ranking, change Downloader behavior, or change Highlight behavior.

## Audit Tasks

- [x] Read the Release X brief completely before implementation.
- [x] Audited source structure, feature boundaries, utilities, CSS, dialogs, loading states, Firestore queries, assets, and build posture.
- [x] Created `engineering_audit.md` before source edits.
- [x] Confirmed the workspace already contained prior P1.2/R1 changes and treated those as the live baseline.
- [x] Identified duplicate helper behavior, dead components, unused imports, unused props, unused state, unreachable profile code, and repeated lazy import boilerplate.
- [x] Confirmed large components should not be split during Release X because behavior preservation is the priority.

## Implementation Tasks

- [x] Removed unused `Header` composer prop plumbing.
- [x] Consolidated duplicate lazy imports for `AppPanels`.
- [x] Removed dead Auth prompt components that were no longer imported.
- [x] Removed unused KnowledgeCard imports, props, and locals.
- [x] Reused the existing shared `tokenizeSearch` helper instead of keeping a duplicate feed helper implementation.
- [x] Removed unused KnowledgeFeed imports and dead focused-post discovery export.
- [x] Removed unreachable Profile liked-section state, listener, pagination, and derived values.
- [x] Removed unused SmartTalk derived rows.
- [x] Removed the nonessential backend startup `console.log`.
- [x] Preserved all user-visible behavior and existing data contracts.

## Files Created

- `engineering_audit.md`

## Files Modified By Release X

- `implementation_plan.md`
- `task.md`
- `walkthrough.md`
- `server.ts`
- `src/App.tsx`
- `src/components/Auth.tsx`
- `src/components/Header.tsx`
- `src/components/KnowledgeCard/CardHeader.tsx`
- `src/components/KnowledgeCard/KnowledgeCard.tsx`
- `src/components/KnowledgeCard/cardTypes.ts`
- `src/components/KnowledgeCard/highlightHelpers.tsx`
- `src/components/KnowledgeFeed/FeedRenderer.tsx`
- `src/components/KnowledgeFeed/KnowledgeFeed.tsx`
- `src/components/KnowledgeFeed/feedHelpers.ts`
- `src/components/KnowledgeFeed/feedTypes.ts`
- `src/components/Profile.tsx`
- `src/components/SmartTalk.tsx`

The worktree also contains prior release changes in P1.2/R1 files. Release X did not revert or rewrite those existing changes.

## Duplicate Code Removed

- Removed the duplicate `tokenizeSearch` implementation from feed helpers and re-exported the shared utility from `src/utils/searchHelpers.ts`.
- Consolidated duplicate AppPanels lazy import setup in `App.tsx`.

## Dead Code Removed

- Dead Auth username/identity prompt components.
- Dead `PostDiscoveryLinks` export after R1 Knowledge Journey replaced the focused-only discovery surface.
- Unused SmartTalk `visibleQuestionRows` memo.
- Unreachable Profile `liked` section type, state, query path, pagination, and derived ordering.
- Unused imports, props, locals, and map indexes reported by strict TypeScript checks.

## Shared Utilities Created

No new utility module was created. Release X intentionally reused the existing shared search helper instead of introducing another abstraction.

## Performance And Bundle Observations

- Profile chunk decreased from about `58.20 kB / gzip 16.40 kB` after R1 to `55.17 kB / gzip 15.76 kB`.
- SmartTalk chunk decreased from about `32.33 kB / gzip 9.63 kB` to `32.02 kB / gzip 9.55 kB`.
- CSS output decreased from about `77.17 kB / gzip 13.53 kB` to `75.78 kB / gzip 13.37 kB`, including earlier release polish already in the worktree.
- Rendering work was reduced by removing unreachable Profile liked-section listeners and unused derived state.

## Regression Verification

- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false`: passed during hardening.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- `git diff --check`: passed with line-ending warnings only.
- Browser QA desktop: Home loaded, search shell present, Knowledge Journey rendered after the loaded post, and no console warnings or errors appeared.
- Browser QA notifications: notification button opened the lazy-loaded panel and closed cleanly.
- Browser QA SmartTalk: route loaded with search shell and expected headings.
- Browser QA Explore/Search: route loaded with unified search shell.
- Browser QA Profile guest state: Google sign-in shell loaded and no visible liked-section route remained.
- Browser QA card controls: post action menu opened and still exposed Save, Share, and Download actions; Highlight Mode control remained visible.
- Browser QA tablet: Home loaded with Knowledge Journey and no horizontal overflow.
- Browser QA mobile: Home and Profile loaded; mobile Profile had no horizontal overflow. Home had a `4px` overflow tolerance observation with no visible regression from Release X.
- Browser console during QA: `0` warnings/errors.

## Remaining Work

No Release X implementation work remains.

Large components such as Profile, KnowledgeFeed, SmartTalk, Explore, and KnowledgeCard are still candidates for future planned decomposition, but that work was intentionally left out because it would carry behavior risk.

## Production Readiness

Release X is production-ready.

The release removes proven dead code and duplicate helper behavior, improves strict TypeScript cleanliness, preserves visible behavior, and passes build, TypeScript, diff, and browser smoke verification.
