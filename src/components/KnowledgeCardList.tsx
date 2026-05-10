import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { KnowledgeEntry, UserProfile } from "../types";
import type { KnowledgeIdentity } from "../utils/knowledgeIdentity";
import {
  getKnowledgeEntryImageLayout,
  getKnowledgeEntryImages,
} from "../utils/knowledgeImages";

const knowledgeCardModulePromise = import("./KnowledgeCard");
const LazyKnowledgeCard = lazy(() =>
  knowledgeCardModulePromise.then((module) => ({
    default: module.KnowledgeCard,
  })),
);

const DEFAULT_CARD_HEIGHT = 680;
const VIRTUAL_OVERSCAN_PX = 900;

interface KnowledgeCardListProps {
  entries: KnowledgeEntry[];
  currentIdentity: KnowledgeIdentity | null;
  profiles: UserProfile[];
  onIdentityRequired: (action: {
    type: "like" | "comment";
    entryId: string;
  }) => void;
  onOpenProfile: (authorId: string) => void;
  onOpenEntry: (entryId: string) => void;
  onVisible?: (entry: KnowledgeEntry) => void;
  onSelectHashtag?: (tag: string) => void;
  onLikeChange?: (entryId: string, likes: string[]) => void;
  highlightedEntryId?: string | null;
}

interface ViewportWindow {
  top: number;
  bottom: number;
}

interface ItemLayout {
  offsets: number[];
  heights: number[];
  totalHeight: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function estimateKnowledgeCardHeight(entry: KnowledgeEntry) {
  const imageCount = getKnowledgeEntryImages(entry).length;
  const imageHeight =
    imageCount === 0
      ? 0
      : getKnowledgeEntryImageLayout(entry) === "portrait"
        ? 430
        : 390;
  const titleLines = Math.ceil(entry.title.length / 34);
  const contentLines = Math.ceil(entry.content.length / 74);
  const hashtagRows = Math.ceil((entry.hashtags || []).length / 3);
  const mentionRows = Math.ceil((entry.mentions || []).length / 3);
  const commentPreviewHeight = (entry.comments || []).length > 0 ? 92 : 0;
  const textHeight =
    220 +
    clamp(titleLines, 1, 3) * 28 +
    clamp(contentLines, 2, 12) * 28 +
    hashtagRows * 34 +
    mentionRows * 30 +
    commentPreviewHeight;

  return clamp(imageHeight + textHeight, 420, 1360);
}

export const KnowledgeCardList = memo(function KnowledgeCardList({
  entries,
  currentIdentity,
  profiles,
  onIdentityRequired,
  onOpenProfile,
  onOpenEntry,
  onVisible,
  onSelectHashtag,
  onLikeChange,
  highlightedEntryId,
}: KnowledgeCardListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const measuredHeightsRef = useRef<Record<string, number>>({});
  const itemLayoutRef = useRef<ItemLayout>({
    offsets: [],
    heights: [],
    totalHeight: 0,
  });
  const viewportWindowRef = useRef<ViewportWindow>({
    top: 0,
    bottom: typeof window === "undefined" ? 900 : window.innerHeight,
  });
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>(
    {},
  );
  const [viewportWindow, setViewportWindow] = useState<ViewportWindow>(() => ({
    top: 0,
    bottom: typeof window === "undefined" ? 900 : window.innerHeight,
  }));

  const updateViewportWindow = useCallback(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") return;

    const rect = container.getBoundingClientRect();
    const top = Math.max(0, -rect.top);
    const bottom = top + window.innerHeight;

    setViewportWindow((current) => {
      if (
        Math.abs(current.top - top) < 16 &&
        Math.abs(current.bottom - bottom) < 16
      ) {
        return current;
      }

      return { top, bottom };
    });
  }, []);

  useEffect(() => {
    measuredHeightsRef.current = measuredHeights;
  }, [measuredHeights]);

  useEffect(() => {
    viewportWindowRef.current = viewportWindow;
  }, [viewportWindow]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const scheduleUpdate = () => {
      if (animationFrameRef.current !== null) return;

      animationFrameRef.current = window.requestAnimationFrame(() => {
        animationFrameRef.current = null;
        updateViewportWindow();
      });
    };

    updateViewportWindow();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }

      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [updateViewportWindow]);

  const estimatedHeights = useMemo(
    () =>
      Object.fromEntries(
        entries.map((entry) => [entry.id, estimateKnowledgeCardHeight(entry)]),
      ),
    [entries],
  );
  const entryIndexById = useMemo(
    () =>
      new Map(entries.map((entry, index) => [entry.id, index] as const)),
    [entries],
  );

