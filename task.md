# Release T1 Task Checklist

Status: implementation complete; final gates passed.
Date: 2026-07-05

## Part 1 - Cookie consent

- [x] First-visit cookie consent added
- [x] Shows only when consent version is missing or outdated
- [x] Acceptance stored locally
- [x] Versioned consent implemented
- [x] Non-modal
- [x] No fullscreen overlay
- [x] Responsive
- [x] Lightweight
- [x] Accessible
- [x] Premium/calm presentation
- [x] Copy matches required title, description, and buttons
- [x] Learn More opens `/cookies`
- [x] Acceptance suppresses future display on reload

## Part 2 - Notification permission

- [x] No immediate browser notification permission request
- [x] Existing notification system left intact
- [x] Lightweight permission card added
- [x] Card requires cookie consent first
- [x] Card requires meaningful engagement
- [x] Logged-in identity qualifies as engagement
- [x] Opening three unique posts qualifies as engagement
- [x] Enable Notifications button is the only `requestPermission()` path
- [x] Not Now dismisses the prompt
- [x] Never asks twice in the same session
- [x] Granted/denied decisions stored locally when returned by the browser
- [x] Unsupported browser Notification API suppresses the prompt
- [x] No polling
- [x] No timers
- [x] No new global listeners

## Part 3 - Cookies page

- [x] Essential Cookies wording
- [x] Preference Storage wording
- [x] Future Analytics wording
- [x] Future Advertising wording
- [x] Clear explanation
- [x] Simple language
- [x] No legal duplication added
- [x] No redesign

## Part 4 - Performance

- [x] No dependency added
- [x] No cookie library added
- [x] No notification library added
- [x] Consent UI lazy-loaded
- [x] Startup entry gzip decreased by 681 bytes
- [x] Third-party script startup removed

## Part 5 - Accessibility

- [x] Keyboard-accessible native controls
- [x] Labelled consent regions
- [x] Focus-visible styles
- [x] Escape support for notification card
- [x] ARIA labels/labelled regions
- [x] Color contrast uses existing high-contrast palette

## Part 6 - Validation

- [x] `npm run build` passed before report updates
- [x] `npx tsc --noEmit` passed before report updates
- [x] `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` passed before report updates
- [x] Final `npm run build` after report updates
- [x] Final `npx tsc --noEmit` after report updates
- [x] Final strict unused TypeScript check after report updates
- [x] Final `git diff --check`
- [x] Desktop QA
- [x] Tablet QA
- [x] Mobile QA
- [x] Cookie QA
- [x] Notification Prompt QA with in-app browser limitation noted
- [x] Accessibility QA
- [x] Console QA

## Reports

- [x] `trust_report.md`
- [x] `performance_report.md`
- [x] `walkthrough.md`
- [x] `task.md`
- [x] `final_report.md`

## Stop conditions

- [x] Push notifications not implemented
- [x] Backend notification delivery not implemented
- [x] Firestore not modified
- [x] SmartTalk not modified
- [x] Notebook not modified
- [x] Routing not modified
- [x] SEO infrastructure not modified
- [x] Feed behavior not modified for T1
- [x] Startup bundle did not increase by more than 500 bytes gzip
