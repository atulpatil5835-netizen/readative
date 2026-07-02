import {
  KnowledgeComment,
  KnowledgeEntry,
  KnowledgeImageAsset,
  KnowledgeImageLayout,
  UserProfile,
  KnowledgeVisibility,
} from "../../types";
import { type ContributorReputation } from "../../utils/trustSystem";
import { type KnowledgeIdentity } from "../../utils/knowledgeIdentity";
import { type TrustMetrics } from "../../utils/trustSystem";
import type { InkColor, InkWidth } from "../../ink/types";

export interface CommentMentionState {
  query: string;
  start: number;
}

export interface EditPostModalProps {
  entry: KnowledgeEntry;
  onClose: () => void;
  onSave: (input: {
    title: string;
    content: string;
    hashtagInput: string;
    visibility: KnowledgeVisibility;
  }) => Promise<void>;
}

export interface CardHeaderProps {
  resolvedAuthorId: string;
  authorProfile?: UserProfile;
  authorDisplayName: string;
  authorUsername: string;
  authorReputation?: ContributorReputation;
  reputationTitle: string;
  shouldShowAuthorSocialLinks: boolean;
  canManageEntry: boolean;
  isSaved: boolean;
  isUpdatingSave: boolean;
  isDeleting: boolean;
  onOpenAuthorProfile: (authorId: string) => void;
  onSaveToggle: () => void;
  onShare: () => void;
  onDownload: () => void;
  setShowEditModal: (show: boolean) => void;
  onDeleteEntry: () => void;
  hasInk?: boolean;
}

export interface CardMediaProps {
  entryImages: KnowledgeImageAsset[];
  imageLayout: KnowledgeImageLayout;
  title: string;
}

export interface CardTrustProps {
  trustToneClass: string;
  trustMetrics: TrustMetrics;
  trustLabel: string;
  localSaveCount: number;
  entry: KnowledgeEntry;
  entryVisibility: "public" | "private";
  isInkMode?: boolean;
  inkColor: InkColor;
  inkWidth: InkWidth;
  onToggleInkMode?: () => void;
  onSetInkColor: (color: InkColor) => void;
  onSetInkWidth: (width: InkWidth) => void;
}

export interface CardContentProps {
  entry: KnowledgeEntry;
  contentSections: string[];
  mentions: { authorId: string; username: string }[];
  onOpenAuthorProfile: (authorId: string) => void;
  onOpenEntryDetails: () => void;
  onSelectHashtag: (tag: string) => void;
  topComment: KnowledgeComment | null;
  topCommentProfile?: UserProfile;
  topCommentDisplayName: string;
  topCommentUsername: string;
  currentUserId: string | null;
  isFocusedPost: boolean;
  isInkMode: boolean;
  shouldRenderInk: boolean;
  inkColor: InkColor;
  inkWidth: InkWidth;
  onPostHasInk: (postId: string) => void;
  onInkStatus: (message: string) => void;
}

export interface CardActionsProps {
  isHelpful: boolean;
  isMisleading: boolean;
  isUpdatingTrust: boolean;
  helpfulCount: number;
  misleadingCount: number;
  commentsCount: number;
  showComments: boolean;
  helpfulAnimationVersion: number;
  onHelpful: () => void;
  onMisleading: () => void;
  onToggleComments: () => void;
}

export interface CardCommentsProps {
  entry: KnowledgeEntry;
  activeIdentity: KnowledgeIdentity | null;
  commentText: string;
  setCommentText: (text: string) => void;
  commentInputRef: React.RefObject<HTMLInputElement | null>;
  commentMessage: string | null;
  isCommenting: boolean;
  isModeratingComment: boolean;
  activeCommentMention: CommentMentionState | null;
  filteredCommentMentionProfiles: UserProfile[];
  localComments: KnowledgeComment[];
  profileMap: ReadonlyMap<string, UserProfile>;
  onCommentSubmit: () => void;
  onCommentMentionInsert: (profile: UserProfile) => void;
  onOpenAuthorProfile: (authorId: string) => void;
  updateCommentMentionState: (value: string, cursorPosition: number) => void;
  setCommentMessage: (msg: string | null) => void;
  onIdentityRequired: (action: {
    type: "helpful" | "misleading" | "comment" | "save" | "ink";
    entryId: string;
  }) => void;
}
