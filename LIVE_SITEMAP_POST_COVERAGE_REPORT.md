# Live Sitemap Post Coverage Report

Generated: 2026-06-18

## Executive Finding

The live `https://www.readative.com/sitemap.xml` is not running the dynamic sitemap dataset that the verification script used.

The live sitemap response is byte-for-byte identical to the static `public/sitemap.xml` file and contains only 28 static hub/category/topic URLs. It contains zero individual post URLs and zero profile URLs.

## 1. Verification Dataset vs Live Sitemap Dataset

### Expected Dataset

Source: local verification via Firestore REST-backed SEO loader.

| URL type | Expected count |
|---|---:|
| Published post URLs | 280 |
| Profile URLs | 65 |
| SmartTalk discussions discovered | 109 |
| Tag URLs | 469 |
| Total generated sitemap URLs | 872 |

### Live Sitemap Dataset

Source: direct fetch of `https://www.readative.com/sitemap.xml`.

| URL type | Actual live count |
|---|---:|
| Total URLs | 28 |
| Post URLs containing `/post/` | 0 |
| Profile URLs containing `/profile/` | 0 |
| Tag URLs containing `/tag/` | 0 |
| SmartTalk question URLs | 0 |
| `/posts` discovery index URL | 0 |
| `/smarttalks` index URL | 0 |

## 2. Required Count Comparison

| Check | Expected | Actual live | Gap |
|---|---:|---:|---:|
| Post URLs | 280 | 0 | 280 missing |
| Profile URLs | 65 | 0 | 65 missing |

## 3. Live Response Evidence

Live `https://www.readative.com/sitemap.xml` returned:

| Header/check | Value |
|---|---|
| HTTP status | 200 |
| Content-Type | `application/xml` |
| Cache-Control | `public, max-age=0, must-revalidate` |
| X-Vercel-Cache | `HIT` |
| X-Readative-SEO-Source | absent |
| X-Readative-SEO-Post-Count | absent |
| X-Readative-SEO-URL-Count | absent |
| Live body equals local `public/sitemap.xml` | true |
| Live URL count | 28 |

The missing `X-Readative-SEO-*` headers are important because the dynamic sitemap handler sets those headers. Their absence confirms the dynamic handler is not producing the live `/sitemap.xml` response.

## 4. Direct API/Support Endpoint Evidence

Direct checks of the dynamic/support endpoints returned serverless invocation failures:

| URL | Status | Vercel error |
|---|---:|---|
| `https://www.readative.com/api/sitemap.xml` | 500 | `FUNCTION_INVOCATION_FAILED` |
| `https://www.readative.com/posts` | 500 | `FUNCTION_INVOCATION_FAILED` |
| `https://www.readative.com/smarttalks` | 500 | `FUNCTION_INVOCATION_FAILED` |

This means the deployed dynamic functions are not currently usable in production. However, the public sitemap request is not exposing that 500 because the static `public/sitemap.xml` file is being served at `/sitemap.xml`.

## 5. Root Cause

Exact root cause for posts being absent from the live sitemap:

`https://www.readative.com/sitemap.xml` is serving the static `public/sitemap.xml` asset, not the dynamic Firestore-backed sitemap output.

Evidence:

- The live sitemap body hash matches the local static `public/sitemap.xml` hash exactly.
- The live sitemap contains the same 28 static URLs as `public/sitemap.xml`.
- The live sitemap has zero dynamic diagnostic headers from the API handler.
- The live sitemap response is cached as a Vercel static response (`X-Vercel-Cache: HIT`).

Secondary production issue:

- The dynamic endpoints that should provide the Firestore-backed URL graph are deployed/reachable but currently fail with `FUNCTION_INVOCATION_FAILED`.
- Because the dynamic endpoints fail before returning custom `X-Readative-SEO-*` headers, the function fallback path is not successfully producing output in production.

## 6. Investigation Questions

### Is deployment outdated?

Partially yes for the sitemap output.

The live `/sitemap.xml` output is still the static 28-URL sitemap and not the Firestore-backed generated sitemap claimed by verification. Some new support routes appear to be deployed because `/posts` and `/smarttalks` resolve to serverless functions, but those functions are failing.

### Is sitemap logic filtering posts?

No evidence of that.

The verification loader reads Firestore and finds 280 published posts and 65 profiles. The live sitemap is not using that loader output at all.

### Are wrong Firestore fields used?

No evidence from this investigation.

Firestore REST access is healthy and returns knowledge documents. The local verification dataset is not empty and currently discovers 280 posts. The live sitemap has 0 posts because the live `/sitemap.xml` response is static, not because Firestore fields filtered them out.

### Is the fallback path being executed?

Not for the live `/sitemap.xml` response.

The live sitemap is the static XML file. Direct dynamic endpoint requests return 500, so the production function fallback is not successfully returning XML either.

## 7. Conclusion

Google is seeing the 28-URL static sitemap, not the 872-URL generated sitemap. That is why individual post URLs and profile URLs are absent from the live sitemap.

The immediate production blocker is not post filtering. The blocker is that the live sitemap path is served from `public/sitemap.xml`, while the deployed dynamic functions that should expose Firestore-backed posts/profiles/SmartTalk content are failing when invoked directly.
