# Readative Release Y.2 — Migration Plan

Date: 2026-07-03

Status: Proposed only; no Firestore data has been read or modified

## Migration objective

Introduce one semantic Highlight V2 document per user/post without deleting or guessing from historical data.

There are two legacy sources with different safety properties:

1. Archived `userHighlights` semantic ranges from before Release Y.1.
2. Live/current `userInk` freehand vectors created by Release Y.1.

They must not be treated as equivalent.

## Decision summary

| Source | Automatic conversion | Decision |
| --- | --- | --- |
| `userHighlights` semantic rows | Possible only after exact validation against current post text | Migrate validated rows in an offline/admin process; archive rejected rows |
| `userInk` vector strokes | Cannot be mapped reliably to semantic text ranges | Do not convert; archive in place |

Normal Y.2 application startup does not scan, migrate, copy, or delete either legacy collection.

## Target paths

- `userNotebook/{uid}`: schema version, highlighted `postIds`, and update time for the existing My Notes count compatibility seam.
- `userNotebook/{uid}/posts/{postId}`: one semantic Highlight V2 document for that user/post.

The post subdocument is the only highlight document for that user/post. It stores ranges only; canonical post metadata remains in `knowledge/{postId}`.

## Why vector Ink cannot be converted

Ink strokes contain normalized geometry, block hash/ordinal, source dimensions, color, width, and a content revision. They do not identify characters.

Converting a path to a semantic range would require guessing:

- Whether a stroke was an underline, circle, arrow, handwriting, or unrelated mark.
- Which rendered line or characters it intended.
- How it should map after responsive reflow.
- Whether the target post has changed.

Bounding-box intersection with text would still be heuristic and could highlight unrelated words. That violates semantic correctness. Therefore:

- `userInk` remains untouched.
- Y.2 does not read `userInk` during normal use.
- No SVG/path/geometry is copied into `userNotebook`.
- No deletion occurs as part of Y.2.
- Rollback to Y.1 remains possible while the archive exists.

## Why legacy semantic Highlight may be converted

Archived `userHighlights` rows already contain:

- User ID.
- Post ID.
- Paragraph index.
- Start/end rendered-text offsets.
- Selected text.
- Capture timestamp.

This is enough to validate, not enough to trust blindly. A post may have been edited, a paragraph may have moved, or the old range may have been malformed.

## Migration prerequisites

Before any data operation:

- Architecture approval.
- Final Y.2 schema approval.
- Backup/export or confirmed retention policy for both legacy collections.
- Reviewed owner-only Firestore rules for `userNotebook`.
- Required query index available for `updatedAt` paging.
- Admin credentials used outside the browser application.
- A dry-run mode that performs zero writes.
- A durable report path and run ID.
- A maintenance/ordering decision that prevents live Y.2 writes from being overwritten.

## Semantic migration algorithm

### 1. Read and group

- Stream legacy `userHighlights` rows in bounded pages.
- Validate basic types and lengths.
- Group by `(userId, postId)`.
- Deduplicate exact legacy document IDs and exact semantic ranges.
- Never load all users into memory at once.

### 2. Load canonical post

- Read `knowledge/{postId}` once per group.
- Reject the group if the post is missing or inaccessible to the migration job.
- Do not reconstruct title/author from the legacy row.

### 3. Reconstruct paragraph model

- Split current `content` with the exact production blank-line expression.
- Trim and remove empty sections exactly as `KnowledgeCard` does.
- Generate each current paragraph ID from normalized source plus duplicate occurrence.
- Generate display text with the same pure transformation represented by `renderRichText`.

The migration tool must share or test against the production pure paragraph/display-text logic. It must not use a browser screenshot or DOM geometry.

### 4. Validate each row

Accept only when all conditions pass:

- `paragraphIndex` is an integer within current paragraph bounds.
- `startOffset` and `endOffset` are integers with `0 <= start < end`.
- `endOffset` is within the current rendered paragraph text length.
- The current rendered slice matches legacy `selectedText` after only a documented trim/line-ending normalization.
- The resulting paragraph ID and all target field lengths pass V2 validation.

