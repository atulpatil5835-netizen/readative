# Readative Release Y — Ink System Implementation Plan

Date: 2026-07-01

Status: Proposed sequence only; no implementation authorized

## Objective

Evolve the working Highlight feature into the approved Ink architecture through small, independently reversible releases. The current Highlight System remains the production default until all gesture, rendering, anchoring, storage, migration, accessibility, and performance gates pass.

## Non-Implementation Boundary for This Release

The architecture phase creates only:

- `architecture.md`
- `implementation_plan.md`
- `engineering_risk.md`
- `migration_plan.md`
- `task.md`

It does not alter source code, UI, routes, Firestore data, security rules, indexes, dependencies, or deployed behavior.

## Delivery Principles

1. Add before replacing.
2. Keep Highlight as the rollback path until post-migration verification is complete.
3. Never dual-write the same gesture into both systems.
4. Keep each release small enough to disable independently.
5. Ship no drawing dependency; use browser APIs and native SVG.
6. Treat gesture acceptance and anchor correctness as production blockers, not polish.
7. Measure initial bundle, feed reads, DOM mounts, and mobile frame timing in every implementation release.

## Proposed Release Sequence

### Y0 — Architecture Approval

Scope: documentation only.

Deliverables:

- Approve or revise the state machine, settings interaction, renderer, anchor model, Firestore schema, My Notes behavior, migration order, budgets, and stop conditions.
- Confirm that tapping Ink from the base feed may reuse `/post/:id` and focus the existing card before arming.
- Confirm that unresolved annotations fail closed instead of being drawn at a guessed location.

Exit gate:

- Explicit user approval to begin implementation.

### Y1 — Isolated Ink Core Behind a Disabled Flag

Scope: no user-visible replacement and no production data migration.

Planned additions after approval:

- Ink domain types and color/width enums.
- Stroke sampling, simplification, quantization, codec, and SVG-path conversion.
- Content revision and anchor projection utilities.
- A repository interface with an in-memory test implementation.
- Unit fixtures for reflow, edit, orientation, and malformed vectors.
- A disabled feature flag that tree-shakes or dynamically excludes the feature from normal startup.

Likely files:

- New isolated `src/ink/` modules.
- Test/fixture files only outside the existing feature surfaces.

Verification:

- Codec round-trip is deterministic.
- Invalid vectors and out-of-range enums are rejected.
- Simplification stays within an approved visual error tolerance.
- The production UI and current Highlight behavior are unchanged.
- Initial bundle delta is zero when the flag is disabled.

Rollback:

- Remove/disable the isolated import; no data or UI rollback required.

### Y2 — Gesture and SVG Prototype on the Focused Post

Scope: internal/flagged prototype using memory only. The current Highlight button remains the production control.

Planned work:

- Reuse `focusedEntryId` and `/post/:id` as the single Ink surface.
- Add the OFF → VIEWING/ARMED → CANDIDATE → DRAWING → COMMITTING state machine behind the flag.
- Implement the timed first-move handoff and cancellation paths.
- Mount one lazy SVG overlay only for the focused post.
- Add the temporary inline settings rail behind the flag.
- Keep all strokes in memory; no Firestore write.

Likely existing seams touched:

- `src/components/KnowledgeCard/KnowledgeCard.tsx`
- `src/components/KnowledgeCard/CardTrust.tsx`
- `src/components/KnowledgeCard/CardContent.tsx`
- `src/components/KnowledgeCard/cardTypes.ts`
- Existing route callback plumbing only if required; no new route

Required device matrix:

- iPhone Safari: current and previous supported iOS.
- Android Chrome on a mid-tier device.
- Samsung Internet.
- Windows touch device in Edge.
- Desktop Chrome/Edge with mouse.
- Stylus device where available.

Exit gates:

- Ordinary scrolls do not create strokes.
- Hold-and-draw does not scroll the page while the stroke is active.
- Release restores native scrolling immediately.
- Pinch zoom, links, selection outside Ink, and controls remain usable.
- No global non-passive touch listener exists while not drawing.
- 500 simplified strokes meet the SVG performance gate.

Rollback:

- Disable the flag; no persistent data exists.

