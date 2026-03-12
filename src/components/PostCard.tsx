import { useState, useRef } from "react";
import { motion } from "motion/react";
import { Post, UserProfile } from "../types";
import { Heart, MessageCircle, Share2, Sparkles } from "lucide-react";
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
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);
  const [localLikes, setLocalLikes] = useState<string[]>(post.likes || []);
  const [localComments, setLocalComments] = useState(post.comments || []);

  const prevPostRef = useRef(post);
  if (post !== prevPostRef.current) {
    prevPostRef.current = post;
    setLocalLikes(post.likes || []);
    setLocalComments(post.comments || []);
  }

  const isLiked = user ? localLikes.includes(user.id) : false;

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

  const handleShare = () => {
    const text = `Check out this post on Readative!\n\n"${post.content.substring(0, 100)}..."`;
    if (navigator.share) {
      navigator.share({ title: "Readative Post", text, url: window.location.href }).catch(console.error);
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
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-lg">
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
        </div>

        {/* Content */}
        <div className="text-base leading-relaxed text-gray-800 mb-4 whitespace-pre-wrap">
          {post.content}
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
            <div className="text-center p-4 bg-gray-100 rounded-xl text-sm text-gray-500">Please login to comment.</div>
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
