import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirebaseAdminAuth, getFirebaseAdminDb, getFirebaseAdminTechNewsDb } from "./_authAdmin.js";

const TECH_NEWS_EDITOR_EMAIL = "atulpatil5835@gmail.com";
const MAX_IMAGE_DATA_URL_LENGTH = 125_000;

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
const READ_API_CACHE_CONTROL =
  "public, max-age=0, s-maxage=60, stale-while-revalidate=300";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader(
    "Cache-Control",
    req.method === "GET" ? READ_API_CACHE_CONTROL : "no-store",
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { id, action } = req.query;
  const postId = Array.isArray(id) ? id[0] : id;
  const postAction = Array.isArray(action) ? action[0] : action;

  if ((req.method === "GET" || req.method === "HEAD") && postAction === "tech-news-image") {
    const idValue = typeof postId === "string" ? postId : "";
    if (!/^[a-zA-Z0-9_-]{8,160}$/.test(idValue)) return res.status(404).end();
    try {
      const snapshot = await getFirebaseAdminDb().collection("knowledge").doc(idValue).get();
      if (!snapshot.exists) return res.status(404).end();
      const entry = snapshot.data() || {};
      if (entry.visibility !== "public" || entry.contentKind !== "news" || String(entry.authorEmail || "").trim().toLowerCase() !== TECH_NEWS_EDITOR_EMAIL) return res.status(404).end();
      const image = Array.isArray(entry.images) ? entry.images[0] : null;
      const dataUrl = typeof image?.dataUrl === "string" ? image.dataUrl : typeof entry.imageDataUrl === "string" ? entry.imageDataUrl : "";
      const match = dataUrl.match(/^data:image\/(webp|jpeg|png);base64,([a-zA-Z0-9+/=]+)$/i);
      if (!match) return res.redirect(302, "/default-tech-news-og.svg");
      res.setHeader("Content-Type", `image/${match[1].toLowerCase()}`);
      res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000");
      res.setHeader("X-Content-Type-Options", "nosniff");
      if (req.method === "HEAD") return res.status(200).end();
      return res.status(200).send(Buffer.from(match[2], "base64"));
    } catch (error) {
      console.error("Tech News image request failed:", error);
      return res.redirect(302, "/default-tech-news-og.svg");
    }
  }

  if (req.method === "POST" && postAction === "tech-news") {
    try {
      const authorization = req.headers.authorization;
      const header = Array.isArray(authorization) ? authorization[0] || "" : authorization || "";
      const token = header.match(/^Bearer\s+(.+)$/i)?.[1] || "";
      if (!token) return res.status(401).json({ error: "Sign in to publish news." });

      const decoded = await getFirebaseAdminAuth().verifyIdToken(token, true);
      const email = decoded.email?.trim().toLowerCase() || "";
      if (email !== TECH_NEWS_EDITOR_EMAIL || decoded.email_verified !== true) {
        return res.status(403).json({ error: "This account cannot publish Tech News." });
      }

      const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 160) : "";
      const content = typeof req.body?.content === "string" ? req.body.content.trim().slice(0, 20_000) : "";
      const rawHashtags = Array.isArray(req.body?.hashtags) ? req.body.hashtags : [];
      const hashtags = [...new Set(rawHashtags
        .filter((tag: unknown): tag is string => typeof tag === "string")
        .map((tag: string) => tag.replace(/^#/, "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, ""))
        .filter(Boolean))].slice(0, 8);
      const image = req.body?.image as {
        dataUrl?: string;
        mimeType?: string;
        width?: number;
        height?: number;
      } | undefined;
      if (title.length < 6 || content.length < 40) {
        return res.status(400).json({ error: "Add a headline and complete news content." });
      }
      if (
        !image ||
        typeof image.dataUrl !== "string" ||
        image.dataUrl.length > MAX_IMAGE_DATA_URL_LENGTH ||
        !/^data:image\/(webp|jpeg|png);base64,/i.test(image.dataUrl) ||
        !["image/webp", "image/jpeg", "image/png"].includes(image.mimeType || "") ||
        !Number.isFinite(image.width) ||
        !Number.isFinite(image.height) ||
        image.width > 1000 ||
        image.height > 1000
      ) {
        return res.status(400).json({ error: "Choose a compressed image under 1000 pixels." });
      }

      const createdAt = Date.now();
      const reference = getFirebaseAdminTechNewsDb().collection("knowledge").doc();
      const entry = {
        id: reference.id,
        author: typeof decoded.name === "string" && decoded.name.trim() ? decoded.name.trim() : "Readative Editorial",
        authorId: decoded.uid,
        authorEmail: TECH_NEWS_EDITOR_EMAIL,
        title,
        content,
        contentKind: "news",
        category: null,
        visibility: "public",
        hashtags,
        likes: [],
        likeCount: 0,
        helpfulIds: [],
        helpfulCount: 0,
        dislikes: [],
        dislikeCount: 0,
        misleadingIds: [],
        misleadingCount: 0,
        savedBy: [],
        saveCount: 0,
        comments: [],
        mentions: [],
        images: [{ dataUrl: image.dataUrl, mimeType: image.mimeType, width: image.width, height: image.height, optimizedAt: createdAt }],
        imageLayout: "wide",
        imageDataUrl: image.dataUrl,
        imageMimeType: image.mimeType,
        imageWidth: image.width,
        imageHeight: image.height,
        imageOptimizedAt: createdAt,
        createdAt,
        updatedAt: createdAt,
        excerpt: content.length > 180 ? `${content.slice(0, 177).trim()}...` : content,
        readingMinutes: Math.max(1, Math.ceil(content.split(/\s+/).length / 180)),
      };

      await reference.set(entry);
      return res.status(201).json({ entry });
    } catch (error) {
      console.error("Tech News publish failed:", error);
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("tech news publishing is disabled")) {
        return res.status(503).json({ error: "Tech News publishing is unavailable right now." });
      }
      if (message.includes("id token") || message.includes("token has expired")) {
        return res.status(401).json({ error: "Your sign-in session expired. Sign in again to publish." });
      }
      return res.status(500).json({ error: "Could not publish this news item." });
    }
  }

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
