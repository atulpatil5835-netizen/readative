import { memo } from "react";
import { cn } from "../utils/classNames";

interface SkeletonBlockProps {
  className?: string;
}

export function SkeletonBlock({ className }: SkeletonBlockProps) {
  return (
    <span
      className={cn("readative-skeleton block rounded-full", className)}
      aria-hidden="true"
    />
  );
}

function SkeletonButtonRow({ count = 6 }: { count?: number }) {
  return (
    <div className="-mx-4 overflow-hidden px-4">
      <div className="flex min-w-max gap-2 pb-1">
        {Array.from({ length: count }).map((_, index) => (
          <SkeletonBlock
            key={index}
            className={cn(
              "h-9 rounded-full",
              index === 0 ? "w-16" : index % 2 === 0 ? "w-24" : "w-20",
            )}
          />
        ))}
      </div>
    </div>
  );
}

export const KnowledgeCardSkeleton = memo(function KnowledgeCardSkeleton({
  showImage = true,
  compact = false,
}: {
  showImage?: boolean;
  compact?: boolean;
}) {
  return (
    <article
      className="overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.07)]"
      aria-hidden="true"
    >
      {showImage && <SkeletonBlock className="aspect-video rounded-none" />}
      <div className={cn("space-y-5 p-5", compact && "space-y-4")}>
        <div className="flex items-center gap-3">
          <SkeletonBlock className="h-12 w-12 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBlock className="h-3.5 w-32" />
            <SkeletonBlock className="h-3 w-44 max-w-[72%]" />
          </div>
          <SkeletonBlock className="h-8 w-8 rounded-full" />
        </div>

        <div className="space-y-3">
          <SkeletonBlock className="h-7 w-[86%] rounded-xl" />
          <SkeletonBlock className="h-7 w-[62%] rounded-xl" />
        </div>

        <div className="space-y-2.5">
          <SkeletonBlock className="h-3.5 w-full" />
          <SkeletonBlock className="h-3.5 w-[94%]" />
          <SkeletonBlock className="h-3.5 w-[78%]" />
          {!compact && <SkeletonBlock className="h-3.5 w-[55%]" />}
        </div>

        {!compact && (
          <div className="flex flex-wrap gap-2">
            <SkeletonBlock className="h-7 w-20 rounded-full" />
            <SkeletonBlock className="h-7 w-24 rounded-full" />
            <SkeletonBlock className="h-7 w-16 rounded-full" />
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <div className="flex gap-4">
            <SkeletonBlock className="h-5 w-12" />
            <SkeletonBlock className="h-5 w-12" />
          </div>
          <SkeletonBlock className="h-5 w-20" />
        </div>
      </div>
    </article>
  );
});

export function KnowledgeFeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-3">
        <SkeletonBlock className="h-12 w-full rounded-[22px]" />
        <SkeletonButtonRow />
      </div>
      <div className="space-y-4">
        {Array.from({ length: count }).map((_, index) => (
          <KnowledgeCardSkeleton
            key={index}
            showImage={index !== 1}
            compact={index === count - 1}
          />
        ))}
      </div>
    </div>
  );
}

export function FeedEmptyLoadingSkeleton({
  labelWidth = "w-48",
}: {
  labelWidth?: string;
}) {
  return (
    <div
      className="rounded-[30px] border border-dashed border-slate-300 bg-white px-6 py-10 shadow-sm"
      aria-busy="true"
    >
      <div className="mx-auto max-w-md space-y-5">
        <SkeletonBlock className="mx-auto h-11 w-11 rounded-2xl" />
        <SkeletonBlock className={cn("mx-auto h-5 rounded-xl", labelWidth)} />
        <div className="space-y-2">
          <SkeletonBlock className="mx-auto h-3.5 w-full max-w-sm" />
          <SkeletonBlock className="mx-auto h-3.5 w-[72%] max-w-xs" />
        </div>
      </div>
    </div>
  );
}

export function FeedPaginationSkeleton() {
  return (
    <div className="space-y-4 py-2" aria-busy="true" aria-live="polite">
      <KnowledgeCardSkeleton showImage={false} compact />
      <div className="flex justify-center">
        <SkeletonBlock className="h-9 w-36 rounded-full" />
      </div>
    </div>
  );
}

export function SmartTalkSkeleton() {
  return (
    <div className="space-y-6 pb-20" aria-busy="true" aria-live="polite">
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <SkeletonBlock className="h-11 w-11 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-6 w-32 rounded-xl" />
            <SkeletonBlock className="h-3 w-24" />
          </div>
        </div>
        <SkeletonBlock className="h-24 w-full rounded-2xl" />
        <div className="mt-3 flex justify-end">
          <SkeletonBlock className="h-11 w-full rounded-2xl sm:w-24" />
        </div>
      </div>

      <SkeletonBlock className="h-12 w-full rounded-[22px]" />

      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <SmartTalkQuestionSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

export function SmartTalkQuestionSkeleton() {
  return (
    <div
      className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
      aria-hidden="true"
    >
      <div className="mb-5 flex items-start gap-3">
        <SkeletonBlock className="h-9 w-9 shrink-0 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <SkeletonBlock className="h-4 w-[86%] rounded-xl" />
          <SkeletonBlock className="h-4 w-[58%] rounded-xl" />
          <SkeletonBlock className="h-3 w-36" />
        </div>
      </div>
      <div className="mb-5 ml-4 space-y-3 border-l border-slate-100 pl-4">
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <SkeletonBlock className="h-3 w-28" />
            <SkeletonBlock className="h-3 w-16" />
          </div>
          <div className="space-y-2">
            <SkeletonBlock className="h-3.5 w-full" />
            <SkeletonBlock className="h-3.5 w-[72%]" />
          </div>
        </div>
      </div>
      <SkeletonBlock className="h-20 w-full rounded-2xl" />
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-6 pb-20" aria-busy="true" aria-live="polite">
      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <SkeletonBlock className="h-36 rounded-none sm:h-44" />
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-3 sm:-mt-14">
            <SkeletonBlock className="h-24 w-24 rounded-[26px] ring-4 ring-white" />
            <div className="flex gap-2">
              <SkeletonBlock className="h-7 w-28 rounded-full" />
              <SkeletonBlock className="h-8 w-16 rounded-full" />
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <SkeletonBlock className="h-8 w-[62%] rounded-xl sm:h-10" />
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="h-4 w-[72%]" />
            <SkeletonBlock className="h-4 w-[88%]" />
          </div>
        </div>
      </div>

      <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
        <SkeletonBlock className="h-8 w-24 rounded-full" />
        <SkeletonBlock className="ml-1 h-8 w-20 rounded-full" />
      </div>

      <div className="space-y-4">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <SkeletonBlock className="h-6 w-52 rounded-xl" />
        </div>
        <KnowledgeCardSkeleton compact />
      </div>
    </div>
  );
}

export function CommentSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <SkeletonBlock className="h-8 w-8 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-3 w-16" />
          </div>
          <SkeletonBlock className="h-3.5 w-full" />
          <SkeletonBlock className="h-3.5 w-[68%]" />
        </div>
      </div>
    </div>
  );
}

