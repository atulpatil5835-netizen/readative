import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { type KnowledgeIdentity } from "../utils/knowledgeIdentity";

export interface UserHighlight {
  id: string;
  userId: string;
  postId: string;
  selectedText: string;
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
  postTitle: string;
  authorName: string;
  createdAt: number;
}

interface HighlightsContextType {
  highlights: UserHighlight[];
  highlightModePostIds: Record<string, boolean>;
  toggleHighlightMode: (postId: string) => void;
  addHighlight: (hlData: Omit<UserHighlight, "id" | "userId" | "createdAt">) => Promise<void>;
  removeHighlight: (id: string) => Promise<void>;
  isLoading: boolean;
}

const HighlightsContext = createContext<HighlightsContextType | undefined>(undefined);

export function useHighlights() {
  const context = useContext(HighlightsContext);
  if (!context) {
    throw new Error("useHighlights must be used within a HighlightsProvider");
  }
  return context;
}

interface HighlightsProviderProps {
  children: ReactNode;
  identity: KnowledgeIdentity | null;
}

export function HighlightsProvider({ children, identity }: HighlightsProviderProps) {
  const [highlights, setHighlights] = useState<UserHighlight[]>([]);
  const [highlightModePostIds, setHighlightModePostIds] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Sync highlights from Firestore in real-time for the active user
  useEffect(() => {
    if (!identity?.authorId) {
      setHighlights([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const q = query(
      collection(db, "userHighlights"),
      where("userId", "==", identity.authorId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: UserHighlight[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as UserHighlight);
        });
        // Sort highlights descending by creation date
        list.sort((a, b) => b.createdAt - a.createdAt);
        setHighlights(list);
        setIsLoading(false);
      },
      (error) => {
        console.error("Firestore highlights subscription error:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [identity?.authorId]);

  const toggleHighlightMode = (postId: string) => {
    setHighlightModePostIds((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  const addHighlight = async (
    hlData: Omit<UserHighlight, "id" | "userId" | "createdAt">
  ) => {
    if (!identity?.authorId) return;

    // Check for identical duplicate highlights to avoid database spam
    const isDuplicate = highlights.some(
      (hl) =>
        hl.postId === hlData.postId &&
        hl.paragraphIndex === hlData.paragraphIndex &&
        hl.startOffset === hlData.startOffset &&
        hl.endOffset === hlData.endOffset
    );
    if (isDuplicate) return;

    const newHl = {
      userId: identity.authorId,
      postId: hlData.postId,
      selectedText: hlData.selectedText,
      paragraphIndex: hlData.paragraphIndex,
      startOffset: hlData.startOffset,
      endOffset: hlData.endOffset,
      postTitle: hlData.postTitle,
      authorName: hlData.authorName,
      createdAt: Date.now(),
    };

    try {
      await addDoc(collection(db, "userHighlights"), newHl);
    } catch (error) {
      console.error("Failed to save highlight:", error);
    }
  };

  const removeHighlight = async (id: string) => {
    try {
      await deleteDoc(doc(db, "userHighlights", id));
    } catch (error) {
      console.error("Failed to remove highlight:", error);
    }
  };

  return (
    <HighlightsContext.Provider
      value={{
        highlights,
        highlightModePostIds,
        toggleHighlightMode,
        addHighlight,
        removeHighlight,
        isLoading,
      }}
    >
      {children}
    </HighlightsContext.Provider>
  );
}
