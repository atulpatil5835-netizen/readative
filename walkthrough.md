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
