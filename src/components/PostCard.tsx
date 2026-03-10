import { useState, useRef } from "react";
import { motion } from "motion/react";
import { Post, UserProfile, Highlight } from "../types";
import { geminiService } from "../services/gemini";
import { Heart, MessageCircle, Share2, Play, Pause, Highlighter, Underline, Languages, Loader2, Sparkles } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
  story: '📖', joke: '😄', motivation: '🔥',
  poetry: '🌸', shayari: '🌙', knowledge: '💡', questions: '❓',
};

export function PostCard({ post, user, refreshProfile, onUpdate }: PostCardProps) {
  const [isReading, setIsReading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);
  const [penMode, setPenMode] = useState<'none' | 'highlight' | 'underline'>('none');
  const [highlights, setHighlights] = useState<Highlight[]>(post.highlights || []);
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  // Local state for live updates without re-fetch
  const [localLikes, setLocalLikes] = useState<string[]>(post.likes || []);
  const [localComments, setLocalComments] = useState(post.comments || []);

  // Sync comments from server polling (via prop update)
  const prevCommentsRef = useRef(post.comments);
  if (post.comments !== prevCommentsRef.current) {
    prevCommentsRef.current = post.comments;
    // Only update if server has more comments (don't overwrite local optimistic adds)
    if (post.comments.length > localComments.length) {
      setLocalComments(post.comments);
    }
  }

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const words = (showTranslation && translatedContent ? translatedContent : post.content).split(/\s+/);
  const isLiked = user ? localLikes.includes(user.id) : false;

  const handleLike = async () => {
    if (!user) return;
    // Optimistic update — instant feedback
    const newLikes = isLiked
      ? localLikes.filter((id) => id !== user.id)
      : [...localLikes, user.id];
    setLocalLikes(newLikes);

    try {
      const res = await fetch(`/api/posts/${post.id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (!res.ok) throw new Error(`Failed to like post (${res.status})`);
      const data = await res.json();
      setLocalLikes(data.likes);
    } catch {
      // Revert on error
      setLocalLikes(post.likes || []);
    }
  };

  const handleTranslate = async () => {
    if (showTranslation) { setShowTranslation(false); return; }
    if (translatedContent) { setShowTranslation(true); return; }
    if (!user?.preferredLanguage || user.preferredLanguage === "English") {
      alert("Please select a target language in your Profile settings first.");
      return;
    }
    setIsTranslating(true);
    try {
      const translated = await geminiService.translateText(post.content, user.preferredLanguage);
      setTranslatedContent(translated);
      setShowTranslation(true);
    } catch (error) {
      console.error("Translation failed", error);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleTTS = async () => {
    if (isReading) { audioRef.current?.pause(); setIsReading(false); return; }
    if (!audioUrl) {
      const url = await geminiService.generateTTS(post.content);
      if (url) {
        setAudioUrl(url);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onplay = () => setIsReading(true);
        audio.onpause = () => setIsReading(false);
        audio.onended = () => { setIsReading(false); setCurrentWordIndex(-1); };
        audio.onloadedmetadata = () => {
          const durationPerWord = audio.duration / words.length;
          audio.ontimeupdate = () => setCurrentWordIndex(Math.floor(audio.currentTime / durationPerWord));
        };
        audio.play();
      }
    } else {
      audioRef.current?.play();
    }
    if (user && !user.readPosts.includes(post.id)) {
      try {
        await fetch(`/api/profile/${user.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...user, readingScore: user.readingScore + 10, readPosts: [...user.readPosts, post.id] }),
        });
      } catch (error) {
        console.error("Failed to update reading profile:", error);
      }
      refreshProfile();
    }
  };

  const handleComment = async () => {
    if (!user || !commentText.trim()) return;
    setIsCommenting(true);

    // Optimistic comment — appears instantly
    const optimisticComment = {
      id: `temp-${Date.now()}`,
      author: user.name,
      authorId: user.id,
      text: commentText,
      createdAt: Date.now(),
      isAI: false,
    };
    setLocalComments(prev => [...prev, optimisticComment]);
    setCommentText("");

    try {
      const res = await fetch(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author: user.name,
          authorId: user.id,
          text: optimisticComment.text,
        }),
      });
      if (!res.ok) throw new Error(`Failed to comment (${res.status})`);
      const savedComment = await res.json();
      // Replace optimistic comment with real one from server
      setLocalComments(prev => prev.map(c => c.id === optimisticComment.id ? savedComment : c));
      // Poll for AI reply after delay
      setTimeout(() => onUpdate(), 3000);
    } catch (error) {
      console.error("Failed to add comment:", error);
      // Remove optimistic comment on error
      setLocalComments(prev => prev.filter(c => c.id !== optimisticComment.id));
    } finally {
      setIsCommenting(false);
    }
  };

  const handleTextSelection = () => {
    if (penMode === 'none') return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(contentRef.current!);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    const start = preSelectionRange.toString().length;
    const end = start + range.toString().length;
    setHighlights([...highlights, {
      id: Math.random().toString(36).substr(2, 9),
      start, end,
      type: penMode === 'highlight' ? 'highlight' : 'underline',
      color: penMode === 'highlight' ? '#FDE047' : '#10B981',
    }]);
    selection.removeAllRanges();
  };

  const renderContent = () => {
    const contentToRender = showTranslation && translatedContent ? translatedContent : post.content;
    if (showTranslation) return <div className="whitespace-pre-wrap">{contentToRender}</div>;
    if (highlights.length === 0) {
      return words.map((word, i) => (
        <span key={i} className={cn("transition-colors duration-200",
          currentWordIndex === i ? "bg-emerald-200 text-emerald-900 rounded px-0.5" : "")}>
          {word}{" "}
        </span>
      ));
    }
    let result: React.ReactNode[] = [];
    let lastIndex = 0;
    const sortedHighlights = [...highlights].sort((a, b) => a.start - b.start);
    sortedHighlights.forEach((h) => {
      if (h.start > lastIndex) result.push(contentToRender.substring(lastIndex, h.start));
      result.push(
        <span key={h.id} style={{
          backgroundColor: h.type === 'highlight' ? h.color : 'transparent',
          textDecoration: h.type === 'underline' ? `underline 2px ${h.color}` : 'none',
          textUnderlineOffset: '4px',
        }} className="rounded-sm px-0.5">
          {contentToRender.substring(h.start, h.end)}
        </span>
      );
      lastIndex = h.end;
    });
    if (lastIndex < contentToRender.length) result.push(contentToRender.substring(lastIndex));
    return result;
  };

  const handleShare = () => {
    const text = `Check out this post on Readative!\n\n"${post.content.substring(0, 100)}..."`;
    if (navigator.share) {
      navigator.share({ title: 'Readative Post', text, url: window.location.href }).catch(console.error);
    } else {
      navigator.clipboard.writeText(`${text}\n\n${window.location.href}`);
      alert("Link copied to clipboard!");
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
          {/* Tools */}
          <div className="flex gap-1">
            <button onClick={() => setPenMode(penMode === 'highlight' ? 'none' : 'highlight')} title="Highlight"
              className={cn("p-2 rounded-lg transition-colors", penMode === 'highlight' ? "bg-yellow-100 text-yellow-600" : "hover:bg-gray-100 text-gray-400")}>
              <Highlighter className="w-4 h-4" />
            </button>
            <button onClick={() => setPenMode(penMode === 'underline' ? 'none' : 'underline')} title="Underline"
              className={cn("p-2 rounded-lg transition-colors", penMode === 'underline' ? "bg-emerald-100 text-emerald-600" : "hover:bg-gray-100 text-gray-400")}>
              <Underline className="w-4 h-4" />
            </button>
            <button onClick={handleTranslate} title={showTranslation ? "Show Original" : "Translate"} disabled={isTranslating}
              className={cn("p-2 rounded-lg transition-colors", showTranslation ? "bg-indigo-100 text-indigo-600" : "hover:bg-gray-100 text-gray-400")}>
              {isTranslating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
            </button>
            <button onClick={handleTTS} title="Read Aloud"
              className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors">
              {isReading ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Content */}
        <div ref={contentRef} onMouseUp={handleTextSelection}
          className="text-lg leading-relaxed text-gray-800 mb-4 whitespace-pre-wrap selection:bg-emerald-100">
          {renderContent()}
        </div>

        {/* Hashtags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {post.hashtags?.map((tag) => (
            <span key={tag} className="text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              #{tag}
            </span>
          ))}
        </div>

        {/* Actions — rating removed */}
        <div className="flex items-center justify-between pt-4 border-t border-black/5">
          <div className="flex items-center gap-4">
            {/* Like */}
            <button onClick={handleLike} disabled={!user}
              className={cn("flex items-center gap-1.5 transition-all", isLiked ? "text-red-500 scale-110" : "text-gray-400 hover:text-red-400")}>
              <Heart className={cn("w-5 h-5 transition-all", isLiked ? "fill-current" : "")} />
              <span className="text-sm font-medium">{localLikes.length}</span>
            </button>
            {/* Comments */}
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

      {/* Comments Section */}
      {showComments && (
        <div className="bg-gray-50 p-6 border-t border-black/5 space-y-4">
          {user ? (
            <div className="flex gap-3">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleComment()}
                placeholder="Add a comment..."
                className="flex-1 bg-white border border-black/5 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <button onClick={handleComment} disabled={isCommenting || !commentText.trim()}
                className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50">
                {isCommenting ? "..." : "Post"}
              </button>
            </div>
          ) : (
            <div className="text-center p-4 bg-gray-100 rounded-xl text-sm text-gray-500">Please login to comment.</div>
          )}

          <div className="space-y-3">
            {localComments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold",
                  comment.isAI ? "bg-emerald-100 text-emerald-600" : "bg-gray-200 text-gray-600"
                )}>
                  {comment.isAI ? <Sparkles className="w-4 h-4" /> : comment.author[0]}
                </div>
                <div className={cn(
                  "p-3 rounded-2xl shadow-sm border flex-1",
                  comment.isAI ? "bg-emerald-50 border-emerald-100" : "bg-white border-black/5"
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-bold text-gray-900">{comment.author}</p>
                    {comment.isAI && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-bold">AI</span>
                    )}
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
