# Release P1 Implementation Plan - Production Polish

Date: 2026-06-27

## Goal

Make Readative feel production-clean and premium without expanding features, rewriting architecture, changing Firestore schema, changing downloader logic, changing highlight logic, changing KnowledgeFeed ranking, changing SEO infrastructure, or optimizing performance.

This plan follows the completed audit in `production_audit.md`. No product code was changed during the audit. P1.1 implementation began only after the audit was complete.

## Release P1.1 - Launch Blocker Polish

Status: **Completed on 2026-06-27.**

Goal: fix the issues that make core flows feel broken or inaccessible.

- [x] Restore a visible SmartTalk "Ask question" entry point to the existing ask modal.
- [x] Convert SmartTalk question list rows from clickable containers into semantic links.
- [x] Fix SmartTalk focused-question scroll reset when entering a question detail.
- [x] Fix Explore discussion links so they open the intended SmartTalk question and do not resolve to 404 when opened directly.
- [x] Add dialog semantics to the post composer and SmartTalk ask modal.
- [x] Replace the guest Notifications dead-end with a clear Google sign-in path.
- [x] Add primary mobile nav `aria-current` and explicit button types.
- [x] Align Explore active-discussion pulse count with active-discussion data.
- [x] Correct SmartTalk no-match copy from posts to questions.

Regression focus:

- SmartTalk category routes.
- SmartTalk focused question routes.
- Explore discussion links.
- Mobile navigation.
- Composer open/close/publish gating.

Verification:

- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- Browser smoke checks confirmed SmartTalk links, ask trigger, focused-question scroll reset, mobile nav current state, composer dialog semantics, and guest notification Google CTA.

## Release P1.2 - Accessibility And Flow Consistency

Goal: make existing interactions feel professionally reliable across keyboard, screen reader, mobile, and desktop use.

- Add a shared modal focus pattern for Google sign-in, composer, SmartTalk ask, Info, Notifications, and sign-out confirmation.
- Restore opener focus after closing dialogs and panels.
- Add remaining explicit button types where existing controls are missing them in modal and card interaction surfaces.
- Improve SmartTalk "question not found" recovery.
- Keep guest drafts safe when sign-in is required to publish.

Regression focus:

- Authentication popup launch.
- Closing dialogs with Escape and close buttons.
- Existing form submission behavior.
- Save, helpful, comment, answer, and publish prompts.

## Release P1.3 - Copy, Trust, And Visual Polish

Goal: remove small signs of unfinished product copy and inconsistent metrics.

- Rename "Saved Posts" to a label that includes saved SmartTalk discussions.
- Replace future-facing sign-in copy with present-tense production copy.
- Tighten About, Privacy, Terms, Guidelines, and Disclaimer panel copy.
- Review highlight icon treatment for consistency without changing highlight behavior.
- Re-test mobile lower fixed controls on shorter phone heights.

Regression focus:

- Text-only copy changes.
- Account menu routing.
- Profile saved tab routing.
- Existing legal/contact panel sections.

## Safe Next Steps

1. Continue with P1.2 only.
2. Keep changes narrow to shared focus management, recovery states, and remaining accessibility consistency.
3. Run `npm run build` after each release slice.
4. Do not combine P1 polish with Firestore, SEO, downloader, highlight, ranking, or performance work.

## Production Readiness Target

- Audit baseline score: 74 / 100.
- Current post-P1.1 score: 84 / 100.
- P1.2 target: 90 / 100.
- P1.3 target: 94 / 100.
