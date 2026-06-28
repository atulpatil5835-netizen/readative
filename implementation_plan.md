# Readative Release X Implementation Plan

Date: 2026-06-27

## Objective

Release X hardens the engineering quality of the live production application without changing product behavior.

No features, redesigns, Firestore schema changes, routing changes, SEO changes, SmartTalk logic changes, feed ranking changes, downloader changes, or highlight behavior changes are allowed.

## Audit Boundary

`engineering_audit.md` was completed before source edits. The implementation below is limited to low-risk cleanup backed by the audit.

## Safe Compression Scope

1. Remove provably unused imports, props, locals, and derived values.
2. Remove dead internal components that are not imported anywhere.
3. Remove dead unreachable code paths that have no visible route or UI entry point.
4. Consolidate exact duplicate utility behavior only when inputs and outputs remain identical.
5. Consolidate repeated lazy import boilerplate where module behavior remains unchanged.

## Planned Source Changes

- `src/App.tsx`
  - Remove unused `handleOpenAboutPanel`.
  - Consolidate duplicated lazy import setup for `AppPanels`.
  - Stop passing the unused `onOpenComposer` prop to `Header`.

- `src/components/Header.tsx`
  - Remove unused `onOpenComposer` prop.

- `src/components/Auth.tsx`
  - Remove dead `IdentityPrompt` and `UsernamePrompt` components.
  - Remove icons only used by those dead components.
  - Keep `GoogleSignInPrompt` behavior identical.

- `src/components/KnowledgeCard/CardHeader.tsx`
  - Stop destructuring unused `entry`.

- `src/components/KnowledgeCard/cardTypes.ts`
  - Remove unused import.

- `src/components/KnowledgeCard/highlightHelpers.tsx`
  - Remove unused array-map index.

- `src/components/KnowledgeCard/KnowledgeCard.tsx`
  - Remove unused top-level `html-to-image` namespace import.
  - Keep dynamic PNG export import unchanged.

- `src/components/KnowledgeFeed/feedTypes.ts`
  - Convert imports to the smaller type set actually used.

- `src/components/KnowledgeFeed/feedHelpers.ts`
  - Remove unused imports from the prior component split.
  - Re-export the existing shared `tokenizeSearch` helper instead of duplicating it.

- `src/components/KnowledgeFeed/KnowledgeFeed.tsx`
  - Remove unused imports only.

- `src/components/KnowledgeFeed/FeedRenderer.tsx`
  - Remove unused `FeedMessage` import.
  - Remove dead `PostDiscoveryLinks` component.

- `src/components/Profile.tsx`
  - Remove the unreachable `liked` profile section type.
  - Remove dead liked-section state, listener, pagination, and derived values.
  - Keep shared posts, saved posts, highlights, activity, and profile behavior unchanged.

- `src/components/SmartTalk.tsx`
  - Remove unused `visibleQuestionRows` memo.

- `server.ts`
  - Remove the nonessential startup `console.log`.
  - Keep server startup behavior unchanged.

## Behavior Preservation Checks

- Header create FAB remains in `App.tsx`.
- Header account menu remains unchanged.
- Google sign-in prompt remains unchanged.
- Knowledge card download/highlight/share/save/comment/trust behavior remains unchanged.
- SmartTalk visible question rendering continues to use `visibleQuestions`.
- Profile visible sections remain Posts, Activity, Saved, and Highlights.
- Knowledge Journey remains unchanged.

## QA Plan

- `npx tsc --noEmit`
- `npm run build`
- `git diff --check`
- Browser smoke:
  - Desktop Home / Knowledge Journey
  - SmartTalk
  - Profile
  - Search shell
  - Notifications panel
  - Tablet Home
  - Mobile Home / Profile

## Completed Verification

- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- `git diff --check`: passed with line-ending warnings only.
- Browser smoke passed for desktop, tablet, mobile, guest profile, notifications, SmartTalk, Explore/Search, Knowledge Journey, card actions, Download menu presence, and Highlight Mode control presence.

## Stop Condition

If any cleanup touches behavior-sensitive logic beyond unused/dead code removal, stop and produce a recovery report instead of continuing blindly.
