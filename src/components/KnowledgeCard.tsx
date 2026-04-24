import { Fragment, useEffect, useState } from "react";
import { motion } from "motion/react";
import { KnowledgeComment, KnowledgeEntry, TaggedUser } from "../types";
import {
  BookOpenText,
  Heart,
  ImageIcon,
  MessageCircle,
  Share2,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import {
  getGuestId,
  getGuestName,
  saveGuestName,
} from "../utils/guestIdentity";
import {
  notifyCommentOnKnowledge,
  notifyLikeOnKnowledge,
  removeLikeNotification,
} from "../utils/notifications";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface KnowledgeCardProps {
  entry: KnowledgeEntry;
  onIdentityRequired: (action: {
    type: "like" | "comment";
    entryId: string;
  }) => void;
  onOpenProfile: (authorId: string) => void;
}

function renderTextWithMentions(
  text: string,
  mentions: TaggedUser[],
  onOpenProfile: (authorId: string) => void
) {
  const mentionMap = new Map(
    mentions.map((mention) => [mention.username.toLowerCase(), mention] as const)
  );

  return text.split(/(@[a-z0-9_]+)/gi).map((part, index) => {
    if (part.startsWith("@")) {
      const mention = mentionMap.get(part.slice(1).toLowerCase());
      if (mention) {
        return (
          <button
            key={`${mention.authorId}-${index}`}
            onClick={() => onOpenProfile(mention.authorId)}
            className="font-semibold text-emerald-700 underline underline-offset-2"
          >
            @{mention.username}
          </button>
        );
      }
    }

    return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
  });
}

export function KnowledgeCard({
  entry,
  onIdentityRequired,
  onOpenProfile,
}: KnowledgeCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);
  const [localLikes, setLocalLikes] = useState<string[]>(entry.likes || []);
  const [localComments, setLocalComments] = useState<KnowledgeComment[]>(
    entry.comments || []
  );
  const [pendingCommenter, setPendingCommenter] = useState<string | null>(null);
  const [guestName, setGuestName] = useState<string | null>(() => getGuestName());

  const guestId = getGuestId();
  const isLiked = localLikes.includes(guestId);
  const mentions = entry.mentions || [];

  useEffect(() => {
    setLocalLikes(entry.likes || []);
    setLocalComments(entry.comments || []);
  }, [entry.id, entry.likes, entry.comments]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{
        type: "like" | "comment";
        entryId: string;
        username: string;
      }>).detail;

      if (!detail || detail.entryId !== entry.id) return;

      const normalizedName = saveGuestName(detail.username);
      setGuestName(normalizedName);

      if (detail.type === "like") {
        void updateLike(true, normalizedName);
        return;
      }

      setShowComments(true);
      setPendingCommenter(normalizedName);
    };

    window.addEventListener("knowledge-action", handler);
    return () => window.removeEventListener("knowledge-action", handler);
  }, [entry.id, localLikes]);

  const updateLike = async (shouldLike: boolean, actorName?: string | null) => {
    const nextLikes = shouldLike
      ? [...localLikes, guestId]
      : localLikes.filter((id) => id !== guestId);

    setLocalLikes(nextLikes);

    try {
      await updateDoc(doc(db, "knowledge", entry.id), {
        likes: shouldLike ? arrayUnion(guestId) : arrayRemove(guestId),
      });

      if (shouldLike && actorName) {
        await notifyLikeOnKnowledge(entry, {
          authorId: guestId,
          username: actorName,
        });
      }

      if (!shouldLike) {
        await removeLikeNotification(entry.id, guestId);
      }
    } catch (error) {
      console.error("Failed to update like:", error);
      setLocalLikes(entry.likes || []);
    }
  };

  const handleLike = () => {
    if (isLiked) {
      void updateLike(false, guestName);
      return;
    }

    if (guestName) {
      void updateLike(true, guestName);
      return;
    }

    onIdentityRequired({ type: "like", entryId: entry.id });
  };

  const handleComment = async (authorName: string) => {
    const normalizedName = saveGuestName(authorName);
    const content = commentText.trim();
    if (!normalizedName || !content) return;

    setGuestName(normalizedName);
    setPendingCommenter(null);
    setIsCommenting(true);

    const optimisticComment: KnowledgeComment = {
      id: `temp-${Date.now()}`,
      author: normalizedName,
      authorId: guestId,
      text: content,
      createdAt: Date.now(),
    };

    setLocalComments((current) => [...current, optimisticComment]);
    setCommentText("");

    try {
      const savedComment: KnowledgeComment = {
        id: Math.random().toString(36).slice(2, 11),
        author: normalizedName,
        authorId: guestId,
        text: content,
        createdAt: Date.now(),
      };

      await updateDoc(doc(db, "knowledge", entry.id), {
        comments: arrayUnion(savedComment),
      });

      await notifyCommentOnKnowledge(
        entry,
        {
          authorId: guestId,
          username: normalizedName,
        },
        savedComment
      );

      setLocalComments((current) =>
        current.map((comment) =>
          comment.id === optimisticComment.id ? savedComment : comment
        )
      );
    } catch (error) {
      console.error("Failed to save comment:", error);
      setLocalComments((current) =>
        current.filter((comment) => comment.id !== optimisticComment.id)
      );
      setCommentText(content);
    } finally {
      setIsCommenting(false);
    }
  };

  const handleCommentSubmit = () => {
    if (!commentText.trim()) return;

    const name = pendingCommenter || guestName;
    if (name) {
      void handleComment(name);
      return;
    }

    onIdentityRequired({ type: "comment", entryId: entry.id });
  };

  const handleShare = async () => {
    const text = `${entry.title}\n\n${entry.content.slice(0, 160)}${
      entry.content.length > 160 ? "..." : ""
    }`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: entry.title,
          text,
          url: window.location.href,
        });
        return;
      } catch (error) {
        console.error("Share cancelled or failed:", error);
      }
    }

    await navigator.clipboard.writeText(`${text}\n\n${window.location.href}`);
    alert("Knowledge link copied to clipboard!");
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
    >
      {entry.imageDataUrl && (
        <div className="relative h-64 overflow-hidden bg-slate-100">
          <img
            src={entry.imageDataUrl}
            alt={entry.title}
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-transparent" />
          <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-700 backdrop-blur">
            <ImageIcon className="h-3.5 w-3.5" />
            Visual Insight
          </div>
        </div>
      )}

      <div className="p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenProfile(entry.authorId)}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 via-teal-100 to-cyan-100 text-lg font-black text-emerald-700"
            >
              {entry.author[0]?.toUpperCase() || "K"}
            </button>
            <div>
              <button
                onClick={() => onOpenProfile(entry.authorId)}
                className="text-left text-sm font-bold text-slate-900 transition-colors hover:text-emerald-700"
              >
                @{entry.author}
              </button>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <BookOpenText className="h-3.5 w-3.5" />
                  Knowledge
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
            Insight Drop
          </div>
        </div>

        <h3 className="text-2xl font-black leading-tight tracking-tight text-slate-950">
          {entry.title}
        </h3>
        <p className="mt-4 whitespace-pre-wrap text-[15px] leading-7 text-slate-600">
          {renderTextWithMentions(entry.content, mentions, onOpenProfile)}
        </p>

        {entry.hashtags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {entry.hashtags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {mentions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {mentions.map((mention) => (
              <button
                key={`${mention.authorId}-${mention.username}`}
                onClick={() => onOpenProfile(mention.authorId)}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
              >
                @{mention.username}
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
          <div className="flex items-center gap-5">
            <button
              onClick={handleLike}
              className={cn(
                "flex items-center gap-1.5 text-sm font-semibold transition-colors",
                isLiked ? "text-rose-500" : "text-slate-400 hover:text-rose-500"
              )}
            >
              <Heart className={cn("h-5 w-5", isLiked ? "fill-current" : "")} />
              <span>{localLikes.length}</span>
            </button>

            <button
              onClick={() => setShowComments((current) => !current)}
              className={cn(
                "flex items-center gap-1.5 text-sm font-semibold transition-colors",
                showComments
                  ? "text-emerald-600"
                  : "text-slate-400 hover:text-emerald-600"
              )}
            >
              <MessageCircle className="h-5 w-5" />
              <span>{localComments.length}</span>
            </button>
          </div>

          <button
            onClick={() => void handleShare()}
            className="text-slate-400 transition-colors hover:text-emerald-600"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {showComments && (
        <div className="border-t border-slate-100 bg-slate-50/70 p-6">
          {guestName && (
            <p className="mb-3 text-xs text-slate-400">
              Commenting as{" "}
              <span className="font-semibold text-slate-600">@{guestName}</span>
            </p>
          )}

          <div className="flex gap-3">
            <input
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              onKeyDown={(event) =>
                event.key === "Enter" && !event.shiftKey && handleCommentSubmit()
              }
              placeholder={
                pendingCommenter
                  ? `Commenting as @${pendingCommenter}...`
                  : "Add your thought..."
              }
              className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
            />
            <button
              onClick={handleCommentSubmit}
              disabled={isCommenting || !commentText.trim()}
              className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
            >
              {isCommenting ? "..." : "Post"}
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {localComments.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-center text-sm text-slate-400">
                No comments yet. Start the discussion.
              </p>
            ) : (
              localComments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      @{comment.author}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(comment.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm leading-6 text-slate-600">
                    {comment.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </motion.article>
  );
}
