# Release T1 Performance Report

Status: passed.
Date: 2026-07-05

## Performance rule

T1 target:

```text
Startup increase < 500 bytes gzip
```

No dependency, cookie library, notification library, backend service, or polling mechanism was added.

## Bundle results

Baseline measured from the R3 production build before T1:

```json
{ "entry": "index-C9mLALxp.js", "raw": 82501, "gzip": 24047 }
```

T1 production build:

```json
{ "entry": "index-CYr8QRAD.js", "raw": 80744, "gzip": 23366 }
```

Entry chunk delta:

```text
raw:  -1757 bytes
gzip:  -681 bytes
```

The startup entry became smaller because T1 removed immediate third-party script startup from the main path while lazy-loading the consent UI.

## Startup assets after T1

```json
{ "file": "dist/index.html", "raw": 4730, "gzip": 1274 }
{ "file": "dist/assets/index-CYr8QRAD.js", "raw": 80744, "gzip": 23366 }
{ "file": "dist/assets/index-DCPn6uSi.css", "raw": 81563, "gzip": 14322 }
```

## Consent UI chunk

The consent UI is split into its own lazy chunk:

```json
{ "file": "TrustConsent-DtKkjE7I.js", "raw": 4735, "gzip": 1601 }
```

This chunk is not part of the core entry chunk. It loads only when the cookie consent is needed or when the notification-permission card becomes eligible after consent and engagement.

## Third-party startup reduction

Removed immediate startup loading for:

- Google Analytics script in `index.html`
- Startup scheduling of Google Analytics / Google ads in `src/main.tsx`

Runtime QA confirmed no `googletagmanager` or `googlesyndication` scripts were present during first-visit, post-acceptance, or reload checks.

## Dependency audit

No changes were made to:

- `package.json`
- `package-lock.json`

No cookie or notification package was added.

## Conclusion

T1 passes the startup performance rule. The entry chunk decreased by 681 bytes gzip, and the consent UI is isolated in a small lazy chunk.
