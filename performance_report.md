# Release P3.2 - Performance Report

Status: implemented and validated.
Date: 2026-07-04

## Dependency and runtime impact

- Dependencies added: 0.
- Firestore reads or writes added: 0.
- Listeners added: 0.
- Polling added: 0.
- Timers or intervals added: 0.

The footer is now simpler than the P3 multi-column version. The About content is server-rendered and adds no client runtime work.

## Bundle impact

| Measurement | JavaScript gzip bytes |
| --- | ---: |
| Preserved P4 baseline | 330,548 |
| P3.2 final build | 330,136 |
| Net impact | -412 |

Final build highlights:

- transformed modules: 1,765
- main application chunk: 23.62 kB gzip
- CSS: 14.10 kB gzip
- build time: 18.18 seconds

P3.2 produces a small bundle reduction because the grouped corporate-footer data and rendering branches were removed.

## Responsive impact

Desktop, tablet, and mobile browser QA found no horizontal overflow in the footer or About page. The footer links wrap naturally at smaller widths, and the existing About grid collapses to one column below its established breakpoint.

## Validation

- `npm run build` - passed.
- `npx tsc --noEmit` - passed with zero errors.
- `git diff --check` - passed.
- Desktop QA - passed.
- Tablet QA - passed.
- Mobile QA - passed.
- Console QA - passed with zero errors and warnings.

## Regression risk

Risk level: very low.

The change is limited to static footer markup and one server-rendered About section. Routes, metadata, schemas, data access, and product logic remain unchanged.

## Production readiness

Ready for production within the P3.2 performance and scope constraints.
