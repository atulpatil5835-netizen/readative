export type PostCategory = 'story' | 'joke' | 'motivation' | 'poetry' | 'shayari' | 'knowledge' | 'questions';

export interface Post {
  id: string;
  author: string;
  authorId: string;
  content: string;
  type: PostCategory;
  hashtags: string[];
  likes: string[];        // array of user IDs
  stars: number;
  ratingCount: number;
  comments: Comment[];
  createdAt: number;
  highlights?: Highlight[];
}

export interface Highlight {
  id: string;
  start: number;
  end: number;
  type: 'highlight' | 'underline';
  color: string;
}

export interface Comment {
  id: string;
  author: string;
  authorId?: string;
  text: string;
  createdAt: number;
  isAI?: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  photo: string;
  readingScore: number;
  examScore: number;
  readPosts: string[];
  following: string[];
  preferredLanguage?: string;
  email?: string;
  avatar?: string;
}

export interface ExamQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface SmartAnswer {
  id: string;
  author: string;
  content: string;
  type: 'user' | 'ai';
  likes: number;
  dislikes: number;
  createdAt: number;
}

export interface SmartQuestion {
  id: string;
  author: string;
  content: string;
  createdAt: number;
  answers: SmartAnswer[];
}