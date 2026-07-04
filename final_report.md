# Release Y.2.3 Final Report

Status: implementation complete; automated validation passed; authenticated browser scenario pending sign-in.

## Root cause fixed

Notebook activation on a non-focused visible card was opening the post route before activation. That route update set `focusedEntryId`, and `KnowledgeFeed` responded with its explicit focused-post `scrollIntoView` behavior.

Y.2.3 removes route navigation from Notebook activation.

## Files changed

- `src/App.tsx`
- `src/context/NotebookContext.tsx`
- `src/components/KnowledgeCard/KnowledgeCard.tsx`
- `root_cause.md`
- `walkthrough.md`
- `task.md`
- `final_report.md`

## What changed

- Notebook button activation no longer calls `onOpenEntry(entry.id)`.
- The sign-in completion path for Notebook activation no longer calls `onOpenEntry(entry.id)`.
- Stale browser selection is cleared safely before activation.
- Notebook mode can activate on the visible Knowledge card without route focus.
- Provider auto-exit still clears Notebook when leaving Knowledge, opening another focused post, or closing a focused post.

## What did not change

- No Firestore change.
- No schema change.
- No My Notes change.
- No highlight persistence change.
- No text highlight rendering change.
- No Notebook visual/UI redesign.
- No virtualization change.

## Validation

Passed:

- `npm run build`
- `npx tsc --noEmit`
- Desktop browser scroll delta after Notebook click: `0`
- Tablet browser scroll delta after Notebook click: `0`
- Mobile browser scroll delta after Notebook click: `0`
- No console errors observed in available browser checks

Pending:

- Full authenticated scenario with a saved highlight on Post A, then scrolling to Post B and enabling Notebook there.

Reason pending:

- The in-app browser is signed out and opens the Google sign-in prompt on Notebook click.
- Chrome fallback requires explicit user approval when the preferred browser is blocked by missing authentication, so it was not used.

## Regression risk

Low-medium.

The fix is localized to Notebook activation and provider lifecycle. The main risk is lifecycle edge cases, not data loss or rendering changes.

## Production readiness

Not final production-ready until the authenticated scroll scenario is verified. The code is ready for that QA gate.
