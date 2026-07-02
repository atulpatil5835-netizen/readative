# Readative Release Y — Highlight-to-Ink Migration Plan

Date: 2026-07-01

Status: Proposed migration only; no Firestore or production changes authorized

## Migration Goal

Move users from text-range yellow Highlights to blue-pen vector Ink without losing valid marks, duplicating new writes, copying text snippets into the new schema, changing `knowledge` post documents, or removing the rollback path prematurely.

## Current Data and Behavior

Current `userHighlights` documents contain:

- `userId`
- `postId`
- `selectedText`
- `paragraphIndex`
- `startOffset`
- `endOffset`
- `postTitle`
- `authorName`
- `createdAt`

Current runtime behavior:

- `HighlightsProvider` opens a user-wide realtime query on sign-in.
- Each `KnowledgeCard` filters the full user list for its post.
- Highlight mode is tracked as a post-ID boolean map.
- `CardContent` creates ranges from mouse/touch text selection.
- Yellow DOM `<mark>` elements render the ranges.
- Profile groups individual snippets into post cards and permits deletion.

This architecture works and remains the fallback until migration verification is complete.

## Target Mapping

| Legacy concept | Ink replacement | Migration rule |
| --- | --- | --- |
| One Highlight document | One synthetic underline stroke | Deterministic stroke ID derived from legacy document ID |
| `selectedText` | No target field | Use in memory for validation only; never copy |
| `paragraphIndex` | Block ordinal hint | Copy as numeric hint, not identity |
| `startOffset` / `endOffset` | Canonical text position and sparse pins | Validate against current content before conversion |
| `postTitle` / `authorName` | No target field | My Notes hydrates current canonical post metadata |
| `createdAt` | Stroke `at`; summary created/last time | Preserve original time |
| Yellow `<mark>` | Blue synthetic free-underline vector | Generate vector geometry; no bitmap/screenshot |
| Highlight list count | Annotated-post count | Count Ink manifests, not strokes |
| Delete one highlight | Delete notes for the post in initial Ink scope | Preserve at least the existing deletion capability |
| `?tab=highlights` | `?tab=notes` | Keep the old route as an alias |

## Migration Rules

1. Migration is additive. It never updates `knowledge` documents.
2. No legacy document is deleted during conversion or cutover.
3. New Ink documents never contain selected text, post title, author, body, image, or screenshot.
4. Conversion IDs are deterministic so retries cannot duplicate a stroke.
5. A user is cut over only after their migrated set passes count and resolution checks.
6. Unresolved or unavailable legacy ranges remain in `userHighlights` and remain recoverable.
7. The old system stays deployable through the observation window.
8. Cleanup is a separate future approval, never an automatic migration step.

## Proposed Phases

### M0 — Inventory Before Any Write

Read-only audit after implementation approval:

- Total users with legacy highlights.
- Total documents and distinct user/post pairs.
- Highlights per user and per post: median, p95, maximum.
- Missing/deleted post references.
- Invalid paragraph indexes or offsets.
- Duplicate legacy ranges.
- Documents with missing timestamps/title/author fields.
- Estimated vector/chunk output size.

Produce a migration report with counts only. Do not include selected text in logs or reports.

Stop if the maximum/invalid distributions invalidate chunk or anchor assumptions.

### M1 — Add Ink Without Routing Users to It

Prerequisites:

- Approved Ink rules/index exemptions.
- Tested repository and schema version.
- Feature flag defaults OFF.
- Current Highlight reads/writes unchanged.

No user is migrated in this phase. It proves additive deployment and rollback safety.

### M2 — Internal New-Ink Cohort

- Selected internal accounts create only Ink while the flag is enabled.
- They do not dual-write legacy Highlight documents.
- Existing legacy highlights for those accounts remain readable through the old UI or a flagged compatibility view.
- Validate storage size, Firestore reads/writes, offline behavior, and My Notes.

No legacy source document is changed.

### M3 — Legacy Conversion Prototype

For one opted-in internal user/post pair:

1. Read the legacy documents on demand.
2. Read the canonical `knowledge/{postId}` document.
3. Reconstruct current paragraphs using the same blank-line split as the legacy renderer.
4. Validate paragraph index, offsets, and selected-text match in memory.
5. Resolve the DOM range at a canonical content width.
6. Generate one or more free-underline polyline segments from the range rectangles.
7. Build numeric/hash-only semantic anchors and sparse text pins.
8. Write vectors to a deterministic migration chunk such as `legacy-v1-000`.
9. Write/update the Ink manifest and bounded vector preview.
10. Read the Ink data back, decode it, and compare source/converted identifiers and counts.

The resulting preview is generated from the stored vector geometry. No image, canvas snapshot, or screenshot is generated or stored.

If DOM reconstruction is unavailable, do not fabricate a mark from text length alone. Leave the item unresolved and keep it legacy-only.

### M4 — Idempotency and Audit Trial

Run the same conversion twice for a controlled cohort.

Required invariants:

- Second run writes no duplicate source stroke.
- Deterministic chunk contents remain stable.
- Every converted stroke records an opaque legacy source ID/hash, never selected text.
- `converted + duplicate + unresolved + unavailable = source total` for every user/post pair.
- Ink manifest stroke counts match decoded chunks.
- Preview vector count/bytes stay within limits.
- Reverting the flag restores unchanged Highlight behavior.

### M5 — Cohort Cutover

