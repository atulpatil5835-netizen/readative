# Release H3 Walkthrough

Status: ❌ NOT READY FOR DEPLOY
Date: 2026-07-08

## Objective

Treat Readative as a production product and fix only confirmed production issues without adding features, redesigning UI, changing Firestore schema, changing routing, changing SEO architecture, touching AdSense, or changing SmartTalk logic.

## H3 Code Walkthrough

1. Profile photo flow:
   - Upload/save still writes `profileImage` to `userProfiles/{uid}` through the existing profile utilities.
   - Profile saves now dispatch `readative:user-profile-updated` only after Firestore success.
   - Knowledge Feed now collects visible author/comment/mention profile ids, loads only missing `userProfiles` docs, and caches loaded/loading ids for the session.
   - Feed cards continue to render `ProfileAvatar` from the existing profile map.

2. Edit Post:
   - The modal still loads existing title/content/hashtags from the card entry.
   - Save still writes the existing `knowledge/{postId}` fields.
   - After Firestore success, the updated entry is propagated through `KnowledgeCard` -> `KnowledgeCardList` -> `FeedRenderer` -> `KnowledgeFeed`.
   - Home/topic/focused feed state and feed cache now receive the saved title/content instead of stale entry data.

3. Helpful/Misleading:
   - Existing transaction helpers remain the primary write path.
   - Notification side effects remain best-effort.
   - Profile tracking/cleanup remains best-effort.
   - UI state continues to update from persisted arrays returned by the transaction helpers.

4. Accessibility:
   - Cookie banner link text is now `Read Cookie Policy`.
   - Trust badge exposes a descriptive accessible label.
   - Existing toggle-style controls expose `aria-pressed`.
   - Confirmed button semantics were tightened with explicit `type="button"`.

5. Google:
   - `trackPageView` now receives the app's accepted consent state and does not depend only on a storage reread.
   - GA script loading remains deduplicated after consent.
   - AdSense code was not touched.

## H3 Local Validation

Commands run from `C:\Users\Atul\OneDrive\Documents\readative (1)`:

```text
npm run build
npx tsc --noEmit
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
git diff --check
npm run verify:seo
```

Results:

- Build: PASS.
- TypeScript: PASS.
- Strict unused-symbol TypeScript: PASS.
- Diff whitespace: PASS; CRLF conversion warnings only.
- SEO verifier: PASS; 333 post URLs, 109 SmartTalk URLs, 33 profile URLs, 547 tag URLs, 509 sitemap URLs, 0 missing post URLs.

## H3 Browser QA Walkthrough

Preview URL: `http://127.0.0.1:4173/`

Passed:

1. Desktop 1280x900 Home loaded with feed content and loaded profile images.
2. Tablet 768x1024 Home loaded with feed content and loaded profile images.
3. Mobile 390x844 Home loaded with feed content and loaded profile images.
4. SmartTalk route rendered.
5. SPA navigation between Home and SmartTalk worked.
6. GA script tag remained exactly once after consent/navigation.
7. Cookie banner link text was verified as `Read Cookie Policy` before consent in the first browser pass.

Blocked:

1. Publish could not be completed because the browser session was not authenticated.
2. Google sign-in attempt in local preview failed at Firebase auth handler with `The requested action is invalid`.
3. Because auth failed, browser QA could not complete:
   - Profile image upload/save.
   - Edit Post save via authenticated ownership.
   - Helpful count persistence after refresh and another browser.
   - Misleading count persistence after refresh and another browser.
   - Comments write.
   - Notifications side-effect behavior.
4. Direct LCP measurement was blocked because the in-app browser evaluation sandbox did not expose `window.performance`.

## H3 Deployment Gate

Before deploy approval, run authenticated browser QA with an approved signed-in account:

