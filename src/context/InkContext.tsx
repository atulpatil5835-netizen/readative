import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { KnowledgeIdentity } from "../utils/knowledgeIdentity";
import {
  isInkColor,
  isInkWidth,
  type InkColor,
  type InkWidth,
} from "../ink/types";

const INK_PREFERENCE_KEY = "readativeInkPreference:v1";

interface InkContextValue {
  activePostId: string | null;
  inkPostIds: ReadonlySet<string>;
  color: InkColor;
  width: InkWidth;
  activateInk: (postId: string) => void;
  deactivateInk: () => void;
  markPostHasInk: (postId: string) => void;
  unmarkPostHasInk: (postId: string) => void;
  setColor: (color: InkColor) => void;
  setWidth: (width: InkWidth) => void;
}

const InkContext = createContext<InkContextValue | null>(null);

function loadInkPreference() {
  if (typeof window === "undefined") {
    return { color: "blue" as InkColor, width: "medium" as InkWidth };
  }
  try {
    const value = JSON.parse(localStorage.getItem(INK_PREFERENCE_KEY) || "{}");
    return {
      color: isInkColor(value.color) ? value.color : ("blue" as InkColor),
      width: isInkWidth(value.width) ? value.width : ("medium" as InkWidth),
    };
  } catch {
    return { color: "blue" as InkColor, width: "medium" as InkWidth };
  }
}

export function InkProvider({
  children,
  identity,
  focusedPostId,
}: {
  children: ReactNode;
  identity: KnowledgeIdentity | null;
  focusedPostId: string | null;
}) {
  const preference = useMemo(loadInkPreference, []);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [inkPostIds, setInkPostIds] = useState<Set<string>>(() => new Set());
  const [color, setColorState] = useState<InkColor>(preference.color);
  const [width, setWidthState] = useState<InkWidth>(preference.width);

  useEffect(() => {
    if (!activePostId) return;
    if (!focusedPostId || focusedPostId !== activePostId) {
      setActivePostId(null);
    }
  }, [activePostId, focusedPostId]);

  useEffect(() => {
    const userId = identity?.authorId;
    if (!userId) {
      setInkPostIds(new Set());
      setActivePostId(null);
      return;
    }

    let cancelled = false;
    void import("../ink/repository")
      .then(({ loadInkIndex }) => loadInkIndex(userId))
      .then((postIds) => {
        if (!cancelled) setInkPostIds(new Set(postIds));
      })
      .catch((error) => {
        console.error("Failed to load Ink index:", error);
        if (!cancelled) setInkPostIds(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [identity?.authorId]);

  const savePreference = useCallback((nextColor: InkColor, nextWidth: InkWidth) => {
    try {
      localStorage.setItem(
        INK_PREFERENCE_KEY,
        JSON.stringify({ color: nextColor, width: nextWidth }),
      );
    } catch {
      // Ink preferences are non-critical when browser storage is unavailable.
    }
  }, []);

  const setColor = useCallback(
    (nextColor: InkColor) => {
      setColorState(nextColor);
      savePreference(nextColor, width);
    },
    [savePreference, width],
  );

  const setWidth = useCallback(
    (nextWidth: InkWidth) => {
      setWidthState(nextWidth);
      savePreference(color, nextWidth);
    },
    [color, savePreference],
  );

  const markPostHasInk = useCallback((postId: string) => {
    setInkPostIds((current) => {
      if (current.has(postId)) return current;
      const next = new Set(current);
      next.add(postId);
      return next;
    });
  }, []);

  const unmarkPostHasInk = useCallback((postId: string) => {
    setInkPostIds((current) => {
      if (!current.has(postId)) return current;
      const next = new Set(current);
      next.delete(postId);
      return next;
    });
  }, []);

  const value = useMemo<InkContextValue>(
    () => ({
      activePostId,
      inkPostIds,
      color,
      width,
      activateInk: setActivePostId,
      deactivateInk: () => setActivePostId(null),
      markPostHasInk,
      unmarkPostHasInk,
      setColor,
      setWidth,
    }),
    [
      activePostId,
      color,
      inkPostIds,
      markPostHasInk,
      setColor,
      setWidth,
      unmarkPostHasInk,
      width,
    ],
  );

  return <InkContext.Provider value={value}>{children}</InkContext.Provider>;
}

export function useInk() {
  const context = useContext(InkContext);
  if (!context) throw new Error("useInk must be used within InkProvider");
  return context;
}
