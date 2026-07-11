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
import {
  getContributorReputationFromEntries,
} from "../utils/trustSystem";
import { KnowledgeCardSkeleton } from "./Skeletons";

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
    type: "helpful" | "misleading" | "comment" | "save" | "ink";
    entryId: string;
  }) => void;
  onOpenProfile: (authorId: string, username?: string) => void;
  onOpenEntry: (entryId: string) => void;
  onVisible?: (entry: KnowledgeEntry) => void;
  onSelectHashtag?: (tag: string) => void;
  onLikeChange?: (
    entryId: string,
    helpfulIds: string[],
    misleadingIds?: string[],
  ) => void;
  onEntryUpdated?: (entry: KnowledgeEntry) => void;
  focusedEntryId?: string | null;
  renderAfterCard?: (entry: KnowledgeEntry) => ReactNode;
  estimateAfterCardHeight?: (entry: KnowledgeEntry) => number;
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

function findFirstVisibleIndex(
  offsets: number[],
  heights: number[],
  targetTop: number,
) {
  let low = 0;
  let high = offsets.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const rowBottom = offsets[mid] + heights[mid];

    if (rowBottom < targetTop) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

function findFirstOffsetAtOrAfter(
  offsets: number[],
  targetBottom: number,
  startIndex: number,
) {
  let low = startIndex;
  let high = offsets.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);

    if (offsets[mid] < targetBottom) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
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
  onEntryUpdated,
  focusedEntryId,
  renderAfterCard,
  estimateAfterCardHeight,
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
      entries.map(
        (entry) =>
          estimateKnowledgeCardHeight(entry) +
          Math.max(0, estimateAfterCardHeight?.(entry) || 0),
      ),
    [entries, estimateAfterCardHeight],
  );
  const entryIndexById = useMemo(
    () =>
      new Map(entries.map((entry, index) => [entry.id, index] as const)),
    [entries],
  );
  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile] as const)),
    [profiles],
  );
  const authorReputationMap = useMemo(() => {
    const authorIds = new Set(entries.map((entry) => entry.authorId).filter(Boolean));

    return new Map(
      [...authorIds].map(
        (authorId) =>
          [
            authorId,
            getContributorReputationFromEntries(
              entries,
              authorId,
              profileMap.get(authorId),
            ),
          ] as const,
      ),
    );
  }, [entries, profileMap]);

  const itemLayout = useMemo<ItemLayout>(() => {
    const offsets: number[] = [];
    const heights: number[] = [];
    let totalHeight = 0;

    entries.forEach((entry, index) => {
      const height =
        measuredHeights[entry.id] ||
        estimatedHeights[index] ||
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

  useEffect(() => {
    const entryIds = new Set(entries.map((entry) => entry.id));
    const nextMeasuredHeights = Object.fromEntries(
      Object.entries(measuredHeightsRef.current).filter(([entryId]) =>
        entryIds.has(entryId),
      ),
    );

    if (
      Object.keys(nextMeasuredHeights).length ===
      Object.keys(measuredHeightsRef.current).length
    ) {
      return;
    }

    measuredHeightsRef.current = nextMeasuredHeights;
    setMeasuredHeights(nextMeasuredHeights);
  }, [entries]);

  const virtualRange = useMemo(() => {
    if (entries.length === 0) {
      return { start: 0, end: 0 };
    }

    const overscanTop = Math.max(0, viewportWindow.top - VIRTUAL_OVERSCAN_PX);
    const overscanBottom = viewportWindow.bottom + VIRTUAL_OVERSCAN_PX;
    const start = Math.min(
      findFirstVisibleIndex(itemLayout.offsets, itemLayout.heights, overscanTop),
      entries.length - 1,
    );
    const end = findFirstOffsetAtOrAfter(
      itemLayout.offsets,
      overscanBottom,
      start,
    );

    return { start, end: Math.max(end, start + 1) };
  }, [entries.length, itemLayout, viewportWindow]);

  const visibleEntries = useMemo(
    () => entries.slice(virtualRange.start, virtualRange.end),
    [entries, virtualRange],
  );

  const handleHeightChange = useCallback(
    (entryId: string, height: number) => {
      const entryIndex = entryIndexById.get(entryId);
      const previousHeight =
        measuredHeightsRef.current[entryId] ||
        (typeof entryIndex === "number"
          ? estimatedHeights[entryIndex]
          : DEFAULT_CARD_HEIGHT) ||
        DEFAULT_CARD_HEIGHT;

      if (Math.abs(previousHeight - height) < 4) {
        return;
      }

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
                profileMap={profileMap}
                authorReputation={authorReputationMap.get(entry.authorId)}
                onVisible={onVisible}
                onIdentityRequired={onIdentityRequired}
                onOpenProfile={onOpenProfile}
                onOpenEntry={onOpenEntry}
                onSelectHashtag={onSelectHashtag}
                onLikeChange={onLikeChange}
                onEntryUpdated={onEntryUpdated}
                focused={entry.id === focusedEntryId}
              />
              {renderAfterCard?.(entry)}
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
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
