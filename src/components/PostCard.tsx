import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { Post, UserProfile, Highlight } from "../types";
import { geminiService } from "../services/gemini";
import { Star, MessageCircle, Share2, Play, Pause, PenTool, Highlighter, Underline, Languages, Loader2 } from "lucide-react";
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

export function PostCard({ post, user, refreshProfile, onUpdate }: PostCardProps) {
  const [isReading, setIsReading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [penMode, setPenMode] = useState<'none' | 'highlight' | 'underline'>('none');
  const [highlights, setHighlights] = useState<Highlight[]>(post.highlights || []);
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const words = (showTranslation && translatedContent ? translatedContent : post.content).split(/\s+/);

  const handleTranslate = async () => {
    if (showTranslation) {
      setShowTranslation(false);
      return;
    }

    if (translatedContent) {
      setShowTranslation(true);
      return;
    }

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
    if (isReading) {
      audioRef.current?.pause();
      setIsReading(false);
      return;
    }

    if (!audioUrl) {
      const url = await geminiService.generateTTS(post.content);
      if (url) {
        setAudioUrl(url);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onplay = () => setIsReading(true);
        audio.onpause = () => setIsReading(false);
        audio.onended = () => {
          setIsReading(false);
          setCurrentWordIndex(-1);
        };
        
        // Simple word highlighting simulation based on duration
        // Real word highlighting requires timestamped audio, but we can approximate
        const totalDuration = 0; // Will be set when loaded
        audio.onloadedmetadata = () => {
          const durationPerWord = audio.duration / words.length;
          audio.ontimeupdate = () => {
            const index = Math.floor(audio.currentTime / durationPerWord);
            setCurrentWordIndex(index);
          };
        };
        audio.play();
      }
    } else {
      audioRef.current?.play();
    }

    // Mark as read
    if (user && !user.readPosts.includes(post.id)) {
      const updatedReadPosts = [...user.readPosts, post.id];
      await fetch(`/api/profile/${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...user, readingScore: user.readingScore + 10, readPosts: updatedReadPosts })
      });
      refreshProfile();
    }
  };

  const handleRate = async (stars: number) => {
    if (!user) {
      alert("Please login to rate posts.");
      return;
    }
    await fetch(`/api/posts/${post.id}/rate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stars })
    });
    onUpdate();
  };

  const handleComment = async () => {
    if (!user) {
      alert("Please login to comment.");
      return;
    }
    if (!commentText.trim()) return;
    await fetch(`/api/posts/${post.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: Math.random().toString(36).substr(2, 9),
        author: user?.name || "Reader",
        text: commentText,
        createdAt: Date.now()
      })
    });
    setCommentText("");
    onUpdate();
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

    const newHighlight: Highlight = {
      id: Math.random().toString(36).substr(2, 9),
      start,
      end,
      type: penMode === 'highlight' ? 'highlight' : 'underline',
      color: penMode === 'highlight' ? '#FDE047' : '#10B981'
    };

    setHighlights([...highlights, newHighlight]);
    selection.removeAllRanges();
  };

  const renderContent = () => {
    const contentToRender = showTranslation && translatedContent ? translatedContent : post.content;
    
    // If showing translation, disable highlights for now as indices won't match
    if (showTranslation) {
      return (
        <div className="whitespace-pre-wrap">
          {contentToRender}
        </div>
      );
    }

    let result: React.ReactNode[] = [];
    let lastIndex = 0;

    // Sort highlights by start position
    const sortedHighlights = [...highlights].sort((a, b) => a.start - b.start);

    sortedHighlights.forEach((h, i) => {
      // Add text before highlight
      if (h.start > lastIndex) {
        result.push(contentToRender.substring(lastIndex, h.start));
      }
      // Add highlighted text
      result.push(
        <span 
          key={h.id} 
          style={{ 
            backgroundColor: h.type === 'highlight' ? h.color : 'transparent',
            textDecoration: h.type === 'underline' ? `underline 2px ${h.color}` : 'none',
            textUnderlineOffset: '4px'
          }}
          className="rounded-sm px-0.5"
        >
          {contentToRender.substring(h.start, h.end)}
        </span>
      );
      lastIndex = h.end;
    });

    // Add remaining text
    if (lastIndex < contentToRender.length) {
      result.push(contentToRender.substring(lastIndex));
    }

    // If no highlights, just return words for TTS highlighting
    if (highlights.length === 0) {
      return words.map((word, i) => (
        <span 
          key={i} 
          className={cn(
            "transition-colors duration-200",
            currentWordIndex === i ? "bg-emerald-200 text-emerald-900 rounded px-0.5" : ""
          )}
        >
          {word}{" "}
        </span>
      ));
    }

    return result;
  };

  const handleShare = () => {
    const highlightCount = highlights.length;
    const text = `Check out this post on Readative! I've marked ${highlightCount} important parts.\n\n"${post.content.substring(0, 100)}..."`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Readative Post',
        text: text,
        url: window.location.href,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(`${text}\n\n${window.location.href}`);
      alert("Link with highlights copied to clipboard!");
    }
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden"
    >
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
              {post.author[0]}
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{post.author}</h3>
              <p className="text-xs text-gray-400">{new Date(post.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setPenMode(penMode === 'highlight' ? 'none' : 'highlight')}
              title="Highlight Tool"
              className={cn("p-2 rounded-lg transition-colors", penMode === 'highlight' ? "bg-yellow-100 text-yellow-600" : "hover:bg-gray-100 text-gray-400")}
            >
              <Highlighter className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setPenMode(penMode === 'underline' ? 'none' : 'underline')}
              title="Underline Tool"
              className={cn("p-2 rounded-lg transition-colors", penMode === 'underline' ? "bg-emerald-100 text-emerald-600" : "hover:bg-gray-100 text-gray-400")}
            >
              <Underline className="w-4 h-4" />
            </button>
            <button 
              onClick={handleTranslate}
              title={showTranslation ? "Show Original" : "Translate"}
              disabled={isTranslating}
              className={cn(
                "p-2 rounded-lg transition-colors flex items-center gap-1", 
                showTranslation ? "bg-indigo-100 text-indigo-600" : "hover:bg-gray-100 text-gray-400"
              )}
            >
              {isTranslating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
              {showTranslation && <span className="text-xs font-bold">Original</span>}
            </button>
            <button 
              onClick={handleTTS}
              title="Read Aloud"
              className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors"
            >
              {isReading ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div 
          ref={contentRef}
          onMouseUp={handleTextSelection}
          className="text-lg leading-relaxed text-gray-800 mb-4 whitespace-pre-wrap selection:bg-emerald-100"
        >
          {renderContent()}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {post.hashtags.map((tag) => (
            <span key={tag} className="text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-black/5">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button 
                  key={s} 
                  onClick={() => handleRate(s)}
                  className={cn("transition-colors", s <= Math.round(post.stars) ? "text-yellow-400" : "text-gray-200 hover:text-yellow-200")}
                >
                  <Star className="w-5 h-5 fill-current" />
                </button>
              ))}
              <span className="text-xs font-bold text-gray-400 ml-1">{post.stars.toFixed(1)}</span>
            </div>
            <button 
              onClick={() => setShowComments(!showComments)}
              className="flex items-center gap-1.5 text-gray-500 hover:text-emerald-600 transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{post.comments.length}</span>
            </button>
          </div>
          <button 
            onClick={handleShare}
            className="text-gray-400 hover:text-emerald-600 transition-colors"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {showComments && (
        <div className="bg-gray-50 p-6 border-t border-black/5 space-y-4">
          {user ? (
            <div className="flex gap-3">
              <input 
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 bg-white border border-black/5 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <button 
                onClick={handleComment}
                className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700"
              >
                Post
              </button>
            </div>
          ) : (
            <div className="text-center p-4 bg-gray-100 rounded-xl text-sm text-gray-500">
              Please login to comment.
            </div>
          )}
          <div className="space-y-3">
            {post.comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center text-xs font-bold">
                  {comment.author[0]}
                </div>
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-black/5 flex-1">
                  <p className="text-xs font-bold text-gray-900 mb-1">{comment.author}</p>
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
