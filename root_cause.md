# Release R3 Root Cause - UX Stability & Deployment Polish

Status: root causes identified, fixed, and validated.
Date: 2026-07-05

## Scope boundary

R3 is a stabilization release only. No features, UI redesigns, Firestore schema changes, SmartTalk behavior changes, Notebook behavior changes, feed ranking changes, SEO behavior changes, or routing changes were introduced.

## Confirmed root cause 1: double loading / hydration restart

The production-visible loading restart came from identity hydration, not React StrictMode.

Before R3, `src/App.tsx` initialized `identity` synchronously with `getKnowledgeIdentity()`. That function can return a local guest knowledge identity before Firebase auth has resolved. After the Firebase auth subscription settles, `subscribeToGoogleIdentity()` updates the identity again: either to the signed-in Google identity or to `null` for signed-out users.

That created this sequence on identity-dependent surfaces:

```text
Initial render
-> temporary local knowledge identity exists
-> feed/profile/explore/notebook/notifications can mount or hydrate from that identity
-> Firebase auth subscription resolves
-> identity changes to the real auth result
-> identity-dependent effects restart
-> users can see content/skeleton/content or repeated hydration work
```

Affected ownership seams:

- `src/App.tsx`: app identity source and route-surface mounting
- `NotebookProvider`: received pre-auth identity before auth settlement
- `KnowledgeFeed`: received pre-auth identity and ownership context
- `Explore`: reads `currentIdentity?.authorId` in data effects
- `Profile`: computes active author identity from `currentIdentity`
- `SmartTalk`: receives identity for reader/user state
- Notifications listener: subscribed from identity before auth was settled

React StrictMode was audited but is not the deployed root cause. StrictMode can double-invoke effects in development, but production preview and Vercel builds do not rely on that behavior to reproduce the observed loading restart.

## Fix 1

`src/App.tsx` now separates raw identity state from hydrated identity state:

- `isIdentityHydrated` starts as false when Firebase config is available.
- `hydratedIdentity` is `null` until Firebase auth has resolved.
- Identity-dependent surfaces mount only after identity hydration is complete.
- Notifications listen only for `hydratedIdentity?.authorId`.
- Notebook, Header, Feed, SmartTalk, Profile, Explore, and NotificationsPanel all receive the same hydrated identity boundary.

This preserves product behavior while removing the transient pre-auth identity pass.

## Confirmed root cause 2: refresh restored the feed to the middle

The refresh jump was caused by accidental browser-persistent feed scroll restoration.

Before R3, `src/components/KnowledgeFeed/feedHelpers.ts` stored feed scroll positions in `sessionStorage` under:

```text
readativeKnowledgeFeedScroll:v1
```

`KnowledgeFeed` then restored that value on first render. Because `sessionStorage` survives hard refreshes in the same tab, refreshing Home or Explore could restore the page to an old middle-of-feed position.

Reproduction before the fix:

```json
{
  "route": "/",
  "beforeReloadScrollTop": 1150,
  "afterReloadScrollTop": 2760
}
```

## Fix 2

Feed scroll positions are now in-memory only:

- Hard refresh starts with an empty scroll map.
- Home refresh starts at top.
- Explore refresh starts at top.
- Profile refresh starts at top.
- In-session browser back/forward can still intentionally restore feed scroll.
- Direct post routes still keep the focused post behavior.

`src/main.tsx` also initializes browser scroll restoration as manual before React mounts, via `src/utils/scrollRestoration.ts`.

## Direct-post note

The route `/post/:id` intentionally scrolls the focused post into view using the existing focused-entry behavior in `KnowledgeFeed`. This is not a refresh bug because the expected behavior for direct post refresh is "same post," not "top."

Validated route:

```text
/post/4ELsdHoS5ra5PJkDQbgk
```

After reload, the focused entry remained the same post and occupied the viewport.

## Deployment finding

No deployment blocker was found.

Validated:

- `npx vercel build --yes`: PASS
- Vercel output: `.vercel/output`
- Serverless route probe: PASS for sitemap, post, SmartTalk, legal, SPA, and API routes
- Lazy chunks and dynamic imports emitted successfully
- Hydration/runtime console checks showed no errors or warnings

## Files changed

- `src/App.tsx`
- `src/main.tsx`
- `src/utils/scrollRestoration.ts`
- `src/components/KnowledgeFeed/KnowledgeFeed.tsx`
- `src/components/KnowledgeFeed/feedHelpers.ts`
