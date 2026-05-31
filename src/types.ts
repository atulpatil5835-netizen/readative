export interface TaggedUser {
  authorId: string;
  username: string;
}

export interface KnowledgeComment {
  id: string;
  author: string;
  authorId?: string;
  text: string;
  mentions?: TaggedUser[];
  createdAt: number;
}

export type KnowledgeImageLayout = "wide" | "portrait";
export type KnowledgeVisibility = "public" | "private";

export interface KnowledgeImageAsset {
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  optimizedAt: number;
}

export interface KnowledgeEntry {
  id: string;
  author: string;
  authorId: string;
  authorEmail: string;
  title: string;
  content: string;
  visibility: KnowledgeVisibility;
  hashtags: string[];
  likes: string[];
  likeCount?: number | null;
  helpfulIds?: string[];
  helpfulCount?: number | null;
  dislikes?: string[];
  dislikeCount?: number | null;
  misleadingIds?: string[];
  misleadingCount?: number | null;
  comments: KnowledgeComment[];
  mentions: TaggedUser[];
  createdAt: number;
  updatedAt?: number | null;
  images?: KnowledgeImageAsset[];
  imageLayout?: KnowledgeImageLayout | null;
  imageDataUrl?: string | null;
  imageMimeType?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  imageOptimizedAt?: number | null;
  excerpt?: string | null;
  readingMinutes?: number | null;
  qualityScore?: number | null;
  contentKind?: string | null;
  category?: string | null;
  savedBy?: string[];
  saveCount?: number | null;
}

export interface UserSocialLinks {
  linkedin?: string;
  instagram?: string;
  github?: string;
  twitter?: string;
  website?: string;
  youtube?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  username: string;
  usernameLower: string;
  jobTitle: string;
  bio: string;
  socialLinks: UserSocialLinks;
  showSocialLinksOnPosts: boolean;
  likedKnowledgeIds: string[];
  savedKnowledgeIds: string[];
  savedSmartTalkIds: string[];
  bannerImage?: KnowledgeImageAsset | null;
  profileImage?: KnowledgeImageAsset | null;
  photoUrl?: string | null;
  createdAt: number;
  updatedAt: number;
  lastUsernameChangedAt: number | null;
  reputationScore?: number | null;
  helpfulCount?: number | null;
  misleadingCount?: number | null;
  bestAnswerCount?: number | null;
}

export interface UserNotification {
  id: string;
  targetAuthorId: string;
  actorAuthorId: string;
  actorUsername: string;
  type:
    | "like"
    | "comment"
    | "tag"
    | "level-up"
    | "trust-score"
    | "best-answer"
    | "helpful-milestone";
  entryId: string;
  entryTitle: string;
  preview: string;
  read: boolean;
  createdAt: number;
}

export interface ExamQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface SmartAnswer {
  id: string;
  author: string;
  authorId?: string;
  content: string;
  likes: string[];
  dislikes: string[];
  helpfulIds?: string[];
  helpfulCount?: number | null;
  misleadingIds?: string[];
  misleadingCount?: number | null;
  bestAnswer?: boolean;
  createdAt: number;
}

export interface SmartQuestion {
  id: string;
  author: string;
  authorId?: string;
  content: string;
  createdAt: number;
  answers: SmartAnswer[];
  category?: string | null;
  difficulty?: string | null;
  savedBy?: string[];
  saveCount?: number | null;
}
