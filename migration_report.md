# Release P4 - Migration Report

Status: complete.
Date: 2026-07-04

## Migration type

P4 is a code-only discovery and internal-linking migration. It introduces no database, document, index, dependency, or content migration.

## Data and cache compatibility

- Firestore schema is unchanged.
- Existing post, SmartTalk, profile, category, and tag fields are reused.
- Client recommendations consume already-loaded component data.
- Server recommendations consume the existing SEO dataset cache.
- No listener, poll, timer, interval, or extra recommendation query was added.

## Recommendation migration

Repeated post/question matching logic moved to `src/utils/contentGraph.ts`. Callers provide their existing arrays and receive deterministic, bounded, deduplicated recommendations.

The server post SEO loader no longer uses obsolete per-category REST recommendation helpers. Removing those helpers does not change stored data or public URL ownership.

## Route migration

No production route was added or removed.

Existing routes were enriched:

- `/post/{id}`
- `/smarttalks/{questionId}`
- `/profile/{authorId}`
- `/topic/{slug}`
- `/category/{slug}`
- `/tag/{slug}`

Existing canonical redirects and old SmartTalk compatibility behavior remain intact.

## Tag normalization

Tag labels now pass through the shared route slug normalizer. Casing and whitespace variants resolve to the same URL slug, and duplicate normalized tags are discarded before recommendations or links render.

No stored tag values were rewritten.

## Structured-data migration

Existing SEO schemas were preserved and aligned with the richer discovery surfaces:

- Article and BreadcrumbList for posts
- DiscussionForumPosting, FAQPage, and BreadcrumbList for SmartTalk
- Person, Organization, BreadcrumbList, and ItemList for authors
- CollectionPage and BreadcrumbList for categories/topics

## Rollback

Rollback is code-only. No Firestore, index, or dependency rollback is required.

If rollback is needed, restore the prior local recommendation selectors and remove the P4 presentation sections. Existing content and URLs require no remediation.

## Migration status

Complete. No data migration remains.
