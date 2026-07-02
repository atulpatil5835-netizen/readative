# Readative Release Y.1 — Ink System Walkthrough

Date: 2026-07-01

## Outcome

Release Y.1 replaces the production Highlight workflow with Ink.

Removed:

- Yellow text selection and `<mark>` rendering.
- Selected-text snippets.
- Paragraph/start/end highlight offsets.
- App-wide `userHighlights` realtime subscription.
- Per-post Highlight mode map.
- Highlight save/delete UI and helper code.
- Profile Highlights snippet cards.

Added:

- One route-scoped Ink Mode for the focused post.
- Touch/hold/draw/release gesture arbitration with reading-first cancellation.
- Native SVG freehand rendering for underlines, circles, arrows, and small marks.
- Blue, Black, Red, Green, and Orange Ink.
- Thin, Medium, and Thick widths.
- Long-press pen settings popover.
- One compact private Ink document per user/post.
- Feed pen indicator sourced from one user Ink index read.
- Lazy My Notes cards with live post title/author, last date, SVG preview, and Continue Reading.

No new package was installed.

## Reader Flow

### Feed

- Feed cards mount no Ink SVG and perform no per-post Ink read.
- A signed-in user's `/userInk/{uid}` index is read once per identity session without a listener.
- Posts whose IDs are in that index show only the small pen indicator.
- Tapping the pen on a feed card opens the existing `/post/:id` route and activates Ink there.

### Focused post

- Reading Mode is the default.
- Tapping the pen activates Ink only when the card is the route-focused post.
- Leaving that post, changing route, or signing out clears the active post ID.
- A focused annotated post reads exactly one Ink post document and renders its stored vectors.
- No annotation SVG is mounted on surrounding feed cards.

### Drawing

- Touch starts as a scroll candidate.
- Movement beyond 8 CSS pixels before 280 ms cancels Ink and leaves scrolling native.
- A stationary 280 ms touch activates a single stroke.
- The first post-hold move is captured with a narrowly scoped non-passive listener.
- Mouse/pen use the same model with a 140 ms dwell.
- Links, buttons, fields, multiple touches, resize, blur, visibility change, and pointer/touch cancellation never save a stroke.
- Release simplifies, quantizes, renders optimistically, and performs one Firestore save.
- Pointer sampling mutates one live SVG path at most once per animation frame; it does not update React state per sample.

### Pen settings

- Tap toggles Ink Mode.
- Long press for 450 ms opens the compact anchored settings popover.
- The popover contains only five colors and three fixed widths.
- Preferences are stored locally under `readativeInkPreference:v1`; no Firestore preference read/write is added.

## Vector Model

Each stored stroke contains:

- Opaque stroke ID and timestamp.
- Color and width enums.
- Compact base-36 geometry with at most 256 persisted points.
- Hash-based block key and block ordinal hint.
- Source block dimensions.
- Hash-only content revision.

No selected text, post title, author, body, screenshot, image, bitmap, canvas state, or arbitrary SVG markup is stored.

At render time:

1. The block hash is matched against the current post DOM.
2. Geometry is projected into the current responsive block dimensions.
3. If the exact block is absent but the content revision matches, the ordinal hint is used.
4. If neither anchor is safe, the stroke is not rendered.

Committed strokes are grouped by the 15 possible color/width combinations. The DOM therefore does not need one SVG path per stored stroke.

## Storage Walkthrough

```text
/userInk/{uid}
  postIds: [postId, ...]
  schemaVersion: 1
  updatedAt: number

/userInk/{uid}/posts/{postId}
  schemaVersion: 1
  createdAt: number
  lastAnnotatedAt: number
  strokes: InkStroke[]
```

- Existing annotated post: one `setDoc(..., merge)` with `arrayUnion(stroke)` after release.
- First stroke on a post: one atomic batch containing two document writes—the post document and user index.
- Delete notes: one atomic batch deleting the post document and removing its ID from the user index.
- Hard client limits: 600 strokes, 1,024 raw samples per gesture, 256 persisted points per stroke, 450,000 geometry characters per post, and 16,384 characters per individual geometry field.

## My Notes

Profile now uses `notes` instead of `highlights`.

- The section is lazy-loaded only when opened.
- Pages contain 12 Ink post documents.
- Missing canonical metadata is loaded from `knowledge` in one bounded document-ID query.
- Each card uses canonical post title/author and the Ink document timestamp.
- The preview decodes stored vector strokes into a tiny inline SVG over notebook guide lines.
- Continue Reading uses the existing post route.
- Delete removes only the current user's Ink for that post.
- Deleted/unavailable posts expose no duplicated stale post content.

## Obsolete Code Removed

Deleted files:

- `src/context/HighlightsContext.tsx`
- `src/components/ProfileHighlights.tsx`
- `src/components/KnowledgeCard/highlightHelpers.tsx`

Repository search after removal found no source reference to:

- `userHighlights`
- `selectedText`
- `startOffset`
- `endOffset`
- `paragraphIndex`
- `HighlightsContext`
- `ProfileHighlights`
- `highlightHelpers`

## Validation Completed

- `npx tsc --noEmit --pretty false`: passed.
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false`: passed.
- Ink geometry encode/decode/simplification check: passed.
- `npm run build`: passed, 1,775 modules transformed.
- `git diff --check`: passed; line-ending warnings only.
- Desktop Home, focused Post, Explore, SmartTalk, and Profile: loaded without console warnings/errors or horizontal overflow.
- Tablet 768×1024: required routes loaded without console warnings/errors or horizontal overflow.
- Mobile 390×844: required routes loaded without console warnings/errors; Explore, SmartTalk, and Profile had zero overflow. Home/focused Post retained the existing 4 px tolerance observation.
- Mobile post scrolling moved normally from `scrollY 0` to `600` with no Ink overlay mounted in guest mode.
- Home DOM check: 381 elements, 0 Ink overlays, 0 Ink previews, and 0 canvas elements.
- Guest Ink click correctly opened “Sign in to use Ink.”
- Guest `profile?tab=notes` correctly remained behind the profile sign-in gate.

## Verification Boundary

The in-app browser session was signed out. Authenticated Firestore persistence, the populated My Notes page, and real touch-held drawing could not be exercised without accessing an account. Those paths passed TypeScript, strict unused checks, production build, static data-flow review, and signed-out gating QA, but remain the final production QA gate.
