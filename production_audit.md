# Readative Release P1 Production Audit

Date: 2026-06-27

## Objective

Audit Readative from a real user's perspective and identify production polish issues only. This audit does not implement UI changes, UX changes, feature expansion, architecture rewrites, schema changes, ranking changes, SEO infrastructure changes, downloader changes, highlight logic changes, or performance optimization.

## Audit Method

- Reviewed the current workspace and prior release documents.
- Inspected the current git changes without reverting prior work.
- Ran the local Vite app at `http://127.0.0.1:5173/`.
- Audited desktop at the default `1280x720` viewport.
- Audited mobile at `390x844`.
- Inspected guest flows through Home, Explore, Profile, account menu, notifications, sign-in, post actions, composer, SmartTalk, and info panels.
- Reviewed logged-in-only surfaces from source where authentication could not be safely completed in this audit session.
- Ran `npm run build`.

## Build Status

- Audit phase `npm run build`: passed.
- Audit phase: no product code was modified.
- P1.1 stabilization phase: launch-blocker source changes were made only after the audit was complete.

## Production Readiness Score

Audit baseline: **74 / 100**

Readative is functional and content-rich, with a strong foundation from the G releases. It is not yet premium-production clean because one SmartTalk contribution path is effectively unreachable and several navigation, accessibility, modal, and deep-link issues remain.

Post-P1.1 launch-blocker score: **84 / 100**

P1.1 removes the largest SmartTalk contribution, deep-link, guest notification, composer semantics, mobile navigation, and Explore metric inconsistencies. Readative is still not fully premium-polish complete because shared modal focus restoration, recovery states, production copy cleanup, and lower-risk visual polish remain.

## Issue Register

| ID | Severity | Flow | Problem | Impact | Recommended solution | Regression risk | Effort |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P1-001 | Critical | SmartTalk question flow | The SmartTalk ask-question modal exists in state and markup, but no visible list-view entry point opens it. The mobile `Create` action opens the post composer, not SmartTalk ask. | Normal users can read and answer but cannot discover how to ask a SmartTalk question. This blocks a core SmartTalk contribution flow. | Restore a single visible "Ask question" trigger that opens the existing SmartTalk ask flow and keeps the existing Google sign-in gate. | Medium | Small |
| P1-002 | High | SmartTalk list | Question rows are clickable `div` containers with `cursor-pointer`, no link/button semantics, no `tabIndex`, and no keyboard activation. | Mouse users can open questions, but keyboard and screen-reader users do not get a proper interactive control. It also hides real deep links. | Render each question row as a semantic link or button using the existing SmartTalk route target. Preserve current visual styling. | Medium | Medium |
| P1-003 | High | SmartTalk deep links/back navigation | Opening a question from a scrolled SmartTalk list retains the previous scroll position. In testing, the focused route opened at `scrollY: 404`, landing mid-detail. | Users can arrive inside the answer area with the question/back context partly off-screen, which feels broken on mobile. | Scroll the SmartTalk container/page to top when `focusedQuestionId` changes, while preserving normal browser back behavior. | Low | Small |
| P1-004 | High | Explore to SmartTalk links | Explore discussion links use `/smarttalk#question-{id}` while the router treats that hash as an unknown route. Directly opening `/smarttalk#question-import_q100` produced the Not Found route. SPA clicks also call `onOpenSmartTalk()` without passing the question id. | SmartTalk links from Explore can lose their target or resolve to 404 when opened directly, shared, or opened in a new tab. | Use the existing SmartTalk focused-question route shape, such as `/smarttalk?id={id}` or the route builder, for both `href` and click behavior. | Medium | Small |
| P1-005 | High | Create post/composer | The post composer behaves like a modal overlay but lacks `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape handling, and focus restoration. Several buttons in the composer also omit explicit `type`. | Keyboard and assistive-tech users do not get a reliable modal contract. Future form nesting could create accidental submit behavior. | Add dialog semantics and focus handling to the existing composer shell without changing composer fields or publish logic. Add explicit button types. | Medium | Medium |
| P1-006 | High | Dialogs/authentication | Modal focus behavior is inconsistent. Info and notifications handle Escape, but there is no shared focus trap/restore. Google sign-in initially focuses the close button. | Users can lose focus context after closing panels, and the sign-in conversion flow feels less intentional. | Introduce a shared modal focus pattern for existing dialogs: initial focus, focus trap, Escape, and opener focus restore. | Medium | Medium |
| P1-007 | High | Notifications guest state | Guests can open Notifications, but the panel says "Choose a username once" and has no action. The app now uses Google sign-in language elsewhere. | Guest users hit a dead-end panel and receive outdated guidance. | Either route guests to the existing Google sign-in prompt from notifications or add a clear sign-in CTA/copy inside the panel. | Low | Small |
| P1-008 | Medium | Mobile navigation | The fixed mobile nav buttons have no `aria-current` state and omit explicit `type="button"`. | Sighted users see active styling, but assistive tech does not receive current-page state. | Add `aria-current="page"` to the active mobile nav button and explicit button types. | Low | Small |
| P1-009 | Medium | Explore | Explore's "Today's Pulse" showed `Active Discussions 0` while the same page listed active discussions below. | Conflicting metrics reduce product trust and make the platform feel unfinished. | Align the pulse count with the same active-discussion data used by the discussion section. | Low | Small |
| P1-010 | Medium | SmartTalk search | Empty search copy says `No SmartTalk posts matched`, even though SmartTalk content is questions/discussions. | Minor wording inconsistency, but it weakens product language. | Change the copy to "questions" or "discussions" without changing behavior. | Low | Small |
| P1-011 | Medium | SmartTalk focused route | The "Question not found or has been deleted" state has no recovery action beyond the route context. | Broken/deleted links feel abrupt and leave users without a useful next step. | Add existing-style recovery actions: back to SmartTalk, clear category, or search. | Low | Small |
| P1-012 | Medium | SmartTalk ask modal | The SmartTalk ask overlay also lacks dialog semantics and focus management. | Once the ask entry point is restored, the modal will still have accessibility polish debt. | Give the existing ask overlay `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape handling, and focus restore. | Medium | Small |
| P1-013 | Medium | Guest create/publish | Mobile `Create` opens the full post composer for guests and only communicates "Sign in to publish" inside the composer. | A guest can invest effort drafting before learning that Google sign-in is required to publish. | Keep draft preservation, but make sign-in requirement clearer at composer entry or in the composer header. | Medium | Medium |
| P1-014 | Medium | Loading/empty states | Explore can briefly appear sparse while data sources settle; the page header/search are visible before community sections appear. | First-time users can interpret the page as empty or unfinished during staggered loading. | Use the existing skeleton/empty-state patterns more consistently while Explore sections hydrate. | Low | Small |
| P1-015 | Low | Account menu/profile | The account menu says "Saved Posts" while profile saved content now includes posts and SmartTalk discussions. | Users may not realize saved discussions are included. | Rename to "Saved" or "Saved Items" while preserving the same route. | Low | Small |
| P1-016 | Low | Sign-in copy | Google sign-in benefit copy says "Build toward richer visibility tools as they arrive." | Future-facing wording can make the production app feel unfinished. | Replace with present-tense benefit copy tied to existing saved posts, highlights, discussions, and reputation. | Low | Small |
| P1-017 | Low | About/Privacy/Terms | Policies are presented in a polished panel, but the helper copy says "Open the section you need from the buttons below." The legal content feels more like an app widget than formal production policy pages. | Professional trust is acceptable but not premium. | Tighten copy and typography inside the existing panel; consider future dedicated routes outside P1 if desired. | Low | Small |
| P1-018 | Low | Highlight affordance | Highlight mode is represented by an emoji-style glyph in the card header area. | It works, but the affordance feels less consistent than the rest of the lucide-based action system. | Replace only the icon/label treatment in a future polish pass without changing highlight logic. | Low | Small |
| P1-019 | Low | Mobile profile | Guest profile uses a fixed Google sign-in CTA above the bottom nav. It fits at `390x844`, but the lower screen is busy. | On shorter mobile heights or with browser UI visible, the CTA/nav stack may feel crowded. | Re-test at smaller heights and adjust spacing only if overlap is confirmed. | Low | Small |

