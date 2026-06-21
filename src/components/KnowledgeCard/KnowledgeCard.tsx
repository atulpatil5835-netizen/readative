import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as htmlToImage from "html-to-image";
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
import { useHighlights } from "../../context/HighlightsContext";

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

interface KnowledgeCardProps {
  entry: KnowledgeEntry;
  currentIdentity: KnowledgeIdentity | null;
  profiles?: UserProfile[];
  profileMap?: ReadonlyMap<string, UserProfile>;
  authorReputation?: ContributorReputation;
  onVisible?: (entry: KnowledgeEntry) => void;
  onIdentityRequired: (action: {
    type: "helpful" | "misleading" | "comment" | "save";
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
  highlighted?: boolean;
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
  highlighted = false,
}: KnowledgeCardProps) {
  const { highlights, highlightModePostIds, toggleHighlightMode, addHighlight, removeHighlight } = useHighlights();
  const cardHighlights = useMemo(() => highlights.filter(hl => hl.postId === entry.id), [highlights, entry.id]);
  const hasHighlights = cardHighlights.length > 0;
  const isHighlightMode = !!highlightModePostIds[entry.id];

  const [isExporting, setIsExporting] = useState(false);
  const [exportPages, setExportPages] = useState<any[]>([]);

  const handleToggleHighlightMode = () => {
    const nextState = !isHighlightMode;
    toggleHighlightMode(entry.id);
    if (nextState) {
      setInteractionMessage("Highlight Mode Enabled");
      setTimeout(() => {
        setInteractionMessage((current) =>
          current === "Highlight Mode Enabled" ? null : current
        );
      }, 3000);
    } else {
      setInteractionMessage((current) =>
        current === "Highlight Mode Enabled" ? null : current
      );
    }
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
          type: "like" | "helpful" | "misleading" | "comment" | "save";
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
  }, [commentText, entry.id, localHelpfulIds, localMisleadingIds]);

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

