# Readative Release Y — Ink System Architecture

Date: 2026-07-01

Status: Architecture proposal only; awaiting approval

Priority: Performance first

## Scope Guard

This document designs the future Ink System. Release Y architecture approval does not change production code, the current Highlight experience, Firestore data, security rules, indexes, routes, or UI.

The eventual system must preserve all existing user capabilities while replacing yellow text highlights with private blue-pen-style vector annotations. It must not add stickers, a shape library, brushes, handwriting recognition, screenshots, bitmap storage, a fullscreen editor, a floating toolbar, or a permanent scroll-blocking drawing mode.

## Current Architecture to Evolve

The existing feature has useful seams and should not be rebuilt wholesale.

| Current seam | Current behavior | Reuse decision |
| --- | --- | --- |
| `HighlightsProvider` in `src/App.tsx` | Subscribes to every `userHighlights` document for the active user | Reuse the feature boundary, but replace the app-wide realtime listener with on-demand Ink reads |
| `KnowledgeCard` | Derives highlights for one post and owns per-card mode state | Reuse its action/content prop seam; change mode ownership to one active post ID |
| `CardTrust` | Hosts the Highlight button | Reuse the exact control location for the Ink crayon |
| `CardContent` | Owns text interaction and paragraph wrappers | Reuse the content boundary and paragraph DOM anchors; replace text selection with a lazy Ink surface |
| `highlightHelpers.tsx` | Maps paragraph indexes and character offsets to yellow `<mark>` elements | Reuse only its lessons and legacy-range adapter; it is not a vector renderer |
| `ProfileHighlights` | Groups snippets by post | Reuse the private-profile section slot; replace the content with post-level My Notes cards |
| `/post/:id` and `focusedEntryId` | Reuses the standard card while focusing one post | Make this the only full Ink surface; do not create an editor route |
| `KnowledgeEntry.updatedAt` | Changes when post content is edited | Use as a quick revision hint, backed by a content hash in Ink metadata |

The current global listener, duplicated title/author fields, selected snippets, yellow DOM marks, and `Record<postId, boolean>` mode map are the parts that should not survive the final cutover.

## Recommended Product Model

Ink has two distinct states. This distinction is the key to preserving scrolling.

1. **OFF** — Ink interaction is off. No gesture capture exists. If the focused post has stored Ink, it may enter VIEWING after its route-scoped manifest read.
2. **VIEWING** — existing vectors render read-only on the focused post; scrolling, tapping, selection, and zoom remain browser-owned.
3. **ARMED** — Ink is enabled for exactly one focused post, but the browser still owns normal scrolling, tapping, and pinch zoom.
4. **CANDIDATE** — one primary contact is stationary and a short hold timer is running. Scrolling is still native.
5. **DRAWING** — only after the hold succeeds does the app temporarily capture movement and draw one stroke.
6. **COMMITTING** — release simplifies and saves the stroke optimistically, then returns immediately to ARMED.

There is no Done button. ARMED is not a drawing lock; it is permission to recognize a deliberate hold. Navigation, closing the focused post, signing out, or tapping the active crayon returns the system to OFF.

On an ordinary feed card, tapping the crayon should reuse `onOpenEntry` to open the existing `/post/:id` focus route and arm that post. This gives Ink one clear coordinate space without creating a fullscreen editor or mounting overlays throughout the feed.

## Scroll-versus-Draw Architecture

### Options considered

| Option | Scrolling | Drawing freedom | Risk | Decision |
| --- | --- | --- | --- | --- |
| `touch-action: none` while Ink is armed | Blocked unless scrolling is reimplemented in JavaScript | Full | High jank and accessibility risk | Reject |
| `touch-action: pan-y` | Native vertical scroll | Vertical portions of circles/arrows may be canceled by the browser | Medium/high | Reject as the primary model |
| Dedicated draw mode after tapping Ink | Blocked until mode is exited | Full | Violates automatic return to scrolling | Reject |
| Two separate gestures: hold to arm, second touch to draw | Native | Full | Safe but does not match Touch → Hold → Draw | Reject |
| Timed first-move handoff | Native until a stationary hold succeeds | Full after the handoff | Medium; requires device testing | **Recommend** |

