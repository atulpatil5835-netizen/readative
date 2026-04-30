import { useEffect, useMemo, useRef, useState } from "react";
import { KnowledgeComment, KnowledgeEntry, TaggedUser, UserProfile } from "../types";
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
  notifyTaggedUsersOnComment,
  removeLikeNotification,
} from "../utils/notifications";
import { moderateContent } from "../utils/contentModeration";
import { renderRichText } from "../utils/renderRichText";
import { queueLegacyKnowledgeImageMigration } from "../utils/knowledgeImages";
import { buildAbsoluteRouteUrl, navigateToRoute } from "../utils/routes";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface KnowledgeCardProps {
  entry: KnowledgeEntry;
  profiles?: UserProfile[];
  onIdentityRequired: (action: {
    type: "like" | "comment";
    entryId: string;
  }) => void;
  onOpenProfile: (authorId: string) => void;
  onOpenEntry: (entryId: string) => void;
  onSelectHashtag?: (tag: string) => void;
  highlighted?: boolean;
}

function estimateReadMinutes(text: string) {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(wordCount / 180) || 1);
}

interface CommentMentionState {
  query: string;
  start: number;
}

function extractMentionKeys(text: string): string[] {
  return [
    ...new Set(
      [...text.matchAll(/(?:^|\s)@([a-z0-9_]{1,20})/gi)].map((match) =>
        match[1].toLowerCase()
      )
    ),
  ];
}

function resolveMentions(text: string, profiles: UserProfile[]): TaggedUser[] {
  const profileMap = new Map(
    profiles.map((profile) => [profile.usernameLower, profile] as const)
  );

  return extractMentionKeys(text)
    .map((usernameLower) => profileMap.get(usernameLower))
    .filter((profile): profile is UserProfile => Boolean(profile))
    .map((profile) => ({
      authorId: profile.id,
      username: profile.username,
    }));
}