  const itemLayout = useMemo<ItemLayout>(() => {
    const offsets: number[] = [];
    const heights: number[] = [];
    let totalHeight = 0;

    entries.forEach((entry) => {
      const height =
        measuredHeights[entry.id] ||
        estimatedHeights[entry.id] ||
        DEFAULT_CARD_HEIGHT;
      offsets.push(totalHeight);
      heights.push(height);
      totalHeight += height;
    });

    return { offsets, heights, totalHeight };
  }, [entries, estimatedHeights, measuredHeights]);

  useEffect(() => {
    itemLayoutRef.current = itemLayout;
  }, [itemLayout]);

  const virtualRange = useMemo(() => {
    if (entries.length === 0) {
      return { start: 0, end: 0 };
    }

    const overscanTop = Math.max(0, viewportWindow.top - VIRTUAL_OVERSCAN_PX);
    const overscanBottom = viewportWindow.bottom + VIRTUAL_OVERSCAN_PX;
    let start = 0;
    let end = entries.length;

    while (
      start < entries.length - 1 &&
      itemLayout.offsets[start] + itemLayout.heights[start] < overscanTop
    ) {
      start += 1;
    }

    end = start;
    while (
      end < entries.length &&
      itemLayout.offsets[end] < overscanBottom
    ) {
      end += 1;
    }

    return { start, end: Math.max(end, start + 1) };
  }, [entries.length, itemLayout, viewportWindow]);

  const visibleEntries = useMemo(
    () => entries.slice(virtualRange.start, virtualRange.end),
    [entries, virtualRange],
  );

  const handleHeightChange = useCallback(
    (entryId: string, height: number) => {
      const previousHeight =
        measuredHeightsRef.current[entryId] ||
        estimatedHeights[entryId] ||
        DEFAULT_CARD_HEIGHT;

      if (Math.abs(previousHeight - height) < 4) {
        return;
      }

      const entryIndex = entryIndexById.get(entryId);
      const layout = itemLayoutRef.current;
      const rowTop =
        typeof entryIndex === "number" ? layout.offsets[entryIndex] || 0 : 0;
      const rowBottom = rowTop + previousHeight;
      const isAboveViewport = rowBottom < viewportWindowRef.current.top;
      const heightDelta = height - previousHeight;

      if (isAboveViewport && typeof window !== "undefined") {
        window.scrollBy({ top: heightDelta, left: 0, behavior: "auto" });
      }

      measuredHeightsRef.current = {
        ...measuredHeightsRef.current,
        [entryId]: height,
      };
      setMeasuredHeights((current) => ({
        ...current,
        [entryId]: height,
      }));
    },
    [entryIndexById, estimatedHeights],
  );

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ height: itemLayout.totalHeight || undefined }}
    >
      {visibleEntries.map((entry, offsetIndex) => {
        const index = virtualRange.start + offsetIndex;

        return (
          <MeasuredVirtualRow
            key={entry.id}
            entryId={entry.id}
            top={itemLayout.offsets[index] || 0}
            onHeightChange={handleHeightChange}
          >
            <Suspense fallback={<KnowledgeCardSkeleton />}>
              <LazyKnowledgeCard
                entry={entry}
                currentIdentity={currentIdentity}
                profiles={profiles}
                onVisible={onVisible}
                onIdentityRequired={onIdentityRequired}
                onOpenProfile={onOpenProfile}
                onOpenEntry={onOpenEntry}
                onSelectHashtag={onSelectHashtag}
                onLikeChange={onLikeChange}
                highlighted={entry.id === highlightedEntryId}
              />
            </Suspense>
          </MeasuredVirtualRow>
        );
      })}
    </div>
  );
});

function MeasuredVirtualRow({
  entryId,
  top,
  onHeightChange,
  children,
}: {
  entryId: string;
  top: number;
  onHeightChange: (entryId: string, height: number) => void;
  children: ReactNode;
}) {
  const rowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    const measure = () => {
      onHeightChange(entryId, row.getBoundingClientRect().height);
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      const timeoutId = window.setTimeout(measure, 250);
      return () => window.clearTimeout(timeoutId);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(row);

    return () => observer.disconnect();
  }, [entryId, onHeightChange]);

  return (
    <div
      ref={rowRef}
      className="absolute left-0 right-0 pb-4"
      style={
        {
          contain: "layout paint",
          transform: `translateY(${top}px)`,
          willChange: "transform",
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

function KnowledgeCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.07)]">
      <div className="aspect-video animate-pulse bg-slate-200" />
      <div className="space-y-4 p-5">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 animate-pulse rounded-2xl bg-slate-200" />
          <div className="space-y-2">
            <div className="h-3 w-28 animate-pulse rounded-full bg-slate-200" />
            <div className="h-3 w-40 animate-pulse rounded-full bg-slate-100" />
          </div>
        </div>
        <div className="h-7 w-4/5 animate-pulse rounded-full bg-slate-200" />
        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse rounded-full bg-slate-100" />
          <div className="h-3 w-11/12 animate-pulse rounded-full bg-slate-100" />
          <div className="h-3 w-2/3 animate-pulse rounded-full bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
