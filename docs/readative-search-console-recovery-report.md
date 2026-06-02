# Readative Search Console Recovery Report

Audit date: June 2, 2026

## 1. Robots Report

Local `public/robots.txt` now includes both sitemap discovery lines:

```txt
Sitemap: https://readative.com/sitemap.xml
Sitemap: https://www.readative.com/sitemap.xml
```

Production findings before this deploy:

| URL | Status | Result |
| --- | ---: | --- |
| `https://readative.com/robots.txt` | 307 | Redirects to `https://www.readative.com/robots.txt` |
| `https://www.readative.com/robots.txt` | 200 | Served as `text/plain; charset=utf-8` |

Important note: Cloudflare Managed content is prepended on production robots output. The project robots content is still present after the managed block on the canonical `www` host.

## 2. Sitemap Report

Production header audit before this deploy:

| URL | Status | Content-Type |
| --- | ---: | --- |
| `https://readative.com/sitemap.xml` | 307 | `text/plain` redirect to `https://www.readative.com/sitemap.xml` |
| `https://www.readative.com/sitemap.xml` | 200 | `application/xml` |

Local sitemap validity audit after this update:

| Check | Result |
| --- | --- |
| XML declaration | Pass |
| Sitemap namespace | Pass |
| URL count | 28 |
| URL limit | Pass, below 50,000 URLs |
| URL format | Pass, all fully qualified absolute URLs |
| Protocol | Pass, all HTTPS |
| Canonical host | Pass, all `www.readative.com` |

Change made: sitemap URLs were normalized from `https://readative.com/...` to `https://www.readative.com/...` because production currently redirects non-www URLs to the `www` host.

Vercel header hardening added:

```json
{
  "source": "/sitemap.xml",
  "headers": [{ "key": "Content-Type", "value": "application/xml" }]
}
```

## 3. Legacy URL Report

Production legacy URL audit before this deploy:

| Legacy URL | Status | Current Behavior |
| --- | ---: | --- |
| `https://www.readative.com/tags/Inspiration` | 404 | Static 404 |
| `https://www.readative.com/tags/LifeTruths` | 404 | Static 404 |
| `https://www.readative.com/tags/thoughtoftheday` | 404 | Static 404 |

New tag architecture audit:

| New URL | Status |
| --- | ---: |
| `https://www.readative.com/tag/inspiration` | 200 |
| `https://www.readative.com/tag/automation` | 200 |

## 4. Redirect Recommendation Report

Permanent server-side redirects are appropriate for legacy `/tags/*` URLs because:

- They represent an old tag URL pattern.
- The equivalent new tag URL pattern exists at `/tag/*`.
- Google recommends permanent server-side redirects when old URLs have permanently moved and the new target should become canonical.

Implemented in `vercel.json`:

```json
{ "source": "/tags/Inspiration", "destination": "/tag/inspiration", "permanent": true },
{ "source": "/tags/LifeTruths", "destination": "/tag/lifetruths", "permanent": true },
{ "source": "/tags/thoughtoftheday", "destination": "/tag/thoughtoftheday", "permanent": true },
{ "source": "/tags/:path*", "destination": "/tag/:path*", "permanent": true }
```

The exact redirects normalize the known Search Console examples to lowercase. The catch-all preserves any other legacy tag URL and routes it into the new tag architecture.

## 5. Search Console Recovery Report

Recommended recovery sequence after deployment:

1. Confirm `https://www.readative.com/robots.txt` returns 200 and includes both sitemap lines.
2. Confirm `https://www.readative.com/sitemap.xml` returns 200 with `Content-Type: application/xml`.
3. Submit `https://www.readative.com/sitemap.xml` in Search Console.
4. Keep `https://readative.com/sitemap.xml` discoverable through robots because it redirects to the canonical `www` sitemap.
5. Use URL Inspection for the three legacy examples and verify they return a permanent redirect after deployment.
6. Validate the Search Console sitemap issue once the new deployment is live and Cloudflare/Vercel cache has refreshed.

Expected post-deploy outcome:

- Sitemap can be read at the canonical `www` URL.
- Sitemap URLs no longer point to redirecting non-www pages.
- Legacy `/tags/*` crawl errors transition to redirects.
- New `/tag/*` pages remain available and noindex as supporting metadata pages.

## 6. Files Modified

- `public/robots.txt`
- `public/sitemap.xml`
- `vercel.json`
- `index.html`
- `docs/readative-search-console-recovery-report.md`

## 7. Verification Checklist

- Production robots checked with raw headers.
- Production sitemap checked with raw headers.
- Legacy `/tags/*` production URLs confirmed as 404 before this deploy.
- New `/tag/*` production URLs confirmed as 200 before this deploy.
- Sitemap XML locally validated for declaration, namespace, URL count, absolute URLs, HTTPS, and canonical host.
- `vercel.json` parsed successfully as valid JSON.
- Static fallback canonical and URL tags were removed from `index.html` so route-level Helmet canonical metadata is authoritative.
- In-app browser route verification passed for `/category/ai`, `/topic/chatgpt`, and `/tag/automation`.
- Route-level canonical tags verified as singular and route-specific on the checked pages.
- `/tag/automation` verified as `noindex`; category and topic pages verified as `index`.
- `npm run build` passed.
- No Firebase changes.
- No auth changes.
- No SmartTalk logic changes.
- No content-system changes.
- No SEO architecture rollback.

References:

- Google robots.txt sitemap field: https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec
- Google sitemap best practices: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Google redirect guidance: https://developers.google.com/search/docs/crawling-indexing/301-redirects