### Recommended handoff

- Initial touch hold: 280 ms, subject to usability testing.
- Pre-hold movement tolerance: 8 CSS pixels. Movement beyond it cancels the candidate and leaves the gesture entirely to native scrolling.
- Start only on non-interactive post content. Links, buttons, media controls, form elements, browser selection, and multi-touch never start Ink.
- Use passive observation while waiting. Do not register a non-passive `touchmove` handler for normal reading.
- If the timer wins before movement, attach a narrowly scoped `{ passive: false }` handler for that active touch. Prevent the first post-hold move, capture the stroke, and remove the handler on release/cancel.
- Disable native selection/callout only inside the armed content surface and only while required. Do not disable page zoom globally.
- A second contact, `touchcancel`, route change, visibility change, lost pointer capture, or scroll beginning before the timer cancels the stroke without saving.
- Release commits only strokes that exceed a small distance/point threshold. A hold-and-release without drawing is a no-op.
- Pen and mouse use the same state machine with a shorter initial dwell target; they do not get a separate toolbar or brush model.

This uses the Touch Events rule that canceling the first active `touchmove` can suppress scrolling for that contact. Pointer Events remain useful for unified coordinates, coalesced samples, and mouse/pen input, but Pointer Events alone cannot take panning away after it has started. The implementation must feature-detect and test the exact handoff on Safari iOS, Chrome Android, Samsung Internet, desktop Chrome/Edge, and touch-enabled Windows before production approval.

## Compact Settings

### Options considered

| Option | Benefit | Cost | Decision |
| --- | --- | --- | --- |
| Always-visible color/width controls | Discoverable | Permanent clutter | Reject |
| Anchored popover | Compact | It is a floating panel and can cover text | Reject |
| Bottom sheet | Large touch targets | Interrupts reading | Reject |
| Repeated tap to cycle every value | Smallest | Hidden and slow to use | Reject |
| Temporary inline settings rail | Visible only on request; never covers content | Small, temporary layout shift | **Recommend** |

Tap the crayon to toggle Ink. Press and hold the crayon itself to expand a single compact rail inside the existing card chrome, never over the article. The rail contains five color swatches and three fixed line samples. It collapses immediately after a choice, on outside interaction, or on route change.

Defaults and bounded values:

- Color: Blue (`blue`) by default; optional `black`, `red`, `green`, and `orange`.
- Width: Medium (`medium`) by default; optional `thin` and `thick`.
- Store enum codes, not arbitrary colors or numeric widths.
- Store the preference locally. Do not add a Firestore preference read or write.

The exact color values and CSS widths remain design tokens, allowing visual tuning without migrating stored annotations.

## Rendering Decision

| Renderer | Strengths | Weaknesses | Fit |
| --- | --- | --- | --- |
| SVG overlay | Native vector paths, resolution independent, direct preview reuse, easy responsive viewBox, no dependency | Too many individual path nodes can become expensive | Best overall |
| Canvas overlay | Excellent raw raster throughput and one DOM node | High-DPI redraws, manual hit testing, separate SVG preview path, more lifecycle code | Useful only if profiling disproves SVG |
| Hybrid canvas + SVG | Fast live stroke plus vector committed output | Two renderers, synchronization cost, larger lazy chunk | Premature for this scale |
| DOM elements per mark | Simple for underlines | Poor for freehand/circles/arrows; excessive layout and DOM | Reject |

### Recommendation: native SVG

Use one absolutely positioned SVG per active content surface, not per post card and not per paragraph. The SVG is lazy-mounted only on the focused post when Ink is armed or when that focused post has existing annotations.

Performance rules:

