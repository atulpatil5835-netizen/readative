# Release P1 Task List - Production Polish Audit And P1.1 Completion

## Completed Audit Tasks

- [x] Audited existing workspace state and prior release documents.
- [x] Inspected git changes without reverting prior work.
- [x] Audited guest Home/Landing experience.
- [x] Audited guest Explore experience.
- [x] Audited guest Profile experience.
- [x] Audited Google sign-in prompts and gated save/publish prompts.
- [x] Audited Saved Posts entry point and profile saved language.
- [x] Audited SmartTalk list, focused question, search, category links, and answer surface.
- [x] Audited header, account menu, mobile navigation, dialogs, and deep links.
- [x] Audited About, Privacy, Terms, Guidelines, Disclaimer, and Notifications panels.
- [x] Reviewed logged-in-only Feed/Profile/Notifications surfaces from source.
- [x] Classified each issue by severity, impact, regression risk, and effort.
- [x] Grouped remaining work into P1.1, P1.2, and P1.3.
- [x] Ran `npm run build`.
- [x] Produced `production_audit.md`.
- [x] Updated `implementation_plan.md`.
- [x] Updated `walkthrough.md`.
- [x] Updated `task.md`.
- [x] Completed P1.1 launch-blocker polish after the audit.
- [x] Re-ran TypeScript and production build verification after P1.1 changes.

## Completed P1.1 Tasks

- [x] Restored the SmartTalk "Ask question" entry point.
- [x] Converted SmartTalk question rows to semantic focused-question links.
- [x] Reset scroll position when entering focused SmartTalk questions.
- [x] Fixed Explore SmartTalk deep links to use route-builder focused-question targets.
- [x] Added dialog semantics and Escape close behavior to the post composer.
- [x] Added dialog semantics and Escape close behavior to the SmartTalk ask modal.
- [x] Added Google sign-in copy and CTA to the guest Notifications panel.
- [x] Added primary mobile nav `aria-current` states and explicit button types.
- [x] Aligned Explore active-discussion count and SmartTalk empty-search wording.

## Files Modified

- `production_audit.md`
- `implementation_plan.md`
- `task.md`
- `walkthrough.md`
- `src/App.tsx`
- `src/components/AppPanels.tsx`
- `src/components/Explore.tsx`
- `src/components/KnowledgeFeed/FeedComposer.tsx`
- `src/components/SmartTalk.tsx`

## Files Not Modified

- Application source files were not modified during the audit phase.
- P1.1 source changes were limited to the files listed above.
- Firestore schema was not modified.
- Downloader logic was not modified.
- Highlight logic was not modified.
- KnowledgeFeed ranking was not modified.
- SEO infrastructure was not modified.
- Authentication provider logic was not modified.

## Remaining Release Tasks

- [x] P1.1: Fix SmartTalk ask entry point, SmartTalk semantic rows, focused-question scroll reset, Explore discussion deep links, composer dialog semantics, and guest notification dead-end.
- [ ] P1.2: Normalize shared modal focus management, remaining button types, recovery states, and focus restoration.
- [ ] P1.3: Clean production copy, saved-item language, legal/info panel tone, highlight icon treatment, and small visual polish.

## Verification

- `npm run build`: passed.
- `npx tsc --noEmit`: passed.
- Browser smoke: SmartTalk ask trigger, SmartTalk focused-question links, focused-question scroll reset, mobile nav `aria-current`, composer dialog semantics, and guest Notifications Google CTA passed.
- Browser note: local Explore had no visible active-discussion cards during the final smoke pass, so Explore SmartTalk link behavior was verified from source and by matching SmartTalk focused-route behavior.

## Production Readiness

- Current score: 84 / 100.
- Status: P1 audit complete and P1.1 launch-blocker polish complete.
- Recommendation: complete P1.2 before calling Readative fully premium-production ready.
