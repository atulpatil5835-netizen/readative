import type { VercelRequest, VercelResponse } from "@vercel/node";

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

let posts: Post[] = [];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { id, action } = req.query;
  const postId = Array.isArray(id) ? id[0] : id;
  const postAction = Array.isArray(action) ? action[0] : action;

  if (req.method === "GET" && !postId) {
    const rawCategory = req.query.category;
    const category = Array.isArray(rawCategory) ? rawCategory[0] : rawCategory;

    if (category && category !== "all") {
      return res.json(posts.filter((post) => post.type === category));
    }

    return res.json(posts);
  }

  if (req.method === "POST" && !postId) {
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
  }

  if (req.method === "POST" && postId && postAction === "like") {
    const post = posts.find((item) => item.id === postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const { userId } = req.body;
    const likeIndex = post.likes.indexOf(userId);
    if (likeIndex === -1) {
      post.likes.push(userId);
    } else {
      post.likes.splice(likeIndex, 1);
    }

    return res.json({ likes: post.likes });
  }

  if (req.method === "POST" && postId && postAction === "rate") {
    const post = posts.find((item) => item.id === postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const { stars } = req.body;
    post.ratingCount += 1;
    post.stars =
      (post.stars * (post.ratingCount - 1) + stars) / post.ratingCount;
    return res.json({ stars: post.stars, ratingCount: post.ratingCount });
  }

  if (req.method === "GET" && postId && postAction === "comments") {
    const post = posts.find((item) => item.id === postId);
    if (!post) return res.status(404).json([]);

    return res.json(post.comments);
  }

  if (req.method === "POST" && postId && postAction === "comments") {
    const post = posts.find((item) => item.id === postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const comment: Comment = {
      id: Math.random().toString(36).slice(2, 11),
      createdAt: Date.now(),
      ...req.body,
    };

    post.comments.push(comment);
    return res.json(comment);
  }

  return res.status(404).json({ error: "Route not found" });
}
