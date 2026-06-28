import { ShieldCheck, Bookmark, Highlighter, Lock } from "lucide-react";
import { CardTrustProps } from "./cardTypes";

export function CardTrust({
  trustToneClass,
  trustMetrics,
  trustLabel,
  localSaveCount,
  entry,
  entryVisibility,
  isHighlightMode,
  onToggleHighlightMode,
}: CardTrustProps) {
  return (
    <div className="mb-3 flex items-center justify-between gap-4">
      <div className="flex flex-wrap gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${trustToneClass}`}
          title={`${trustMetrics.communityTrustPercent}% trust: ${trustMetrics.helpfulCount} helpful, ${trustMetrics.misleadingCount} misleading`}
        >
          <ShieldCheck className="h-2.5 w-2.5" />
          {trustLabel}
        </span>
        {trustMetrics.helpfulCount >= 5 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-700">
            Most Helpful
          </span>
        )}
        {localSaveCount >= 3 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-sky-700">
            <Bookmark className="h-2.5 w-2.5" />
            Most Saved
          </span>
        )}
        {entry.contentKind === "tutorial" && trustMetrics.helpfulCount >= 3 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-indigo-700">
            Top Tutorial
          </span>
        )}
        {entryVisibility === "private" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-600">
            <Lock className="h-2.5 w-2.5" />
            Private
          </span>
        )}
      </div>

      {onToggleHighlightMode && (
        <button
          type="button"
          onClick={onToggleHighlightMode}
          aria-label="Highlight Mode"
          title="Highlight Mode"
          className={`readative-touch-target shrink-0 inline-flex items-center justify-center rounded-full transition-all ${
            isHighlightMode
              ? "bg-amber-100 border border-amber-300 text-amber-600 shadow-sm"
              : "border border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600"
          }`}
        >
          <Highlighter className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
