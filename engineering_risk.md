# Readative Release Y — Ink System Engineering Risk

Date: 2026-07-01

Status: Architecture risk assessment only

## Risk Posture

Overall engineering risk is **medium-high**. SVG rendering and chunked vector storage are conventional. The two genuinely difficult areas are:

1. Distinguishing a deliberate hold-and-draw from a normal touch scroll without making reading feel worse.
2. Keeping arbitrary freehand marks attached to meaningful content after responsive reflow or author edits.

Neither problem should be treated as a late QA detail. Both require prototypes and explicit production gates before the current Highlight System is replaced.

## Risk Matrix

| ID | Risk | Probability | Impact | Level | Primary mitigation | Release gate |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | A normal scroll becomes an accidental stroke | Medium | Critical | Critical | Stationary hold, movement slop, no save below stroke threshold, device testing | Zero saved strokes during the agreed scroll test suite |
| R2 | A held draw scrolls or is canceled mid-circle/arrow | Medium | High | High | First-post-hold `touchmove` handoff; touch-specific fallback; cancel-safe state machine | Every supported browser completes all gesture shapes |
| R3 | Scrolling remains blocked after release/cancel | Low/medium | Critical | Critical | Scoped listeners, central cleanup, route/visibility/pointer-cancel handling | Automated cleanup assertions plus manual interruption tests |
| R4 | Native selection, links, pinch zoom, or accessibility gestures regress | Medium | High | High | Exclusion zones; multi-touch cancellation; selection suppression only when armed/active | Accessibility and browser matrix passes |
| R5 | An annotation moves to unrelated text after an edit | Medium | Critical | Critical | Dual geometry/semantic anchors; hashed context; fail closed | No ambiguous fixture is drawn |
| R6 | Marks distort across width/font/orientation changes | Medium | Medium/high | High | Sparse text pins, `em` offsets, piecewise reprojection, resize throttling | Reflow visual tolerance approved on matrix |
| R7 | One Firestore document grows too large | Low with design | High | Medium | 32 KiB target chunks, 64 KiB client hard stop, rollover by count/bytes | Boundary fixture passes before beta |
| R8 | Concurrent tabs/devices overwrite strokes | Medium | High | High | Session-owned chunk IDs; unique stroke IDs; atomic counters | Two-tab/two-device conflict tests pass |
| R9 | Manifest preview is incomplete after concurrent writes | Medium | Low | Low/medium | Preview is non-authoritative and self-heals after a full load | Source chunks remain complete; preview repairs |
| R10 | App startup/feed becomes heavier | Medium | High | High | Dynamic imports; no global provider listener; focused route only | Bundle/read/DOM budgets pass |
| R11 | Hundreds of SVG nodes cause frame drops | Low/medium | Medium | Medium | Simplify, quantize, group committed paths, update live path outside React | 500-stroke benchmark passes or renderer is revisited |
| R12 | My Notes causes large post reads | Medium | Medium | Medium | Tab-scoped pagination, cache-first metadata, 12-card cap | Network/read trace stays within documented bounds |
| R13 | Private Ink is readable or writable by another account | Low if rules correct | Critical | Critical | UID-scoped paths, field validation, emulator rules suite | Security suite is mandatory before any beta write |
| R14 | Offline/background transition loses a released mark | Medium | High | High | Optimistic queue, release flush, `visibilitychange`, idempotent retry | Offline/interruption test suite passes |
| R15 | Legacy conversion loses or duplicates highlights | Medium | Critical | Critical | Additive deterministic conversion; count audit; no source deletion | Per-user audit succeeds before cutover |
| R16 | New Ink stores text snippets through anchor metadata/telemetry | Low/medium | High | High | Hash-only context, schema allowlist, telemetry content ban | Payload inspection contains no readable selected text |
| R17 | Deleted/private posts leave unusable note records | Medium | Low/medium | Medium | Unavailable My Notes state and delete-notes action | Privacy behavior approved |
| R18 | Malformed/hostile vectors exhaust rendering | Low | High | Medium | Rule/client bounds, point/path caps, parser rejection | Fuzzed payloads fail safely |

## R1–R4: Scroll and Input Arbitration

### Why this is the largest risk

Browsers decide touch panning early. Under Pointer Events, panning generally cannot be taken back merely by canceling a later pointer event; `touch-action` must declare intent before the gesture. Changing `touch-action` after contact does not affect that contact. Setting it to `none` up front would make Ink feel like a drawing editor and would damage native reading performance.