## Critical Issues

1. **P1-001: SmartTalk ask-question entry point is unreachable.**

## Launch Blockers

- P1-001: Restore the SmartTalk ask-question entry point. **Completed in P1.1.**
- P1-002: Make SmartTalk question cards semantic and keyboard-accessible. **Completed in P1.1.**
- P1-003: Reset focused-question scroll position. **Completed in P1.1.**
- P1-004: Fix Explore-to-SmartTalk focused-question links. **Completed in P1.1.**
- P1-005: Add production-grade modal semantics to the composer. **Completed in P1.1.**
- P1-006: Normalize shared modal focus handling across all dialogs. **Remaining for P1.2.**

## P1.1 Completion Addendum

Completed after the audit, on 2026-06-27:

- Restored a visible SmartTalk "Ask question" trigger that uses the existing ask flow.
- Converted SmartTalk question rows into semantic SmartTalk links with focused-question route targets.
- Reset scroll position when opening a focused SmartTalk question.
- Replaced Explore SmartTalk hash links with the existing route-builder shape.
- Added dialog semantics and Escape handling to the post composer and SmartTalk ask modal.
- Added a Google sign-in path in the guest Notifications panel.
- Added explicit `type="button"` and `aria-current` where needed in primary mobile navigation.
- Aligned Explore active-discussion pulse counts with the visible active-discussion data source.
- Corrected SmartTalk empty-search copy from posts to questions.

P1.1 did not change Firestore schema, downloader behavior, highlight behavior, KnowledgeFeed ranking, SEO infrastructure, authentication provider logic, or performance architecture.

## Quick Wins

- Add `aria-current` and `type="button"` to mobile nav buttons.
- Rename "Saved Posts" to "Saved" or "Saved Items".
- Change "No SmartTalk posts matched" to "No SmartTalk questions matched".
- Update guest notification copy to Google sign-in language.
- Replace future-facing sign-in copy with present-tense production copy.
- Align Explore's active-discussion count with the visible section.

## Regression Risk Summary

- Highest risk is SmartTalk routing because cards, Explore links, category filters, and focused-question state are connected.
- Modal/focus work should be centralized to avoid inconsistent behavior across Google sign-in, composer, SmartTalk ask, Info, Notifications, and sign-out.
- Copy-only fixes are low risk.
- No Firestore schema, ranking, downloader, highlight behavior, SEO infrastructure, authentication provider logic, or performance optimizations are required for P1.1.

## Production Readiness

Readative is **P1.1 production-polish complete**, but not fully P1 complete. The launch-blocker polish is in place and verified. Remaining polish belongs to P1.2 and P1.3: shared modal focus restoration, route recovery states, copy/trust tightening, saved-item language, and small visual polish.