1. Upload/change profile photo, then verify Knowledge Feed avatar after refresh.
2. Edit an owned post, refresh, and verify the feed and focused post show saved content.
3. Toggle Helpful, refresh, and verify another browser reflects the count.
4. Remove Helpful and verify count restoration.
5. Toggle Misleading, refresh, and verify another browser reflects the count.
6. Remove Misleading and verify count restoration.
7. Add a comment and verify persistence.
8. Publish a temporary post and delete it.
9. Open Notifications and verify notification failures do not affect primary writes.
10. Verify LCP under 3 seconds using a browser/runtime that exposes performance entries.

## H3 Verdict

❌ NOT READY FOR DEPLOY

# Release H2 Walkthrough

Status: local code and smoke validation passed; authenticated write walkthrough still required.
Date: 2026-07-06

## Objective

Restore interaction-based Firestore integrity without redesigning UI, routing, SEO, cookies, desktop workspace, or notification architecture.

## What Changed

Posts:

- Helpful and Misleading now update UI only after the Firestore transaction returns persisted arrays.
- Helpful profile tracking now runs best-effort after post trust updates, so profile-rule failures cannot break the button.
- Save now updates UI only after the Firestore transaction returns persisted saved state.
- Comments appear only after the `knowledge/{postId}` write succeeds.
- Comment and publish notifications now run best-effort after primary persistence.

SmartTalk:

- Helpful/Misleading answer votes throw on missing discussion docs instead of silently returning.
- Vote buttons disable while a vote transaction is in flight.
- Save uses a shared awaited helper and blocks duplicate writes.
- Vote/save failures show visible messages.
- Question and answer validation failures clean up loading state and show visible messages.

Auth:

- Google sign-in waits for Firebase auth persistence setup.
- Session restore waits for persistence setup and reports restore errors.
- Sign-out is awaited, duplicate-submit guarded, and visibly reports failure.

Trace and test helpers:

- Touched transaction paths now record transaction callback attempt counts.
- Repository results include collection/document/profile paths where applicable.
- The temporary Firestore test helper deletes its test post in `finally`.

## Local Validation Performed

Commands run from `C:\Users\Atul\OneDrive\Documents\readative (1)`:

```text
npm run build
npx tsc --noEmit
npx tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false
git diff --check
```

Results:

- Build: PASS.
- TypeScript: PASS.
- Strict unused-symbol TypeScript: PASS.
- Diff whitespace: PASS; Git printed CRLF conversion warnings only.

## Browser Smoke Walkthrough

1. Built the app with `npm run build`.
2. Started production preview at `http://127.0.0.1:4173/`.
3. Loaded Home, SmartTalk, Explore, and Profile on desktop 1280x720.
4. Repeated Home, SmartTalk, Explore, and Profile on tablet 768x1024.
5. Repeated Home, SmartTalk, Explore, and Profile on mobile 390x844.
6. Verified no console errors on those routes.
7. Verified no horizontal overflow on those routes.
8. Did not perform production Firestore writes because no signed-in browser credentials were available.

## Authenticated Walkthrough Still Required

After signing in with a disposable or approved account:

1. Toggle Helpful and verify count, refresh persistence, and another-session visibility.
2. Remove Helpful and verify count, refresh persistence, and another-session visibility.
3. Toggle Misleading and verify Helpful cleanup, count sync, refresh persistence, and another-session visibility.
4. Remove Misleading and verify count and refresh persistence.
5. Save and unsave a post; verify profile saved state/count and refresh persistence.
6. Add a comment; verify count and refresh persistence.
7. Verify notification failure cannot roll back a saved comment or published post.
8. Verify SmartTalk answer Helpful/Misleading vote, duplicate-click disable, counts, refresh persistence, and error messaging.
9. Verify SmartTalk save/unsave and answer/reply flow.
10. Verify Notebook highlight save/delete, My Notes, feed highlights, notebook count, and refresh persistence.
11. Verify profile counters after real actions.
12. Verify notifications panel, badge, mark-read state, and open behavior with existing notifications.
13. Verify logout and session restore.

## Verdict

H2 is locally clean and interaction code paths are repaired, but authenticated persistence QA remains the release gate before calling it fully production-complete.
