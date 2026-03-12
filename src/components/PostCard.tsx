import { useState, useRef } from "react";
import { motion } from "motion/react";
import { Post, UserProfile, Highlight } from "../types";
import { geminiService } from "../services/gemini";
import { Heart, MessageCircle, Share2, Play, Pause, Highlighter, Underline, Languages, Loader2, Sparkles, X } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../firebase/firebase";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PostCardProps {
  post: Post;
  user: UserProfile | null;
  refreshProfile: () => void;
  onUpdate: () => void;
}

const CATEGORY_EMOJI: Record<string, string> = {
  story: "📖", joke: "😄", motivation: "🔥",
  poetry: "🌸", shayari: "🌙", knowledge: "💡", questions: "❓",
};

export function PostCard({ post, user, refreshProfile, onUpdate }: PostCardProps) {
  const [isReading, setIsReading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);

  // Pen mode
  const [penMode, setPenMode] = useState<"none" | "highlight" | "underline">("none");
  // Highlights stored per-session (localStorage key = post.id)
  const storageKey = `highlights_${post.id}`;
  const [highlights, setHighlights] = useState<Highlight[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Translation
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  // Likes / Comments (optimistic)
  const [localLikes, setLocalLikes] = useState<string[]>(post.likes || []);
  const [localComments, setLocalComments] = useState(post.comments || []);

  const prevPostRef = useRef(post);
  if (post !== prevPostRef.current) {
    prevPostRef.current = post;
    setLocalLikes(post.likes || []);
    setLocalComments(post.comments || []);
  }

  const contentRef = useRef<HTMLDivElement>(null);
  const isLiked = user ? localLikes.includes(user.id) : false;
  const displayContent = showTranslation && translatedContent ? translatedContent : post.content;

  // Save highlights to localStorage whenever they change
  const saveHighlights = (newHighlights: Highlight[]) => {
    setHighlights(newHighlights);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newHighlights));
    } catch { /* ignore */ }
  };

  // ── Like ──────────────────────────────────────────────────────────────
  const handleLike = async () => {
    if (!user) return;
    const newLikes = isLiked
      ? localLikes.filter(id => id !== user.id)
      : [...localLikes, user.id];
    setLocalLikes(newLikes);
    try {
      await updateDoc(doc(db, "posts", post.id), {
        likes: isLiked ? arrayRemove(user.id) : arrayUnion(user.id),
      });
    } catch (e) {
      console.error("Like failed:", e);
      setLocalLikes(post.likes || []);
    }
  };

  // ── Comment ───────────────────────────────────────────────────────────
  const handleComment = async () => {
    if (!user || !commentText.trim()) return;
    setIsCommenting(true);
    const optimistic = {
      id: `temp-${Date.now()}`,
      author: user.name,
      authorId: user.id,
      text: commentText,
      createdAt: Date.now(),
      isAI: false,
    };
    setLocalComments(prev => [...prev, optimistic]);
    const savedText = commentText;
    setCommentText("");
    try {
      const real = {
        id: Math.random().toString(36).substr(2, 9),
        author: user.name,
        authorId: user.id,
        text: savedText,
        createdAt: Date.now(),
        isAI: false,
      };
      await updateDoc(doc(db, "posts", post.id), { comments: arrayUnion(real) });
      setLocalComments(prev => prev.map(c => c.id === optimistic.id ? real : c));
    } catch (e) {
      setLocalComments(prev => prev.filter(c => c.id !== optimistic.id));
    } finally {
      setIsCommenting(false);
    }
  };

  // ── Translate ─────────────────────────────────────────────────────────
  const handleTranslate = async () => {
    setTranslateError(null);

    if (showTranslation) {
      setShowTranslation(false);
      return;
    }
    if (translatedContent) {
      setShowTranslation(true);
      return;
    }

    const lang = user?.preferredLanguage;
    if (!lang || lang === "English") {
      setTranslateError("Go to Profile and select a language first.");
      return;
    }

    setIsTranslating(true);
    try {
      const result = await geminiService.translateText(post.content, lang);
      if (result && result !== post.content) {
        setTranslatedContent(result);
        setShowTranslation(true);
      } else {
        setTranslateError("Translation failed. Try again.");
      }
    } catch (e) {
      setTranslateError("Translation failed. Try again.");
    } finally {
      setIsTranslating(false);
    }
  };

  // ── Text Selection for Highlight / Underline ──────────────────────────
  const handleTextSelection = () => {
    if (penMode === "none") return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

    const contentEl = contentRef.current;
    if (!contentEl) return;

    const range = selection.getRangeAt(0);
    if (!contentEl.contains(range.commonAncestorContainer)) return;

    // Get the plain text content of the div (same string as displayContent)
    const fullText = contentEl.innerText;

    // Build a range from the start of contentEl to selection start
    const preRange = document.createRange();
    preRange.setStart(contentEl, 0);
    preRange.setEnd(range.startContainer, range.startOffset);
    const start = preRange.toString().length;
    const selected = range.toString();
    if (!selected.trim()) return;
    const end = start + selected.length;

    // Validate offsets are within actual text
    if (end > fullText.length || start < 0) return;

    const newHighlight: Highlight = {
      id: Math.random().toString(36).substr(2, 9),
      start,
      end,
      type: penMode === "highlight" ? "highlight" : "underline",
      color: penMode === "highlight" ? "#FDE047" : "#10B981",
    };

    saveHighlights([...highlights, newHighlight]);
    selection.removeAllRanges();
  };

  // ── Render content with highlights ───────────────────────────────────
  // Uses displayContent directly (no word-splitting that shifts offsets)
  const renderContent = () => {
    if (highlights.length === 0) {
      return <span>{displayContent}</span>;
    }

    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    const sorted = [...highlights].sort((a, b) => a.start - b.start);

    for (const h of sorted) {
      const hStart = Math.min(h.start, displayContent.length);
      const hEnd = Math.min(h.end, displayContent.length);
      if (hStart > cursor) {
        nodes.push(<span key={`t-${cursor}`}>{displayContent.slice(cursor, hStart)}</span>);
      }
      if (hEnd > hStart) {
        nodes.push(
          <span key={h.id} style={{
            backgroundColor: h.type === "highlight" ? h.color : "transparent",
            textDecoration: h.type === "underline" ? `underline 2px ${h.color}` : "none",
            textUnderlineOffset: "3px",
            borderRadius: "2px",
          }}>
            {displayContent.slice(hStart, hEnd)}
          </span>
        );
      }
      cursor = hEnd;
    }

    if (cursor < displayContent.length) {
      nodes.push(<span key="tail">{displayContent.slice(cursor)}</span>);
    }

    return <>{nodes}</>;
  };

  const handleShare = () => {
    const text = `"${post.content.substring(0, 100)}..." — Readative`;
    if (navigator.share) {
      navigator.share({ title: "Readative Post", text, url: window.location.href }).catch(console.error);
    } else {
      navigator.clipboard.writeText(`${text}\n${window.location.href}`);
      alert("Copied to clipboard!");
    }
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
      <div className="p-6">

        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
              {post.author[0]}
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{post.author}</h3>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-400">{new Date(post.createdAt).toLocaleDateString()}</p>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium capitalize">
                  {CATEGORY_EMOJI[post.type]} {post.type}
                </span>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex gap-1 items-center">
            {/* Highlight */}
            <button onClick={() => setPenMode(penMode === "highlight" ? "none" : "highlight")}
              title="Highlight text"
              className={cn("p-2 rounded-lg transition-colors",
                penMode === "highlight" ? "bg-yellow-100 text-yellow-600" : "hover:bg-gray-100 text-gray-400")}>
              <Highlighter className="w-4 h-4" />
            </button>

            {/* Underline */}
            <button onClick={() => setPenMode(penMode === "underline" ? "none" : "underline")}
              title="Underline text"
              className={cn("p-2 rounded-lg transition-colors",
                penMode === "underline" ? "bg-emerald-100 text-emerald-600" : "hover:bg-gray-100 text-gray-400")}>
              <Underline className="w-4 h-4" />
            </button>

            {/* Clear highlights */}
            {highlights.length > 0 && (
              <button onClick={() => saveHighlights([])}
                title="Clear highlights"
                className="p-2 rounded-lg hover:bg-red-50 text-red-400 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Translate */}
            <button onClick={handleTranslate} disabled={isTranslating}
              title={showTranslation ? "Show original" : `Translate to ${user?.preferredLanguage || "selected language"}`}
              className={cn("p-2 rounded-lg transition-colors",
                showTranslation ? "bg-indigo-100 text-indigo-600" : "hover:bg-gray-100 text-gray-400")}>
              {isTranslating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
            </button>

            {/* TTS — play button only, no word highlighting to avoid offset issues */}
            <button onClick={() => {
              if ("speechSynthesis" in window) {
                if (isReading) {
                  window.speechSynthesis.cancel();
                  setIsReading(false);
                } else {
                  const utterance = new SpeechSynthesisUtterance(post.content);
                  utterance.onend = () => setIsReading(false);
                  utterance.onerror = () => setIsReading(false);
                  window.speechSynthesis.speak(utterance);
                  setIsReading(true);
                }
              }
            }}
              title="Read aloud"
              className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors">
              {isReading ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Pen mode hint */}
        {penMode !== "none" && (
          <div className={`text-xs px-3 py-1.5 rounded-lg mb-3 font-medium ${
            penMode === "highlight" ? "bg-yellow-50 text-yellow-700" : "bg-emerald-50 text-emerald-700"
          }`}>
            {penMode === "highlight" ? "✏️ Select text to highlight" : "✏️ Select text to underline"} · click icon again to stop
          </div>
        )}

        {/* Translation error */}
        {translateError && (
          <div className="text-xs px-3 py-1.5 rounded-lg mb-3 bg-red-50 text-red-600 flex items-center justify-between">
            {translateError}
            <button onClick={() => setTranslateError(null)}><X className="w-3 h-3" /></button>
          </div>
        )}

        {/* Translation badge */}
        {showTranslation && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
              🌐 {user?.preferredLanguage}
            </span>
            <button onClick={() => setShowTranslation(false)} className="text-xs text-gray-400 hover:text-gray-600 underline">
              original
            </button>
          </div>
        )}

        {/* Content — single div, no word splitting */}
        <div
          ref={contentRef}
          onMouseUp={handleTextSelection}
          className={cn(
            "text-base leading-relaxed text-gray-800 mb-4 whitespace-pre-wrap",
            penMode !== "none" ? "cursor-text select-text" : "select-text"
          )}
        >
          {renderContent()}
        </div>

        {/* Hashtags */}
        {post.hashtags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {post.hashtags.map((tag) => (
              <span key={tag} className="text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-black/5">
          <div className="flex items-center gap-4">
            <button onClick={handleLike} disabled={!user}
              className={cn("flex items-center gap-1.5 transition-all",
                isLiked ? "text-red-500" : "text-gray-400 hover:text-red-400")}>
              <Heart className={cn("w-5 h-5", isLiked ? "fill-current" : "")} />
              <span className="text-sm font-medium">{localLikes.length}</span>
            </button>
            <button onClick={() => setShowComments(!showComments)}
              className={cn("flex items-center gap-1.5 transition-colors",
                showComments ? "text-emerald-600" : "text-gray-500 hover:text-emerald-600")}>
              <MessageCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{localComments.length}</span>
            </button>
          </div>
          <button onClick={handleShare} className="text-gray-400 hover:text-emerald-600 transition-colors">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="bg-gray-50 p-6 border-t border-black/5 space-y-4">
          {user ? (
            <div className="flex gap-3">
              <input value={commentText} onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleComment()}
                placeholder="Add a comment..."
                className="flex-1 bg-white border border-black/5 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
              <button onClick={handleComment} disabled={isCommenting || !commentText.trim()}
                className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50">
                {isCommenting ? "..." : "Post"}
              </button>
            </div>
          ) : (
            <p className="text-center text-sm text-gray-400 py-2">Login to comment.</p>
          )}
          <div className="space-y-3">
            {localComments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <div className={cn("w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold",
                  comment.isAI ? "bg-emerald-100 text-emerald-600" : "bg-gray-200 text-gray-600")}>
                  {comment.isAI ? <Sparkles className="w-4 h-4" /> : comment.author[0]}
                </div>
                <div className={cn("p-3 rounded-2xl shadow-sm border flex-1",
                  comment.isAI ? "bg-emerald-50 border-emerald-100" : "bg-white border-black/5")}>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-bold text-gray-900">{comment.author}</p>
                    {comment.isAI && <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-bold">AI</span>}
                  </div>
                  <p className="text-sm text-gray-600">{comment.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
