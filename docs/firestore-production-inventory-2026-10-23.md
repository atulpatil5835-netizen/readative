# Readative Firestore Production Inventory

**Audited:** 2026-10-23  
**Firebase project:** `readative-803b0`  
**Scope:** read-only collection/document inventory, named database cleanup, and default database delete protection. Production documents were not edited.

## Active database retained

The website config and server Admin code call Firestore without a database ID, which selects `(default)`. No named `ai-studio-*` database ID is referenced in the Readative app or API code.

| Database | Region | Edition | Root collections | Root docs | Nested docs |
| --- | --- | --- | --- | ---: | ---: |
| `(default)` | `asia-south1` | Standard, free-tier eligible | 10 | 3,228 | 11 Notebook items |

The default database now has **delete protection enabled**. Point-in-time recovery remains disabled; Firestore PITR requires billing, so it was not enabled on Spark.

## Collections and observed data

Counts below are read-time Firestore aggregate counts. For `userNotebook`, the count is across four users' `posts` subcollections; the root parent-document count is zero. Document contents and personal values were not printed during the audit.

| Path | Count | Data purpose / observed shape |
| --- | ---: | --- |
| `knowledge` | 384 | Posts and Tech News in one collection; news is identified by content fields. Posts can contain comments, likes, image metadata, and image `dataUrl` fields inline. |
| `smarttalk` | 109 | SmartTalk questions; answer arrays are stored on question documents. |
| `userProfiles` | 81 | User profile fields, social links, saved/liked IDs, and profile/banner image assets. |
| `usernames` | 20 | Username-to-user reservations. |
| `notifications` | 2,621 | Recipient/actor, target item, read state, and notification preview. |
| `userNotebook/{uid}/posts` | 11 | Notebook items under 4 user paths. |
| `userHighlights` | 9 | Highlight text and offsets linked to posts. |
| `userInk` | 2 | Per-user ink/annotation metadata. |
| `authEmailOtps` | 1 | Short-lived verification/reset state, including code hash, expiry, attempts, and email metadata. No OTP value was displayed. |
| `posts` | 1 | A root-level collection exists, but no active Readative Firestore client/API path to this collection was found. Preserved for follow-up review. |

The 3,228 root count plus 11 nested Notebook records gives 3,239 known document records. The sample confirms that at least some `knowledge` image payloads are inline data URLs. This audit did not read all document bodies, so it does not claim every image/profile is inline.

## Named AI Studio databases removed

These were not selected by the Readative app. Their collection names and sample field schemas differ from the active default database. All were exported first, then deleted as requested.

| Removed database | Before deletion | Observed content |
| --- | ---: | --- |
| `ai-studio-48cfe6cb-4e57-4721-bebf-c4182443df63` | 0 documents | Empty |
| `ai-studio-78d14f99-7962-4a54-b874-1efc75098f75` | 126 documents | `posts` collection; a separate AI Studio content schema |
| `ai-studio-eb70c9dc-7729-4162-b516-c0b532cfed44` | 3 documents | `presentations` collection with slide data |

Post-deletion Firebase CLI verification returned only `(default)` and confirmed its delete protection is enabled.

## Encrypted pre-deletion archive

The named-database export contains 129 documents total, is AES-256-GCM encrypted, and its random key is protected with Windows DPAPI for the current Windows user. Keep both files together and on this Windows account to restore the archive.

- Archive: `%LOCALAPPDATA%\Readative\firestore-archives\named-databases-2026-10-23T05-09-24-673Z.rdbak`
- Protected key: `%LOCALAPPDATA%\Readative\firestore-archives\named-databases-2026-10-23T05-09-24-673Z.rdbak.key.dpapi`
- Plaintext export SHA-256: `10e01cb743e3e37b1e99afd959c6d1ef43509cfc97d762a9ae3e482edeaa6dc3`

The backup is a local encrypted safety copy, not a Firebase managed backup. It can be decrypted only under the Windows user profile that protected its key.

## Follow-up data organization

- Keep `knowledge` as the canonical source for posts and Tech News for now; separate editorial/news queries through explicit fields and indexes before considering a schema migration.
- Preserve existing Firestore document IDs and current embedded `comments`/`likes` fields during any future cleanup. Normalize those into subcollections only with a migration and compatibility plan.
- Keep profile and Notebook private data access constrained by Firebase Authentication and Firestore Security Rules.
- Review the single root `posts` document and expired OTP record separately before removing individual documents.
- Move media independently from database records if desired: write new images to object storage and keep stable object keys/URLs plus dimensions in Firestore. Do not rewrite historical media in the same operation as database cleanup.
