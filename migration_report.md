# Readative Release Y.1 — Migration Report

Date: 2026-07-01

## Decision

Legacy Highlight data is **archived in place and not automatically converted**.

This is the safe branch explicitly allowed by the release brief.

## Why Automatic Conversion Was Rejected

Legacy documents store selected text plus paragraph/start/end offsets. Ink stores responsive freehand vectors tied to rendered content blocks.

Safe conversion would require all of the following for every historical item:

1. Load the original post.
2. Reconstruct the exact historical paragraph layout.
3. Resolve a still-valid text range.
4. Render that range at a canonical width/font.
5. Generate vector underline geometry.
6. Verify it again against current responsive layouts.

Posts may have been edited, deleted, restyled, or reflowed. Converting offsets without that proof could put Ink under unrelated text. A server-only conversion cannot recover DOM line rectangles, and a length-based synthetic underline would be guesswork.

The release therefore chooses correctness over cosmetic migration.

## Archive Behavior

- Existing `userHighlights` documents are not read, changed, copied, or deleted.
- No new production code imports or queries `userHighlights`.
- No new Highlight document can be created.
- No legacy selected text is copied into Ink.
- The old collection remains available only as an external data archive/rollback record.
- Ink starts with a clean `/userInk/{uid}/posts/{postId}` document when the user completes their first stroke.

## Code Migration Completed

| Legacy component | Result |
| --- | --- |
| `HighlightsProvider` app wrapper | Replaced by route-aware `InkProvider` |
| User-wide `onSnapshot(userHighlights)` | Removed; one `getDoc` Ink index read replaces it |
| Text-selection mouse/touch handlers | Removed |
| Yellow `<mark>` renderer | Removed |
| Offset calculation helper | Removed |
| Highlight duplicate-range logic | Removed |
| Per-highlight `addDoc`/`deleteDoc` | Removed |
| Profile selected-text snippets | Replaced by post-level My Notes cards |
| Multiple post mode map | Replaced by one active post ID |
| Profile `highlights` section | Replaced by `notes` |

## Data Separation

The new collection does not reuse the legacy schema.

Ink stores only:

- Stroke identity/time.
- Compact vector geometry.
- Color/width enums.
- Hash-based block/revision anchors.

It does not store:

- Legacy selected text.
- Legacy paragraph/start/end offsets.
- Post title/author/body.
- Images, screenshots, bitmaps, canvas snapshots, or arbitrary SVG.

## Migration Risk

| Risk | Result |
| --- | --- |
| Misplaced converted mark | Eliminated by no automatic conversion |
| Duplicate writes during conversion | Eliminated |
| Legacy data loss | Eliminated; archive untouched |
| New code accidentally reading private snippets | Eliminated; all source references removed |
| User does not see old marks in My Notes | Accepted tradeoff; documented consequence of safe fresh start |

## Verification

`rg` returned no source references to the legacy collection, selected-text fields, offset fields, old context, old Profile renderer, or old helper.

The archive itself was not inspected or modified during this implementation.

## Final Migration Status

**Complete as archive-and-start-fresh.**

Any future conversion utility must be a separately approved, audited project. It must not be reintroduced into the app startup or Ink rendering path.
