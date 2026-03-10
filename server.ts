import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, ".env") })
dotenv.config({ path: path.resolve(process.cwd(), ".env") })
dotenv.config()

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ""

console.log("🔑 GEMINI KEY:", GEMINI_API_KEY ? `${GEMINI_API_KEY.slice(0, 8)}...` : "❌ NOT FOUND")

const app = express()
app.use(cors())
app.use(express.json())

const PORT = 5000

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

interface ProfileData {
  id: string
  name?: string
  photo?: string
  email?: string
  readingScore?: number
  examScore?: number
  readPosts?: string[]
  following?: string[]
  preferredLanguage?: string
}

let posts: Post[] = []
const profiles = new Map<string, ProfileData>()

async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    console.error("❌ No Gemini API key found!")
    return ""
  }
  try {
    console.log("🤖 Calling Gemini:", prompt.slice(0, 80) + "...")
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    )
    const data = await response.json()

    if (data.error) {
      console.error("❌ Gemini API error:", data.error.message)
      return ""
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ""
    console.log("✅ Gemini response:", text.slice(0, 80) + "...")
    return text
  } catch (error) {
    console.error("❌ Gemini fetch error:", error)
    return ""
  }
}

function randomDelayMs(): number {
  const minDays = 2
  const maxDays = 5
  const days = minDays + Math.random() * (maxDays - minDays)
  return Math.floor(days * 24 * 60 * 60 * 1000)
}

async function checkScheduledAIComments() {
  const now = Date.now()
  for (const post of posts) {
    if (post.aiCommentPosted) continue
    if (!post.aiCommentScheduledAt) continue
    if (post.stars < 4.5) continue
    if (now < post.aiCommentScheduledAt) continue

    console.log(`⏰ Posting scheduled AI comment on post ${post.id} (stars: ${post.stars})`)
    try {
      const categoryLabel = post.type.charAt(0).toUpperCase() + post.type.slice(1)
      const aiPrompt = `You are a thoughtful, well-read literary critic and reader on Readative — a social reading/writing platform.

This post has received high ratings from the community. Write ONE meaningful, insightful comment (3-4 sentences) that:
- Responds specifically to the content of the post
- Highlights what makes it particularly good
- Feels genuine, not generic

Post category: ${categoryLabel}
Post by ${post.author}:
"${post.content}"

Your comment:`

      const aiText = await callGemini(aiPrompt)
      if (aiText && aiText.trim()) {
        const aiComment: Comment = {
          id: Math.random().toString(36).substr(2, 9),
          author: "Readative AI",
          isAI: true,
          text: aiText.trim(),
          createdAt: now,
        }
        post.comments.push(aiComment)
        post.aiCommentPosted = true
        console.log(`✅ Scheduled AI comment posted on post ${post.id}`)
      }
    } catch (e) {
      console.error("❌ Scheduled AI comment failed:", e)
    }
  }
}

setInterval(checkScheduledAIComments, 30 * 60 * 1000)

app.get("/api/test-ai", async (req, res) => {
  console.log("🧪 Test AI route hit")
  const result = await callGemini("Say hello in one sentence.")
  res.json({
    key: GEMINI_API_KEY ? `${GEMINI_API_KEY.slice(0, 8)}...` : "❌ NOT FOUND",
    result,
  })
})

app.get("/api/posts", (req, res) => {
  const { category } = req.query
  if (category && category !== "all") {
    return res.json(posts.filter((p) => p.type === category))
  }
  res.json(posts)
})

app.post("/api/posts", async (req, res) => {
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
  console.log(`📅 Post ${newPost.id} — AI comment in ~${Math.round((scheduledAt - Date.now()) / 86400000 * 10) / 10} days if rating ≥ 4.5`)
  res.json(newPost)
})

app.post("/api/posts/:id/like", (req, res) => {
  const { userId } = req.body
  const post = posts.find((p) => p.id === req.params.id)
  if (!post) return res.status(404).json({ error: "Post not found" })
  const idx = post.likes.indexOf(userId)
  if (idx === -1) { post.likes.push(userId) } else { post.likes.splice(idx, 1) }
  res.json({ likes: post.likes })
})

app.post("/api/posts/:id/rate", (req, res) => {
  const { stars } = req.body
  const post = posts.find((p) => p.id === req.params.id)
  if (!post) return res.status(404).json({ error: "Post not found" })
  post.ratingCount += 1
  post.stars = (post.stars * (post.ratingCount - 1) + stars) / post.ratingCount
  console.log(`⭐ Post ${post.id} rated — avg: ${post.stars.toFixed(2)}`)
  res.json({ stars: post.stars, ratingCount: post.ratingCount })
})

app.get("/api/posts/:id/comments", (req, res) => {
  const post = posts.find((p) => p.id === req.params.id)
  if (!post) return res.status(404).json([])
  res.json(post.comments)
})

app.post("/api/posts/:id/comments", async (req, res) => {
  const post = posts.find((p) => p.id === req.params.id)
  if (!post) return res.status(404).json({ error: "Post not found" })
  const comment: Comment = {
    id: Math.random().toString(36).substr(2, 9),
    createdAt: Date.now(),
    ...req.body,
  }
  post.comments.push(comment)
  res.json(comment)
})

app.get("/api/profile/:id", (req, res) => {
  const id = req.params.id
  const current = profiles.get(id) ?? {
    id,
    readingScore: 0,
    examScore: 0,
    readPosts: [],
    following: [],
    preferredLanguage: "English",
  }
  res.json(current)
})

app.post("/api/profile/:id", (req, res) => {
  const id = req.params.id
  const previous = profiles.get(id) ?? { id }
  const next = {
    ...previous,
    ...req.body,
    id,
  }
  profiles.set(id, next)
  res.json(next)
})

app.post("/api/ai", async (req, res) => {
  try {
    const { type, prompt, content, topic, language } = req.body
    let finalPrompt = ""

    switch (type) {
      case "answer":
        finalPrompt = prompt || ""
        break
      case "hashtags":
        finalPrompt = `Generate 5-6 relevant hashtags (with # prefix, space-separated) for this content. Return only hashtags, nothing else:\n${content}`
        break
      case "exam":
        finalPrompt = `Generate 5 multiple choice questions based on:\n${topic}\nFormat each as:\nQ: ...\nA) ...\nB) ...\nC) ...\nD) ...\nAnswer: ...`
        break
      case "translate":
        finalPrompt = `Translate the following text to ${language}. Return only the translation, nothing else:\n${content}`
        break
      case "autoReply": {
        const [author, category] = (prompt || "").split("|||")
        finalPrompt = `You are a warm reader on Readative. Write ONE short smart comment (2-3 sentences) on this ${category || "post"} by ${author}:\n"${content}"`
        break
      }
      case "tts":
        return res.json({ audio: null })
      default:
        finalPrompt = prompt || content || ""
    }

    const text = await callGemini(finalPrompt)
    res.json({ text })
  } catch (error) {
    console.error("❌ AI route error:", error)
    res.status(500).json({ text: "" })
  }
})

app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
  checkScheduledAIComments()
})
