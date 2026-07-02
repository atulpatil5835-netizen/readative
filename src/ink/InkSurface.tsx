import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  createInkStrokeId,
  encodeInkGeometry,
  hashInkText,
  inkPointsToPath,
  projectInkStroke,
  simplifyInkPoints,
  type InkPoint,
} from "./geometry";
import {
  INK_COLOR_HEX,
  INK_WIDTH_PX,
  type InkColor,
  type InkStroke,
  type InkWidth,
} from "./types";
import { appendInkStroke, loadInkPost } from "./repository";

interface InkSurfaceProps {
  hostRef: RefObject<HTMLDivElement | null>;
  userId: string;
  postId: string;
  content: string;
  isInkMode: boolean;
  color: InkColor;
  width: InkWidth;
  onPostHasInk: (postId: string) => void;
  onStatus: (message: string) => void;
}

interface InkCandidate {
  kind: "touch" | "pointer";
  identifier: number;
  startClientX: number;
  startClientY: number;
  points: InkPoint[];
  timerId: number;
  drawing: boolean;
  blockKey: string;
  blockOrdinal: number;
  blockLeft: number;
  blockTop: number;
  blockWidth: number;
  blockHeight: number;
}

const HOLD_MS_TOUCH = 280;
const HOLD_MS_POINTER = 140;
const MOVE_SLOP_PX = 8;
const MIN_STROKE_DISTANCE_PX = 6;
const MAX_STROKES_PER_POST = 600;
const MAX_GEOMETRY_CHARACTERS_PER_POST = 450_000;

function isInteractiveTarget(target: EventTarget | null, host: HTMLElement) {
  const element = target instanceof Element ? target : null;
  const interactive = element?.closest(
    "a,button,input,textarea,select,summary,[role='button'],[contenteditable='true']",
  );
  return Boolean(interactive && host.contains(interactive));
}

function getInkBlocks(host: HTMLElement) {
  return Array.from(host.querySelectorAll<HTMLElement>("[data-ink-block-key]"));
}

function getBlockAtPoint(
  host: HTMLElement,
  clientX: number,
  clientY: number,
) {
  const direct = document
    .elementFromPoint(clientX, clientY)
    ?.closest<HTMLElement>("[data-ink-block-key]");
  const blocks = getInkBlocks(host);
  const block = direct && host.contains(direct) ? direct : blocks[0];
  if (!block) return null;
  const hostRect = host.getBoundingClientRect();
  const blockRect = block.getBoundingClientRect();
  return {
    key: block.dataset.inkBlockKey || "post",
    ordinal: Number.parseInt(block.dataset.inkBlockOrdinal || "0", 10) || 0,
    left: blockRect.left - hostRect.left,
    top: blockRect.top - hostRect.top,
    width: Math.max(1, blockRect.width),
    height: Math.max(1, blockRect.height),
  };
}

function strokeDistance(points: InkPoint[]) {
  let distance = 0;
  for (let index = 1; index < points.length; index += 1) {
    distance += Math.hypot(
      points[index].x - points[index - 1].x,
      points[index].y - points[index - 1].y,
    );
  }
  return distance;
}

