# Release Z.1 - Desktop Experience V2 Task Status

Status: Phase 1 desktop UX architecture audit complete.

Production code modified: no.

## Requested deliverables

Created/updated only the requested architecture-phase files:

- `desktop_architecture.md`
- `implementation_plan.md`
- `engineering_risk.md`
- `performance_plan.md`
- `task.md`

## Audit checklist

Completed:

- AppShell audit
- Header audit
- Feed container audit
- KnowledgeFeed audit
- Explore audit
- SmartTalk audit
- Profile audit
- Desktop breakpoint audit
- Max-width container audit
- Scroll container audit
- Sticky/fixed element audit
- Responsive CSS audit
- Virtualization audit
- Existing side panel audit
- Cached/local data reuse audit
- Firestore/listener boundary audit
- Render/repaint/memory risk audit

## Key finding

The current desktop layout is a centered `max-w-3xl` reading column inside a wider viewport. Reading width is already close to the target, but desktop whitespace is unused and there is no persistent knowledge-workspace shell.

The recommended architecture is a desktop-only, route-owned adaptive shell above 1400px:

- left rail: 220-260px;
- center reading column: 760-820px;
- right rail: 260-320px;
- sticky rails;
- no new Firestore listeners;
- no new dependencies;
- no changes to mobile/tablet layout.

## Recommended implementation posture

After approval:

1. Add a small presentational desktop shell.
2. Keep the existing mobile/tablet route rendering path.
3. Keep feed virtualization untouched.
4. Let KnowledgeFeed supply rail view models from already-loaded data.
5. Do not preload Explore, SmartTalk, Profile, or My Notes for rails.
6. Validate with build, TypeScript, diff check, and desktop/tablet/mobile QA.

## Stop condition

STOP.

Waiting for architecture approval before implementation.
