import { Bookmark, Highlighter, Lock, ShieldCheck } from "lucide-react";
import { CardTrustProps } from "./cardTypes";

export function CardTrust({
  trustToneClass,
  trustMetrics,
  trustLabel,
  localSaveCount,
  entry,
  entryVisibility,
  isNotebookMode,
  onToggleNotebookMode,
}: CardTrustProps) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <div className="flex flex-wrap gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${trustToneClass}`}
          title={`${trustMetrics.communityTrustPercent}% trust: ${trustMetrics.helpfulCount} helpful, ${trustMetrics.misleadingCount} misleading`}
        >
          <ShieldCheck className="h-2.5 w-2.5" />
          {trustLabel}
        </span>
        {trustMetrics.helpfulCount >= 5 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
            Most Helpful
          </span>
        )}
        {localSaveCount >= 3 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-100 bg-sky-50/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-sky-700">
            <Bookmark className="h-2.5 w-2.5" />
            Most Saved
          </span>
        )}
        {entry.contentKind === "tutorial" && trustMetrics.helpfulCount >= 3 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-indigo-700">
            Top Tutorial
          </span>
        )}
        {entryVisibility === "private" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
            <Lock className="h-2.5 w-2.5" />
            Private
          </span>
        )}
      </div>

      {onToggleNotebookMode && (
        <button
          type="button"
          onClick={onToggleNotebookMode}
          aria-label={
            isNotebookMode
              ? "Turn Notebook Highlight mode off"
              : "Turn Notebook Highlight mode on"
          }
          aria-pressed={isNotebookMode}
          title="Notebook Highlight"
          className={`readative-touch-target inline-flex shrink-0 items-center justify-center rounded-full border ${
            isNotebookMode
              ? "border-amber-300 bg-amber-50 text-amber-700"
              : "border-slate-200/80 text-slate-400 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"
          }`}
        >
          <Highlighter className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
