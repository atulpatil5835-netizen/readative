import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  KnowledgeComment,
  KnowledgeEntry,
  UserProfile,
  KnowledgeVisibility,
} from "../../types";
import { arrayUnion, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { cn } from "../../utils/classNames";
import { recordKnowledgeFeedActivity } from "../../utils/feedPersonalization";
import {
  toggleKnowledgeEntryLike,
  toggleKnowledgeEntryMisleading,
} from "../../utils/knowledgeFeedData";
import {
  getKnowledgeEntryImageLayout,
  getKnowledgeEntryImages,
  queueLegacyKnowledgeImageMigration,
} from "../../utils/knowledgeImages";
import { buildAbsoluteRouteUrl, navigateToRoute } from "../../utils/routes";
import { type KnowledgeIdentity } from "../../utils/knowledgeIdentity";
import { normalizeKnowledgeVisibility } from "../../utils/knowledgePrivacy";
import {
  createExcerpt,
  estimateReadMinutes,
  extractInlineHashtags,
  mergeHashtags,
  parseManualHashtags,
  resolveMentions,
} from "../../utils/knowledgeEntryHelpers";
import {
  getTrustMetrics,
  type ContributorReputation,
} from "../../utils/trustSystem";
import { getSaveMetrics, toggleKnowledgeSave } from "../../utils/bookmarks";
import { useNotebook } from "../../context/NotebookContext";

// Subcomponents
import { CardHeader } from "./CardHeader";
import { CardMedia } from "./CardMedia";
import { CardTrust } from "./CardTrust";
import { CardContent } from "./CardContent";
import { CardActions } from "./CardActions";
import { CardComments } from "./CardComments";
import { EditPostModal } from "./EditPostModal";

// Helpers & Types
import { CommentMentionState } from "./cardTypes";
import {
  getProfileDisplayName,
  findAuthorProfile,
  isShareAbortError,
  copyShareTextToClipboard,
  observeEntryVisibilityOnce,
} from "./cardHelpers";

function clearNotebookSelection() {
  if (typeof window === "undefined") return;
  try {
    window.getSelection()?.removeAllRanges();
  } catch {
    // Browser selection is external state; Notebook activation must remain passive.
  }
}

interface KnowledgeCardProps {
  entry: KnowledgeEntry;
  currentIdentity: KnowledgeIdentity | null;
  profiles?: UserProfile[];
  profileMap?: ReadonlyMap<string, UserProfile>;
  authorReputation?: ContributorReputation;
  onVisible?: (entry: KnowledgeEntry) => void;
  onIdentityRequired: (action: {
    type: "helpful" | "misleading" | "comment" | "save" | "ink";
    entryId: string;
  }) => void;
  onOpenProfile: (authorId: string) => void;
  onOpenEntry: (entryId: string) => void;
  onSelectHashtag?: (tag: string) => void;
  onLikeChange?: (
    entryId: string,
    helpfulIds: string[],
    misleadingIds?: string[],
  ) => void;
  focused?: boolean;
}


export const KnowledgeCard = memo(function KnowledgeCard({
  entry,
  currentIdentity,
  profiles = [],
  profileMap: providedProfileMap,
  authorReputation,
  onVisible,
  onIdentityRequired,
  onOpenProfile,
  onOpenEntry,
  onSelectHashtag,
  onLikeChange,
  focused = false,
}: KnowledgeCardProps) {
  const {
    activePostId,
    activateNotebook,
    deactivateNotebook,
    markPostHasHighlights,
  } = useNotebook();
  const isNotebookMode = activePostId === entry.id;


  const handleToggleNotebookMode = () => {
    if (!currentIdentity) {
      onIdentityRequired({ type: "ink", entryId: entry.id });
      return;
    }

    if (isNotebookMode) {
      deactivateNotebook();
      return;
    }

    clearNotebookSelection();
    activateNotebook(entry.id);
  };

  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);
  const [isModeratingComment, setIsModeratingComment] = useState(false);
  const [commentMessage, setCommentMessage] = useState<string | null>(null);
  const [interactionMessage, setInteractionMessage] = useState<string | null>(
    null,
  );
  const [shareCopied, setShareCopied] = useState(false);
  const initialTrustMetrics = useMemo(() => getTrustMetrics(entry), [entry]);
  const initialSaveMetrics = useMemo(() => getSaveMetrics(entry), [entry]);
  const [localHelpfulIds, setLocalHelpfulIds] = useState<string[]>(
    initialTrustMetrics.helpfulIds,
  );
  const [localMisleadingIds, setLocalMisleadingIds] = useState<string[]>(
    initialTrustMetrics.misleadingIds,
  );
  const [localHelpfulCount, setLocalHelpfulCount] = useState(
    initialTrustMetrics.helpfulCount,
  );
  const [localMisleadingCount, setLocalMisleadingCount] = useState(
    initialTrustMetrics.misleadingCount,
  );
  const [localComments, setLocalComments] = useState<KnowledgeComment[]>(
    entry.comments || [],
  );
  const [localSavedBy, setLocalSavedBy] = useState<string[]>(
    initialSaveMetrics.savedBy,
  );
  const [localSaveCount, setLocalSaveCount] = useState(
    initialSaveMetrics.saveCount,
  );
  const [actionIdentity, setActionIdentity] =
    useState<KnowledgeIdentity | null>(currentIdentity);
  const [activeCommentMention, setActiveCommentMention] =
    useState<CommentMentionState | null>(null);
  const [helpfulAnimationVersion, setHelpfulAnimationVersion] = useState(0);
  const [isUpdatingTrust, setIsUpdatingTrust] = useState(false);
  const [isUpdatingSave, setIsUpdatingSave] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const commentInputRef = useRef<HTMLInputElement | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const hasTrackedVisibilityRef = useRef(false);

  const activeIdentity = currentIdentity || actionIdentity;
  const activeAuthorId = activeIdentity?.authorId || null;
  const isHelpful = activeAuthorId
    ? localHelpfulIds.includes(activeAuthorId)
    : false;
  const isMisleading = activeAuthorId
    ? localMisleadingIds.includes(activeAuthorId)
    : false;
  const isSaved = activeAuthorId ? localSavedBy.includes(activeAuthorId) : false;
  const entryVisibility = normalizeKnowledgeVisibility(entry.visibility);
  const mentions = entry.mentions || [];
  const trustMetrics = useMemo(
    () =>
      getTrustMetrics({
        helpfulIds: localHelpfulIds,
        helpfulCount: localHelpfulCount,
        likes: localHelpfulIds,
        likeCount: localHelpfulCount,
        misleadingIds: localMisleadingIds,
        misleadingCount: localMisleadingCount,
        dislikes: localMisleadingIds,
        dislikeCount: localMisleadingCount,
      }),
    [
      localHelpfulCount,
      localHelpfulIds,
      localMisleadingCount,
      localMisleadingIds,
    ],
  );
  const trustToneClass =
    trustMetrics.tone === "strong"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : trustMetrics.tone === "positive"
        ? "border-teal-200 bg-teal-50 text-teal-700"
        : trustMetrics.tone === "neutral"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-amber-200 bg-amber-50 text-amber-700";
  const trustLabel =
    trustMetrics.tone === "strong"
      ? "Trusted"
      : trustMetrics.tone === "positive"
        ? "Helpful"
        : trustMetrics.tone === "neutral"
          ? "New Signal"
          : "Review";
  const entryImages = useMemo(() => getKnowledgeEntryImages(entry), [entry]);
  const imageLayout = useMemo(() => getKnowledgeEntryImageLayout(entry), [entry]);
  const contentSections = useMemo(
    () =>
      entry.content
        .split(/\r?\n(?:[ \t]*\r?\n)+/)
        .map((section) => section.trim())
        .filter(Boolean),
    [entry.content],
  );
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
    () =>
      providedProfileMap ||
      new Map(profiles.map((profile) => [profile.id, profile] as const)),
    [profiles, providedProfileMap],
  );
  const authorProfile = findAuthorProfile(entry, profiles, profileMap);
  const resolvedAuthorId = authorProfile?.id || entry.authorId;
  const authorDisplayName = getProfileDisplayName(authorProfile, entry.author);
  const authorUsername = authorProfile?.username || entry.author;
  const reputationTitle = authorReputation
    ? `${authorReputation.level}: ${authorReputation.score} reputation points`
    : "";
  const canManageEntry =
    Boolean(currentIdentity?.authorId) &&
    (currentIdentity?.authorId === entry.authorId ||
      currentIdentity?.authorId === resolvedAuthorId);
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
    const metrics = getTrustMetrics(entry);
    setLocalHelpfulIds(metrics.helpfulIds);
    setLocalMisleadingIds(metrics.misleadingIds);
    setLocalHelpfulCount(metrics.helpfulCount);
    setLocalMisleadingCount(metrics.misleadingCount);
    setLocalComments(entry.comments || []);
    const saveMetrics = getSaveMetrics(entry);
    setLocalSavedBy(saveMetrics.savedBy);
    setLocalSaveCount(saveMetrics.saveCount);
  }, [
    entry.id,
    entry.likes,
    entry.likeCount,
    entry.helpfulIds,
    entry.helpfulCount,
    entry.dislikes,
    entry.dislikeCount,
    entry.misleadingIds,
    entry.misleadingCount,
    entry.savedBy,
    entry.saveCount,
    entry.comments,
  ]);

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
    if (!authorId) return;

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
          type: "like" | "helpful" | "misleading" | "comment" | "save" | "ink";
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

      if (detail.type === "ink") {
        clearNotebookSelection();
        activateNotebook(entry.id);
        return;
      }

      if (detail.type === "like" || detail.type === "helpful") {
        void updateHelpful(true, nextIdentity);
        return;
      }

      if (detail.type === "misleading") {
        void updateMisleading(true, nextIdentity);
        return;
      }

      if (detail.type === "save") {
        void updateSave(true, nextIdentity);
        return;
      }

      setShowComments(true);
      if (commentText.trim()) {
        void handleComment(nextIdentity);
      }
    };

    window.addEventListener("knowledge-action", handler);
    return () => window.removeEventListener("knowledge-action", handler);
  }, [
    activateNotebook,
    commentText,
    entry.id,
    localHelpfulIds,
    localMisleadingIds,
    onOpenEntry,
  ]);

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

  const updateHelpful = async (
    shouldLike: boolean,
    actorIdentity: KnowledgeIdentity | null = activeIdentity,
  ) => {
    if (!actorIdentity) {
      onIdentityRequired({ type: "helpful", entryId: entry.id });
      return;
    }

    if (isUpdatingTrust) {
      return;
    }

    if (shouldLike && !localHelpfulIds.includes(actorIdentity.authorId)) {
      setHelpfulAnimationVersion((current) => current + 1);
    }

    const nextHelpfulIds = shouldLike
      ? [...new Set([...localHelpfulIds, actorIdentity.authorId])]
      : localHelpfulIds.filter((id) => id !== actorIdentity.authorId);
    const nextMisleadingIds = shouldLike
      ? localMisleadingIds.filter((id) => id !== actorIdentity.authorId)
      : localMisleadingIds;

    setLocalHelpfulIds(nextHelpfulIds);
    setLocalHelpfulCount(nextHelpfulIds.length);
    setLocalMisleadingIds(nextMisleadingIds);
    setLocalMisleadingCount(nextMisleadingIds.length);
    onLikeChange?.(entry.id, nextHelpfulIds, nextMisleadingIds);
    setInteractionMessage(null);
    setIsUpdatingTrust(true);

    try {
      await toggleKnowledgeEntryLike({
        entry,
        actorId: actorIdentity.authorId,
        actorName: actorIdentity.displayName,
        shouldLike,
      });
    } catch (error) {
      console.error("Failed to update helpful trust:", error);
      const metrics = getTrustMetrics(entry);
      setLocalHelpfulIds(metrics.helpfulIds);
      setLocalHelpfulCount(metrics.helpfulCount);
      setLocalMisleadingIds(metrics.misleadingIds);
      setLocalMisleadingCount(metrics.misleadingCount);
      onLikeChange?.(entry.id, metrics.helpfulIds, metrics.misleadingIds);
      setInteractionMessage(
        "Could not update helpful feedback right now. Please try again.",
      );
    } finally {
      setIsUpdatingTrust(false);
    }
  };

  const updateMisleading = async (
    shouldMarkMisleading: boolean,
    actorIdentity: KnowledgeIdentity | null = activeIdentity,
  ) => {
    if (!actorIdentity) {
      onIdentityRequired({ type: "misleading", entryId: entry.id });
      return;
    }

    if (isUpdatingTrust) {
      return;
    }

    const nextMisleadingIds = shouldMarkMisleading
      ? [...new Set([...localMisleadingIds, actorIdentity.authorId])]
      : localMisleadingIds.filter((id) => id !== actorIdentity.authorId);
    const nextHelpfulIds = shouldMarkMisleading
      ? localHelpfulIds.filter((id) => id !== actorIdentity.authorId)
      : localHelpfulIds;

    setLocalHelpfulIds(nextHelpfulIds);
    setLocalHelpfulCount(nextHelpfulIds.length);
    setLocalMisleadingIds(nextMisleadingIds);
    setLocalMisleadingCount(nextMisleadingIds.length);
    onLikeChange?.(entry.id, nextHelpfulIds, nextMisleadingIds);
    setInteractionMessage(null);
    setIsUpdatingTrust(true);

    try {
      await toggleKnowledgeEntryMisleading({
        entry,
        actorId: actorIdentity.authorId,
        shouldMarkMisleading,
      });
    } catch (error) {
      console.error("Failed to update misleading trust:", error);
      const metrics = getTrustMetrics(entry);
      setLocalHelpfulIds(metrics.helpfulIds);
      setLocalHelpfulCount(metrics.helpfulCount);
      setLocalMisleadingIds(metrics.misleadingIds);
      setLocalMisleadingCount(metrics.misleadingCount);
      onLikeChange?.(entry.id, metrics.helpfulIds, metrics.misleadingIds);
      setInteractionMessage(
        "Could not update misleading feedback right now. Please try again.",
      );
    } finally {
      setIsUpdatingTrust(false);
    }
  };

  const handleHelpful = () => {
    if (!activeIdentity) {
      onIdentityRequired({ type: "helpful", entryId: entry.id });
      return;
    }

    if (isHelpful) {
      void updateHelpful(false, activeIdentity);
      return;
    }

    void updateHelpful(true, activeIdentity);
  };

  const handleMisleading = () => {
    if (!activeIdentity) {
      onIdentityRequired({ type: "misleading", entryId: entry.id });
      return;
    }

    if (isMisleading) {
      void updateMisleading(false, activeIdentity);
      return;
    }

    void updateMisleading(true, activeIdentity);
  };

  const updateSave = async (
    shouldSave: boolean,
    actorIdentity: KnowledgeIdentity | null = activeIdentity,
  ) => {
    if (!actorIdentity) {
      onIdentityRequired({ type: "save", entryId: entry.id });
      return;
    }

    if (isUpdatingSave) return;

    const nextSavedBy = shouldSave
      ? [...new Set([...localSavedBy, actorIdentity.authorId])]
      : localSavedBy.filter((id) => id !== actorIdentity.authorId);

    setLocalSavedBy(nextSavedBy);
    setLocalSaveCount(nextSavedBy.length);
    setInteractionMessage(null);
    setIsUpdatingSave(true);

    try {
      await toggleKnowledgeSave({
        entry,
        actorId: actorIdentity.authorId,
        shouldSave,
      });
      setInteractionMessage(shouldSave ? "Saved to your profile." : "Removed from saved.");
    } catch (error) {
      console.error("Failed to update saved post:", error);
      const saveMetrics = getSaveMetrics(entry);
      setLocalSavedBy(saveMetrics.savedBy);
      setLocalSaveCount(saveMetrics.saveCount);
      setInteractionMessage("Could not update saved posts right now. Please try again.");
    } finally {
      setIsUpdatingSave(false);
    }
  };

  const handleSaveToggle = () => {
    if (!activeIdentity) {
      onIdentityRequired({ type: "save", entryId: entry.id });
      return;
    }

    void updateSave(!isSaved, activeIdentity);
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

    const { moderateContent } = await import("../../utils/contentModeration");
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
        await import("../../utils/notifications");
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

    const { moderateContent } = await import("../../utils/contentModeration");
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
      data-publisher-content="knowledge-post"
      className={cn(
        "readative-card-surface readative-card-surface-hover overflow-hidden",
        focused &&
          "ring-2 ring-emerald-400 ring-offset-4 ring-offset-[#f7f8fb]",
      )}
    >
      <CardHeader
        resolvedAuthorId={resolvedAuthorId}
        authorProfile={authorProfile}
        authorDisplayName={authorDisplayName}
        authorUsername={authorUsername}
        authorReputation={authorReputation}
        reputationTitle={reputationTitle}
        shouldShowAuthorSocialLinks={shouldShowAuthorSocialLinks}
        canManageEntry={canManageEntry}
        isSaved={isSaved}
        isUpdatingSave={isUpdatingSave}
        isDeleting={isDeleting}
        onOpenAuthorProfile={handleOpenAuthorProfile}
        onSaveToggle={handleSaveToggle}
        onShare={handleShare}
        setShowEditModal={setShowEditModal}
        onDeleteEntry={handleDeleteEntry}
      />

      <CardMedia
        entryImages={entryImages}
        imageLayout={imageLayout}
        title={entry.title}
      />

      <div className="p-4 pt-4 sm:p-5">
        <CardTrust
          trustToneClass={trustToneClass}
          trustMetrics={trustMetrics}
          trustLabel={trustLabel}
          localSaveCount={localSaveCount}
          entry={entry}
          entryVisibility={entryVisibility}
          isNotebookMode={isNotebookMode}
          onToggleNotebookMode={handleToggleNotebookMode}
        />

        <CardContent
          entry={entry}
          contentSections={contentSections}
          mentions={mentions}
          onOpenAuthorProfile={handleOpenAuthorProfile}
          onOpenEntryDetails={handleOpenEntryDetails}
          onSelectHashtag={handleSelectHashtag}
          topComment={topComment}
          topCommentProfile={topCommentProfile}
          topCommentDisplayName={topCommentDisplayName}
          topCommentUsername={topCommentUsername}
          currentUserId={currentIdentity?.authorId || null}
          isFocusedPost={focused || isNotebookMode}
          isNotebookMode={isNotebookMode}
          onPostFirstHighlight={markPostHasHighlights}
          onExitNotebookMode={deactivateNotebook}
        />

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100/90 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <CardActions
            isHelpful={isHelpful}
            isMisleading={isMisleading}
            isUpdatingTrust={isUpdatingTrust}
            helpfulCount={trustMetrics.helpfulCount}
            misleadingCount={trustMetrics.misleadingCount}
            commentsCount={localComments.length}
            showComments={showComments}
            helpfulAnimationVersion={helpfulAnimationVersion}
            onHelpful={handleHelpful}
            onMisleading={handleMisleading}
            onToggleComments={() => setShowComments((current) => !current)}
          />

          {shareCopied && (
            <span className="text-xs font-semibold text-emerald-600">
              Link ready
            </span>
          )}
        </div>

        {interactionMessage && (
          <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {interactionMessage}
          </p>
        )}
      </div>

      {showComments && (
        <CardComments
          entry={entry}
          activeIdentity={activeIdentity}
          commentText={commentText}
          setCommentText={setCommentText}
          commentInputRef={commentInputRef}
          commentMessage={commentMessage}
          isCommenting={isCommenting}
          isModeratingComment={isModeratingComment}
          activeCommentMention={activeCommentMention}
          filteredCommentMentionProfiles={filteredCommentMentionProfiles}
          localComments={localComments}
          profileMap={profileMap}
          onCommentSubmit={handleCommentSubmit}
          onCommentMentionInsert={handleCommentMentionInsert}
          onOpenAuthorProfile={handleOpenAuthorProfile}
          updateCommentMentionState={updateCommentMentionState}
          setCommentMessage={setCommentMessage}
          onIdentityRequired={onIdentityRequired}
        />
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
