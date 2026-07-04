# Readative Release Y.2 — Migration Report

Date: 2026-07-03

## Decision

Release Y.2 starts a clean semantic Notebook Highlight namespace.

No old Ink stroke was migrated. No archived semantic Highlight row was migrated in this release. No legacy document was read, changed, copied, or deleted.

## Legacy sources

### Release Y.1 Ink

Legacy paths:

```text
userInk/{uid}
userInk/{uid}/posts/{postId}
```

Status: archived in place.

Y.2 does not import the old repository and has no runtime reference to `userInk`. Vector geometry cannot be reliably converted to paragraph/character ranges, so no heuristic migration exists.

### Pre-Y.1 semantic Highlight

Legacy path:

```text
userHighlights/{autoId}
```

Status: archived in place.

Although some rows contain paragraph indexes and offsets, converting them requires a separately approved validation migration against current post text. Y.2 application startup does not scan or convert them.

## New namespace

```text
userNotebook/{uid}/posts/{postId}
```

Each document contains one array of records with only:

- `postId`
- `paragraphId`
- `startOffset`
- `endOffset`
- `color`
- `createdAt`

No legacy ID, vector, path, coordinate, selected sentence, post metadata, schema marker, or migration marker is stored.

## Code migration

| Y.1 component | Y.2 result |
| --- | --- |
| `InkProvider` | Replaced by route-aware `NotebookProvider` |
| Ink post-ID manifest | Replaced by a count aggregation; no manifest document |
| `InkSurface` | Deleted |
| Stroke schema | Deleted |
| Geometry codec/projector | Deleted |
| SVG overlay/path rendering | Deleted |
| Hold/touch/pointer drawing state | Deleted |
| Pen colors/widths/preferences | Deleted |
| `InkPreview` | Replaced by derived yellow text preview |
| `userInk` repository | Replaced by semantic one-document-per-post repository |
| Ink card indicator/settings | Replaced by one Notebook Highlight icon and paragraph margin controls |
| Vector My Notes | Replaced by post-level semantic My Notes |

## Source archive verification

- No Y.2 highlight source imports the deleted `src/ink` directory.
- No Y.2 highlight source references `userInk`.
- No migration script was added to the web bundle.
- No Firestore write was executed during this implementation/QA session.
- Old collections remain available for rollback/data-retention decisions.

## Rollback

Application rollback can restore Release Y.1, which will continue reading its archived `userInk` namespace. Y.1 ignores `userNotebook`.

Y.2 rollback must not delete `userNotebook` automatically. Any future data cleanup requires a separately approved, scoped process.

## Migration status

Complete as archive-and-start-clean.

Production activation remains conditional on deployed security-rule validation for the new owner-scoped path.
