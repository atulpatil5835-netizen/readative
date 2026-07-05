# Release R1 Final Refinement - Performance Audit

## Scope lock

This is an audit-only document. No production code, dependencies, routes, Firestore reads, timers, listeners, bundle configuration, or UI behavior were changed.

Bundle numbers below are measured from the existing `dist/assets` output. No rebuild was performed for this audit phase.

## Bundle snapshot

Existing built assets:

- asset files: 38
- total raw size: about 1272 KB
- total gzip size: about 348 KB

Largest gzip assets:

| Asset | Raw KB | Gzip KB | Notes |
| --- | ---: | ---: | --- |
| `firebase-firestore-DWlcjqk8.js` | 439.33 | 108.97 | Largest chunk; expected for Firestore-heavy app |
| `react-Dp1bPehN.js` | 152.97 | 49.96 | React/vendor chunk |
| `index-D9KdFUSA.js` | 80.12 | 23.34 | App entry |
| `KnowledgeFeed-Di-rtzWW.js` | 72.67 | 22.59 | Main feed surface |
| `firebase-auth-tJi5azUg.js` | 109.63 | 22.29 | Auth chunk |
| `Profile-COoz7Ig4.js` | 54.83 | 15.43 | Profile surface |
| `index-SpG5osRW.css` | 78.25 | 13.86 | Global CSS/Tailwind output |
| `KnowledgeCard-CBLIi7gZ.js` | 38.76 | 11.78 | Card surface |
| `firebase-app-DmcoAl9L.js` | 46.73 | 11.56 | Firebase app chunk |
| `LegalPageRoute-CiVE9IWR.js` | 33.68 | 10.64 | Legal SPA route |
| `SmartTalk-BPhBra0F.js` | 35.59 | 10.52 | SmartTalk surface |
| `Explore-Cclvrjcf.js` | 31.08 | 8.65 | Explore surface |
| `KnowledgeImageCarousel-C_YtnASb.js` | 22.39 | 7.57 | Image carousel |
| `DiscoverySearch-BpqyW85I.js` | 22.63 | 7.19 | Shared discovery search |
| `KnowledgeCardList-Mfw0Q-01.js` | 7.64 | 3.36 | Virtualized card list |

## Chunking and lazy loading

Current chunking is intentional and helpful:

- React has a manual vendor chunk.
- Firebase app/auth/firestore have separate manual chunks.
- Major surfaces are lazy-loaded through `App.tsx`.
- Knowledge card and feed list are split from the feed surface.

No immediate chunking change is recommended in this audit phase.

## Runtime performance findings

### Critical

No critical performance regression was confirmed.

### High

#### P1 - Large UI components increase render-risk and profiling cost

The highest performance risk is not one obvious expensive line; it is the size and responsibility of the main surfaces:

- `Profile.tsx`
- `KnowledgeFeed.tsx`
- `SmartTalk.tsx`
- `Explore.tsx`

Each surface owns many derived arrays, route/event listeners, Firestore lifecycle code, and presentation sections. This makes re-render sources harder to isolate.

Recommended future action: profile first; then extract pure presentational sections without changing data flow.

#### P2 - Firestore-heavy architecture makes accidental read expansion risky

The app legitimately uses Firestore across knowledge, SmartTalk, profiles, notifications, and Notebook. The cleanup risk is accidental extra reads while refactoring.

Known high-sensitivity areas:

- feed first-page and pagination reads
- SmartTalk first-page, focused-question, and pagination reads
- Profile public/private content and saved items
- Notebook Highlight post-level reads/writes
- server-side SEO data reads in `api/_seoData.ts`

Recommended future action: any cleanup touching these areas must include read-count and listener-count checks.

### Medium

#### P3 - Scroll and viewport listeners are spread across surfaces

Read-only scan found scroll, resize, route, animation-frame, observer, and keyboard logic in multiple files, including:

