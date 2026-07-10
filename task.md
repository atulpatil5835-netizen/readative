# Release H5 Task Checklist

Status: PASS.
Date: 2026-07-10

## Audit

- [x] Audit post URL generation and consumption.
- [x] Audit SmartTalk URL generation and consumption.
- [x] Audit feed, journey, related content, Explore, profile, bookmarks/saved items, My Notes, share/copy, sitemap, canonical metadata, OpenGraph, Twitter, JSON-LD, and server-rendered discovery.
- [x] Document findings in `seo_url_audit.md`.

## Slug Engine

- [x] Add one shared deterministic slug utility.
- [x] Normalize unicode.
- [x] Lowercase.
- [x] Remove punctuation.
- [x] Replace separators with hyphens.
- [x] Collapse duplicate hyphens.
- [x] Preserve document IDs in every canonical URL.
- [x] Support ID extraction from both legacy and slugged segments.

## Routing

- [x] Support new post URLs: `/posts/<slug>--<id>`.
- [x] Support old post URLs: `/post/<id>`.
- [x] Support new SmartTalk URLs: `/smarttalk/<slug>--<id>`.
- [x] Support old SmartTalk URLs: `/smarttalk/<id>` and `/smarttalks/<id>`.
- [x] Add server-side legacy redirects to canonical URLs after document lookup.
- [x] Preserve `/posts` discovery index.
- [x] Preserve `/smarttalks` discovery index.

## Internal Linking

- [x] Knowledge Card title links.
- [x] Knowledge Card share/copy URL.
- [x] Knowledge Feed desktop rails.
- [x] Knowledge Journey Continue Reading.
- [x] Knowledge Journey Related Posts.
- [x] Knowledge Journey Related SmartTalk.
- [x] Explore post links.
- [x] Explore SmartTalk links.
- [x] Explore search result links.
- [x] Profile shared-post structured data.
- [x] Profile saved SmartTalk opens.
- [x] My Notes Continue Reading.
- [x] Server-rendered related post links.
- [x] Server-rendered related SmartTalk links.
- [x] Sitemap URLs.
- [x] Discovery index anchors.

## SEO

- [x] Canonical URL generation.
- [x] OpenGraph URL generation.
- [x] Twitter card metadata pairing.
- [x] Article JSON-LD URL.
- [x] DiscussionForumPosting JSON-LD URL.
- [x] FAQPage JSON-LD URL.
- [x] Breadcrumb URL.
- [x] ItemList URL.
- [x] Sitemap entries.
- [x] SEO verifier updated for slug URL contract.

## Validation

- [x] `npx tsc --noEmit`
- [x] `npm run build`
- [x] `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`
- [x] `npm run verify:seo`
- [x] `git diff --check`
- [x] Local direct route smoke for old and new post URLs.
- [x] Local direct route smoke for old and new SmartTalk URLs.
- [x] Browser refresh/back/forward smoke for representative canonical post and SmartTalk routes.
- [x] Browser canonical/OG smoke for Home, Explore, post, and SmartTalk routes.
- [x] Static/code-path coverage for auth-personalized Bookmarks and Notifications URL opens.

## Scope Guard

- [x] No Firestore schema change.
- [x] No feed ranking change.
- [x] No SmartTalk logic change.
- [x] No Notebook change.
- [x] No Authentication change.
- [x] No Notifications behavior change.
- [x] No UI redesign.
