# Readative AdSense Readiness Report

Generated: 2026-09-06

## Purpose

This report tracks the local fixes made after AdSense reported these issues for readative.com:

- Google-served ads on screens without publisher content.
- Low value content.
- Site ownership verification needs attention.

## Changes Made

- Added the AdSense account verification meta tag for `ca-pub-8482951627272767` to the app shell and server-rendered documents.
- Kept the existing `public/ads.txt` seller record in place.
- Added `/advertising-policy` as a public policy page with ad placement, inventory quality, privacy, consent, and reporting sections.
- Added the Advertising Policy to footer navigation, legal route handling, Vercel rewrites, Netlify-style redirects, sitemap static pages, and `llms.txt`.
- Disabled Google ad serving by default through `VITE_ADSENSE_AUTO_ADS_ENABLED=false`.
- Restricted future ad loading to individual content routes only, not home, profile, search, empty, alert, navigation, or policy screens.
- Raised indexable content thresholds so short posts and short SmartTalk discussions stay accessible but do not enter the main crawlable review inventory.
- Raised ad-eligible content thresholds further so future ads are limited to substantial publisher content.
- Normalized review-facing metadata from `ReAdative` to `Readative`.
- Marked the static 404 page as `noindex, follow`.

## Current Content Inventory

Using live Firebase/REST content during QA:

- Public posts found: 365.
- Posts now considered indexable: 86.
- Posts eligible for future ad loading: 19.
- Public SmartTalk discussions found: 109.
- SmartTalk discussions now considered indexable in SEO verification: 34.
- SmartTalk discussions eligible for future ad loading: 0.

## QA Results

- `npm run build`: passed.
- `npx tsc --noEmit`: passed.
- `npm run verify:seo`: passed with no blocking failures.
- Server-render spot checks passed for `/`, `/posts`, and `/advertising-policy`.
- Built local preview at `http://127.0.0.1:4173/` returned 200, included the AdSense account meta tag, and did not include the Google ad-serving script.
- `git diff --check`: passed with only Git line-ending warnings.

## Deployment And Review Notes

- These fixes are local until deployed to production.
- Vercel CLI availability check failed on this machine with `ECOMPROMISED Lock compromised`, so production deployment was not attempted here.
- Keep `VITE_ADSENSE_AUTO_ADS_ENABLED=false` during the next AdSense review.
- After the production deployment is live, confirm `https://www.readative.com/`, `https://www.readative.com/posts`, and `https://www.readative.com/advertising-policy` expose the new HTML.
- AdSense says another review request is available from 12 September 2026, so do not request review before that date.
