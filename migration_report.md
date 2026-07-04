# Release P1 — Migration Report

Status: implemented and validated.
Date: 2026-07-04

## Migration type

This release is a URL, routing, metadata, and crawlability migration.

No Firestore documents were migrated, copied, rewritten, deleted, or reshaped.

## URL migration

| Old surface | New canonical surface | Migration behavior |
| --- | --- | --- |
| legal AppPanel sections | `/about`, `/contact`, `/privacy`, `/terms`, `/disclaimer`, `/community` | footer/header links now navigate to public URLs |
| `/community-guidelines` | `/community` | permanent redirect |
| `/smarttalk` | `/smarttalks` | server 308 redirect |
| `/smarttalk?id={questionId}` | `/smarttalks/{questionId}` | server 308 redirect |
| `/smarttalk/{questionId}` | `/smarttalks/{questionId}` | server 308 redirect |
| `/category/{slug}?id={questionId}` | `/smarttalks/{questionId}` | preserved as client-resolved compatibility to avoid breaking category routing |
| `/post/{postId}` SPA shell | `/post/{postId}` server SEO document plus SPA hydration | same public URL, stronger initial HTML |

## SmartTalk migration

Canonical SmartTalk URLs are now:

```text
/smarttalks
/smarttalks/{questionId}
```

Internal SmartTalk question links, SmartTalk schema, Explore schema, discovery output, and sitemap output now point to canonical question URLs.

Backward compatibility remains through:

- server redirect for `/smarttalk`
- server redirect for `/smarttalk?id={questionId}`
- server redirect for `/smarttalk/{questionId}`
- SPA parsing for category query aliases
- SPA parsing for old hash aliases

## Legal migration

The legal side panel is no longer the primary legal experience.

Authoritative legal pages are single-source server-rendered documents in `api/legal.ts`.

The optional `InfoPanel` was reduced to a lightweight preview that links to:

- `/about`
- `/contact`
- `/privacy`
- `/terms`
- `/community`
- `/disclaimer`

Duplicated legal content inside the panel was removed.

## Sitemap migration

The sitemap now contains production URLs only:

- static public pages
- legal/trust pages
- public posts
- public SmartTalk questions
- public author profiles with public contribution evidence
- non-empty categories/topics

The sitemap excludes:

- legacy `/smarttalk` URLs
- query URLs
- `/tag/` URLs
- empty/thin taxonomy URLs
- private/deleted/hidden content
- fallback timestamps when no reliable lastmod exists

## Rollback

Application rollback restores the previous SPA shell behavior and old footer/panel routing. No database rollback is required.

Operational rollback watch items:

- Vercel rewrites for `/about`, `/contact`, `/privacy`, `/terms`, `/disclaimer`, `/community`, `/post/:id`, `/smarttalks`, and `/smarttalks/:id`.
- Vercel redirect/rewrite for `/smarttalk`.
- Sitemap dynamic data availability.

## Compatibility note

No server redirect was added for `/category/{slug}?id={questionId}` because that would require query-sensitive category route interception and could introduce breaking category behavior. The old URL shape remains resolved by the existing SPA route parser, preserving user navigation while canonical links and sitemap discovery point to `/smarttalks/{questionId}`.

## Migration status

Complete for P1.

No data migration remains.