export default function InkSurface({
  hostRef,
  userId,
  postId,
  content,
  isInkMode,
  color,
  width,
  onPostHasInk,
  onStatus,
}: InkSurfaceProps) {
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const activePathRef = useRef<SVGPathElement | null>(null);
  const activePathFrameRef = useRef<number | null>(null);
  const candidateRef = useRef<InkCandidate | null>(null);
  const strokesRef = useRef<InkStroke[]>([]);
  const hasDocumentRef = useRef(false);
  const contentRevision = useMemo(() => hashInkText(content), [content]);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  useEffect(() => {
    let cancelled = false;
    setIsReady(false);
    void loadInkPost(userId, postId)
      .then((note) => {
        if (cancelled) return;
        const nextStrokes = note?.strokes || [];
        hasDocumentRef.current = Boolean(note);
        strokesRef.current = nextStrokes;
        setStrokes(nextStrokes);
        setIsReady(true);
      })
      .catch((error) => {
        console.error("Failed to load Ink:", error);
        if (!cancelled) {
          setIsReady(true);
          onStatus("Ink could not be loaded right now.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [onStatus, postId, userId]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    let frameId = 0;
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        setLayoutVersion((version) => version + 1);
      });
    });
    observer.observe(host);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frameId);
    };
  }, [hostRef]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !isInkMode || !isReady) return;

    const clearCandidate = () => {
      const candidate = candidateRef.current;
      if (candidate) window.clearTimeout(candidate.timerId);
      candidateRef.current = null;
      if (activePathFrameRef.current !== null) {
        window.cancelAnimationFrame(activePathFrameRef.current);
        activePathFrameRef.current = null;
      }
      if (activePathRef.current) activePathRef.current.setAttribute("d", "");
      host.removeEventListener("touchmove", handleActiveTouchMove);
    };

    const addPoint = (clientX: number, clientY: number) => {
      const candidate = candidateRef.current;
      if (!candidate) return;
      const hostRect = host.getBoundingClientRect();
      const point = {
        x: clientX - hostRect.left,
        y: clientY - hostRect.top,
      };
      const previous = candidate.points[candidate.points.length - 1];
      if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 1.25) {
        return;
      }
      if (candidate.points.length >= 1_024) {
        candidate.points[candidate.points.length - 1] = point;
      } else {
        candidate.points.push(point);
      }
      if (activePathRef.current && activePathFrameRef.current === null) {
        activePathFrameRef.current = window.requestAnimationFrame(() => {
          activePathFrameRef.current = null;
          const activeCandidate = candidateRef.current;
          if (activeCandidate && activePathRef.current) {
            activePathRef.current.setAttribute(
              "d",
              inkPointsToPath(activeCandidate.points),
            );
          }
        });
      }
    };

    const commitCandidate = () => {
      const candidate = candidateRef.current;
      if (!candidate?.drawing) {
        clearCandidate();
        return;
      }

      const simplified = simplifyInkPoints(candidate.points, 1.2).slice(0, 256);
      if (simplified.length < 2 || strokeDistance(simplified) < MIN_STROKE_DISTANCE_PX) {
        clearCandidate();
        return;
      }

      if (strokesRef.current.length >= MAX_STROKES_PER_POST) {
        clearCandidate();
        onStatus("This post has reached the Ink limit.");
        return;
      }

      const blockPoints = simplified.map((point) => ({
        x: point.x - candidate.blockLeft,
        y: point.y - candidate.blockTop,
      }));
      const stroke: InkStroke = {
        id: createInkStrokeId(),
        at: Date.now(),
        color,
        width,
        geometry: encodeInkGeometry(
          blockPoints,
          candidate.blockWidth,
          candidate.blockHeight,
        ),
        anchor: {
          blockKey: candidate.blockKey,
          blockOrdinal: candidate.blockOrdinal,
          sourceWidth: candidate.blockWidth,
          sourceHeight: candidate.blockHeight,
        },
        contentRevision,
      };

      const nextGeometrySize = strokesRef.current.reduce(
        (total, item) => total + item.geometry.length,
        stroke.geometry.length,
      );
      if (nextGeometrySize > MAX_GEOMETRY_CHARACTERS_PER_POST) {
        clearCandidate();
        onStatus("This post has reached the Ink storage limit.");
        return;
      }

      const isFirstStroke = !hasDocumentRef.current;
      hasDocumentRef.current = true;
      strokesRef.current = [...strokesRef.current, stroke];
      setStrokes(strokesRef.current);
      clearCandidate();

      void appendInkStroke(userId, postId, stroke, isFirstStroke)
        .then(() => onPostHasInk(postId))
        .catch((error) => {
          console.error("Failed to save Ink stroke:", error);
          strokesRef.current = strokesRef.current.filter((item) => item.id !== stroke.id);
          setStrokes(strokesRef.current);
          if (isFirstStroke && strokesRef.current.length === 0) {
            hasDocumentRef.current = false;
          }
          onStatus("Ink was not saved. Please try again.");
        });
    };

    function handleActiveTouchMove(event: TouchEvent) {
      const candidate = candidateRef.current;
      if (!candidate?.drawing || candidate.kind !== "touch") return;
      const touch = Array.from(event.changedTouches).find(
        (item) => item.identifier === candidate.identifier,
      );
      if (!touch) return;
      event.preventDefault();
      addPoint(touch.clientX, touch.clientY);
    }

    const beginCandidate = (
      kind: InkCandidate["kind"],
      identifier: number,
      clientX: number,
      clientY: number,
      target: EventTarget | null,
    ) => {
      if (candidateRef.current || isInteractiveTarget(target, host)) return;
      const block = getBlockAtPoint(host, clientX, clientY);
      if (!block) return;
      const hostRect = host.getBoundingClientRect();
      const candidate: InkCandidate = {
        kind,
        identifier,
        startClientX: clientX,
        startClientY: clientY,
        points: [{ x: clientX - hostRect.left, y: clientY - hostRect.top }],
        timerId: 0,
        drawing: false,
        blockKey: block.key,
        blockOrdinal: block.ordinal,
        blockLeft: block.left,
        blockTop: block.top,
        blockWidth: block.width,
        blockHeight: block.height,
      };
      candidate.timerId = window.setTimeout(
        () => {
          if (candidateRef.current !== candidate) return;
          candidate.drawing = true;
          if (kind === "touch") {
            host.addEventListener("touchmove", handleActiveTouchMove, {
              passive: false,
            });
          }
        },
        kind === "touch" ? HOLD_MS_TOUCH : HOLD_MS_POINTER,
      );
      candidateRef.current = candidate;
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        clearCandidate();
        return;
      }
      const touch = event.changedTouches[0];
      beginCandidate(
        "touch",
        touch.identifier,
        touch.clientX,
        touch.clientY,
        event.target,
      );
    };

    const handleCandidateTouchMove = (event: TouchEvent) => {
      const candidate = candidateRef.current;
      if (!candidate || candidate.kind !== "touch" || candidate.drawing) return;
      const touch = Array.from(event.changedTouches).find(
        (item) => item.identifier === candidate.identifier,
      );
      if (
        touch &&
        Math.hypot(
          touch.clientX - candidate.startClientX,
          touch.clientY - candidate.startClientY,
        ) > MOVE_SLOP_PX
      ) {
        clearCandidate();
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const candidate = candidateRef.current;
      if (!candidate || candidate.kind !== "touch") return;
      const touch = Array.from(event.changedTouches).find(
        (item) => item.identifier === candidate.identifier,
      );
      if (!touch) return;
      if (candidate.drawing) addPoint(touch.clientX, touch.clientY);
      commitCandidate();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch" || event.button !== 0) return;
      beginCandidate(
        "pointer",
        event.pointerId,
        event.clientX,
        event.clientY,
        event.target,
      );
    };

    const handlePointerMove = (event: PointerEvent) => {
      const candidate = candidateRef.current;
      if (!candidate || candidate.kind !== "pointer" || candidate.identifier !== event.pointerId) {
        return;
      }
      if (!candidate.drawing) {
        if (
          Math.hypot(
            event.clientX - candidate.startClientX,
            event.clientY - candidate.startClientY,
          ) > MOVE_SLOP_PX
        ) {
          clearCandidate();
        }
        return;
      }
      event.preventDefault();
      addPoint(event.clientX, event.clientY);
    };

    const handlePointerUp = (event: PointerEvent) => {
      const candidate = candidateRef.current;
      if (!candidate || candidate.kind !== "pointer" || candidate.identifier !== event.pointerId) {
        return;
      }
      if (candidate.drawing) addPoint(event.clientX, event.clientY);
      commitCandidate();
    };

    const preventInkCallout = (event: Event) => {
      if (candidateRef.current) event.preventDefault();
    };
    const cancelWithoutSave = () => clearCandidate();
    const cancelWhenHidden = () => {
      if (document.hidden) clearCandidate();
    };

    host.addEventListener("touchstart", handleTouchStart, { passive: true });
    host.addEventListener("touchmove", handleCandidateTouchMove, { passive: true });
    host.addEventListener("touchend", handleTouchEnd, { passive: true });
    host.addEventListener("touchcancel", cancelWithoutSave, { passive: true });
    host.addEventListener("pointerdown", handlePointerDown);
    host.addEventListener("pointermove", handlePointerMove);
    host.addEventListener("pointerup", handlePointerUp);
    host.addEventListener("pointercancel", cancelWithoutSave);
    host.addEventListener("contextmenu", preventInkCallout);
    window.addEventListener("blur", cancelWithoutSave);
    window.addEventListener("resize", cancelWithoutSave);
    document.addEventListener("visibilitychange", cancelWhenHidden);

    return () => {
      clearCandidate();
      host.removeEventListener("touchstart", handleTouchStart);
      host.removeEventListener("touchmove", handleCandidateTouchMove);
      host.removeEventListener("touchend", handleTouchEnd);
      host.removeEventListener("touchcancel", cancelWithoutSave);
      host.removeEventListener("pointerdown", handlePointerDown);
      host.removeEventListener("pointermove", handlePointerMove);
      host.removeEventListener("pointerup", handlePointerUp);
      host.removeEventListener("pointercancel", cancelWithoutSave);
      host.removeEventListener("contextmenu", preventInkCallout);
      window.removeEventListener("blur", cancelWithoutSave);
      window.removeEventListener("resize", cancelWithoutSave);
      document.removeEventListener("visibilitychange", cancelWhenHidden);
    };
  }, [
    color,
    contentRevision,
    hostRef,
    isInkMode,
    isReady,
    onPostHasInk,
    onStatus,
    postId,
    userId,
    width,
  ]);

  const renderedGroups = useMemo(() => {
    const host = hostRef.current;
    if (!host) return [];
    const hostRect = host.getBoundingClientRect();
    const blocks = getInkBlocks(host);
    const groups = new Map<string, { color: InkColor; width: InkWidth; d: string }>();

    for (const stroke of strokes) {
      const exactBlock = blocks.find(
        (block) => block.dataset.inkBlockKey === stroke.anchor.blockKey,
      );
      const block =
        exactBlock ||
        (stroke.contentRevision === contentRevision
          ? blocks[stroke.anchor.blockOrdinal]
          : undefined);
      if (!block) continue;
      const blockRect = block.getBoundingClientRect();
      const left = blockRect.left - hostRect.left;
      const top = blockRect.top - hostRect.top;
      const points = projectInkStroke(stroke, blockRect.width, blockRect.height).map(
        (point) => ({ x: point.x + left, y: point.y + top }),
      );
      const d = inkPointsToPath(points);
      if (!d) continue;
      const key = `${stroke.color}:${stroke.width}`;
      const current = groups.get(key);
      if (current) current.d = `${current.d} ${d}`;
      else groups.set(key, { color: stroke.color, width: stroke.width, d });
    }
    return [...groups.values()];
  }, [contentRevision, hostRef, layoutVersion, strokes]);

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible"
      preserveAspectRatio="none"
    >
      {renderedGroups.map((group) => (
        <path
          key={`${group.color}-${group.width}`}
          d={group.d}
          fill="none"
          stroke={INK_COLOR_HEX[group.color]}
          strokeWidth={INK_WIDTH_PX[group.width]}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <path
        ref={activePathRef}
        fill="none"
        stroke={INK_COLOR_HEX[color]}
        strokeWidth={INK_WIDTH_PX[width]}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