  const handleDownload = async () => {
    // 1. Create temporary measurement container
    const measureContainer = document.createElement("div");
    measureContainer.style.position = "absolute";
    measureContainer.style.left = "-9999px";
    measureContainer.style.top = "-9999px";
    measureContainer.style.width = "520px";
    measureContainer.style.fontFamily = "Inter, sans-serif";
    measureContainer.style.boxSizing = "border-box";
    document.body.appendChild(measureContainer);

    // 2. Measure Title
    const h3 = document.createElement("h3");
    h3.style.width = "520px";
    h3.style.margin = "0 0 16px 0";
    h3.style.fontSize = "28px";
    h3.style.fontWeight = "900";
    h3.style.lineHeight = "1.2";
    h3.style.fontFamily = "Inter, sans-serif";
    h3.style.boxSizing = "border-box";
    h3.textContent = entry.title;
    measureContainer.appendChild(h3);
    const titleHeight = h3.getBoundingClientRect().height;
    measureContainer.removeChild(h3);

    // 3. Measure Trust Badges
    const trustDiv = document.createElement("div");
    trustDiv.style.width = "520px";
    trustDiv.style.display = "flex";
    trustDiv.style.flexWrap = "wrap";
    trustDiv.style.gap = "8px";
    trustDiv.style.marginBottom = "12px";
    trustDiv.style.boxSizing = "border-box";
    
    // Add primary trust badge
    const span = document.createElement("span");
    span.style.padding = "2px 6px";
    span.style.fontSize = "9px";
    span.style.fontWeight = "bold";
    span.textContent = trustLabel;
    trustDiv.appendChild(span);

    // Add other badges if applicable
    if (trustMetrics.helpfulCount >= 5) {
      const b = document.createElement("span");
      b.textContent = "Most Helpful";
      trustDiv.appendChild(b);
    }
    if (localSaveCount >= 3) {
      const b = document.createElement("span");
      b.textContent = "Most Saved";
      trustDiv.appendChild(b);
    }
    if (entry.contentKind === "tutorial" && trustMetrics.helpfulCount >= 3) {
      const b = document.createElement("span");
      b.textContent = "Top Tutorial";
      trustDiv.appendChild(b);
    }
    if (entryVisibility === "private") {
      const b = document.createElement("span");
      b.textContent = "Private";
      trustDiv.appendChild(b);
    }
    measureContainer.appendChild(trustDiv);
    const trustHeight = trustDiv.getBoundingClientRect().height;
    measureContainer.removeChild(trustDiv);

    // 4. Measure Content Sections (paragraphs)
    const measuredParagraphs = [];
    for (const section of contentSections) {
      const p = document.createElement("p");
      p.style.width = "520px";
      p.style.margin = "0";
      p.style.fontSize = "16px";
      p.style.lineHeight = "28px";
      p.style.fontFamily = "Inter, sans-serif";
      p.style.boxSizing = "border-box";
      p.textContent = section;
      measureContainer.appendChild(p);
      const pHeight = p.getBoundingClientRect().height;
      measureContainer.removeChild(p);
      measuredParagraphs.push({ text: section, height: pHeight });
    }

    // 5. Measure Tags
    let tagsHeight = 0;
    if (entry.hashtags.length > 0) {
      const tagsDiv = document.createElement("div");
      tagsDiv.style.width = "520px";
      tagsDiv.style.display = "flex";
      tagsDiv.style.flexWrap = "wrap";
      tagsDiv.style.gap = "8px";
      tagsDiv.style.marginTop = "16px";
      tagsDiv.style.boxSizing = "border-box";
      
      if (entry.contentKind) {
        const span = document.createElement("span");
        span.textContent = entry.contentKind;
        tagsDiv.appendChild(span);
      }
      for (const tag of entry.hashtags) {
        const a = document.createElement("span");
        a.textContent = `#${tag}`;
        tagsDiv.appendChild(a);
      }
      measureContainer.appendChild(tagsDiv);
      tagsHeight = tagsDiv.getBoundingClientRect().height;
      measureContainer.removeChild(tagsDiv);
    }

    document.body.removeChild(measureContainer);

    // Header, Footer, Padding values (in pixels)
    const HEADER_HEIGHT = 86; // includes avatar and 16px bottom margin
    const FOOTER_HEIGHT = 40; // includes top border, padding, text, margins
    const VERTICAL_PADDING = 80; // 40px top + 40px bottom padding

    // Calculate total content height
    let totalContentHeight = 0;
    
    // Media (Images)
    const imagesHeight = entryImages.length * 296; // 280px + 16px margin-bottom
    totalContentHeight += imagesHeight;

    // Trust badge
    totalContentHeight += trustHeight + 12; // trust badge height + margin-bottom

    // Title
    totalContentHeight += titleHeight + 16; // title height + margin-bottom

    // Paragraphs
    let paragraphsHeight = 0;
    for (let i = 0; i < measuredParagraphs.length; i++) {
      const p = measuredParagraphs[i];
      if (i > 0) {
        paragraphsHeight += 33; // divider top border + 16px top + 16px bottom margin
      }
      paragraphsHeight += p.height;
    }
    totalContentHeight += paragraphsHeight;

    // Tags
    if (tagsHeight > 0) {
      totalContentHeight += tagsHeight + 16; // tags height + 16px top margin
    }

    // Splitting settings
    const MAX_SINGLE_PAGE_CONTENT_HEIGHT = 1000;
    const TARGET_CONTENT_HEIGHT = 700;

    const splitParagraphIntoSentences = (text: string): string[] => {
      const matches = text.match(/[^.!?]+[.!?]+(?:\s+|$)/g);
      return matches ? matches.map(s => s.trim()) : [text];
    };

    const pages: any[] = [];

    if (totalContentHeight <= MAX_SINGLE_PAGE_CONTENT_HEIGHT) {
      // Short/Medium/Large post -> One single adaptive-height PNG
      const pageElements: any[] = [];
      
      // Images first
      for (const img of entryImages) {
        pageElements.push({ type: "image", image: img });
      }
      // Trust badges
      pageElements.push({ type: "trust_badge" });
      // Title
      pageElements.push({ type: "title", text: entry.title });
      // Paragraphs
      for (let i = 0; i < measuredParagraphs.length; i++) {
        pageElements.push({
          type: "paragraph",
          text: measuredParagraphs[i].text,
          hasDivider: i > 0
        });
      }
      // Tags
      if (tagsHeight > 0) {
        pageElements.push({ type: "tags" });
      }

      const calculatedPageHeight = Math.max(400, Math.ceil(HEADER_HEIGHT + totalContentHeight + FOOTER_HEIGHT + VERTICAL_PADDING));

      pages.push({
        elements: pageElements,
        pageHeight: calculatedPageHeight
      });
    } else {
      // Very large post -> Multiple uniform-height PNGs
      const elements: any[] = [];

      // Add images
      for (const img of entryImages) {
        elements.push({ type: "image", image: img, height: 296 });
      }
      // Add Trust Badge
      elements.push({ type: "trust_badge", height: trustHeight + 12 });
      // Add Title
      elements.push({ type: "title", text: entry.title, height: titleHeight + 16 });
      // Add Paragraphs
      for (let i = 0; i < measuredParagraphs.length; i++) {
        const p = measuredParagraphs[i];
        elements.push({
          type: "paragraph",
          text: p.text,
          height: p.height,
          hasDivider: i > 0,
          dividerHeight: i > 0 ? 33 : 0
        });
      }
      // Add Tags
      if (tagsHeight > 0) {
        elements.push({ type: "tags", height: tagsHeight + 16 });
      }

      let currentPageElements: any[] = [];
      let currentPageHeight = 0;

      const startNewPage = () => {
        if (currentPageElements.length > 0) {
          pages.push({ elements: currentPageElements, contentHeight: currentPageHeight });
        }
        currentPageElements = [];
        currentPageHeight = 0;
      };

      for (const elem of elements) {
        const elemHeight = elem.height + (elem.dividerHeight || 0);

        if (currentPageHeight + elemHeight > TARGET_CONTENT_HEIGHT) {
          if (currentPageElements.length > 0) {
            startNewPage();
          }

          if (elem.type === "paragraph" && elemHeight > TARGET_CONTENT_HEIGHT) {
            // Very long paragraph! Split by sentences
            const sentences = splitParagraphIntoSentences(elem.text);
            let currentSentenceChunk: string[] = [];
            let currentChunkHeight = 0;

            for (const sentence of sentences) {
              const tempContainer = document.createElement("div");
              tempContainer.style.position = "absolute";
              tempContainer.style.left = "-9999px";
              tempContainer.style.top = "-9999px";
              tempContainer.style.width = "520px";
              tempContainer.style.fontFamily = "Inter, sans-serif";
              tempContainer.style.boxSizing = "border-box";
              document.body.appendChild(tempContainer);

              const pMeasure = document.createElement("p");
              pMeasure.style.width = "520px";
              pMeasure.style.margin = "0";
              pMeasure.style.fontSize = "16px";
              pMeasure.style.lineHeight = "28px";
              pMeasure.style.fontFamily = "Inter, sans-serif";
              pMeasure.style.boxSizing = "border-box";
              pMeasure.textContent = sentence;
              tempContainer.appendChild(pMeasure);
              const sentenceHeight = pMeasure.getBoundingClientRect().height;
              document.body.removeChild(tempContainer);

              const sentenceTotalHeight = sentenceHeight + (currentSentenceChunk.length === 0 && elem.hasDivider ? 33 : 0);

              if (currentPageHeight + sentenceTotalHeight > TARGET_CONTENT_HEIGHT) {
                if (currentSentenceChunk.length > 0) {
                  currentPageElements.push({
                    type: "paragraph",
                    text: currentSentenceChunk.join(" "),
                    height: currentChunkHeight,
                    hasDivider: elem.hasDivider && currentPageElements.length === 0
                  });
                  currentPageHeight += currentChunkHeight;
                  currentSentenceChunk = [];
                  currentChunkHeight = 0;
                }
                startNewPage();
              }
              currentSentenceChunk.push(sentence);
              currentChunkHeight += sentenceHeight;
            }

            if (currentSentenceChunk.length > 0) {
              currentPageElements.push({
                type: "paragraph",
                text: currentSentenceChunk.join(" "),
                height: currentChunkHeight,
                hasDivider: elem.hasDivider && currentPageElements.length === 0
              });
              currentPageHeight += currentChunkHeight;
            }
          } else {
            currentPageElements.push(elem);
            currentPageHeight += elemHeight;
          }
        } else {
          currentPageElements.push(elem);
          currentPageHeight += elemHeight;
        }
      }

      if (currentPageElements.length > 0) {
        pages.push({ elements: currentPageElements, contentHeight: currentPageHeight });
      }

      // Calculate uniform height based on the tallest page content
      const maxPageContentHeight = Math.max(...pages.map(p => p.contentHeight));
      const uniformPageHeight = Math.max(400, Math.ceil(HEADER_HEIGHT + maxPageContentHeight + FOOTER_HEIGHT + VERTICAL_PADDING));

      // Apply the uniform height to all pages
      for (const p of pages) {
        p.pageHeight = uniformPageHeight;
      }
    }

    setInteractionMessage("Generating card(s)... Please wait.");
    setExportPages(pages);
    setIsExporting(true);
  };