### Y3 — Additive Private Storage and Focused-Post Loading

Scope: approved beta users only; Highlight remains available to everyone else.

Firestore prerequisites after explicit approval:

- Owner-scoped `/userInk/{uid}/posts/{postId}` and `/chunks/{chunkId}` security rules.
- Validation for schema version, allowed fields, enums, and bounded payloads.
- Single-field index exemptions for vector/anchor/preview payload fields.
- Emulator rule tests for cross-user denial and malformed writes.

Planned app work:

- Add the Firestore Ink repository behind a dynamic import.
- Read one manifest only on a focused post after initial content paint or on explicit activation.
- Fetch bounded chunks only when the manifest exists.
- Batch session-chunk and manifest writes on release.
- Support offline pending/failed state without a Done button.
- Add delete-all-notes-for-post while preserving source chunks until confirmed.
- Do not add any realtime Ink listener.

Exit gates:

- Feed reads/listeners remain unchanged at zero Ink activity.
- Cross-user reads and writes fail in emulator tests.
- 1, 40, 200, and 500-stroke fixtures stay under chunk limits.
- Two tabs and two devices do not overwrite source strokes.
- Network failure, offline mode, route change, and app backgrounding do not silently lose a released stroke.

Rollback:

- Disable beta flag. Additive Ink data remains private and untouched.

### Y4 — My Notes Beta

Scope: new private tab for beta users; existing Highlights remains the default for non-beta users.

Planned work:

- Build `MyNotes` as a lazy profile section.
- Query manifests only when the tab is opened: `orderBy(lastAnnotatedAt, desc)`, `limit(12)`, cursor pagination.
- Hydrate title/author from current canonical post data using cache-first, bounded ID reads.
- Generate preview SVG paths by decoding the manifest's bounded preview vectors.
- Add Continue Reading through the existing route.
- Add the confirmed delete-notes action.
- Handle deleted/private/unavailable posts without revealing stale duplicated content.

Likely existing seams touched:

- `src/components/Profile.tsx`
- Replaceable `src/components/ProfileHighlights.tsx` slot or a new lazy `MyNotes` component
- `src/utils/routes.ts` only for the `notes` section alias; no content route change

Exit gates:

- Opening any other Profile section causes zero Ink reads.
- First page is bounded to 12 manifest documents and at most 12 missing post documents.
- No post body is loaded to create a preview.
- No image, screenshot, canvas snapshot, selected snippet, title, or author is stored in Ink.
- Old `?tab=highlights` links can resolve safely during migration.

Rollback:

- Hide My Notes beta; existing Highlights remains intact.

### Y5 — Legacy Conversion and Controlled Cutover

Scope: convert legacy ranges without deleting their source documents, then rename the production UI.

Planned work:

- Freeze new legacy Highlight writes only for users entering the Ink rollout.
- Read legacy highlights on demand, never through the current app-wide listener for migrated users.
- Convert each valid range into deterministic blue underline vectors with semantic anchors; do not copy `selectedText`, title, or author into Ink.
- Use deterministic migration chunk IDs and `migrationVersion` for idempotency.
- Compare per-user/per-post source counts, converted counts, unresolved counts, and duplicate IDs.
- Show Ink/My Notes only after the user's conversion audit succeeds.
- Rename Highlight to Ink and Highlights to My Notes for the approved cohort.
- Preserve the delete capability and old route alias.

Exit gates:

- No migrated user loses access to a valid prior mark.
- Re-running migration creates no duplicate stroke.
- Unresolvable legacy data remains in `userHighlights` and is reported; it is never silently deleted.
- Rollback can return the user to the untouched Highlight experience.

Rollback:

- Restore the old feature flag and legacy read path. Do not delete Ink or Highlight data.

### Y6 — General Availability and Deferred Cleanup

Scope: production replacement only after a stable observation window and separate approval.

Planned work:

- Make Ink the default.
- Remove the app-wide Highlight listener and legacy write path from the startup graph.
- Keep the read-only legacy adapter lazy for users with unresolved legacy documents.
- Retain old route aliases.
- After the agreed retention window, produce a deletion proposal for obsolete legacy documents/code. Deletion is not automatic and requires explicit approval.

