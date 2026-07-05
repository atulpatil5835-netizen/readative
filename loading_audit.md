# Release R3 Loading Audit

Status: completed.
Date: 2026-07-05

## Goal

Readative should load once:

```text
Skeleton
-> Content
-> Done
```

It should not show:

```text
Skeleton
-> Content
-> Loading again
```

## Root loading issue

The exact source of the double-loading behavior was the app identity boundary in `src/App.tsx`.

`identity` was initialized from `getKnowledgeIdentity()` before Firebase auth resolution. Auth then resolved through `subscribeToGoogleIdentity()` and changed the identity again. Identity-dependent surfaces could therefore mount with a temporary identity and then restart with the settled auth identity.

R3 gates identity-dependent surfaces behind `isIdentityHydrated` and passes only `hydratedIdentity` to those surfaces.

## Audited sources

| Area | Finding | Action |
| --- | --- | --- |
| Duplicate fetches | No broad duplicate-fetch rewrite was justified. The confirmed repeated work was identity-driven. | No speculative changes. |
| Duplicate `useEffect` | Effects depending on identity were impacted by pre-auth identity state. | Hydrated identity boundary. |
| React StrictMode | Development-only double effect behavior; not the production root cause. | Kept unchanged. |
| Hydration mismatch | No browser console hydration warnings observed. | No SEO/hydration rewrite. |
| Context reset | Notebook provider received pre-auth identity. | Provider receives `hydratedIdentity`. |
| Suspense remount | Lazy route chunks were stable; remount perception came from auth identity timing. | Gated data surfaces before mount. |
| Cache invalidation | Feed scroll cache persisted across refresh. | Scroll cache changed to memory only. |
| Route remount | Routing behavior preserved. | No routing changes. |
| AppShell remount | No AppShell rewrite made. | No change. |
| KnowledgeFeed remount | Feed was affected by identity and scroll restoration. | Hydration gate and scroll fix. |
| Notebook hydration | Notebook identity input is now hydrated. | Behavior unchanged. |
| Profile hydration | Profile identity input is now hydrated. | Behavior unchanged. |
| SmartTalk hydration | SmartTalk identity input is now hydrated. | Behavior unchanged. |

## Route loading QA

| Route | Result |
| --- | --- |
| `/` | Refresh starts at top; no console errors or warnings. |
| `/explore` | Skeleton transitions to content once; refresh starts at top. |
| `/profile` | Refresh starts at top; no console errors or warnings. |
| `/smarttalks/import_q053` | Refresh stays on the same question. |
| `/post/4ELsdHoS5ra5PJkDQbgk` | Refresh stays on the same post. |

## Browser evidence

Home refresh after R3:

```json
{
  "before": { "path": "/", "scrollTop": 1150 },
  "after": { "path": "/", "scrollTop": 0, "articles": 1, "busy": 0 },
  "logs": []
}
```

Explore loading after R3:

```json
[
  { "sample": 0, "skeletons": 82, "links": 0, "headings": 0, "scrollTop": 0 },
  { "sample": 1, "skeletons": 0, "links": 29, "headings": 6, "scrollTop": 0 },
  { "sample": 6, "skeletons": 0, "links": 83, "headings": 11, "scrollTop": 0 }
]
```

No content-to-skeleton regression was observed in the measured route traces.

## Console evidence

Runtime browser checks across Home, Explore, Profile, SmartTalk, direct post, and responsive viewports produced no console errors or warnings.

## Conclusion

The double-loading source was fixed at the app identity hydration boundary. The second loading flash was not treated with broad remount or cache rewrites because the measured root cause was specific and source-local.

