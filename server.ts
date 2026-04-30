import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;

interface Comment {
  id: string;
  author: string;
  authorId?: string;
  text: string;
  createdAt: number;
}

interface Post {
  id: string;
  author: string;
  authorId: string;
  content: string;
  type: string;
  hashtags: string[];
  likes: string[];
  stars: number;
  ratingCount: number;
  comments: Comment[];
  createdAt: number;
}

interface ProfileData {
  id: string;
  name?: string;
  photo?: string;
  email?: string;
  readingScore?: number;
  examScore?: number;
  readPosts?: string[];
  following?: string[];
  preferredLanguage?: string;
}

let posts: Post[] = [];
const profiles = new Map<string, ProfileData>();

app.get("/api/posts", (req, res) => {
  const { category } = req.query;
  if (category && category !== "all") {
    return res.json(posts.filter((post) => post.type === category));
  }

  return res.json(posts);
});

app.post("/api/posts", (req, res) => {
  const newPost: Post = {
    id: Math.random().toString(36).slice(2, 11),
    likes: [],
    stars: 0,
    ratingCount: 0,
    comments: [],
    createdAt: Date.now(),
    ...req.body,
  };

  posts.unshift(newPost);
  return res.json(newPost);
});

app.post("/api/posts/:id/like", (req, res) => {
  const { userId } = req.body;
  const post = posts.find((item) => item.id === req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });

  const likeIndex = post.likes.indexOf(userId);
  if (likeIndex === -1) {
    post.likes.push(userId);
  } else {
    post.likes.splice(likeIndex, 1);
  }

  return res.json({ likes: post.likes });
});

app.post("/api/posts/:id/rate", (req, res) => {
  const { stars } = req.body;
  const post = posts.find((item) => item.id === req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });

  post.ratingCount += 1;
  post.stars = (post.stars * (post.ratingCount - 1) + stars) / post.ratingCount;
  return res.json({ stars: post.stars, ratingCount: post.ratingCount });
});

app.get("/api/posts/:id/comments", (req, res) => {
  const post = posts.find((item) => item.id === req.params.id);
  if (!post) return res.status(404).json([]);

  return res.json(post.comments);
});

app.post("/api/posts/:id/comments", (req, res) => {
  const post = posts.find((item) => item.id === req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });

  const comment: Comment = {
    id: Math.random().toString(36).slice(2, 11),
    createdAt: Date.now(),
    ...req.body,
  };

  post.comments.push(comment);
  return res.json(comment);
});

app.get("/api/profile/:id", (req, res) => {
  const id = req.params.id;
  const current = profiles.get(id) ?? {
    id,
    readingScore: 0,
    examScore: 0,
    readPosts: [],
    following: [],
    preferredLanguage: "English",
  };

  return res.json(current);
});

app.post("/api/profile/:id", (req, res) => {
  const id = req.params.id;
  const previous = profiles.get(id) ?? { id };
  const next = {
    ...previous,
    ...req.body,
    id,
  };

  profiles.set(id, next);
  return res.json(next);
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
