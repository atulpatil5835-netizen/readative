import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import type { KnowledgeEntry } from "../types";
import type { KnowledgeIdentity } from "../utils/knowledgeIdentity";
import type { NotebookHighlight } from "../highlights/types";

interface NotebookNoteRow {
  postId: string;
  highlights: NotebookHighlight[];
}

interface NotebookMyNotesPage {
  items: NotebookNoteRow[];
  posts: Map<string, KnowledgeEntry>;
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

interface NotebookContextValue {
  activePostId: string | null;
  notebookPostCount: number;
  inkPostIds: { readonly size: number };
  cacheVersion: number;
  notesCacheVersion: number;
  activateNotebook: (postId: string) => void;
  deactivateNotebook: () => void;
  readNotebookPostHighlights: (postId: string) => NotebookHighlight[] | null;
  loadNotebookPostHighlights: (postId: string) => Promise<NotebookHighlight[]>;
  saveNotebookPostHighlight: (
    postId: string,
    highlight: NotebookHighlight,
  ) => Promise<{
    saved: boolean;
    createdPost: boolean;
    highlights: NotebookHighlight[];
  }>;
  deleteNotebookPostHighlights: (postId: string) => Promise<void>;
  readCachedMyNotesFirstPage: () => NotebookMyNotesPage | null;
  loadMyNotesFirstPage: () => Promise<NotebookMyNotesPage>;
  loadMyNotesPage: (
    cursor: QueryDocumentSnapshot<DocumentData> | null,
  ) => Promise<NotebookMyNotesPage>;
  markPostHasHighlights: () => void;
  unmarkPostHasHighlights: () => void;
}

const NotebookContext = createContext<NotebookContextValue | null>(null);

export function NotebookProvider({
  children,
  identity,
  isKnowledgeActive,
  focusedPostId,
}: {
  children: ReactNode;
  identity: KnowledgeIdentity | null;
  isKnowledgeActive: boolean;
  focusedPostId: string | null;
}) {
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [notebookPostCount, setNotebookPostCount] = useState(0);
  const [cacheVersion, setCacheVersion] = useState(0);
  const [notesCacheVersion, setNotesCacheVersion] = useState(0);
  const countRequestRef = useRef(0);
  const activeUserRef = useRef<string | null>(identity?.authorId || null);
  const previousFocusedPostIdRef = useRef<string | null>(focusedPostId);
  const countCacheRef = useRef<number | null>(null);
  const postHighlightsCacheRef = useRef(new Map<string, NotebookHighlight[]>());
  const postHighlightRequestsRef = useRef(
    new Map<string, Promise<NotebookHighlight[]>>(),
  );
  const myNotesFirstPageCacheRef = useRef<NotebookMyNotesPage | null>(null);
  const myNotesFirstPageRequestRef =
    useRef<Promise<NotebookMyNotesPage> | null>(null);

  const bumpCacheVersion = useCallback(() => {
    setCacheVersion((current) => current + 1);
  }, []);

  const bumpNotesCacheVersion = useCallback(() => {
    setNotesCacheVersion((current) => current + 1);
  }, []);

  const clearNotebookCaches = useCallback(() => {
    postHighlightsCacheRef.current.clear();
    postHighlightRequestsRef.current.clear();
    myNotesFirstPageCacheRef.current = null;
    myNotesFirstPageRequestRef.current = null;
    countCacheRef.current = null;
    bumpCacheVersion();
    bumpNotesCacheVersion();
  }, [bumpCacheVersion, bumpNotesCacheVersion]);

  const invalidateMyNotesCache = useCallback(() => {
    myNotesFirstPageCacheRef.current = null;
    myNotesFirstPageRequestRef.current = null;
    bumpNotesCacheVersion();
  }, [bumpNotesCacheVersion]);

  const activateNotebook = useCallback((postId: string) => {
    setActivePostId(postId);
  }, []);
  const deactivateNotebook = useCallback(() => {
    setActivePostId(null);
  }, []);

  useEffect(() => {
    const previousFocusedPostId = previousFocusedPostIdRef.current;
    previousFocusedPostIdRef.current = focusedPostId;
    if (!activePostId) return;
    if (!isKnowledgeActive) {
      setActivePostId(null);
      return;
    }
    if (focusedPostId && activePostId !== focusedPostId) setActivePostId(null);
    if (
      !focusedPostId &&
      previousFocusedPostId &&
      previousFocusedPostId === activePostId
    ) {
      setActivePostId(null);
    }
  }, [activePostId, focusedPostId, isKnowledgeActive]);

  useEffect(() => {
    if (!activePostId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActivePostId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePostId]);

  const refreshNotebookPostCount = useCallback((force = false) => {
    const userId = identity?.authorId;
    const requestId = ++countRequestRef.current;
    if (!userId) {
      countCacheRef.current = null;
      setNotebookPostCount(0);
      return;
    }
    if (!force && countCacheRef.current !== null) {
      setNotebookPostCount(countCacheRef.current);
      return;
    }
    void import("../highlights/repository")
      .then(({ loadNotebookPostCount }) => loadNotebookPostCount(userId))
      .then((count) => {
        if (requestId === countRequestRef.current) {
          const normalizedCount = Math.max(0, count);
          countCacheRef.current = normalizedCount;
          setNotebookPostCount(normalizedCount);
        }
      })
      .catch((error) => {
        console.error("Failed to load Notebook Highlight count:", error);
        if (requestId === countRequestRef.current) setNotebookPostCount(0);
      });
  }, [identity?.authorId]);

  useEffect(() => {
    const userId = identity?.authorId || null;
    if (activeUserRef.current !== userId) {
      activeUserRef.current = userId;
      clearNotebookCaches();
    }
    if (!userId) setActivePostId(null);
    refreshNotebookPostCount();
    return () => {
      countRequestRef.current += 1;
    };
  }, [clearNotebookCaches, identity?.authorId, refreshNotebookPostCount]);

  const updateCountAfterPostCreated = useCallback(() => {
    if (countCacheRef.current === null) {
      refreshNotebookPostCount(true);
      return;
    }
    const nextCount = countCacheRef.current + 1;
    countCacheRef.current = nextCount;
    setNotebookPostCount(nextCount);
  }, [refreshNotebookPostCount]);

  const updateCountAfterPostDeleted = useCallback(() => {
    if (countCacheRef.current === null) {
      refreshNotebookPostCount(true);
      return;
    }
    const nextCount = Math.max(0, countCacheRef.current - 1);
    countCacheRef.current = nextCount;
    setNotebookPostCount(nextCount);
  }, [refreshNotebookPostCount]);

  const readNotebookPostHighlights = useCallback((postId: string) => {
    const cachedHighlights = postHighlightsCacheRef.current.get(postId);
    return cachedHighlights ? [...cachedHighlights] : null;
  }, []);

  const loadNotebookPostHighlights = useCallback(
    async (postId: string) => {
      const userId = identity?.authorId;
      if (!userId) return [];
      const cachedHighlights = postHighlightsCacheRef.current.get(postId);
      if (cachedHighlights) return [...cachedHighlights];
      const existingRequest = postHighlightRequestsRef.current.get(postId);
      if (existingRequest) return existingRequest;

      const request = import("../highlights/repository")
        .then(({ loadNotebookPost }) => loadNotebookPost(userId, postId))
        .then((highlights) => {
          if (activeUserRef.current === userId) {
            postHighlightsCacheRef.current.set(postId, highlights);
            postHighlightRequestsRef.current.delete(postId);
          }
          return highlights;
        })
        .catch((error) => {
          postHighlightRequestsRef.current.delete(postId);
          throw error;
        });
      postHighlightRequestsRef.current.set(postId, request);
      return request;
    },
    [identity?.authorId],
  );

  const saveNotebookPostHighlight = useCallback(
    async (postId: string, highlight: NotebookHighlight) => {
      const userId = identity?.authorId;
      if (!userId) throw new Error("Sign in to save Notebook Highlights.");
      const { saveNotebookHighlight } = await import("../highlights/repository");
      const result = await saveNotebookHighlight(userId, postId, highlight);
      if (activeUserRef.current === userId) {
        postHighlightsCacheRef.current.set(postId, result.highlights);
        postHighlightRequestsRef.current.delete(postId);
        if (result.saved) {
          invalidateMyNotesCache();
          if (result.createdPost) updateCountAfterPostCreated();
        }
        bumpCacheVersion();
      }
      return result;
    },
    [
      bumpCacheVersion,
      identity?.authorId,
      invalidateMyNotesCache,
      updateCountAfterPostCreated,
    ],
  );

  const deleteNotebookPostHighlights = useCallback(
    async (postId: string) => {
      const userId = identity?.authorId;
      if (!userId) throw new Error("Sign in to delete Notebook Highlights.");
      const { deleteNotebookPost } = await import("../highlights/repository");
      await deleteNotebookPost(userId, postId);
      if (activeUserRef.current === userId) {
        postHighlightsCacheRef.current.set(postId, []);
        postHighlightRequestsRef.current.delete(postId);
        invalidateMyNotesCache();
        updateCountAfterPostDeleted();
        bumpCacheVersion();
      }
    },
    [
      bumpCacheVersion,
      identity?.authorId,
      invalidateMyNotesCache,
      updateCountAfterPostDeleted,
    ],
  );

  const readCachedMyNotesFirstPage = useCallback(
    () => myNotesFirstPageCacheRef.current,
    [],
  );

  const loadMyNotesPage = useCallback(
    async (cursor: QueryDocumentSnapshot<DocumentData> | null) => {
      const userId = identity?.authorId;
      if (!userId) {
        return {
          items: [],
          posts: new Map<string, KnowledgeEntry>(),
          cursor: null,
          hasMore: false,
        };
      }
      const { loadMyNotes, loadNotePosts } = await import("../highlights/repository");
      const page = await loadMyNotes(userId, cursor);
      const posts = await loadNotePosts(page.items.map((item) => item.postId));
      return { ...page, posts };
    },
    [identity?.authorId],
  );

  const loadMyNotesFirstPage = useCallback(async () => {
    const userId = identity?.authorId;
    if (!userId) {
      return {
        items: [],
        posts: new Map<string, KnowledgeEntry>(),
        cursor: null,
        hasMore: false,
      };
    }
    if (myNotesFirstPageCacheRef.current) {
      return myNotesFirstPageCacheRef.current;
    }
    if (myNotesFirstPageRequestRef.current) {
      return myNotesFirstPageRequestRef.current;
    }

    const request = loadMyNotesPage(null)
      .then((page) => {
        if (activeUserRef.current === userId) {
          myNotesFirstPageCacheRef.current = page;
          myNotesFirstPageRequestRef.current = null;
        }
        return page;
      })
      .catch((error) => {
        myNotesFirstPageRequestRef.current = null;
        throw error;
      });
    myNotesFirstPageRequestRef.current = request;
    return request;
  }, [identity?.authorId, loadMyNotesPage]);

  const markPostHasHighlights = useCallback(() => {
    invalidateMyNotesCache();
    refreshNotebookPostCount(true);
    bumpCacheVersion();
  }, [bumpCacheVersion, invalidateMyNotesCache, refreshNotebookPostCount]);
  const unmarkPostHasHighlights = useCallback(() => {
    invalidateMyNotesCache();
    refreshNotebookPostCount(true);
    bumpCacheVersion();
  }, [bumpCacheVersion, invalidateMyNotesCache, refreshNotebookPostCount]);

  const value = useMemo<NotebookContextValue>(
    () => ({
      activePostId,
      notebookPostCount,
      inkPostIds: { size: notebookPostCount },
      cacheVersion,
      notesCacheVersion,
      activateNotebook,
      deactivateNotebook,
      readNotebookPostHighlights,
      loadNotebookPostHighlights,
      saveNotebookPostHighlight,
      deleteNotebookPostHighlights,
      readCachedMyNotesFirstPage,
      loadMyNotesFirstPage,
      loadMyNotesPage,
      markPostHasHighlights,
      unmarkPostHasHighlights,
    }),
    [
      activePostId,
      activateNotebook,
      cacheVersion,
      deactivateNotebook,
      deleteNotebookPostHighlights,
      loadMyNotesFirstPage,
      loadMyNotesPage,
      loadNotebookPostHighlights,
      markPostHasHighlights,
      notesCacheVersion,
      notebookPostCount,
      readCachedMyNotesFirstPage,
      readNotebookPostHighlights,
      saveNotebookPostHighlight,
      unmarkPostHasHighlights,
    ],
  );

  return <NotebookContext.Provider value={value}>{children}</NotebookContext.Provider>;
}

export function useNotebook() {
  const context = useContext(NotebookContext);
  if (!context) throw new Error("useNotebook must be used within NotebookProvider");
  return context;
}
