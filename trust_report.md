# Release T1 Trust Report

Status: implemented and validated.
Date: 2026-07-05

## Scope

T1 is a trust and compliance release. It improves first-visit consent, browser-permission readiness, and cookie-policy clarity without implementing push delivery, backend notification delivery, Firestore changes, SmartTalk changes, Notebook changes, feed changes, routing changes, SEO infrastructure changes, or a page redesign.

## Cookie consent

Implemented a lightweight first-visit cookie consent card in `src/components/TrustConsent.tsx`.

Behavior:

- Shows only when the stored consent version is missing or outdated.
- Stores the accepted version locally under `readativeCookieConsentVersion`.
- Uses version `2026-07-05.t1`.
- Never blocks the reading surface with a modal or fullscreen overlay.
- Stays responsive on desktop, tablet, and mobile.
- Uses a semantic `role="region"` with `aria-labelledby`.
- Uses real button/link controls for keyboard access.
- `Learn More` opens `/cookies`.

Copy matches the T1 requirement:

- Title: `Welcome to Readative`
- Description: `We use essential cookies to improve your reading experience, remember your preferences, and keep Readative secure.`
- Buttons: `Accept & Continue`, `Learn More`

## Notification permission flow

Implemented a lightweight browser-notification permission card using the existing notification surface only.

Behavior:

- Does not request browser notification permission on page load.
- Does not implement push notifications.
- Does not implement backend notification delivery.
- Does not add Firestore writes, schemas, collections, or server functions.
- Does not add polling, timers, or global listeners.
- Shows only after cookie consent has been accepted and meaningful engagement exists.
- Meaningful engagement is currently:
  - a hydrated signed-in identity with an email, or
  - opening three unique posts in the same app session.
- Never asks twice in the same session because display is recorded in `sessionStorage`.
- Stores settled browser permission decisions locally when the browser returns `granted` or `denied`.
- Suppresses itself when the browser Notification API is unsupported, already granted, or already denied.
- `Enable Notifications` is the only path that calls `Notification.requestPermission()`.
- `Not Now` dismisses for the current session.
- Escape dismisses the notification card when focus is inside it.

Notification card copy matches the T1 requirement:

- Title: `Stay Updated`
- Body: `Enable browser notifications for:`
- Items: replies, comments, likes, SmartTalk activity
- Buttons: `Enable Notifications`, `Not Now`

## Cookie policy page

`src/content/legalPages.ts` was polished for the existing `/cookies` page. No route, canonical, sitemap, or SEO schema code was changed.

Verified sections:

- Essential Cookies
- Preference Storage
- Future Analytics
- Future Advertising
- Controls

The page now avoids claiming current analytics or advertising cookie use while the app no longer loads Google Analytics or Google ad scripts on startup.

## Third-party script trust fix

Before T1, `index.html` loaded Google Analytics immediately, and `src/main.tsx` scheduled third-party analytics/ad scripts on startup.

T1 removes that immediate third-party startup path:

- Removed the inline Google Analytics script from `index.html`.
- Removed the startup call to `scheduleThirdPartyScripts()` from `src/main.tsx`.
- Left the existing third-party script utility intact for future explicit consent work.

Browser QA confirmed no `googletagmanager` or `googlesyndication` script tags on first visit, after acceptance, or after reload.

## Accessibility

Verified:

- Cookie card is a labelled region.
- Notification card is a labelled region in source.
- Accept control is a real `button`.
- Learn More is a real `a href="/cookies"` link.
- Notification actions are real buttons.
- Focus styles are present.
- Escape support exists for the notification card.
- No fullscreen overlay or modal trap was introduced.
- Color choices use existing high-contrast slate/emerald styles.

## Browser QA note

The in-app QA browser reports `Notification` as unsupported. Runtime QA therefore verified suppression of the notification prompt when browser notification permission is unavailable. The native browser permission sheet was not accepted or denied during QA.

## Stop-condition audit

- Push notifications: not implemented.
- Backend notification delivery: not implemented.
- Firestore: not modified.
- SmartTalk: not modified.
- Notebook: not modified.
- Routing: not modified.
- Feed: no T1 feed behavior changes.
- SEO infrastructure: not modified.
- Dependencies: none added.

