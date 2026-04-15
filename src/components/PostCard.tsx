import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Post, Comment } from "../types";
import { Heart, MessageCircle, Share2, Sparkles } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { doc, updateDoc, arrayRemove, arrayUnion } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { UsernameAction } from "./Feed";
import { getGuestId, getGuestName, saveGuestName } from "../utils/guestIdentity";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PostCardProps {
  post: Post;
  onGuestAction: (action: UsernameAction) => void;
}

const CATEGORY_EMOJI: Record<string, string> = {
  story: "📖",
  joke: "😄",
  motivation: "🔥",
  poetry: "🌸",
  shayari: "🌙",
  knowledge: "💡",
  questions: "❓",
};

export function PostCard({ post, onGuestAction }: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);
  const [localLikes, setLocalLikes] = useState<string[]>(post.likes || []);
  const [localComments, setLocalComments] = useState<Comment[]>(post.comments || []);
  const [pendingCommenter, setPendingCommenter] = useState<string | null>(null);
  const [guestName, setGuestName] = useState<string | null>(() => getGuestName());

  const guestId = getGuestId();
  const isLiked = localLikes.includes(guestId);

  useEffect(() => {
    setLocalLikes(post.likes || []);
    setLocalComments(post.comments || []);
  }, [post.id, post.likes, post.comments]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{
        type: "like" | "comment";
        postId: string;
        username: string;
      }>).detail;

      if (!detail || detail.postId !== post.id) return;

      const savedName = saveGuestName(detail.username);
      setGuestName(savedName);

      if (detail.type === "like") {
        void executeLike(true);
        return;
      }

      setShowComments(true);
      setPendingCommenter(savedName);
    };

    window.addEventListener("guest-action", handler);
    return () => window.removeEventListener("guest-action", handler);
  }, [post.id, localLikes]);

  const executeLike = async (shouldLike: boolean) => {
    const nextLikes = shouldLike
      ? [...localLikes, guestId]
      : localLikes.filter((id) => id !== guestId);

    setLocalLikes(nextLikes);

    try {
      await updateDoc(doc(db, "posts", post.id), {
        likes: shouldLike ? arrayUnion(guestId) : arrayRemove(guestId),
      });
    } catch (error) {
      console.error("Like failed:", error);
      setLocalLikes(post.likes || []);
    }
  };

  const handleLike = () => {
    if (isLiked) {
      void executeLike(false);
      return;
    }

    if (guestName) {
      void executeLike(true);
      return;
    }

    onGuestAction({ type: "like", postId: post.id });
  };

  const handleComment = async (authorName: string) => {
    const normalizedName = saveGuestName(authorName);
    if (!normalizedName || !commentText.trim()) return;

    setGuestName(normalizedName);
    setPendingCommenter(null);
    setIsCommenting(true);

    const savedText = commentText.trim();
    const optimistic: Comment = {
      id: `temp-${Date.now()}`,
      author: normalizedName,
      authorId: guestId,
      text: savedText,
      createdAt: Date.now(),
      isAI: false,
    };

    setLocalComments((prev) => [...prev, optimistic]);
    setCommentText("");

    try {
      const realComment: Comment = {
        id: Math.random().toString(36).slice(2, 11),
        author: normalizedName,
        authorId: guestId,
        text: savedText,
        createdAt: Date.now(),
        isAI: false,
      };

      await updateDoc(doc(db, "posts", post.id), {
        comments: arrayUnion(realComment),
      });

      setLocalComments((prev) =>
        prev.map((comment) =>
          comment.id === optimistic.id ? realComment : comment
        )
      );
    } catch (error) {
      console.error("Comment failed:", error);
      setLocalComments((prev) =>
        prev.filter((comment) => comment.id !== optimistic.id)
      );
      setCommentText(savedText);
    } finally {
      setIsCommenting(false);
    }
  };

  const handleCommentSubmit = () => {
    if (!commentText.trim()) return;

    const commenterName = pendingCommenter || guestName;
    if (commenterName) {
      void handleComment(commenterName);
      return;
    }

    onGuestAction({ type: "comment", postId: post.id });
  };

  const handleShare = () => {
    const text = `Check out this post on Readative!\n\n"${post.content.substring(
      0,
      100
    )}..."`;

    if (navigator.share) {
      navigator
        .share({
          title: "Readative Post",
          text,
          url: window.location.href,
        })
        .catch(console.error);
      return;
    }

    navigator.clipboard.writeText(`${text}\n\n${window.location.href}`);
    alert("Link copied to clipboard!");
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
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-lg">
              {post.author[0]}
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{post.author}</h3>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-400">
                  {new Date(post.createdAt).toLocaleDateString()}
                </p>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium capitalize">
                  {CATEGORY_EMOJI[post.type]} {post.type}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-base leading-relaxed text-gray-800 mb-4 whitespace-pre-wrap">
          {post.content}
        </div>

        {post.hashtags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {post.hashtags.map((tag) => (
              <span
                key={tag}
                className="text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-black/5">
          <div className="flex items-center gap-4">
            <button
              onClick={handleLike}
              className={cn(
                "flex items-center gap-1.5 transition-all",
                isLiked ? "text-red-500" : "text-gray-400 hover:text-red-400"
              )}
            >
              <Heart className={cn("w-5 h-5", isLiked ? "fill-current" : "")} />
              <span className="text-sm font-medium">{localLikes.length}</span>
            </button>

            <button
              onClick={() => setShowComments((current) => !current)}
              className={cn(
                "flex items-center gap-1.5 transition-colors",
                showComments
                  ? "text-emerald-600"
                  : "text-gray-500 hover:text-emerald-600"
              )}
            >
              <MessageCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{localComments.length}</span>
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
          {guestName && (
            <p className="text-xs text-gray-400">
              Commenting as <span className="font-semibold text-gray-600">@{guestName}</span>
            </p>
          )}

          <div className="flex gap-3">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && handleCommentSubmit()
              }
              placeholder={
                pendingCommenter
                  ? `Commenting as @${pendingCommenter}...`
                  : "Add a comment..."
              }
              className="flex-1 bg-white border border-black/5 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <button
              onClick={handleCommentSubmit}
              disabled={isCommenting || !commentText.trim()}
              className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
            >
              {isCommenting ? "..." : "Post"}
            </button>
          </div>

          <div className="space-y-3">
            {localComments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold",
                    comment.isAI
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-gray-200 text-gray-600"
                  )}
                >
                  {comment.isAI ? (
                    <Sparkles className="w-4 h-4" />
                  ) : (
                    comment.author[0]
                  )}
                </div>

                <div
                  className={cn(
                    "p-3 rounded-2xl shadow-sm border flex-1",
                    comment.isAI
                      ? "bg-emerald-50 border-emerald-100"
                      : "bg-white border-black/5"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-bold text-gray-900">
                      {comment.author}
                    </p>
                    {comment.isAI && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-bold">
                        AI
                      </span>
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