For one user at a time:

1. Freeze that user's new legacy Highlight writes by assigning them to Ink.
2. Convert all valid legacy items.
3. Complete the per-user audit.
4. If the audit passes, show Ink and My Notes for that user.
5. Keep legacy documents and the old read path intact but dormant.
6. If the audit fails, keep that user on Highlight and do not partially expose My Notes as complete.

Do not switch the entire user base based only on a global count. The correctness boundary is the individual user.

### M6 — General Cutover

Only after gesture, performance, security, durability, and cohort migration gates pass:

- Rename the card control from Highlight to Ink.
- Rename private Profile Highlights to My Notes.
- Stop all new `userHighlights` writes.
- Remove the app-wide legacy realtime listener from the default startup path.
- Keep the lazy legacy adapter for unresolved users/items.
- Keep `?tab=highlights` as an alias to My Notes.
- Keep current Highlight data untouched through the observation window.

### M7 — Deferred Legacy Cleanup

Not part of Release Y implementation unless separately approved.

Before any deletion:

- Prove no active user remains on legacy Highlight.
- Prove no unresolved item lacks an approved disposition.
- Export a final count-only audit and rollback snapshot/retention plan.
- Confirm the retention window has elapsed.
- Confirm support/incident metrics show no migration regression.
- Obtain explicit approval for data and code cleanup.

Deleting the `userHighlights` collection or old renderer without this phase is prohibited.

## Deterministic Conversion Design

### IDs

- Stroke ID: stable hash of `schemaVersion + legacyDocumentId`.
- Migration chunk IDs: stable ordered buckets per user/post, capped by both count and bytes.
- Freeze legacy writes for the migrating user before final deterministic bucketing.
- Manifest stores `migrationVersion`, aggregate counts, and last attempt status; it does not store an unbounded list of legacy IDs.

### Geometry

For each valid legacy text range:

- Resolve each current line rectangle.
- Generate a slightly imperfect underline polyline under that line to match the Ink aesthetic.
- Quantize into the same 0–4095 geometry format as native strokes.
- Store Blue and Medium enum values unless product approval chooses Thin for migrated marks.
- Add sparse character pins at segment endpoints and semantic position/hash anchors.
- Preserve the original timestamp.

This is a vector transformation, not text selection storage and not screenshot generation.

### Invalid data

Classify without deleting:

- `duplicate`: identical legacy range already represented by a deterministic target.
- `unresolved`: post exists but range no longer maps safely.
- `unavailable`: post is missing or inaccessible.
- `invalid`: malformed offsets/schema.
- `converted`: persisted and verified vector.

The migration report contains counts and opaque IDs only.

## My Notes Transition

During cohort migration:

- Non-migrated users continue to see Highlights.
- Fully migrated users see My Notes.
- A partially migrated user does not see a falsely complete My Notes tab.
- The My Notes tab uses Ink manifests as its post list.
- Legacy-only unresolved items remain available through a lazy compatibility path until disposition is approved.
- The tab badge counts annotated posts, not old highlight documents or new strokes.
- Continue Reading uses the existing `/post/:id` route.
- Deleting notes must not delete the canonical post or another user's data.

## Query and Listener Transition

Current:

- One app-level realtime query for all of the user's `userHighlights` documents.

Intermediate:

- Legacy query only for the active migrating user and only when My Notes/legacy compatibility or the focused post requires it.
- Ink manifest/chunk `get` operations only; no Ink listener.

Final:

- Base app/feed has no annotation query.
- Focused post reads one manifest and bounded chunks.
- My Notes reads a 12-manifest page and canonical metadata only when opened.
- Legacy adapter dynamic-imports only when migration metadata says it is needed.

## Rollback Plan

### Before cutover

Disable the Ink flag. Current Highlight behavior and documents are untouched.

### During cohort cutover

Return only the affected user to Highlight. Do not delete their Ink. Since no new gesture is dual-written, marks created only in Ink remain private additive data and can be restored after repair.

### After general cutover

Re-enable the legacy UI/read path and freeze new Ink entry if necessary. Preserve both collections. Do not attempt emergency reverse conversion from arbitrary Ink to text highlights; that transformation is lossy.

### Rollback proof

Before general release, rehearse:

- Flag off while Ink is ARMED.
- Flag off during a pending offline write.
- User moved back to Highlight after successful conversion.
- Route alias behavior.
- Old Highlight list and deletion behavior against untouched legacy data.

## Migration Stop Conditions

Stop a user or cohort migration if:

- A source ID maps to multiple target strokes unexpectedly.
- A converted count cannot reconcile with source classifications.
- Selected text/title/author appears in an Ink payload or migration log.
- An invalid range is guessed into a location.
- A rerun creates duplicates.
- A failed write is reported as converted.
- Source legacy data is modified or deleted.
- The user's rollback Highlight view no longer matches its pre-migration data.

## Firestore Impact of Migration

- New additive manifests and vector chunks only after approval.
- Canonical `knowledge` and `userProfiles` documents remain unchanged.
- Legacy `userHighlights` documents remain unchanged through observation.
- Conversion performs bounded reads/writes per user/post and must be rate limited.
- No screenshots, images, canvas snapshots, or duplicate post data are created.

## Approval Boundary

This plan authorizes no migration run. Firestore inventory, schema deployment, conversion, cutover, and cleanup each require their implementation-phase approval and gates.
