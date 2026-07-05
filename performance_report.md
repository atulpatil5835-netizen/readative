# Release R2 - Performance Report

Status: implemented and validated.
Date: 2026-07-04

## Client Bundle Impact

The build output has been measured to verify that removing dependencies and aligning layout modules preserves our production footprint.

| Measurement | Result |
| --- | ---: |
| Gzipped Bundle Size | 347.65 KB (355,995 bytes) |
| Raw Bundle Size | 1272.23 KB (1,302,764 bytes) |
| Total Asset Files | 38 files |
| Build Time | ~21.38 seconds |

### Key Bundle Chunks (Gzip)

- `firebase-firestore-DWlcjqk8.js`: ~111.58 KB gzip
- `react-Dp1bPehN.js`: ~51.15 KB gzip
- `index-B-2RKPHo.js` (entry): ~23.90 KB gzip
- `firebase-auth-tJi5azUg.js`: ~22.83 KB gzip
- `KnowledgeFeed-BYv0hyiH.js`: ~23.13 KB gzip
- `index-s03lI6Rw.css`: ~14.19 KB gzip (80.12 KB raw)

## Repository Footprint & Dependency Reductions

- **Obsolete files removed**: 16 files
- **Total disk space reclaimed**: ~901 KB (smarttalk run artifacts, migration files, Python caches)
- **Deleted dependencies**: `nodemailer` (removed from `package.json` and `package-lock.json`)
- **New runtime dependencies**: 0
- **New Firestore reads or writes**: 0
- **New DOM listeners or timers**: 0

## Conclusion

The release maintains the highly optimized bundle footprint (~347.65 KB gzip) while cleaning up unnecessary dependencies and local development/migration bloat from the repository.
