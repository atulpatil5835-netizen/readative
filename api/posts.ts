import type { VercelRequest, VercelResponse } from "@vercel/node"

interface Comment {
  id: string
  author: string
  authorId?: string
  text: string
  createdAt: number
  isAI?: boolean
}

interface Post {
  id: string
  author: string
  authorId: string
  content: string
  type: string
  hashtags: string[]
  likes: string[]
  stars: number
  ratingCount: number
  comments: Comment[]
  createdAt: number
  aiCommentScheduledAt?: number
  aiCommentPosted?: boolean
}

// In-memory store (resets on cold start — upgrade to Firestore later)
let posts: Post[] = []

async function callGemini(prompt: string): Promise<string> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY
  if (!GEMINI_API_KEY) return ""
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    )
    const data = await response.json()
    if (data.error) { console.error("Gemini error:", data.error.message); return "" }
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || ""
  } catch (e) {
    console.error("Gemini fetch error:", e)
    return ""
  }
}

function randomDelayMs(): number {
  const days = 2 + Math.random() * 3
  return Math.floor(days * 24 * 60 * 60 * 1000)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
  if (req.method === "OPTIONS") return res.status(200).end()

  const { id, action } = req.query
  const postId = Array.isArray(id) ? id[0] : id
  const postAction = Array.isArray(action) ? action[0] : action

  // GET /api/posts
  if (req.method === "GET" && !postId) {
    const rawCategory = req.query.category
    const category = Array.isArray(rawCategory) ? rawCategory[0] : rawCategory
    if (category && category !== "all") {
      return res.json(posts.filter((p) => p.type === category))
    }
    return res.json(posts)
  }

  // POST /api/posts
  if (req.method === "POST" && !postId) {
    const scheduledAt = Date.now() + randomDelayMs()
    const newPost: Post = {
      id: Math.random().toString(36).substr(2, 9),
      likes: [],
      stars: 0,
      ratingCount: 0,
      comments: [],
      createdAt: Date.now(),
      aiCommentScheduledAt: scheduledAt,
      aiCommentPosted: false,
      ...req.body,
    }
    posts.unshift(newPost)

    // AI comment after 2-5 days if rating >= 4.5 (checked via cron)
    res.json(newPost)
    return
  }

  // POST /api/posts/:id/like
  if (req.method === "POST" && postId && postAction === "like") {
    const post = posts.find((p) => p.id === postId)
    if (!post) return res.status(404).json({ error: "Post not found" })
    const { userId } = req.body
    const idx = post.likes.indexOf(userId)
    if (idx === -1) { post.likes.push(userId) } else { post.likes.splice(idx, 1) }
    return res.json({ likes: post.likes })
  }

  // POST /api/posts/:id/rate
  if (req.method === "POST" && postId && postAction === "rate") {
    const post = posts.find((p) => p.id === postId)
    if (!post) return res.status(404).json({ error: "Post not found" })
    const { stars } = req.body
    post.ratingCount += 1
    post.stars = (post.stars * (post.ratingCount - 1) + stars) / post.ratingCount
    return res.json({ stars: post.stars, ratingCount: post.ratingCount })
  }

  // GET /api/posts/:id/comments
  if (req.method === "GET" && postId && postAction === "comments") {
    const post = posts.find((p) => p.id === postId)
    if (!post) return res.status(404).json([])
    return res.json(post.comments)
  }

  // POST /api/posts/:id/comments
  if (req.method === "POST" && postId && postAction === "comments") {
    const post = posts.find((p) => p.id === postId)
    if (!post) return res.status(404).json({ error: "Post not found" })
    const comment: Comment = {
      id: Math.random().toString(36).substr(2, 9),
      createdAt: Date.now(),
      ...req.body,
    }
    post.comments.push(comment)
    return res.json(comment)
  }

  return res.status(404).json({ error: "Route not found" })
}