- Keep one active `<path>` outside React state and update its `d` attribute at most once per animation frame.
- Consume coalesced pointer samples when available.
- Simplify on release with a small in-house polyline simplifier; do not add a drawing library.
- Quantize coordinates before persistence.
- Render committed strokes as combined path strings grouped by anchor block, color, and width. Keep individual stroke identity in data, not necessarily in the DOM.
- Use `vector-effect="non-scaling-stroke"` so Thin/Medium/Thick stay visually stable across responsive scaling.
- Use `pointer-events="none"` for committed SVG. The transient capture layer exists only during CANDIDATE/DRAWING.
- One route-scoped `ResizeObserver`, throttled to animation frames, recomputes projection after width/orientation changes. No observer exists in the feed.
- Do not mount an off-screen canvas, hidden preview DOM, image generator, or screenshot pipeline.

SVG is not selected because it beats Canvas at every possible stroke count. It is selected because hundreds of simplified, grouped vectors are within the expected scale and it gives the smallest coherent system for live rendering, responsive replay, and My Notes previews. Canvas remains a measured fallback only if the acceptance tests fail.

## Coordinate and Anchor Model

Pixel coordinates alone are unsafe because Readative posts reflow. Paragraph indexes alone are also unsafe because the current content is split on blank lines and indexes change when an author inserts a paragraph.

Use a dual anchor for every stroke:

1. **Geometric anchor** — a simplified polyline in a 0–4095 block-local coordinate space, original block bounds/aspect, and sparse text pins.
2. **Semantic anchor** — canonical full-content offsets, paragraph ordinal as a hint, block fingerprint, content revision, and hashed quote context.

No selected text is stored. The quote context contains lengths and SHA-256 hashes for the exact nearby range, prefix, and suffix. On an edited post, the resolver can scan candidate ranges and compare hashes without persisting readable snippets.

Sparse text pins attach selected polyline point indexes to nearby character positions plus `dx`/`dy` offsets in `em` units. They allow piecewise reprojection when line wrapping changes without attaching metadata to every point.

### Resolution order

1. If the content revision and layout signature match, replay the block-local polyline directly.
2. If content matches but width, font metrics, or orientation changed, resolve text pins and piecewise-warp the path; fall back to block-normalized geometry only when pins are insufficient.
3. If content changed, try the original offsets, then block fingerprint, then hashed exact/prefix/suffix context.
4. If anchors resolve uniquely, replay against the new DOM without rewriting source data immediately.
5. If resolution is ambiguous or insufficient, fail closed: preserve the stroke in storage and preview, but do not draw it at a potentially incorrect place.

This cannot guarantee pixel-identical freehand across arbitrary text rewrites; no reflowing web architecture can. The safe guarantee is that Ink will not silently attach a mark to unrelated text.

## Firestore Storage Options

| Model | Reads | Writes | Scale/safety | Decision |
| --- | --- | --- | --- | --- |
| All strokes in one user/post document | One | One document update per save | Eventually approaches Firestore's 1 MiB document limit; rewrites grow | Reject |
| One document per stroke | Hundreds | Simple and conflict-safe | Hundreds of reads to open a heavily annotated post | Reject |
| Store paths on `knowledge` posts | Low | Contends with public post writes | Mixes private user data with shared content and duplicates ownership | Reject |
| Summary + bounded stroke chunks | One summary plus a few chunk reads | Two batched writes per flush | Bounded documents, private, scalable, preview efficient | **Recommend** |

Firestore documents have a hard 1 MiB limit, so the architecture must use a much lower internal chunk ceiling rather than treating that maximum as a target.

### Recommended future schema

```text
/userInk/{uid}
  /posts/{postId}                       # private summary/manifest
    schemaVersion: 1
    createdAt: Timestamp
    lastAnnotatedAt: Timestamp
    strokeCount: number
    chunkCount: number
    contentRevision: string
    preview: {
      viewBox: [number, number, number, number]
      vectors: [{ geometry: string, c: 0..4, w: 0..2 }]
    }
    migrationVersion?: number

    /chunks/{sessionId_sequence}        # private bounded vectors
      schemaVersion: 1
      createdAt: Timestamp
      updatedAt: Timestamp
      strokeCount: number
      pointCount: number
      strokes: [{
        id: string
        at: number
        c: 0..4
        w: 0..2
        geometry: string
        anchor: compact map
      }]
```

