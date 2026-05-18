import {
  memo,
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  KnowledgeComment,
  KnowledgeEntry,
  KnowledgeVisibility,
  UserProfile,
} from "../types";
import {
  Globe2,
  Heart,
  Lock,
  MessageCircle,
  Pencil,
  Save,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { arrayUnion, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { cn } from "../utils/classNames";
import { renderRichText } from "../utils/renderRichText";
import { recordKnowledgeFeedActivity } from "../utils/feedPersonalization";
import { toggleKnowledgeEntryLike } from "../utils/knowledgeFeedData";
import {
  getKnowledgeEntryImageLayout,
  getKnowledgeEntryImages,
  queueLegacyKnowledgeImageMigration,
} from "../utils/knowledgeImages";
import { buildAbsoluteRouteUrl, navigateToRoute } from "../utils/routes";
import { KnowledgeImageCarousel } from "./KnowledgeImageCarousel";
import { ProfileAvatar } from "./ProfileAvatar";
import { ProfileSocialLinks } from "./ProfileSocialLinks";
import { type KnowledgeIdentity } from "../utils/knowledgeIdentity";
import { normalizeKnowledgeVisibility } from "../utils/knowledgePrivacy";
import {
  createExcerpt,
  estimateReadMinutes,
  extractInlineHashtags,
  mergeHashtags,
  parseManualHashtags,
  resolveMentions,
} from "../utils/knowledgeEntryHelpers";

function getProfileDisplayName(profile: UserProfile | undefined, fallback: string) {
  return profile?.displayName?.trim() || fallback;
}

function isShareAbortError(error: unknown) {
  return (
    error instanceof DOMException &&
    error.name === "AbortError"
  );
}

async function copyShareTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    if (!document.execCommand("copy")) {
      throw new Error("Clipboard copy was not accepted.");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

const LIKE_BURST_PARTICLES = [
  { x: -24, y: -18, rotate: -24, delay: 0, scale: 1.05, color: "#fb7185" },
  { x: -8, y: -28, rotate: -12, delay: 35, scale: 0.9, color: "#f43f5e" },
  { x: 14, y: -26, rotate: 18, delay: 70, scale: 1.1, color: "#f97316" },
  { x: 26, y: -12, rotate: 28, delay: 25, scale: 0.95, color: "#fb7185" },
  { x: 18, y: 6, rotate: 18, delay: 90, scale: 0.8, color: "#fda4af" },
  { x: -20, y: 4, rotate: -18, delay: 55, scale: 0.85, color: "#fecdd3" },
] as const;
const SEEN_VISIBILITY_THRESHOLD = 0.6;
const SEEN_DWELL_MS = 450;

function observeEntryVisibilityOnce(target: Element, onVisible: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  if (typeof window.IntersectionObserver !== "function") {
    onVisible();
    return () => undefined;
  }

  let timeoutId: number | null = null;
  const clearVisibilityTimeout = () => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  const observer = new window.IntersectionObserver(
    (observedEntries) => {
      const [observedEntry] = observedEntries;
      if (!observedEntry) {
        return;
      }

      if (
        observedEntry.isIntersecting &&
        observedEntry.intersectionRatio >= SEEN_VISIBILITY_THRESHOLD
      ) {
        if (timeoutId !== null) {
          return;
        }

        timeoutId = window.setTimeout(() => {
          clearVisibilityTimeout();
          observer.disconnect();
          onVisible();
        }, SEEN_DWELL_MS);
        return;
      }

      clearVisibilityTimeout();
    },
    {
      threshold: [0.3, SEEN_VISIBILITY_THRESHOLD, 0.9],
    },
  );

  observer.observe(target);

  return () => {
    clearVisibilityTimeout();
    observer.disconnect();
  };
}

interface KnowledgeCardProps {
  entry: KnowledgeEntry;
  currentIdentity: KnowledgeIdentity | null;
  profiles?: UserProfile[];
  onVisible?: (entry: KnowledgeEntry) => void;
  onIdentityRequired: (action: {
    type: "like" | "comment";
    entryId: string;
  }) => void;
  onOpenProfile: (authorId: string) => void;
  onOpenEntry: (entryId: string) => void;
  onSelectHashtag?: (tag: string) => void;
  onLikeChange?: (entryId: string, likes: string[]) => void;
  highlighted?: boolean;
}

interface CommentMentionState {
  query: string;
  start: number;
}

export const KnowledgeCard = memo(function KnowledgeCard({
  entry,
  currentIdentity,
  profiles = [],
  onVisible,
  onIdentityRequired,
  onOpenProfile,
  onOpenEntry,
  onSelectHashtag,
  onLikeChange,
  highlighted = false,
}: KnowledgeCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);
  const [isModeratingComment, setIsModeratingComment] = useState(false);
  const [commentMessage, setCommentMessage] = useState<string | null>(null);
  const [interactionMessage, setInteractionMessage] = useState<string | null>(
    null,
  );
  const [shareCopied, setShareCopied] = useState(false);
  const [localLikes, setLocalLikes] = useState<string[]>(entry.likes || []);
  const [localComments, setLocalComments] = useState<KnowledgeComment[]>(
    entry.comments || [],
  );
  const [actionIdentity, setActionIdentity] =
    useState<KnowledgeIdentity | null>(currentIdentity);
  const [activeCommentMention, setActiveCommentMention] =
    useState<CommentMentionState | null>(null);
  const [likeAnimationVersion, setLikeAnimationVersion] = useState(0);
  const [isUpdatingLike, setIsUpdatingLike] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const commentInputRef = useRef<HTMLInputElement | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const hasTrackedVisibilityRef = useRef(false);

  const activeIdentity = currentIdentity || actionIdentity;
  const activeAuthorId = activeIdentity?.authorId || null;
  const isLiked = activeAuthorId ? localLikes.includes(activeAuthorId) : false;
  const canManageEntry = currentIdentity?.authorId === entry.authorId;
  const entryVisibility = normalizeKnowledgeVisibility(entry.visibility);
  const mentions = entry.mentions || [];
  const entryImages = useMemo(() => getKnowledgeEntryImages(entry), [entry]);
  const imageLayout = useMemo(() => getKnowledgeEntryImageLayout(entry), [entry]);
  const topComment = useMemo(
    () =>
      localComments.reduce<KnowledgeComment | null>((latest, comment) => {
        if (!latest || (comment.createdAt || 0) > (latest.createdAt || 0)) {
          return comment;
        }

        return latest;
      }, null),
    [localComments],
  );
  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile] as const)),
    [profiles],
  );
  const authorProfile = profileMap.get(entry.authorId);
  const authorDisplayName = getProfileDisplayName(authorProfile, entry.author);
  const authorUsername = authorProfile?.username || entry.author;
  const shouldShowAuthorSocialLinks =
    authorProfile?.showSocialLinksOnPosts &&
    Object.values(authorProfile.socialLinks || {}).some(Boolean);
  const topCommentProfile = topComment?.authorId
    ? profileMap.get(topComment.authorId)
    : undefined;
  const topCommentDisplayName = topComment
    ? getProfileDisplayName(topCommentProfile, topComment.author)
    : "";
  const topCommentUsername = topCommentProfile?.username || topComment?.author || "";
  const filteredCommentMentionProfiles = useMemo(() => {
    if (!activeCommentMention) return [];
    const mentionQuery = activeCommentMention.query.toLowerCase();

    return profiles
      .filter((profile) =>
        profile.usernameLower.startsWith(mentionQuery),
      )
      .slice(0, 6);
  }, [activeCommentMention, profiles]);

  useEffect(() => {
    setLocalLikes(entry.likes || []);
    setLocalComments(entry.comments || []);
  }, [entry.id, entry.likes, entry.comments]);

  useEffect(() => {
    setActionIdentity(currentIdentity);
  }, [currentIdentity?.authorId, currentIdentity?.displayName]);

  useEffect(() => {
    queueLegacyKnowledgeImageMigration(entry);
  }, [entry]);

  useEffect(() => {
    if (!shareCopied) return;
    const timeout = window.setTimeout(() => setShareCopied(false), 2200);
    return () => window.clearTimeout(timeout);
  }, [shareCopied]);

  useEffect(() => {
    if (!onVisible || typeof window === "undefined") return;
    if (hasTrackedVisibilityRef.current) return;

    const articleElement = articleRef.current;
    if (!articleElement) return;

    return observeEntryVisibilityOnce(articleElement, () => {
      if (hasTrackedVisibilityRef.current) {
        return;
      }

      hasTrackedVisibilityRef.current = true;
      onVisible(entry);
    });
  }, [entry, onVisible]);

  const handleOpenAuthorProfile = (authorId: string) => {
    recordKnowledgeFeedActivity({
      type: "author",
      entry,
      authorId,
    });
    onOpenProfile(authorId);
  };

  const handleOpenEntryDetails = () => {
    recordKnowledgeFeedActivity({
      type: "open",
      entry,
    });
    onOpenEntry(entry.id);
  };

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          type: "like" | "comment";
          entryId: string;
          username: string;
          authorId: string;
        }>
      ).detail;

      if (!detail || detail.entryId !== entry.id || !detail.authorId) return;

      const nextIdentity = {
        displayName: detail.username,
        authorId: detail.authorId,
      };
      setActionIdentity(nextIdentity);

      if (detail.type === "like") {
        void updateLike(true, nextIdentity);
        return;
      }

      setShowComments(true);
      if (commentText.trim()) {
        void handleComment(nextIdentity);
      }
    };

    window.addEventListener("knowledge-action", handler);
    return () => window.removeEventListener("knowledge-action", handler);
  }, [commentText, entry.id, localLikes]);

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

  const updateLike = async (
    shouldLike: boolean,
    actorIdentity: KnowledgeIdentity | null = activeIdentity,
  ) => {
    if (!actorIdentity) {
      onIdentityRequired({ type: "like", entryId: entry.id });
      return;
    }

    if (isUpdatingLike) {
      return;
    }

    if (shouldLike && !localLikes.includes(actorIdentity.authorId)) {
      setLikeAnimationVersion((current) => current + 1);
    }

    const nextLikes = shouldLike
      ? [...new Set([...localLikes, actorIdentity.authorId])]
      : localLikes.filter((id) => id !== actorIdentity.authorId);

    setLocalLikes(nextLikes);
    onLikeChange?.(entry.id, nextLikes);
    setInteractionMessage(null);
    setIsUpdatingLike(true);

    try {
      await toggleKnowledgeEntryLike({
        entry,
        actorId: actorIdentity.authorId,
        actorName: actorIdentity.displayName,
        shouldLike,
      });
    } catch (error) {
      console.error("Failed to update like:", error);
      setLocalLikes(entry.likes || []);
      onLikeChange?.(entry.id, entry.likes || []);
      setInteractionMessage(
        "Could not update the like right now. Please try again.",
      );
    } finally {
      setIsUpdatingLike(false);
    }
  };

  const handleLike = () => {
    if (!activeIdentity) {
      onIdentityRequired({ type: "like", entryId: entry.id });
      return;
    }

    if (isLiked) {
      void updateLike(false, activeIdentity);
      return;
    }

    void updateLike(true, activeIdentity);
  };

  const handleComment = async (
    commentIdentity: KnowledgeIdentity | null = activeIdentity,
  ) => {
    const content = commentText.trim();
    if (!content) return;
    if (!commentIdentity) {
      onIdentityRequired({ type: "comment", entryId: entry.id });
      return;
    }

    const normalizedName = commentIdentity.displayName;
    const commentMentions = resolveMentions(content, profiles);

    setCommentMessage(null);
    setInteractionMessage(null);
    setIsModeratingComment(true);

    const { moderateContent } = await import("../utils/contentModeration");
    const moderation = await moderateContent("knowledge-comment", {
      content,
    });

    if (!moderation.allowed) {
      setCommentMessage(moderation.message);
      setIsModeratingComment(false);
      return;
    }

    setActionIdentity(commentIdentity);
    setIsCommenting(true);
    setIsModeratingComment(false);
    setActiveCommentMention(null);

    const optimisticComment: KnowledgeComment = {
      id: `temp-${Date.now()}`,
      author: normalizedName,
      authorId: commentIdentity.authorId,
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
        authorId: commentIdentity.authorId,
        text: content,
        mentions: commentMentions,
        createdAt: Date.now(),
      };

      await updateDoc(doc(db, "knowledge", entry.id), {
        comments: arrayUnion(savedComment),
      });

      const { notifyCommentOnKnowledge, notifyTaggedUsersOnComment } =
        await import("../utils/notifications");
      await notifyCommentOnKnowledge(
        entry,
        {
          authorId: commentIdentity.authorId,
          username: normalizedName,
        },
        savedComment,
      );

      await notifyTaggedUsersOnComment(
        {
          id: entry.id,
          title: entry.title,
          authorId: entry.authorId,
        },
        savedComment,
        {
          authorId: commentIdentity.authorId,
          username: normalizedName,
        },
        commentMentions,
      );
      recordKnowledgeFeedActivity({
        type: "comment",
        entry,
      });

      setLocalComments((current) =>
        current.map((comment) =>
          comment.id === optimisticComment.id ? savedComment : comment,
        ),
      );
    } catch (error) {
      console.error("Failed to save comment:", error);
      setLocalComments((current) =>
        current.filter((comment) => comment.id !== optimisticComment.id),
      );
      setCommentText(content);
      setCommentMessage(
        "Could not add your comment right now. Please try again.",
      );
    } finally {
      setIsCommenting(false);
    }
  };

  const handleCommentSubmit = () => {
    if (!commentText.trim()) return;

    if (activeIdentity) {
      void handleComment(activeIdentity);
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
    const sharePayload = {
      title: entry.title,
      text,
      url: shareUrl,
    };

    setInteractionMessage(null);

    if (
      navigator.share &&
      (typeof navigator.canShare !== "function" || navigator.canShare(sharePayload))
    ) {
      try {
        await navigator.share(sharePayload);
        recordKnowledgeFeedActivity({
          type: "share",
          entry,
        });
        setShareCopied(true);
        return;
      } catch (error) {
        if (isShareAbortError(error)) {
          return;
        }

        console.warn("Native share failed, falling back to clipboard:", error);
      }
    }

    try {
      await copyShareTextToClipboard(`${text}\n\n${shareUrl}`);
      recordKnowledgeFeedActivity({
        type: "share",
        entry,
      });
      setShareCopied(true);
    } catch (error) {
      console.error("Clipboard share failed:", error);
      setInteractionMessage(
        "Could not copy the share link right now. Please try again.",
      );
    }
  };

  const handleSelectHashtag = (tag: string) => {
    recordKnowledgeFeedActivity({
      type: "hashtag",
      entry,
      hashtags: [tag],
    });

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

  const handleDeleteEntry = async () => {
    if (!canManageEntry || isDeleting) return;

    const shouldDelete = window.confirm(
      "Delete this post? This cannot be undone.",
    );
    if (!shouldDelete) return;

    setIsDeleting(true);
    setInteractionMessage(null);

    try {
      await deleteDoc(doc(db, "knowledge", entry.id));
    } catch (error) {
      console.error("Failed to delete post:", error);
      setInteractionMessage(
        "Could not delete this post right now. Please try again.",
      );
      setIsDeleting(false);
    }
  };

  const handleSaveEntryEdit = async ({
    title,
    content,
    hashtagInput,
    visibility,
  }: {
    title: string;
    content: string;
    hashtagInput: string;
    visibility: KnowledgeVisibility;
  }) => {
    if (!canManageEntry) return;

    const seedHashtags = mergeHashtags(
      parseManualHashtags(hashtagInput),
      extractInlineHashtags(`${title}\n${content}`),
    );
    const mentions = resolveMentions(`${title}\n${content}`, profiles);

    const { moderateContent } = await import("../utils/contentModeration");
    const moderation = await moderateContent("knowledge-post", {
      title,
      content,
      hashtags: seedHashtags,
    });

    if (!moderation.allowed) {
      throw new Error(
        [moderation.message, ...moderation.suggestions].slice(0, 2).join(" "),
      );
    }

    await updateDoc(doc(db, "knowledge", entry.id), {
      title,
      content,
      visibility,
      hashtags: seedHashtags,
      mentions,
      excerpt: createExcerpt(content, 180),
      readingMinutes: estimateReadMinutes(content),
      qualityScore: moderation.knowledgeScore,
      updatedAt: Date.now(),
    });

    setShowEditModal(false);
    setInteractionMessage("Post updated.");
  };

  return (
    <article
      ref={articleRef}
      id={`knowledge-${entry.id}`}
      className={cn(
        "overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.07)]",
        highlighted &&
          "ring-2 ring-emerald-400 ring-offset-4 ring-offset-[#F5F5F0]",
      )}
    >
      {entryImages.length > 0 && (
        <KnowledgeImageCarousel
          images={entryImages}
          layout={imageLayout}
          altBase={entry.title}
        />
      )}

      <div className="p-4 sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => handleOpenAuthorProfile(entry.authorId)}
              className="shrink-0 rounded-full transition-transform hover:scale-[1.02]"
              aria-label={`Open ${authorDisplayName}'s profile`}
            >
              <ProfileAvatar
                authorId={entry.authorId}
                image={authorProfile?.profileImage}
                photoUrl={authorProfile?.photoUrl}
                username={authorDisplayName}
                size="sm"
                className="border-slate-200"
              />
            </button>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <button
                  onClick={() => handleOpenAuthorProfile(entry.authorId)}
                  className="min-w-0 truncate text-left text-sm font-bold text-slate-900 transition-colors hover:text-emerald-700"
                >
                  {authorDisplayName}
                </button>
                {shouldShowAuthorSocialLinks && (
                  <ProfileSocialLinks
                    socialLinks={authorProfile?.socialLinks || {}}
                    compact
                    iconOnly
                  />
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400">
                <span>@{authorUsername}</span>
                <span>&bull;</span>
                <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700">
              Insight
            </span>
            {entryVisibility === "private" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
                <Lock className="h-3 w-3" />
                Private
              </span>
            )}
            {canManageEntry && (
              <div className="flex items-center rounded-full border border-slate-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setShowEditModal(true)}
                  className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  aria-label="Edit post"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteEntry()}
                  disabled={isDeleting}
                  className="rounded-full p-2 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  aria-label="Delete post"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleOpenEntryDetails}
          className="text-left transition-colors hover:text-emerald-700"
        >
          <h3 className="text-xl font-black leading-tight tracking-tight text-slate-950 sm:text-2xl">
            {entry.title}
          </h3>
        </button>
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-slate-600">
          {renderRichText({
            text: entry.content,
            mentions,
            onOpenProfile: handleOpenAuthorProfile,
          })}
        </p>

        {entry.hashtags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
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
          <div className="mt-3 flex flex-wrap gap-2">
            {mentions.map((mention) => (
              <button
                key={`${mention.authorId}-${mention.username}`}
                onClick={() => handleOpenAuthorProfile(mention.authorId)}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
              >
                @{mention.username}
              </button>
            ))}
          </div>
        )}

        {topComment && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Top comment
            </p>
            <div className="flex items-start gap-3">
              <ProfileAvatar
                authorId={topComment.authorId || topComment.id}
                image={
                  topComment.authorId ? topCommentProfile?.profileImage : undefined
                }
                photoUrl={
                  topComment.authorId ? topCommentProfile?.photoUrl : undefined
                }
                username={topCommentDisplayName}
                size="xs"
                className="border-slate-200"
              />
              <div className="min-w-0 flex-1">
                {topComment.authorId ? (
                  <button
                    onClick={() => handleOpenAuthorProfile(topComment.authorId)}
                    className="text-xs font-bold text-slate-800 transition-colors hover:text-emerald-700"
                  >
                    {topCommentDisplayName}
                  </button>
                ) : (
                  <span className="text-xs font-bold text-slate-800">
                    {topCommentDisplayName}
                  </span>
                )}
                {topCommentUsername && (
                  <p className="text-[11px] font-semibold text-slate-400">
                    @{topCommentUsername}
                  </p>
                )}
                <p className="line-clamp-2 text-sm leading-6 text-slate-600">
                  {renderRichText({
                    text: topComment.text,
                    mentions: topComment.mentions || [],
                    onOpenProfile: handleOpenAuthorProfile,
                  })}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
          <div className="flex items-center gap-5">
            <button
              onClick={handleLike}
              disabled={isUpdatingLike}
              aria-label={isLiked ? "Unlike post" : "Like post"}
              className={cn(
                "relative overflow-visible flex items-center gap-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70",
                isLiked
                  ? "text-rose-500"
                  : "text-slate-400 hover:text-rose-500",
              )}
            >
              <span className="relative inline-flex h-5 w-5 items-center justify-center">
                <span
                  key={`like-icon-${likeAnimationVersion}`}
                  className={cn(
                    "inline-flex h-5 w-5 items-center justify-center",
                    likeAnimationVersion > 0 && "readative-like-pop",
                  )}
                >
                  <Heart
                    className={cn("h-5 w-5", isLiked ? "fill-current" : "")}
                  />
                </span>

                {likeAnimationVersion > 0 && (
                  <span
                    key={`like-burst-${likeAnimationVersion}`}
                    className="pointer-events-none absolute inset-0"
                    aria-hidden="true"
                  >
                    {LIKE_BURST_PARTICLES.map((particle, index) => (
                      <span
                        key={`${particle.x}-${particle.y}-${index}`}
                        className="readative-like-burst-heart"
                        style={
                          {
                            "--like-x": `${particle.x}px`,
                            "--like-y": `${particle.y}px`,
                            "--like-rotate": `${particle.rotate}deg`,
                            "--like-delay": `${particle.delay}ms`,
                            "--like-scale": `${particle.scale}`,
                            color: particle.color,
                          } as CSSProperties
                        }
                      >
                        <Heart className="h-2.5 w-2.5 fill-current" />
                      </span>
                    ))}
                  </span>
                )}
              </span>
              <span>{localLikes.length}</span>
            </button>

            <button
              onClick={() => setShowComments((current) => !current)}
              aria-label={showComments ? "Hide comments" : "Show comments"}
              className={cn(
                "flex items-center gap-1.5 text-sm font-semibold transition-colors",
                showComments
                  ? "text-emerald-600"
                  : "text-slate-400 hover:text-emerald-600",
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
        <div className="border-t border-slate-100 bg-slate-50/70 p-5">
          {activeIdentity && (
            <p className="mb-3 text-xs text-slate-400">
              Commenting as{" "}
              <span className="font-semibold text-slate-600">
                @{activeIdentity.displayName}
              </span>
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
                    event.target.selectionStart || event.target.value.length,
                  );
                  if (commentMessage) setCommentMessage(null);
                }}
                onClick={(event) => {
                  if (!activeIdentity) {
                    onIdentityRequired({ type: "comment", entryId: entry.id });
                    return;
                  }

                  updateCommentMentionState(
                    event.currentTarget.value,
                    event.currentTarget.selectionStart ||
                      event.currentTarget.value.length,
                  );
                }}
                onFocus={() => {
                  if (!activeIdentity) {
                    onIdentityRequired({ type: "comment", entryId: entry.id });
                  }
                }}
                onKeyDown={(event) =>
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  handleCommentSubmit()
                }
                placeholder={
                  activeIdentity
                    ? `Commenting as @${activeIdentity.displayName}...`
                    : "Sign in to comment and tag with @username..."
                }
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
              />
              <button
                onClick={handleCommentSubmit}
                disabled={
                  isCommenting || isModeratingComment || !commentText.trim()
                }
                className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
              >
                {isCommenting || isModeratingComment ? "..." : "Post"}
              </button>
            </div>

            {activeCommentMention &&
              filteredCommentMentionProfiles.length > 0 && (
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
              localComments.map((comment) => {
                const commentProfile = comment.authorId
                  ? profileMap.get(comment.authorId)
                  : undefined;
                const commentDisplayName = getProfileDisplayName(
                  commentProfile,
                  comment.author,
                );
                const commentUsername = commentProfile?.username || comment.author;

                return (
                  <div
                    key={comment.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="mb-1 flex items-start gap-3">
                      <ProfileAvatar
                        authorId={comment.authorId || comment.id}
                        image={commentProfile?.profileImage}
                        photoUrl={commentProfile?.photoUrl}
                        username={commentDisplayName}
                        size="xs"
                        className="border-slate-200"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {comment.authorId ? (
                            <button
                              onClick={() =>
                                handleOpenAuthorProfile(comment.authorId)
                              }
                              className="text-xs font-bold text-slate-800 transition-colors hover:text-emerald-700"
                            >
                              {commentDisplayName}
                            </button>
                          ) : (
                            <span className="text-xs font-bold text-slate-800">
                              {commentDisplayName}
                            </span>
                          )}
                          <span className="text-[11px] font-semibold text-slate-400">
                            @{commentUsername}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(comment.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm leading-6 text-slate-600">
                          {renderRichText({
                            text: comment.text,
                            mentions: comment.mentions || [],
                            onOpenProfile: handleOpenAuthorProfile,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {showEditModal && (
        <EditPostModal
          entry={entry}
          onClose={() => setShowEditModal(false)}
          onSave={handleSaveEntryEdit}
        />
      )}
    </article>
  );
});

function EditPostModal({
  entry,
  onClose,
  onSave,
}: {
  entry: KnowledgeEntry;
  onClose: () => void;
  onSave: (input: {
    title: string;
    content: string;
    hashtagInput: string;
    visibility: KnowledgeVisibility;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState(entry.title);
  const [content, setContent] = useState(entry.content);
  const [hashtagInput, setHashtagInput] = useState(
    entry.hashtags.map((tag) => `#${tag}`).join(" "),
  );
  const [visibility, setVisibility] = useState<KnowledgeVisibility>(
    normalizeKnowledgeVisibility(entry.visibility),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSave = async () => {
    const nextTitle = title.trim();
    const nextContent = content.trim();
    if (!nextTitle || !nextContent || isSaving) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await onSave({
        title: nextTitle,
        content: nextContent,
        hashtagInput,
        visibility,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not update this post right now.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-start justify-center overflow-y-auto bg-slate-950/35 p-3 pt-16 backdrop-blur-sm sm:p-4 sm:pt-20">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.2)]">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Close edit post"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
            Edit Post
          </p>
          <h2 className="mt-1 pr-10 text-2xl font-black tracking-tight text-slate-950">
            Update knowledge
          </h2>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
            {(
              [
                ["public", "Public", Globe2],
                ["private", "Private", Lock],
              ] as const
            ).map(([nextVisibility, label, Icon]) => (
              <button
                key={nextVisibility}
                type="button"
                onClick={() => setVisibility(nextVisibility)}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                  visibility === nextVisibility
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Post title"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-bold text-slate-900 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />

          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Write your post. Tag people with @username."
            className="min-h-[190px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-4 text-[15px] leading-7 text-slate-700 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Hashtags
            </p>
            <input
              value={hashtagInput}
              onChange={(event) => setHashtagInput(event.target.value)}
              placeholder="#science #history #productivity"
              className="w-full bg-transparent text-sm text-slate-700 outline-none"
            />
          </div>

          {errorMessage && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {errorMessage}
            </p>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || !title.trim() || !content.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 sm:w-auto"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
