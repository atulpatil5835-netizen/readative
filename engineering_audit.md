# Readative Release X Engineering Audit

Date: 2026-06-27

## Scope

Release X is a production hardening pass. The audit covered source structure, imports, exports, Firestore usage, CSS surfaces, dialogs, loading states, bundle composition, and current TypeScript/build posture.

No source code was modified before this audit was completed.

## Current Workspace State

The workspace already contains uncommitted changes from previous releases, including Release R1 Knowledge Journey work. Release X treats those changes as the live baseline and does not revert them.

## High-Level Findings

The application is functional and already uses several production-grade patterns:

- Route-level lazy loading for Knowledge Feed, SmartTalk, Profile, Explore, and panels.
- Virtualized feed rendering in `KnowledgeCardList`.
- Shared skeleton primitives in `Skeletons.tsx`.
- Shared visual shell classes from P1.2 in `src/index.css`.
- Central route helpers in `routes.ts`.
- Central trust/bookmark/profile helpers in utility modules.

The main engineering debt is not one broken area; it is repeated AI-generated logic distributed across large feature components.

## Largest Complexity Centers

- `src/components/Profile.tsx`: about 2,900 lines.
- `src/components/KnowledgeFeed/KnowledgeFeed.tsx`: about 2,000 lines.
- `src/components/Explore.tsx`: about 1,700 lines.
- `src/components/SmartTalk.tsx`: about 1,700 lines.
- `src/components/KnowledgeCard/KnowledgeCard.tsx`: about 1,570 lines.
- `src/components/KnowledgeFeed/feedHelpers.ts`: about 1,290 lines.
- `src/utils/feedPersonalization.ts`: about 1,140 lines.

These should not be aggressively split in Release X because behavior preservation is non-negotiable.

## Duplicate Components

- `src/components/KnowledgeFeed.tsx` and `src/components/KnowledgeCard.tsx` are bridge re-exports, not duplicate implementations. Keep for backward compatibility.
- Dialog implementations share styling through `readative-dialog-surface`, but dialog structure is still repeated in Auth, Composer, Edit Post, Profile Avatar Picker, SmartTalk ask, and sign-out confirmation.
- `InfoPanel` and `NotificationsPanel` share `AppPanels.tsx`, but `App.tsx` declares two separate lazy imports for the same module.

## Duplicate Hooks / Interaction Logic

- Header account menu and Knowledge card action menu repeat outside-click and Escape-key dismissal logic.
- Multiple modal components repeat Escape-key close handling.
- Feed and Knowledge card visibility use separate IntersectionObserver helper paths.

These are candidates for a future shared hook, but extracting them now risks focus and menu regressions.

## Duplicate Helpers

Repeated helper families were found:

- Timestamp normalization in `api/_seoData.ts`, `Explore.tsx`, `KnowledgeFeed/feedHelpers.ts`, and R1 journey code.
- String-array normalization in `api/_seoData.ts`, `Explore.tsx`, and feed helpers.
- SmartTalk question hydration in `SmartTalk.tsx`, `Explore.tsx`, `Profile.tsx`, and R1 journey preview code.
- Topic text matching in `Explore.tsx` and R1 journey relevance logic.
- `tokenizeSearch` exists in both `utils/searchHelpers.ts` and `KnowledgeFeed/feedHelpers.ts`.

Only exact behavior-identical consolidation is safe in this release.

## Duplicate Firestore Queries

Queries are mostly route-scoped and intentional:

- Knowledge Feed owns live/paginated Knowledge post loading.
- Explore loads limited Knowledge, SmartTalk, and Profile discovery snapshots.
- SmartTalk owns its own category-aware question subscription and pagination.
- Profile owns profile, shared posts, saved items, and SmartTalk summary loading.
- Release R1 added a single active-feed SmartTalk preview query for Knowledge Journey.

One dead query path was found:

- `Profile.tsx` still contains a `liked` section listener and pagination path, but there is no visible `Liked` section button and route parsing never selects `liked`. This creates dead state and a potentially unreachable Firestore listener path.