Reject when any check fails. Do not search other paragraphs, fuzzy-match text, or shift offsets automatically.

### 5. Build one target document

For accepted rows in one user/post group:

- Map to `{id, paragraphId, startOffset, endOffset, color: "yellow", createdAt}`.
- Preserve a valid legacy timestamp; otherwise use a documented migration timestamp.
- Sort deterministically.
- Normalize exact duplicates and overlaps according to the approved V2 rule.
- Apply range-count and serialized-size caps.
- Set document `createdAt` to the earliest accepted range and `updatedAt` to the latest accepted range.

No `selectedText`, title, author, HTML, pixels, or migration geometry is copied.

### 6. Merge safely

Preferred rollout: finish the validated migration before enabling public Y.2 writes.

If target documents can already exist:

- Use a transaction.
- Read the current V2 document.
- Merge by stable range ID/semantic signature.
- Preserve user-created V2 ranges.
- Normalize and validate the merged result.
- Write only if the result differs.

Never replace a live target document with a stale migration snapshot.

### 7. Update the user index

For every user with at least one successfully written post document:

- Add the post ID once to `userNotebook/{uid}.postIds`.
- Set schema version/update time.
- Do not add groups with zero accepted ranges.

Batch within Firestore operation limits and keep checkpoints so a retry is idempotent.

## Dry-run report

The dry run must report:

- Run ID, code/schema version, start/end time.
- Total legacy rows scanned.
- Users and posts encountered.
- Accepted rows.
- Exact duplicates removed.
- Overlaps normalized.
- Rejected missing posts.
- Rejected invalid paragraph indexes.
- Rejected invalid offsets.
- Rejected text mismatches.
- Rejected malformed fields.
- Rejected cap/size groups.
- Target documents that would be created, merged, or unchanged.
- Estimated reads and writes.
- A small redacted sample for manual validation.

The report must not expose private selected sentences in logs beyond an explicitly protected validation artifact.

## Write-run safety

- Require an explicit non-default `--write`/equivalent switch.
- Require project/environment confirmation.
- Persist checkpoints by stable source cursor.
- Make every target range ID deterministic from the source document ID or stable semantic signature.
- Make index updates idempotent.
- Limit batch size and retry transient failures with bounded backoff.
- Stop on schema mismatch, permission error, unexpected target shape, or error-rate threshold.
- Produce a final reconciliation report.

No migration code is bundled into the web application.

## Post-migration verification

- Sample migrated documents across low/high range counts and duplicate paragraphs.
- Open corresponding posts at mobile, tablet, and desktop widths.
- Confirm the same characters are yellow at every width.
- Confirm stale/rejected rows do not render.
- Confirm My Notes shows one card per target post, correct count, and one preview.
- Confirm no target document contains selected text or post metadata.
- Confirm no source document changed.
- Compare written target/index counts to the final migration report.
- Confirm signed-out and wrong-user access is denied.

## Rollback

Application rollback:

- Revert the Y.2 application release to Y.1.
- Y.1 continues using `userInk`; the new `userNotebook` collection is ignored.
- Archived `userHighlights` remains untouched.

Data rollback:

- Do not delete source archives.
- Target documents created by a migration run must carry admin-side run evidence, even though private selected text is not stored.
- If target removal is approved, delete only documents enumerated in that run's manifest and reconcile user indexes.
- Never mass-delete by a broad unverified query.

Rollback is not automatic and is not part of normal app startup.

## Retention recommendation

- Keep `userInk` read-only/archived through at least the Y.2 stabilization window and any rollback period.
- Keep rejected `userHighlights` rows archived; they are not proof of valid current ranges.
- Do not expose either archive in My Notes after Y.2.
- Decide long-term deletion only through a separate data-retention approval.

## Migration acceptance gates

- Dry run reviewed and approved.
- Zero writes in dry-run verification.
- Rules/index checks pass.
- Accepted rows are exact, not heuristic.
- Write process is idempotent and checkpointed.
- Source collections remain unchanged.
- One target highlight document maximum per user/post.
- Final reconciliation has no unexplained count difference.

Until these gates pass, Y.2 should start clean for new semantic highlights while all legacy data remains archived.
