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
  isAI?: boolean;
}

export interface KnowledgeEntry {
  id: string;
  author: string;
  authorId: string;
  authorEmail: string;
  title: string;
  content: string;
  hashtags: string[];
  likes: string[];
  comments: KnowledgeComment[];
  mentions: TaggedUser[];
  createdAt: number;
  imageDataUrl?: string | null;
  imageMimeType?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  imageOptimizedAt?: number | null;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  usernameLower: string;
  bio: string;
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
  type: "user" | "ai";
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