- `KnowledgeFeed.tsx`
- `KnowledgeCardList.tsx`
- `KnowledgeCard/*`
- `KnowledgeImageCarousel.tsx`
- `Header.tsx`
- `Profile.tsx`
- `SmartTalk.tsx`
- `NotebookContext.tsx`

Most appear justified. The risk is duplicated listener ownership during refactors.

#### P4 - Derived computations are numerous

Heavy `useMemo` usage appears in:

- `KnowledgeFeed.tsx`
- `FeedRenderer.tsx`
- `KnowledgeCardList.tsx`
- `SmartTalk.tsx`
- `Explore.tsx`
- `Profile.tsx`

This is not automatically bad. It indicates the app already relies on derived view models, and cleanup should avoid changing dependency arrays casually.

#### P5 - CSS output is non-trivial

The CSS asset is about 78 KB raw and 14 KB gzip. Repeated Tailwind clusters and global utility classes may offer small savings, but CSS cleanup should be visual-regression tested.

#### P6 - Public images are heavier than the JS savings available from cleanup

Largest public assets:

- `logo.png` about 206 KB
- `logo-mark.png` about 54 KB
- `icon-192.png` about 33 KB
- `apple-touch-icon.png` about 29 KB

These do not necessarily block initial JS execution, but they affect transfer/cache/storage and social/crawler behavior. Do not remove or replace without verifying all consumers.

### Low

#### P7 - Confirmed unused dependency may reduce install weight, not client bundle

`nodemailer` appears in `package.json` and `package-lock.json`, but no source import was found. Removing it later would likely reduce dependency/install surface rather than the Vite client bundle.

#### P8 - Bridge components add little runtime cost

`src/components/KnowledgeFeed.tsx` and `src/components/KnowledgeCard.tsx` are compatibility bridges. Removing them would simplify source ownership but likely produce negligible bundle savings.

## Network and memory notes

| Area | Current audit note | Cleanup caution |
| --- | --- | --- |
| Firestore client | Large app feature surface depends on Firestore | Do not introduce new listeners or reads during cleanup |
| Firestore admin/server | SEO data endpoints use server-side Firestore reads | Route/serverless validation needed before helper consolidation |
| Third-party scripts | `loadThirdPartyScripts.ts` uses idle/load behavior | Do not alter without ad/analytics validation |
| Notebook cache | `NotebookContext.tsx` uses caches and request de-duplication | Do not split provider without preserving cache identity |
| Feed cache | `feedHelpers.ts` uses local storage write scheduling | Do not remove as dead code without behavior validation |

## Tree-shaking opportunities

| Opportunity | Expected bundle impact | Risk |
| --- | ---: | --- |
| Remove confirmed unused dependency | 0 KB client JS | Low to Medium |
| Replace bridge imports with direct imports | 0-1 KB gzip | Medium |
| Consolidate repeated server metadata helpers | negligible client impact | Medium to High |
| CSS token/class cleanup | 0-3 KB gzip | Medium because visual regressions are easy |
| Split large surfaces without changing lazy boundaries | neutral | High if data logic changes |

## Performance savings estimate

| Cleanup family | Estimated client gzip savings | Other savings | Regression risk |
| --- | ---: | --- | --- |
| Obsolete docs/migration artifact cleanup | 0 KB | repo footprint and navigation only | Low |
| `nodemailer` removal if confirmed unused | 0 KB | package install/lockfile reduction | Low to Medium |
| Bridge file cleanup | 0-1 KB | source simplification | Medium |
| CSS class/token cleanup | 0-3 KB | design consistency | Medium |
| Legal/API helper consolidation | 0-2 KB | server maintenance reduction | Medium to High |
| Large component extraction | usually 0 KB | maintainability and profiling clarity | High |

## Performance audit conclusion

The app is already chunked in a reasonable way. The safest performance work is not aggressive optimization; it is reducing accidental complexity so future changes can be profiled and verified. The maximum safe near-term bundle reduction is likely small, while the maintainability gains from cleanup are meaningful.