The recommended model relies on a narrower Touch Events behavior: if no movement has begun, canceling the first active `touchmove` after a successful hold can suppress scrolling for that contact. That is a standards-backed path, but real browser behavior, passive listener defaults, callouts, selection, and WebView differences still require a prototype.

### Required safeguards

- The hold timer cannot save anything by itself.
- Movement beyond the slop threshold before the timer permanently makes that contact a scroll.
- The non-passive move handler is added only after the stationary hold succeeds and removed on every terminal path.
- All cleanup is centralized and idempotent.
- No component unmount can leave a document/window listener, pointer capture, selection lock, or scroll lock behind.
- A stroke is saved only after minimum distance and sample-count checks.
- Interactive descendants and multiple contacts are excluded.
- Browser zoom remains enabled when not in the one active stroke.

### Test volume

The implementation phase should run at least 500 scripted/manual scroll gestures across the supported mobile matrix before beta. The acceptance target is not “rare accidental ink”; it is zero saved accidental strokes in the controlled suite. Any failure blocks rollout and triggers threshold/interaction redesign.

### Fallback if the handoff is inconsistent

Do not fall back to a permanent `touch-action: none` surface or JavaScript-simulated scrolling. The acceptable fallback is a safer two-contact sequence—hold to arm one stroke, lift, then draw—or deferring touch Ink while preserving mouse/pen support. That fallback changes the target interaction and therefore requires explicit product approval.

## R5–R6: Reflow and Edit Anchoring

### Fundamental limitation

A freehand path is geometric; web text is reflowable and editable. There is no coordinate transform that can preserve a circle or arrow perfectly after arbitrary content changes. Storing screenshots or freezing the post layout would solve geometry at the cost of the explicit product requirements, so both are excluded.

### Safe policy

- Store block-local vector geometry for fidelity.
- Store sparse semantic text pins for responsive reprojection.
- Store canonical text positions and hash-only exact/prefix/suffix context for relocation.
- Treat paragraph ordinal and `updatedAt` only as hints.
- Report resolution as exact, reflowed, relocated, or unresolved.
- Never render unresolved or ambiguous strokes.
- Never auto-delete unresolved strokes.

### Distortion policy

The implementation must define a visual error threshold. If sparse pins would stretch or fold a stroke beyond that threshold, the stroke becomes unresolved for that layout instead of being shown incorrectly. A temporarily missing mark is safer than confidently wrong Ink.

### Edit fixtures that must pass

- Paragraph inserted before the mark.
- Words inserted before and inside the anchored range.
- Paragraph split or merged.
- Repeated identical phrase in the same post.
- Target phrase removed.
- Entire post rewritten.
- Title-only and hashtag-only edits.
- Font, line height, zoom, device width, and orientation changes without content edits.

## R7–R9: Storage and Concurrency

### Document growth

Firestore's 1 MiB document limit makes a single indefinitely growing annotation document unsafe. The proposed 32 KiB target/64 KiB hard client limit leaves substantial margin for Firestore encoding and future schema fields. Both stroke count and actual encoded byte length determine rollover.

### Chunk update cost

Updating an active chunk rewrites that bounded document. This is acceptable only while chunks remain small. A benchmark must compare 1, 20, and 40-stroke chunk commits on slow mobile/network conditions. If write latency becomes visible, lower the chunk target rather than increasing it.

### Concurrency

Each tab/device writes its own session chunk. This prevents source overwrites without a transaction per point. The manifest uses atomic increments and a batch with the chunk update. The bounded preview is allowed to be temporarily incomplete because it is presentation data, not the source of truth.

### Deletion

Deleting a parent Firestore document does not implicitly remove subcollection documents. “Delete notes from this post” must enumerate the bounded chunks, delete them in batches, and delete the manifest only after chunk deletion succeeds. Partial failure must be resumable and must not claim success.

## R10–R12: Performance and Bundle

### Initial bundle regression

The easiest accidental regression is importing Ink utilities from `KnowledgeCard` or a global provider, pulling the entire feature into the initial graph. The shell may know only how to request a dynamic Ink module. Bundle analysis is required; source-level dynamic imports alone are not proof.

### Feed regression

The current global Highlight provider reads all user highlights through a realtime listener. Carrying that pattern into Ink would violate the release mission. The feed cannot query manifests merely to show an annotated badge. A badge may appear only when the information is already in the current session cache; it cannot justify a new feed read.

### SVG load

The risk is DOM path count, not the vector format itself. Source strokes remain individual for deletion and migration, while committed render output can be grouped by block/color/width. The active stroke is the only frequently mutated node.

