# Readative SEO V2 Projection Builder

## Builder Flow

The Milestone 2 projection builder is a pure, deterministic utility. It accepts normalized source data plus an explicit `projectedAt` timestamp and returns an in-memory `seo_document` candidate with validation results.

The builder does not import Firebase, does not read Firestore, does not write Firestore, and does not perform network calls.

## Source Collections

Future migration and writer milestones will derive projections from the existing source-of-truth collections:

- `knowledge`
- `userProfiles`
- `smarttalk`

Those collections remain the primary source of truth. `seo_documents` is a derived read model only.

## Projection Flow

1. Read source records in an offline migration or controlled writer.
2. Convert each source record into one candidate projection.
3. Validate the candidate projection.
4. Produce a dry-run report.
5. In Milestone 3, only after approval, write valid projections to `seo_documents`.

Milestone 2 stops at step 4.

## Validation Rules

Every candidate projection is checked for:

- required fields
- deterministic document id
- valid canonical path
- boolean public state
- current schema version
- current projection version
- valid timestamps
- document size guard
- SmartTalk answer preview limit
- SmartTalk answer preview text limit

Validation returns structured issues with `severity`, `code`, `path`, and `message`.

## Expected Output

The dry-run command writes `seo_v2_projection_dry_run_report.json` by default. The report includes:

- `schemaVersion`
- `projectionVersion`
- `builderVersion`
- `generatedAt`
- processed counts by type
- successful and failed projection counts
- validation failures
- warnings
- skipped documents
- generation time
- average generation time
- architecture validation summary

## Future Firestore Writer

Milestone 3 may add an offline or controlled writer that persists valid projections to:

- `seo_documents`
- `seo_meta`

The writer must be resumable, idempotent, rollback-safe, and must never run on a live user request path.
