# Release H2 Performance Report

Status: build/runtime smoke clean; live Firestore read containment applied.
Date: 2026-07-06

## Scope

H2 focused on Firestore stability and interaction integrity. Performance work was limited to safe duplicate-write prevention and avoiding unnecessary primary-write retries caused by coupled side effects.

## Dependency Impact

No dependency files were changed:

- `package.json`: unchanged
- `package-lock.json`: unchanged

No new libraries, workers, polling loops, or background services were added.

## Firestore Impact

- Helpful/Misleading/save UI no longer encourages duplicate retries caused by optimistic false success/failure states.
- Trust and save buttons are guarded while writes are in flight.
- SmartTalk vote/save buttons are guarded while writes are in flight.
- SmartTalk total count quota failure no longer creates a console error; the page continues with loaded question count.
- Notification side effects are decoupled from primary comment/publish success.
- Test helper cleanup prevents future temporary post write artifacts.
- Public home feed no longer keeps an `onSnapshot` listener open for every visitor.
- Automatic background feed prefetch is disabled.
- Fresh feed cache can skip the initial server reread for returning visitors.
- SmartTalk journey preview is reduced from 50 docs to 12 and cached for 6 hours.
- Profile directory loading is deferred until the composer opens.

## Build Evidence

`npm run build` passed on 2026-07-06:

```text
1769 modules transformed.
dist/index.html                                4.73 kB | gzip:   1.27 kB
dist/assets/index-DCPn6uSi.css                81.56 kB | gzip:  14.32 kB
dist/assets/index-CvG3Nmt5.js                 81.12 kB | gzip:  23.50 kB
dist/assets/SmartTalk-CXyhOTDZ.js             37.89 kB | gzip:  11.13 kB
dist/assets/KnowledgeCard-DB0ECkWa.js         39.97 kB | gzip:  12.13 kB
dist/assets/KnowledgeFeed-CT3F-36d.js         74.54 kB | gzip:  23.15 kB
dist/assets/firebase-auth-tJi5azUg.js        112.26 kB | gzip:  22.83 kB
dist/assets/firebase-firestore-DWlcjqk8.js   449.87 kB | gzip: 111.58 kB
```

## Browser Smoke Evidence

Production preview at `http://127.0.0.1:4173/`:

- Desktop 1280x720: Home, SmartTalk, Explore, Profile rendered; no console errors; no horizontal overflow.
- Tablet 768x1024: Home, SmartTalk, Explore, Profile rendered; no console errors; no horizontal overflow.
- Mobile 390x844: Home, SmartTalk, Explore, Profile rendered; no console errors; no horizontal overflow.

## Verdict

No H2 build or smoke-test performance regression was identified. The live home/feed read path is now materially lower risk; larger schema-level read optimizations should still be handled as a separate data-access release.

Production deploy completed on 2026-07-06 through Vercel prebuilt output and was smoke-checked on `https://www.readative.com/`.