export function KnowledgeCard({
  entry,
  profiles = [],
  onIdentityRequired,
  onOpenProfile,
  onOpenEntry,
  onSelectHashtag,
  highlighted = false,
}: KnowledgeCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);
  const [isModeratingComment, setIsModeratingComment] = useState(false);
  const [commentMessage, setCommentMessage] = useState<string | null>(null);
  const [interactionMessage, setInteractionMessage] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [localLikes, setLocalLikes] = useState<string[]>(entry.likes || []);
  const [localComments, setLocalComments] = useState<KnowledgeComment[]>(
    entry.comments || []
  );
  const [pendingCommenter, setPendingCommenter] = useState<string | null>(null);
  const [activeCommentMention, setActiveCommentMention] =
    useState<CommentMentionState | null>(null);
  const [guestName, setGuestName] = useState<string | null>(() => getGuestName());
  const commentInputRef = useRef<HTMLInputElement | null>(null);

  const guestId = getGuestId();
  const isLiked = localLikes.includes(guestId);
  const mentions = entry.mentions || [];
  const readingMinutes = estimateReadMinutes(entry.content);
  const filteredCommentMentionProfiles = useMemo(() => {
    if (!activeCommentMention) return [];

    return profiles
      .filter((profile) =>
        profile.usernameLower.startsWith(activeCommentMention.query.toLowerCase())
      )
      .slice(0, 6);
  }, [activeCommentMention, profiles]);

  useEffect(() => {
    setLocalLikes(entry.likes || []);
    setLocalComments(entry.comments || []);
  }, [entry.id, entry.likes, entry.comments]);

  useEffect(() => {
    queueLegacyKnowledgeImageMigration(entry);
  }, [entry]);

  useEffect(() => {
    if (!shareCopied) return;
    const timeout = window.setTimeout(() => setShareCopied(false), 2200);
    return () => window.clearTimeout(timeout);
  }, [shareCopied]);

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

  const updateCommentMentionState = (value: string, cursorPosition: number) => {
    const beforeCursor = value.slice(0, cursorPosition);
    const match = beforeCursor.match(/(?:^|\s)@([a-z0-9_]*)$/i);

    if (!match) {
      setActiveCommentMention(null);
      return;
    }

    const atIndex = beforeCursor.lastIndexOf("@");
    setActiveCommentMention({
      query: match[1].toLowerCase(),
      start: atIndex,
    });
  };

  const handleCommentMentionInsert = (profile: UserProfile) => {
    if (!activeCommentMention || !commentInputRef.current) return;

    const input = commentInputRef.current;
    const cursor = input.selectionStart || commentText.length;
    const before = commentText.slice(0, activeCommentMention.start);
    const after = commentText.slice(cursor);
    const inserted = `@${profile.username} `;
    const nextValue = `${before}${inserted}${after}`;

    setCommentText(nextValue);
    setActiveCommentMention(null);

    requestAnimationFrame(() => {
      input.focus();
      const nextCursor = before.length + inserted.length;
      input.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const updateLike = async (shouldLike: boolean, actorName?: string | null) => {
    const nextLikes = shouldLike
      ? [...localLikes, guestId]
      : localLikes.filter((id) => id !== guestId);

    setLocalLikes(nextLikes);
    setInteractionMessage(null);

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
      setInteractionMessage("Could not update the like right now. Please try again.");
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
    const commentMentions = resolveMentions(content, profiles);

    setCommentMessage(null);
    setInteractionMessage(null);
    setIsModeratingComment(true);

    const moderation = await moderateContent("knowledge-comment", {
      content,
    });

    if (!moderation.allowed) {
      setCommentMessage(moderation.message);
      setIsModeratingComment(false);
      return;
    }

    setGuestName(normalizedName);
    setPendingCommenter(null);
    setIsCommenting(true);
    setIsModeratingComment(false);
    setActiveCommentMention(null);

    const optimisticComment: KnowledgeComment = {
      id: `temp-${Date.now()}`,
      author: normalizedName,
      authorId: guestId,
      text: content,
      mentions: commentMentions,
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
        mentions: commentMentions,
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

      await notifyTaggedUsersOnComment(
        {
          id: entry.id,
          title: entry.title,
          authorId: entry.authorId,
        },
        savedComment,
        {
          authorId: guestId,
          username: normalizedName,
        },
        commentMentions
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
      setCommentMessage("Could not add your comment right now. Please try again.");
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
    const shareUrl = buildAbsoluteRouteUrl("knowledge", {
      focusedEntryId: entry.id,
    });
    const text = `${entry.title}\n\n${entry.content.slice(0, 160)}${
      entry.content.length > 160 ? "..." : ""
    }`;

    onOpenEntry(entry.id);
    setInteractionMessage(null);

    if (navigator.share) {
      try {
        await navigator.share({
          title: entry.title,
          text,
          url: shareUrl,
        });
        setShareCopied(true);
        return;
      } catch (error) {
        console.error("Share cancelled or failed:", error);
      }
    }

    try {
      await navigator.clipboard.writeText(`${text}\n\n${shareUrl}`);
      setShareCopied(true);
    } catch (error) {
      console.error("Clipboard share failed:", error);
      setInteractionMessage("Could not copy the share link right now. Please try again.");
    }
  };

  const handleSelectHashtag = (tag: string) => {
    if (onSelectHashtag) {
      onSelectHashtag(tag);
      return;
    }

    if (typeof window !== "undefined") {
      navigateToRoute("knowledge", {
        selectedHashtag: tag.toLowerCase(),
      });
    }
  };

  return (
    <article
      id={`knowledge-${entry.id}`}
      className={cn(
        "overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]",
        highlighted && "ring-2 ring-emerald-400 ring-offset-4 ring-offset-[#F5F5F0]"
      )}
    >
      {entry.imageDataUrl && (
        <div className="relative h-64 overflow-hidden bg-slate-100">
          <img
            src={entry.imageDataUrl}
            alt={entry.title}
            loading="lazy"
            decoding="async"
            width={entry.imageWidth || undefined}
            height={entry.imageHeight || undefined}
            sizes="(max-width: 768px) 100vw, 768px"
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
                <span>&bull;</span>
                <span>{readingMinutes} min read</span>
                <span>&bull;</span>
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

        <button
          onClick={() => onOpenEntry(entry.id)}
          className="text-left transition-colors hover:text-emerald-700"
        >
          <h3 className="text-2xl font-black leading-tight tracking-tight text-slate-950">
            {entry.title}
          </h3>
        </button>
        <p className="mt-4 whitespace-pre-wrap text-[15px] leading-7 text-slate-600">
          {renderRichText({
            text: entry.content,
            mentions,
            onOpenProfile,
          })}
        </p>

        {entry.hashtags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {entry.hashtags.map((tag) => (
              <button
                key={tag}
                onClick={() => handleSelectHashtag(tag)}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100"
              >
                #{tag}
              </button>
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

          <div className="flex items-center gap-3">
            {shareCopied && (
              <span className="text-xs font-semibold text-emerald-600">
                Link ready
              </span>
            )}
            <button
              onClick={() => void handleShare()}
              className="text-slate-400 transition-colors hover:text-emerald-600"
              aria-label="Share knowledge"
            >
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        </div>

        {interactionMessage && (
          <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {interactionMessage}
          </p>
        )}
      </div>

      {showComments && (
        <div className="border-t border-slate-100 bg-slate-50/70 p-6">
          {guestName && (
            <p className="mb-3 text-xs text-slate-400">
              Commenting as{" "}
              <span className="font-semibold text-slate-600">@{guestName}</span>
            </p>
          )}

          <div className="relative">
            <div className="flex gap-3">
              <input
                ref={commentInputRef}
                value={commentText}
                onChange={(event) => {
                  setCommentText(event.target.value);
                  updateCommentMentionState(
                    event.target.value,
                    event.target.selectionStart || event.target.value.length
                  );
                  if (commentMessage) setCommentMessage(null);
                }}
                onClick={(event) =>
                  updateCommentMentionState(
                    event.currentTarget.value,
                    event.currentTarget.selectionStart || event.currentTarget.value.length
                  )
                }
                onKeyDown={(event) =>
                  event.key === "Enter" && !event.shiftKey && handleCommentSubmit()
                }
                placeholder={
                  pendingCommenter
                    ? `Commenting as @${pendingCommenter}...`
                    : "Add your thought and tag with @username..."
                }
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
              />
              <button
                onClick={handleCommentSubmit}
                disabled={isCommenting || isModeratingComment || !commentText.trim()}
                className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
              >
                {isCommenting || isModeratingComment ? "..." : "Post"}
              </button>
            </div>

            {activeCommentMention && filteredCommentMentionProfiles.length > 0 && (
              <div className="absolute left-0 right-16 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                {filteredCommentMentionProfiles.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => handleCommentMentionInsert(profile)}
                    className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left text-sm last:border-b-0 hover:bg-emerald-50"
                  >
                    <span className="font-semibold text-slate-800">
                      @{profile.username}
                    </span>
                    <span className="text-xs text-slate-400">User</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {commentMessage && (
            <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {commentMessage}
            </p>
          )}

          <div className="mt-4 space-y-3">
            {localComments.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-center text-sm text-slate-400">
                No comments yet. Start the discussion.
              </p>
            ) : (
              localComments.map((comment) => (
                <div
                  key={comment.id}
                  className={cn(
                    "rounded-2xl border bg-white p-4 shadow-sm",
                    comment.isAI
                      ? "border-emerald-200 bg-emerald-50/40"
                      : "border-slate-200"
                  )}
                >
                  <div className="mb-1 flex items-center gap-2">
                    {comment.isAI ? (
                      <span className="text-xs font-bold text-emerald-700">
                        {comment.author}
                      </span>
                    ) : comment.authorId ? (
                      <button
                        onClick={() => onOpenProfile(comment.authorId)}
                        className="text-xs font-bold text-slate-800 transition-colors hover:text-emerald-700"
                      >
                        @{comment.author}
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-slate-800">
                        @{comment.author}
                      </span>
                    )}
                    {comment.isAI && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                        Official
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400">
                      {new Date(comment.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm leading-6 text-slate-600">
                    {renderRichText({
                      text: comment.text,
                      mentions: comment.mentions || [],
                      onOpenProfile,
                    })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </article>
  );
}
