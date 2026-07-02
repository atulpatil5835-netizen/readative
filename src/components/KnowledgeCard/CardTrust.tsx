import { useEffect, useRef, useState } from "react";
import { Bookmark, Lock, PenLine, ShieldCheck } from "lucide-react";
import {
  INK_COLORS,
  INK_COLOR_HEX,
  INK_WIDTHS,
  INK_WIDTH_PX,
} from "../../ink/types";
import { CardTrustProps } from "./cardTypes";

export function CardTrust({
  trustToneClass,
  trustMetrics,
  trustLabel,
  localSaveCount,
  entry,
  entryVisibility,
  isInkMode,
  inkColor,
  inkWidth,
  onToggleInkMode,
  onSetInkColor,
  onSetInkWidth,
}: CardTrustProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const holdTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!settingsOpen) return;
    const close = (event: PointerEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [settingsOpen]);

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

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

      {onToggleInkMode && (
        <div ref={settingsRef} className="relative shrink-0">
          <button
            type="button"
            onPointerDown={() => {
              longPressTriggeredRef.current = false;
              clearHoldTimer();
              holdTimerRef.current = window.setTimeout(() => {
                longPressTriggeredRef.current = true;
                setSettingsOpen(true);
              }, 450);
            }}
            onPointerUp={clearHoldTimer}
            onPointerCancel={clearHoldTimer}
            onPointerLeave={clearHoldTimer}
            onContextMenu={(event) => event.preventDefault()}
            onClick={(event) => {
              if (longPressTriggeredRef.current) {
                event.preventDefault();
                longPressTriggeredRef.current = false;
                return;
              }
              setSettingsOpen(false);
              onToggleInkMode();
            }}
            aria-label={isInkMode ? "Turn Ink Mode off" : "Turn Ink Mode on"}
            aria-pressed={isInkMode}
            title="Ink Mode. Hold for pen settings."
            className={`readative-touch-target inline-flex shrink-0 items-center justify-center rounded-full border transition-all ${
              isInkMode
                ? "border-blue-300 bg-blue-50 text-blue-600 shadow-sm"
                : "border-slate-200 text-slate-400 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
            }`}
          >
            <PenLine className="h-4 w-4" />
          </button>

          {settingsOpen && (
            <div
              role="dialog"
              aria-label="Ink settings"
              className="readative-menu-surface absolute right-0 top-12 z-50 w-56 p-3"
            >
              <div className="flex items-center justify-between gap-1.5">
                {INK_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      onSetInkColor(color);
                      setSettingsOpen(false);
                    }}
                    aria-label={`${color} ink`}
                    aria-pressed={inkColor === color}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform hover:scale-105 ${
                      inkColor === color ? "border-slate-900" : "border-transparent"
                    }`}
                  >
                    <span
                      className="h-4 w-4 rounded-full"
                      style={{ backgroundColor: INK_COLOR_HEX[color] }}
                    />
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2">
                {INK_WIDTHS.map((width) => (
                  <button
                    key={width}
                    type="button"
                    onClick={() => {
                      onSetInkWidth(width);
                      setSettingsOpen(false);
                    }}
                    aria-label={`${width} ink width`}
                    aria-pressed={inkWidth === width}
                    className={`flex h-8 flex-1 items-center justify-center rounded-lg border transition-colors ${
                      inkWidth === width
                        ? "border-blue-200 bg-blue-50"
                        : "border-slate-100 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className="w-7 rounded-full bg-slate-700"
                      style={{ height: INK_WIDTH_PX[width] }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