  useEffect(() => {
    if (!isExporting || exportPages.length === 0) return;

    const generateAndDownload = async () => {
      // Short timeout to ensure React finishes DOM paint for the offscreen wrapper
      await new Promise((resolve) => setTimeout(resolve, 300));

      const container = document.getElementById(`export-wrapper-${entry.id}`);
      if (!container) {
        setIsExporting(false);
        setInteractionMessage("Export failed: wrapper container not found.");
        return;
      }

      const cards = container.getElementsByClassName("export-card");
      const sanitizedTitle = entry.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      
      const prefix = sanitizedTitle || "post";

      try {
        const { toPng } = await import("html-to-image");
        for (let i = 0; i < cards.length; i++) {
          const card = cards[i] as HTMLElement;
          // generate PNG
          const dataUrl = await toPng(card, {
            quality: 0.98,
            backgroundColor: "#ffffff",
            pixelRatio: 2, // 2x scaling for crisp quality
            style: {
              transform: "scale(1)",
              transformOrigin: "top left"
            }
          });

          // download
          const link = document.createElement("a");
          const name = cards.length === 1
            ? `readative-${prefix}.png`
            : `readative-${prefix}-part-${i + 1}.png`;
          link.download = name;
          link.href = dataUrl;
          link.click();
        }
        setInteractionMessage("Download started!");
        setTimeout(() => setInteractionMessage(null), 3000);
      } catch (err) {
        console.error("Failed to export PNG:", err);
        setInteractionMessage("Export failed. Please try again.");
      } finally {
        setIsExporting(false);
        setExportPages([]);
      }
    };

    void generateAndDownload();
  }, [isExporting, exportPages, entry.id, entry.title]);

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
        "overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-[0_16px_42px_rgba(15,23,42,0.08)] transition-shadow duration-200 hover:shadow-[0_20px_54px_rgba(15,23,42,0.11)]",
        highlighted &&
          "ring-2 ring-emerald-400 ring-offset-4 ring-offset-[#f7f8fb]",
      )}
    >
      <CardHeader
        entry={entry}
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
        onDownload={handleDownload}
        setShowEditModal={setShowEditModal}
        onDeleteEntry={handleDeleteEntry}
        hasHighlights={hasHighlights}
      />

      <CardMedia
        entryImages={entryImages}
        imageLayout={imageLayout}
        title={entry.title}
      />

      <div className="p-4 pt-3 sm:p-5">
        <CardTrust
          trustToneClass={trustToneClass}
          trustMetrics={trustMetrics}
          trustLabel={trustLabel}
          localSaveCount={localSaveCount}
          entry={entry}
          entryVisibility={entryVisibility}
          isHighlightMode={isHighlightMode}
          onToggleHighlightMode={handleToggleHighlightMode}
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
          isHighlightMode={isHighlightMode}
          highlights={cardHighlights}
          onAddHighlight={addHighlight}
          onRemoveHighlight={removeHighlight}
        />

        <div className="mt-4 flex flex-col gap-2.5 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
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

      {/* Offscreen card rendering for PNG downloads */}
      {isExporting && (
        <div
          id={`export-wrapper-${entry.id}`}
          style={{
            position: "absolute",
            left: "-9999px",
            top: "-9999px",
            pointerEvents: "none"
          }}
        >
          {exportPages.map((page: any, pageIndex: number) => (
            <div
              key={pageIndex}
              className="export-card"
              style={{
                width: "600px",
                height: page.pageHeight ? `${page.pageHeight}px` : "800px",
                padding: "40px",
                backgroundColor: "#ffffff",
                color: "#0f172a",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
                fontFamily: "Inter, sans-serif",
                boxSizing: "border-box",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 16px 42px rgba(15,23,42,0.08)"
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                {/* Avatar */}
                <div style={{ width: "48px", height: "48px", borderRadius: "16px", overflow: "hidden", border: "1px solid #e2e8f0", flexShrink: 0 }}>
                  {authorProfile?.profileImage?.dataUrl || authorProfile?.photoUrl ? (
                    <img
                      src={authorProfile?.profileImage?.dataUrl || authorProfile?.photoUrl}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      loading="eager"
                    />
                  ) : (
                    <div style={{
                      width: "100%",
                      height: "100%",
                      backgroundColor: "#f1f5f9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                      fontSize: "14px",
                      color: "#1e293b"
                    }}>
                      {(authorDisplayName || entry.author || "R").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                {/* User Info */}
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "15px", fontWeight: 900, color: "#0f172a" }}>
                      {authorDisplayName}
                    </span>
                    {authorReputation && (
                      <span
                        title={reputationTitle}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "20px",
                          height: "20px",
                          borderRadius: "9999px",
                          backgroundColor: "#ecfdf5",
                          border: "1px solid #a7f3d0",
                          color: "#047857"
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="8" r="7" />
                          <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", marginTop: "2px" }}>
                    @{authorUsername}
                  </span>
                </div>
              </div>

              {/* Main Content Area */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                {page.elements.map((elem: any, elemIndex: number) => {
                  if (elem.type === "title") {
                    return (
                      <h3
                        key={elemIndex}
                        style={{
                          margin: "0 0 16px 0",
                          fontSize: "28px",
                          fontWeight: 900,
                          lineHeight: "1.2",
                          color: "#0f172a",
                          fontFamily: "Inter, sans-serif"
                        }}
                      >
                        {elem.text}
                      </h3>
                    );
                  }
                  if (elem.type === "trust_badge") {
                    return (
                      <div key={elemIndex} style={{ marginBottom: "12px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${trustToneClass}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            borderRadius: "9999px",
                            border: "1px solid currentColor",
                            padding: "2px 6px",
                            fontSize: "9px",
                            fontWeight: "bold",
                            letterSpacing: "0.08em",
                            textTransform: "uppercase"
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            <path d="M9 11l2 2 4-4" />
                          </svg>
                          {trustLabel}
                        </span>
                        {trustMetrics.helpfulCount >= 5 && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-700"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              borderRadius: "9999px",
                              border: "1px solid #a7f3d0",
                              backgroundColor: "#ecfdf5",
                              padding: "2px 6px",
                              fontSize: "9px",
                              fontWeight: "bold",
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              color: "#047857"
                            }}
                          >
                            Most Helpful
                          </span>
                        )}
                        {localSaveCount >= 3 && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-sky-700"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              borderRadius: "9999px",
                              border: "1px solid #bae6fd",
                              backgroundColor: "#f0f9ff",
                              padding: "2px 6px",
                              fontSize: "9px",
                              fontWeight: "bold",
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              color: "#0369a1"
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                            </svg>
                            Most Saved
                          </span>
                        )}
                        {entry.contentKind === "tutorial" && trustMetrics.helpfulCount >= 3 && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-indigo-700"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              borderRadius: "9999px",
                              border: "1px solid #c7d2fe",
                              backgroundColor: "#eef2ff",
                              padding: "2px 6px",
                              fontSize: "9px",
                              fontWeight: "bold",
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              color: "#4338ca"
                            }}
                          >
                            Top Tutorial
                          </span>
                        )}
                        {entryVisibility === "private" && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-600"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              borderRadius: "9999px",
                              backgroundColor: "#f1f5f9",
                              padding: "2px 6px",
                              fontSize: "9px",
                              fontWeight: "bold",
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              color: "#475569"
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            Private
                          </span>
                        )}
                      </div>
                    );
                  }
                  if (elem.type === "image") {
                    return (
                      <div key={elemIndex} style={{ width: "100%", height: "280px", marginBottom: "16px", overflow: "hidden", borderRadius: "8px" }}>
                        <img
                          src={elem.image.dataUrl}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          loading="eager"
                        />
                      </div>
                    );
                  }
                  if (elem.type === "paragraph") {
                    return (
                      <div key={elemIndex}>
                        {elem.hasDivider && (
                          <div style={{ borderTop: "1px solid #f1f5f9", margin: "16px 0" }} />
                        )}
                        <p
                          style={{
                            margin: "0",
                            fontSize: "16px",
                            lineHeight: "28px",
                            color: "#334155",
                            fontFamily: "Inter, sans-serif",
                            whiteSpace: "pre-wrap"
                          }}
                        >
                          {elem.text}
                        </p>
                      </div>
                    );
                  }
                  if (elem.type === "tags") {
                    return (
                      <div key={elemIndex} style={{ marginTop: "16px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {entry.contentKind && (
                          <span
                            style={{
                              borderRadius: "9999px",
                              border: "1px solid #cbd5e1",
                              backgroundColor: "#ffffff",
                              padding: "4px 12px",
                              fontSize: "12px",
                              fontWeight: 900,
                              textTransform: "capitalize",
                              color: "#64748b"
                            }}
                          >
                            {entry.contentKind}
                          </span>
                        )}
                        {entry.hashtags.map((tag: string) => (
                          <span
                            key={tag}
                            style={{
                              borderRadius: "9999px",
                              border: "1px solid #a7f3d0",
                              backgroundColor: "#ecfdf5",
                              padding: "4px 12px",
                              fontSize: "12px",
                              fontWeight: 600,
                              color: "#047857"
                            }}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>

              {/* Footer */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: "12px", marginTop: "12px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8" }}>
                  {exportPages.length > 1 ? `Part ${pageIndex + 1} of ${exportPages.length}` : ""}
                </span>
                <span style={{ fontSize: "12px", fontWeight: 900, color: "#10b981", letterSpacing: "0.1em" }}>
                  readative.com
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
});