### My Notes hydration

Strictly avoiding duplicated post title/author means missing metadata reads return full `knowledge` documents in the client SDK. Since posts may include images/comments, My Notes must use a small 12-card page, cache-first lookup, and concurrency limits. If measured payload is too large, the architecture must be revisited explicitly; silently duplicating canonical post fields into Ink is not allowed.

## R13 and R16: Privacy and Security

Ink contains potentially sensitive private reading behavior even without text snippets.

Required controls:

- Firebase Authentication UID must match the path UID for every read/write/delete.
- My Notes must render only on the signed-in user's own profile.
- Rules must allowlist fields and bound collections, arrays, strings/bytes, counts, and enum values where the rules language permits.
- Vector payloads and anchor hashes must be excluded from indexing.
- No geometry, nearby text, selected text, or post body goes to analytics, logs, error messages, URLs, or notifications.
- Error reporting may include schema version, status code, byte count, and opaque IDs only.
- Do not use public `knowledge` document fields to authorize ownership of private Ink.

Security rules are not present in this architecture deliverable and must be reviewed/deployed before any production Ink write is possible.

## R14: Offline and Durability

The lack of a Done button makes release the durability boundary. The UI can return to scrolling immediately, but the repository must keep an optimistic pending record until Firestore acknowledges or queues the write.

Required cases:

- Online success.
- Offline with persistent cache.
- Permission denied.
- Payload rejected by bounds.
- Route change immediately after release.
- Tab background/close immediately after release.
- Retry after a transient failure.
- Duplicate retry after an unknown commit result.

Unique stroke IDs make retry idempotent. A failed mark stays locally distinguishable and retryable; it must not silently disappear or appear permanently saved.

## R15: Migration

Legacy Highlight documents contain selected text and duplicated post metadata. The new Ink schema must not copy those fields. Conversion uses the legacy text only in memory to verify old offsets, then writes vector geometry, numeric/hash anchors, timestamps, and source IDs.

Migration is unsafe if it deletes source documents in the same pass. The required order is convert → verify counts/content resolution → cohort cutover → observe → separately approve cleanup. Unresolved items remain legacy data and keep the rollback path alive.

## R17: Orphaned Notes

Without duplicated post title/author, a deleted or newly inaccessible post cannot produce the complete requested My Notes card. The privacy-safe behavior is an “Unavailable post” card with the private vector preview, last annotated time, and delete action. It does not expose a stale title or author and does not offer Continue Reading.

This tradeoff should be approved explicitly because it follows directly from the no-duplicate-post-data requirement.

## R18: Malformed Vector Defense

Even private user data is untrusted input after sync.

- Cap chunks, strokes, points, path length, previews, and anchor pins.
- Reject NaN, infinity, negative counts, unknown schema versions, invalid enum values, and coordinates outside the quantized range.
- Never assign stored strings to `innerHTML`.
- Generate SVG path strings from decoded numeric vectors; do not accept arbitrary SVG markup, elements, URLs, filters, styles, or event attributes.
- Abort a pathological decode within a fixed work budget.

## Production Gates

Ink is not production-ready until all gates are green:

1. Gesture matrix and 500-scroll accidental-stroke test.
2. Cleanup/interruption tests with no stuck scroll state.
3. Reflow/edit fixture suite with ambiguous anchors hidden.
4. 1/40/200/500-stroke SVG performance benchmark.
5. Initial bundle and lazy chunk budgets.
6. Zero feed Ink reads/listeners/overlays.
7. Firestore emulator security and payload-bound tests.
8. Offline, retry, and multi-tab/device durability tests.
9. My Notes pagination/read trace.
10. Idempotent legacy conversion with per-user count audit.
11. Accessibility review for zoom, motor control, keyboard/mouse, reduced motion, and touch targets.
12. Feature-flag rollback rehearsal.

## Rollback Requirements

- One remote/configurable flag must disable Ink entry without a redeploy if feasible.
- Current Highlight source and data remain untouched through migration observation.
- Ink writes are additive and private; disabling the UI does not require destructive data reversal.
- Legacy route aliases remain valid.
- A rollback must remove any active touch listeners/capture immediately and restore normal scrolling.
- No cleanup or collection deletion is part of an emergency rollback.

## Recommendation

Proceed only to a memory-only gesture/anchor prototype after architecture approval. Do not authorize Firestore deployment or production replacement until the prototype proves that the one-contact handoff is reliable on the supported mobile browsers.
