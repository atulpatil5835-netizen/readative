# Readative Firebase to Cloudflare Data Migration Plan

## Status

Audit and target design only. No Cloudflare resources have been created and no production data has been copied, changed, or deleted.

## Recommendation

Use **Cloudflare D1 for structured application data**, **Cloudflare R2 for image and file objects**, and keep **Firebase Authentication** for user identity and sign-in during the first migration. R2 is object storage; it is not a relational database. Do not place user, post, notification, or interaction records in R2 objects.

Expose D1 and private R2 through a Cloudflare Worker API. The browser must not receive D1 access or R2 credentials. The Worker should verify Firebase ID tokens, enforce per-user authorization, validate request payloads, and return only fields the caller may see. Keep the existing application in read-only/rollback-ready state until parity checks pass.

## Active data found in the application

| Current Firestore path/data | Readative feature | Proposed destination |
| --- | --- | --- |
| `knowledge` | Posts, including tech news distinguished by `contentKind` and visibility | `posts` table with a content kind; public/editorial status indexed |
| Post document arrays/fields | Comments, likes, helpful/misleading feedback, ratings, embedded image data | `comments`, `reactions`, and `ratings` tables; media moved to R2 |
| `smarttalk` | SmartTalk questions, answers and question-level interaction data | `smarttalk_questions`, `smarttalk_answers`, `smarttalk_reactions` tables |
| `userProfiles` | Public profile fields, settings and profile image data | `profiles` and restricted `profile_private` tables; images moved to R2 |
| `usernames` | Unique username to account mapping | `username_reservations` table with a unique normalized username |
| `notifications` | User notifications and read state | `notifications` table indexed by recipient and creation time |
| `userNotebook/{uid}/posts` | Reader highlights and notes | `notebook_items` table scoped to Firebase UID and post |
| `authEmailOtps` | Short-lived email verification/reset codes | Keep transient and tightly rate-limited; move to D1 only as part of the authenticated API migration |
| Inline `data:image/...` fields | Post images, profile avatars and banners | R2 objects; D1 stores object key, content type, dimensions, owner and visibility |

Some interactions are currently embedded in post or SmartTalk documents rather than stored as separate collections. The migration needs a deterministic normalizer that retains source document IDs, timestamps, authors, counts, visibility, and ordering. Legacy and currently active fields must be measured before choosing what can be omitted.

Firebase Authentication users are not ordinary Firestore documents and cannot be moved into R2. Keeping Firebase Auth avoids password resets and preserves Firebase UIDs while application data moves. Replacing Auth is a separate project with account-linking and recovery requirements.

## Security and availability design

- Start with private R2 buckets. Serve public post images through a controlled custom domain/Worker after checking the post's published visibility; use short-lived signed access for private objects.
- Keep account email, moderation data, private profile settings, and notebook records out of public media paths.
- Use separate key prefixes such as `posts/`, `tech-news/`, `smarttalk/`, `profiles/avatars/`, and `profiles/banners/`; store object keys (not expiring signed URLs) in D1.
- Use D1 foreign keys, unique constraints, bounded query sizes, prepared statements, and versioned SQL migrations. Preserve stable Firebase UIDs as external account IDs.
- Add an audit trail for moderation and admin edits; do not put secrets, OTPs, raw email codes, or R2 credentials in logs.
- Create independent exports before migration and after cutover. D1 Time Travel is a recovery feature, not the only backup. Test restore into a separate database before production cutover.

## Safe migration sequence

1. **Inventory and backup:** count documents, total bytes, largest documents, nested fields, image bytes, subcollections, and active versus stale records. Create a versioned, encrypted export outside the production database. Never print credentials or user data into logs.
2. **Build the target in isolation:** create a non-production D1 database and private R2 bucket, apply an initial schema, and test Worker token verification and authorization with synthetic data.
3. **Dry-run conversion:** read Firebase without writes, convert each active collection to normalized rows, move media to deterministic R2 keys, and emit a report with per-collection counts, skipped records, duplicate IDs, broken references, and image checksums. Do not make the bucket public.
4. **Validate:** compare source and target counts/checksums and sample posts, comments, SmartTalk answers, profiles, notifications, notebook items, image dimensions, visibility and URL rendering. Verify user A cannot read or change user B's private data.
5. **Shadow reads:** route a small, internal read-only path through the Worker and compare results with Firebase. Keep Firebase as the write source during this phase.
6. **Cut over in a controlled window:** briefly pause writes, capture a final delta, apply it, switch reads/writes to the Worker, and monitor errors and counts. Keep Firebase intact and available for rollback.
7. **Rollback/retirement:** if validation or live health checks fail, point the app back to Firebase. Do not delete Firebase collections, Firebase Storage objects, or Auth users until an agreed retention period and a verified restore have passed.

## Spark-plan export constraint

Firebase's managed Firestore export/import service requires Blaze. Since the project is now on Spark, the migration must not depend on that service unless the owner explicitly upgrades billing. A controlled Admin SDK export can read documents, but must be throttled and account for Firestore read quotas. First inspect the actual database size and current quotas; avoid an unbounded full scan from the live application.

## Cloudflare limits to verify before choosing the tier

Cloudflare's current D1 documentation lists Free limits of 500 MB per database, 5 GB total D1 storage, 50 read subrequests per Worker invocation, and 7 days of Time Travel; Workers Paid lists 10 GB per database and 30 days of Time Travel. These are account-level/platform limits and may change. Measure the active dataset, expected growth, query load, backup retention, and request volume before selecting Free versus Paid.

## Environment access note

The Cloudflare dashboard was open in the user's browser context, but the available browser-control runtime failed to initialize (`failed to write kernel assets: The system cannot find the path specified`). No Cloudflare account state could be inspected and no resource was created. Retry dashboard inspection after browser control is available; do not infer bucket names, account tier, or existing resources.