The document paths already identify the user and post. Do not duplicate `userId`, `postId`, title, author, body, excerpt, selected text, image, or screenshot fields.

Chunk policy:

- One active chunk per browser session/post, so two devices or tabs never overwrite the same chunk.
- Seal a chunk at 40 strokes or 32 KiB of encoded payload, whichever comes first.
- Hard reject a client chunk above 64 KiB before write.
- Encode simplified, quantized point deltas as a compact string or Firestore bytes value; it remains vector source data, not a bitmap.
- Cap preview data at 8 KiB and a small representative vector count. The preview is derived from stored vectors and is not authoritative source data.
- Exempt `geometry`, stroke arrays, anchor maps, and preview vector fields from indexing. Only `lastAnnotatedAt` needs ordering for My Notes; no composite index should be required for the user-scoped query.

### Read behavior

- Base feed: zero Ink reads and zero Ink listeners.
- Focused post: after the post paints, read one manifest. If it exists, lazy-load the Ink chunk and fetch its bounded chunks. Do not subscribe.
- First Ink activation before the idle read: the same manifest request is reused, never duplicated.
- My Notes: only when the private tab opens, query `/userInk/{uid}/posts` ordered by `lastAnnotatedAt desc`, limit 12, using a cursor for later pages.
- My Notes post metadata: resolve from existing in-memory/cache data first; fetch only missing `knowledge` documents in a bounded document-ID query. This avoids duplicating post data, at the cost of additional reads only inside My Notes.
- Do not hydrate full posts for preview generation. Preview vectors already live in the Ink manifest.

### Write behavior

- Save optimistically at release.
- Update the session chunk and manifest in one Firestore write batch.
- Use unique stroke IDs and session-owned chunk IDs for idempotency and multi-tab safety.
- Use atomic counters for stroke/chunk counts. A last-writer preview race may affect only the thumbnail and self-heals when all vectors are next loaded; it must never lose source strokes.
- Optionally coalesce strokes released within a short 500 ms window into one flush, but always flush on route change or `visibilitychange`.
- Firestore's existing persistent local cache can queue offline writes. The UI should distinguish local saved/pending/failed state without blocking reading.

### Privacy and rules requirement

Ink is private. Future security rules must require authenticated ownership at every summary and chunk path: `request.auth != null && request.auth.uid == uid`. Validate allowed fields, schema version, enum ranges, bounded list/string sizes, and immutable ownership. My Notes remains own-profile only.

Rules and index exemptions are production Firestore changes and are explicitly outside this architecture-only release.

## My Notes Architecture

Rename the private Profile tab from Highlights to My Notes at final cutover. Its unit is an annotated post, not a stroke.

Each paginated card contains:

- Live post title from `knowledge/{postId}`.
- Live author from the same canonical post document/profile resolution.
- `lastAnnotatedAt` from the private Ink manifest.
- A tiny inline SVG whose paths are generated by decoding `preview.vectors`.
- Continue Reading, routed through the existing `/post/:id` path.

The tab count becomes annotated-post count, not total-stroke count. No card contains a text snippet. No preview loads a post body, image, canvas snapshot, or screenshot.

If a post is deleted or no longer visible, the system must not expose stale duplicated content. Show an unavailable state using the stored vector preview and allow the user to delete their private Ink data; Continue Reading is disabled.

To preserve the current removal capability, My Notes keeps a confirmed “Delete notes from this post” secondary action. Individual stroke editing is not required for Release Y.

## Lazy-loading and Ownership Boundaries

The final architecture should have these boundaries:

