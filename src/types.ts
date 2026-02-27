export interface Post {
  id: string;
  author: string;
  content: string;
  type: 'joke' | 'motivation' | 'story';
  hashtags: string[];
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
  text: string;
  createdAt: number;
}

export interface UserProfile {
  id: string;
  name: string;
  photo: string;
  readingScore: number;
  examScore: number;
  readPosts: string[]; // IDs of posts read
  following: string[]; // IDs/Names of followed users
  preferredLanguage?: string;
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