Exit gates:

- Error, gesture, write-failure, anchor-resolution, read-count, and frame-time metrics remain within budgets for the observation window.
- No rollback has been required for the approved period.
- A separate cleanup audit proves that no user data or reachable capability depends on the old path.

## Implementation Ownership Map

| Concern | Owner | Must not own |
| --- | --- | --- |
| Route/focused post | Existing app and feed routing | Stroke storage or projection |
| Card shell | Existing `KnowledgeCard` seams | Pointer sampling loop |
| Ink controller | Active post and gesture state | User-wide annotation collection |
| Ink surface | Gesture arbitration and live SVG | Firestore query policy |
| Projection/codec | Geometry, anchors, hashes, path output | React UI |
| Repository | Bounded reads/writes and migration adapter | Rendering |
| My Notes | Pagination, canonical metadata, preview, navigation | Full stroke-chunk loading |
| Legacy adapter | Read/convert old ranges | New Ink writes after cutover |

## Data and API Contracts to Freeze Before UI Work

- Color and width enums.
- Stroke ID and session chunk ID format.
- Geometry quantization and codec version.
- Anchor schema and resolution outcomes: exact, reflowed, relocated, unresolved.
- Manifest/chunk schema and byte ceilings.
- Preview viewBox and path cap.
- Repository read/write/delete result types.
- Migration idempotency key.
- Telemetry events that contain IDs/status only and never note geometry or nearby text.

## Verification Plan

### Static and build

- TypeScript compile.
- Production build.
- `git diff --check`.
- Bundle analyzer comparison against the pre-Ink baseline.
- Dependency graph check proving no new drawing package and no Ink code in initial startup.

### Gesture

- Slow/fast vertical scroll, diagonal scroll, flick, repeated scroll.
- Short tap, long hold without movement, hold then underline, circle, arrow, vertical mark, and scribble.
- Hold near links/buttons/media and across paragraph boundaries.
- Multi-touch and pinch zoom.
- Route change, notification interruption, app background, pointer cancel, and rotation mid-stroke.
- Tremor/slop testing and left/right-hand use.

### Rendering and anchors

- 1, 40, 200, and 500 strokes.
- All 15 color/width combinations.
- Narrow/wide mobile, tablet, desktop, portrait/landscape.
- Font size/zoom changes.
- Paragraph inserted, removed, split, merged, and edited.
- Same quote repeated multiple times.
- Deleted/private post and missing content.

### Firestore and offline

- No Ink reads on feed/app startup.
- Cache hit, cold manifest miss, existing manifest, and paginated My Notes.
- Chunk rollover at count and byte limits.
- Offline release, reconnect, rejected write, and retry.
- Two tabs and two devices.
- Unauthorized and malformed operations in the emulator.
- Idempotent legacy conversion and rollback.

## Performance Acceptance Gates

- Initial JS increase: no more than 1 KiB gzip.
- Lazy Ink interaction chunk: no more than 12 KiB gzip; 6–10 KiB target.
- Base feed: zero Ink Firestore reads/listeners and zero mounted Ink SVGs.
- No React state update per pointer sample.
- No long task over 50 ms caused by Ink surface mount or a normal stroke commit on the agreed test device.
- Drawing loop: p95 frame work fits a 16.7 ms frame on the agreed mid-tier mobile test device.
- Scroll behavior before the hold remains native and visually indistinguishable from Ink OFF.
- Focused annotated post: bounded summary/chunk reads only.
- My Notes: exactly paginated manifest reads; no eager full-history query.

## Stop Conditions

Stop rollout and return to the prior flag if any of the following occurs:

- Intentional scrolling can create a saved stroke.
- Drawing can leave scrolling blocked after release/cancel.
- Pinch zoom is disabled outside the single active stroke.
- An unresolved anchor is rendered against unrelated text.
- A released stroke can be silently lost on a normal route/background transition.
- A user can read or write another user's Ink.
- Ink enters the initial bundle above budget or introduces feed reads/listeners/hidden overlays.
- Legacy conversion deletes, duplicates, or exposes selected snippets.

## Approval Requirement

Implementation begins only after explicit approval of this plan and its linked architecture, risk, and migration decisions.
