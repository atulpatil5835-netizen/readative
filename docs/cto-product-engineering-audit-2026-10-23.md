# Readative CTO Product & Engineering Audit

**Date:** 2026-10-23  
**Scope:** application source, existing release audits, Firestore read patterns, media handling, main user journeys, and production-operability risks.  
**Production data:** not changed during this audit.

## Executive view

Readative already has meaningful product foundations: a personalized knowledge feed, virtualized cards, route-level lazy loading, bounded feed/discovery reads, cached feed and SmartTalk previews, a Knowledge Journey, SmartTalk discussions, bookmarks, and a private Notebook. The best next gains come from making the valuable content arrive quickly, making data/security boundaries explicit, and helping a reader find a reliable next step. A rewrite would put those working interactions and Firestore safeguards at unnecessary risk.

One targeted performance change is included in this pass: the lead image on a Tech News article is now requested eagerly with high fetch priority, while feed thumbnails remain lazy. That removes lazy-image scheduling from the likely largest above-the-fold image on an article route.

## Existing strengths confirmed in source and release notes

- Major app surfaces are lazy-loaded; the knowledge card path is also split.
- `KnowledgeCardList` virtualizes cards and measures visible items.
- The home feed uses bounded one-shot pages and a returning-reader cache; it does not open a permanent public feed listener.
- Explore and SmartTalk preview reads are bounded, and the profile directory is deferred until needed.
- Readitive has local feed personalization signals, category/tag suggestions, authoring feedback, and contextual Knowledge Journey recommendations.
- Primary user actions generally update the UI from committed Firestore results; notifications are best-effort side effects.
- Prior audits record responsive route smoke checks. Authenticated write checks still need an authorized signed-in browser session.

## Prioritized CTO roadmap

### P0 — Verify and own the production security boundary

The repository search did not find a checked-in Firestore rules file or Firebase project config. That means this source audit cannot establish whether production rules are least-privilege, whether private profile/Notebook fields are protected, or whether public clients can write sensitive fields. Confirm the deployed rules in Firebase Console, export them into version control, and review each collection against its actual read/write paths before changing them. Do not deploy a guessed ruleset: current client features depend on direct Firestore writes.

Also maintain an explicit production project/database inventory and backup/restore drill. The active default database has delete protection, but Spark does not provide Firestore PITR; retain an independent export procedure and verify restore periodically.

### P1 — Move newly uploaded images to object storage safely

The production inventory confirms image `dataUrl` fields in Firestore documents. Base64 media inflates document reads and makes feed, profile, and news data more expensive to transfer and harder to cache independently. For future uploads, use a server-authorized upload flow to Cloudflare R2 and store stable object keys/URLs plus MIME type, dimensions, size, and lifecycle metadata in Firestore. Keep existing media readable during a gradual backfill; do not migrate historical data in the same release as the new-upload path. Add image resizing/variants and a CDN cache policy, then measure real image bytes and load timing before migrating old records.

### P1 — Make feed freshness and reader control more transparent

Personalization already ranks by reading and engagement activity. Give readers simple controls to tune it: topic follows/mutes, a chronological option, and a visible way to reset personalization. Start with local state or an explicit profile preference only after deciding whether the setting should sync across devices. Measure whether these controls improve meaningful reading and return visits, not raw scroll time.

### P1 — Strengthen discovery-to-contribution onboarding

The app already offers content quality hints and suggested categories/tags. Build on that with a small, dismissible “choose topics” step and a clear first-contribution path. Keep the home feed available immediately and allow skipping. A useful onboarding success metric is a reader reaching a relevant post or first meaningful action, not forced account creation.

### P1 — Reduce slow-route image delay

**Implemented:** the main image of a focused Tech News article is now eager and high priority; feed cards remain lazy. Next, inspect the published article’s LCP and image transfer size on mobile/slow network. Avoid applying high priority to every virtualized feed image.

### P2 — Separate policy/data behavior from large screens

`Profile`, `KnowledgeFeed`, `SmartTalk`, and `Explore` combine rendering with route state, derived data, and Firestore lifecycle logic. These are expensive to change safely. Extract one behavior at a time behind the current component/API boundary, beginning with pure view-model helpers. Preserve existing query limits, cache identity, listener count, pagination cursors, and transaction semantics. Avoid a wholesale component rewrite.

### P2 — Add operational visibility with privacy controls

Add opt-in, privacy-respecting measurements for route load time, image load failures, feed page latency, search-to-open actions, successful contribution, and return cohorts. Do not log post bodies, private profile data, email addresses, or Notebook content. The codebase previously removed startup analytics for consent/trust reasons, so any analytics restoration needs an explicit consent and retention policy.

### P2 — Establish reliability and scale indicators

Track Firestore reads/listeners per route, failed write rate by action, image transfer bytes, page-level LCP/CLS, and server function error rate. Keep alerts actionable and avoid client-side retries that multiply reads or writes. Existing embedded comments, reactions, and SmartTalk answers are reasonable at current size; migrate hot or growing arrays only when document size/contention data justifies it, with a compatibility and rollback plan.

## Implementation in this pass

`src/components/KnowledgeCard/KnowledgeCard.tsx` now sets `loading="eager"` and `fetchPriority="high"` only for the `news-article` lead image. Other news cards remain lazy-loaded. The browser can begin fetching the article's main visual earlier without increasing priority for every feed image.

## Fresh follow-up pass

The email OTP API previously returned `Access-Control-Allow-Origin: *`, including on verification responses that contain a Firebase custom token. The app calls this API same-origin in production and through the Vite proxy in local development, so wildcard browser access was unnecessary. `api/auth.ts` now accepts only `https://readative.com`, `https://www.readative.com`, and the two local Vite development origins; an unapproved `Origin` receives HTTP 403. Requests without an `Origin` remain usable for server-to-server calls. This is browser-origin hardening, not authentication: OTP validation, rate limits, and Firebase token checks remain necessary.

The pass also rechecked existing platform headers. Vercel already applies `nosniff`, frame denial, a strict referrer policy, and a restrictive permissions policy site-wide. A Content Security Policy was not added because the app's Firebase/Auth, image, and third-party integration origins need a tested policy before enforcing one.

## Additional media efficiency pass

New Knowledge posts and Tech News stored the first image twice: once in the canonical `images[]` asset list and again as the full base64 `imageDataUrl`. The browser feed cache repeated this duplication even though it budgets image size from `images[]` alone. New Firestore writes now keep the canonical array and image metadata without the redundant top-level base64. Feed cache entries also clear the duplicate field after normalizing legacy image-only entries into `images[]`. Existing legacy reads and their image fallback remain intact. This reduces bytes stored and transferred for new/cached posts; the exact savings depend on image size. Historical Firestore documents are unchanged.

## Limits and follow-up

This is a source and historical-audit review, not a production browser performance study. No live Firebase rules were edited, no production data was changed, and no tracking was introduced. Authenticated write behavior and deployed rules must be verified in the owner’s Firebase environment. The next concrete release should first capture mobile LCP/image bytes and inspect deployed Firestore rules; then implement the new-image R2 upload path as an additive, reversible change.