## Duplicate CSS

Shared P1.2 classes exist, but many surfaces still repeat Tailwind shell strings:

- `rounded-[24px] border ... shadow-sm` notices and cards.
- Dashed empty states in Feed and Profile.
- SmartTalk/Explore white card shells with near-identical borders and shadows.
- Repeated legal/info panel inner cards.

Release X should not visually restyle these. Safe work is limited to removing dead CSS if proven unused.

## Duplicate Loading / Empty States

- Shared skeletons are centralized in `Skeletons.tsx`.
- `ExploreSkeleton` remains local to `Explore.tsx`.
- Empty states are repeated in Feed, SmartTalk, Profile, ProfileHighlights, AppPanels, and KnowledgeCard comments.

No safe visible consolidation is planned because wording and spacing are user-visible.

## Dead Components / Dead Utilities

Safe dead-code candidates:

- `IdentityPrompt` and `UsernamePrompt` in `Auth.tsx` are exported but not imported anywhere.
- `PostDiscoveryLinks` in `FeedRenderer.tsx` is dead after R1 replaced focused-only discovery with Knowledge Journey.
- `visibleQuestionRows` in `SmartTalk.tsx` is computed but never rendered.
- Profile `liked` section state/effects/pagination are unreachable from visible navigation and route parsing.

## Unused Imports, Props, State, and Locals

`npx tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` reported unused code in:

- `App.tsx`: `handleOpenAboutPanel`.
- `Header.tsx`: `onOpenComposer` prop.
- `CardHeader.tsx`: unused `entry` prop read.
- `cardTypes.ts`: unused `ComponentType` import.
- `highlightHelpers.tsx`: unused map index.
- `KnowledgeCard.tsx`: unused top-level `html-to-image` namespace import.
- `feedHelpers.ts`: multiple unused imports from an earlier split.
- `FeedRenderer.tsx`: unused `FeedMessage` import and dead `PostDiscoveryLinks`.
- `feedTypes.ts`: unused imported types.
- `KnowledgeFeed.tsx`: unused Firestore/filter/helper imports.
- `Profile.tsx`: unused liked-section state, derived values, and pagination callback.
- `SmartTalk.tsx`: unused `visibleQuestionRows`.

## Unused Assets

No obvious removable public assets were identified. Logos, favicons, manifest icons, robots, AMP HTML, and SEO images are referenced by HTML, API output, SEO helpers, or public metadata.

## Unreachable Code

- The `liked` profile section is unreachable from current UI and route parsing.
- `PostDiscoveryLinks` is exported but not used after R1.
- Legacy username prompt components are unreachable after Google auth became the active auth path.

## Overly Complex Components

Profile, KnowledgeFeed, SmartTalk, Explore, and KnowledgeCard are overly large. A full decomposition would be valuable but is not safe for the final behavior-preserving release. Release X should remove dead code and obvious duplication without changing component boundaries.

## Build / Type Status Before Release X Edits

- Normal `npx tsc --noEmit` passed at the end of R1.
- Normal `npm run build` passed at the end of R1.
- Strict unused TypeScript check failed with unused-code findings listed above. This check is not part of the current project config but is useful for hardening.

## Safe Release X Implementation Candidates

Proceed with:

- Remove unused imports and props proven by TypeScript.
- Remove dead Auth username prompt exports.
- Remove dead `PostDiscoveryLinks`.
- Remove dead SmartTalk `visibleQuestionRows`.
- Remove unreachable Profile liked-section state/effects/pagination.
- Reuse existing `utils/searchHelpers.tokenizeSearch` in feed helpers.
- Consolidate duplicated AppPanels lazy module import in `App.tsx`.

Do not proceed with:

- Rewriting large feature components.
- Consolidating hydrators across API/Explore/Profile/SmartTalk.
- Changing Firestore query behavior for visible routes.
- Changing UI shells, layout, copy, SEO, routes, feed ranking, downloader, highlights, or SmartTalk logic.