- `InkController`: one active post ID and OFF/VIEWING/ARMED/CANDIDATE/DRAWING/COMMITTING state. Route-scoped, not an app-wide annotation collection.
- `InkSurface`: gesture arbitration, sampling, and live SVG. Loaded only after Ink activation or an existing manifest on the focused route.
- `InkProjection`: anchors, hashes, coordinate transforms, and SVG path generation.
- `InkRepository`: on-demand Firestore reads/writes, chunking, batches, and migration adapter.
- `MyNotes`: paginated manifests, canonical post metadata hydration, previews, and delete-post-notes action.
- `LegacyHighlightAdapter`: read-only compatibility during migration; never part of the steady-state bundle unless legacy data is detected.

The crayon shell and active-state token may remain in the existing card chunk. Gesture, codec, repository, projection, migration, and My Notes preview code must be dynamic imports.

## Performance Budgets

These are implementation gates, not measured results.

| Surface | Budget |
| --- | --- |
| Initial application JS | 0–1 KiB gzip increase; no drawing dependency in the initial graph |
| Lazy Ink interaction chunk | Target 6–10 KiB gzip; hard gate 12 KiB gzip |
| Lazy My Notes-specific UI | Target 2–4 KiB gzip beyond shared Ink codec |
| Feed Firestore | 0 reads, 0 listeners caused by Ink |
| Feed DOM | 0 SVG overlays and 0 hidden Ink surfaces |
| Active drawing | One DOM path update per animation frame; no React render per pointer sample |
| Typical focused load | 1 manifest + 1–4 chunk documents |
| 200-stroke focused load | Approximately 1 manifest + 5 chunk documents under the 40-stroke ceiling |
| My Notes first page | 12 manifests + 0–12 canonical post reads, with cache-first hydration |
| Stored typical stroke | Target 0.4–1.2 KiB after simplification, quantization, and anchor metadata |

If native SVG cannot meet the drawing/frame budget at 500 strokes on the agreed low-end device, only then prototype a live-canvas/committed-SVG hybrid behind the same interfaces.

## Behavior Under Change

| Change | Required response |
| --- | --- |
| Title or author changes | My Notes shows current canonical values on next load; Ink data is unchanged |
| Content edit with stable nearby text | Hash/offset resolver reanchors and reprojects |
| Content rewrite or ambiguous anchor | Preserve but hide unresolved strokes; never guess |
| Paragraph inserted before a mark | Block ordinal is only a hint; hashes and offsets relocate it |
| Screen width/device/orientation changes | Recompute sparse text pins and block transform; no Firestore read/write |
| Font metrics change | Re-resolve `em`-based pins after layout settles |
| Post deleted/private | Preserve private Ink until user deletes it; do not expose duplicated post data |
| Multiple tabs/devices | Unique session chunks prevent source overwrites; manifests use atomic counters |
| Offline release | Optimistic local Ink remains visible and queued; failures are recoverable |

## Architectural Decision

Approve the following target as one decision set:

1. Ink exists only on the existing focused post route.
2. ARMED never blocks normal reading; DRAWING exists only for one held contact.
3. Native SVG is the renderer, with Canvas retained only as a benchmarked fallback.
4. Vectors use geometric plus semantic hashed anchors and fail closed after unsafe edits.
5. Firestore uses private user/post manifests plus bounded session chunks.
6. My Notes reads manifests only when opened and hydrates canonical post metadata without duplicating it.
7. The base feed has no Ink reads, listeners, overlays, hidden DOM, or drawing bundle.
8. Migration is additive and reversible; the current Highlight system remains live until explicit cutover approval.

## References

- [Firestore usage and document limits](https://firebase.google.com/docs/firestore/quotas)
- [Firestore cursor pagination](https://firebase.google.com/docs/firestore/query-data/query-cursors)
- [Firestore owner-scoped security rule conditions](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [W3C Pointer Events and `touch-action`](https://www.w3.org/TR/pointerevents/)
- [W3C Touch Events first-`touchmove` cancellation behavior](https://www.w3.org/TR/touch-events/)
- [W3C selector model for text position and quote anchoring](https://www.w3.org/TR/selectors-states/)

## Approval Boundary

No part of this proposal is authorized for production implementation or Firestore deployment until the user approves the architecture.
