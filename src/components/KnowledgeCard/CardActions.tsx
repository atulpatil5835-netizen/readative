import { ThumbsUp, ShieldAlert, MessageCircle } from "lucide-react";
import { cn } from "../../utils/classNames";
import { CardActionsProps } from "./cardTypes";

export function CardActions({
  isHelpful,
  isMisleading,
  isUpdatingTrust,
  helpfulCount,
  misleadingCount,
  commentsCount,
  showComments,
  helpfulAnimationVersion,
  onHelpful,
  onMisleading,
  onToggleComments,
}: CardActionsProps) {
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:flex sm:items-center sm:flex-wrap">
      <button
        type="button"
        onClick={onHelpful}
        disabled={isUpdatingTrust}
        aria-label={
          isHelpful ? "Remove helpful feedback" : "Mark post helpful"
        }
        title={isHelpful ? "Remove helpful feedback" : "Helpful"}
        className={cn(
          "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-2xl border px-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70",
          isHelpful
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-slate-200/80 bg-white text-slate-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700",
        )}
      >
        <span className="relative inline-flex h-5 w-5 items-center justify-center">
          <span
            key={`helpful-icon-${helpfulAnimationVersion}`}
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center",
              helpfulAnimationVersion > 0 && "readative-like-pop",
            )}
          >
            <ThumbsUp
              className={cn("h-4 w-4", isHelpful ? "fill-current" : "")}
            />
          </span>
        </span>
        <span>Helpful</span>
        <span>{helpfulCount}</span>
      </button>

      <button
        type="button"
        onClick={onMisleading}
        disabled={isUpdatingTrust}
        aria-label={
          isMisleading
            ? "Remove misleading feedback"
            : "Mark post misleading"
        }
        title={isMisleading ? "Remove misleading feedback" : "Misleading"}
        className={cn(
          "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-2xl border px-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70",
          isMisleading
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-slate-200/80 bg-white text-slate-500 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700",
        )}
      >
        <ShieldAlert
          className={cn("h-4 w-4", isMisleading ? "fill-current" : "")}
        />
        <span>Misleading</span>
        <span>{misleadingCount}</span>
      </button>

      <button
        type="button"
        onClick={onToggleComments}
        aria-label={showComments ? "Hide comments" : "Show comments"}
        className={cn(
          "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-2xl border px-2.5 text-xs font-semibold transition-colors",
          showComments
            ? "border-sky-200 bg-sky-50 text-sky-700"
            : "border-slate-200/80 bg-white text-slate-500 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700",
        )}
      >
        <MessageCircle className="h-4 w-4" />
        <span>{commentsCount}</span>
      </button>
    </div>
  );
}
