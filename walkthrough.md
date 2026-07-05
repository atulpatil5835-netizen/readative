# Release T1 Walkthrough - Trust, Cookies & Notification Consent

Status: completed.
Date: 2026-07-05

## Objective

Add production-grade trust polish for first-time users:

- premium first-visit cookie consent
- lightweight browser notification permission flow
- polished cookie-policy wording
- no dependencies
- no backend or Firestore changes
- no notification delivery implementation
- no routing, SEO-system, SmartTalk, Notebook, or feed changes

## Implementation

### Cookie consent

Added `src/components/TrustConsent.tsx` and lazy-loaded it from `src/App.tsx`.

The cookie card:

- appears only when consent version `2026-07-05.t1` has not been accepted
- stores acceptance locally
- links to `/cookies`
- is non-modal
- is responsive
- is keyboard-accessible
- is labelled for assistive tech

### Notification permission card

The same lazy component owns the notification permission card.

The card:

- waits until cookie consent is accepted
- waits until meaningful engagement exists
- does not call `Notification.requestPermission()` until `Enable Notifications` is clicked
- stores settled `granted` or `denied` decisions locally
- records session display so it never asks twice in the same session
- dismisses with `Not Now`
- supports Escape when focused inside the card
- adds no polling, timers, or global listeners

### Cookie page polish

Updated the existing `/cookies` legal content in `src/content/legalPages.ts`.

The page now clearly covers:

- Essential Cookies
- Preference Storage
- Future Analytics
- Future Advertising
- Controls

No routing config, route parser, canonical logic, sitemap generator, or schema utility was changed.

### Third-party startup cleanup

Removed immediate third-party script startup so the essential-cookie copy is accurate:

- Removed inline Google Analytics from `index.html`.
- Removed startup `scheduleThirdPartyScripts()` from `src/main.tsx`.
- Kept the existing utility file available for future consent-aware analytics/ads work.

## QA evidence

Cookie first visit:

```json
{
  "path": "/",
  "cookieVisible": true,
  "notificationVisible": false,
  "title": "Welcome to Readative",
  "copyMatches": true,
  "acceptButton": true,
  "learnMoreHref": "/cookies",
  "thirdPartyScripts": [],
  "overflowX": 0
}
```

Cookies page:

```json
{
  "path": "/cookies",
  "hasEssential": true,
  "hasPreference": true,
  "hasFutureAnalytics": true,
  "hasFutureAdvertising": true,
  "noCurrentAnalyticsClaim": true,
  "overflowX": 0
}
```

After acceptance and reload:

```json
{
  "cookieVisible": false,
  "notificationVisible": false,
  "thirdPartyScripts": [],
  "overflowX": 0
}
```

Responsive cookie QA:

- Desktop 1280x720: PASS
- Tablet 900x800: PASS
- Mobile 390x844: PASS
- Horizontal overflow: 0 in all checked sizes

Notification QA:

- Prompt not shown before cookie consent: PASS
- Prompt not shown before engagement: PASS
- In-app browser `Notification` API unsupported; prompt suppressed: PASS
- Source confirms permission is requested only from `Enable Notifications`: PASS
- Source confirms no polling, timers, or global listeners: PASS

Console QA:

- Browser warnings/errors: none observed

## Files modified for T1

- `index.html`
- `src/App.tsx`
- `src/main.tsx`
- `src/components/TrustConsent.tsx`
- `src/content/legalPages.ts`
- `trust_report.md`
- `performance_report.md`
- `walkthrough.md`
- `task.md`
- `final_report.md`

## Validation

Passed before report updates:

- `npm run build`
- `npx tsc --noEmit`
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`

Final gates passed after report updates.
