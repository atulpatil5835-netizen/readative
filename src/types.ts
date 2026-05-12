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
}

export interface UserSocialLinks {
  linkedin?: string;
  instagram?: string;
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
  bannerImage?: KnowledgeImageAsset | null;
  profileImage?: KnowledgeImageAsset | null;
  photoUrl?: string | null;
  createdAt: number;
  updatedAt: number;
  lastUsernameChangedAt: number | null;
}

export interface UserNotification {
  id: string;
  targetAuthorId: string;
  actorAuthorId: string;
  actorUsername: string;
  type: "like" | "comment" | "tag";
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
  createdAt: number;
}

export interface SmartQuestion {
  id: string;
  author: string;
  authorId?: string;
  content: string;
  createdAt: number;
  answers: SmartAnswer[];
}
