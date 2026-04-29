import type { VercelRequest, VercelResponse } from "@vercel/node"
import {
  CHATGPT_MODEL,
  CHATGPT_VERSION_LABEL,
} from "../src/utils/chatgpt"

async function callGemini(prompt: string): Promise<string> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set in environment variables")
    return ""
  }
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
    if (data.error) {
      console.error("Gemini API error:", JSON.stringify(data.error))
      return ""
    }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ""
    if (!text) console.error("Gemini returned empty text. Full response:", JSON.stringify(data).slice(0, 300))
    return text
  } catch (e) {
    console.error("Gemini fetch error:", e)
    return ""
  }
}

async function callChatGPT(prompt: string): Promise<string> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY
  if (!OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set in environment variables")
    return ""
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: CHATGPT_MODEL,
        input: prompt,
      }),
    })

    const data = await response.json()
    if (data.error) {
      console.error("OpenAI API error:", JSON.stringify(data.error))
      return ""
    }

    const text =
      data.output_text ||
      data.output
        ?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content || [])
        .map((item: { text?: string }) => item.text || "")
        .join("")
        .trim() ||
      ""

    if (!text) {
      console.error("OpenAI returned empty text. Full response:", JSON.stringify(data).slice(0, 300))
    }

    return text
  } catch (error) {
    console.error("OpenAI fetch error:", error)
    return ""
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
  if (req.method === "OPTIONS") return res.status(200).end()
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" })

  try {
    const { type, prompt, content, topic, language } = req.body

    if (!type) {
      console.error("Missing 'type' in request body")
      return res.status(400).json({ text: "", error: "Missing type" })
    }

    let finalPrompt = ""
    let provider: "gemini" | "chatgpt" = "gemini"

    switch (type) {
      case "answer":
        finalPrompt = prompt || ""
        break
      case "chatgptSmartAnswer":
        provider = "chatgpt"
        finalPrompt = `You are ChatGPT (${CHATGPT_VERSION_LABEL}), helping on Readative's SmartTalk Q&A.
Write one thoughtful answer in 2-3 short paragraphs.
Be direct, clear, and genuinely useful without sounding robotic.

Question:
${content || ""}
`
        break
      case "hashtags":
        finalPrompt = `Generate 5-6 relevant hashtags (with # prefix, space-separated) for this content. Return only hashtags:\n${content}`
        break
      case "exam":
        finalPrompt = prompt || `Generate 5 MCQ questions based on:\n${topic}`
        break
      case "translate":
        finalPrompt = `Translate to ${language}. Return only translation:\n${content}`
        break
      case "autoReply": {
        const [author, category] = (prompt || "").split("|||")
        finalPrompt = `Write ONE short smart comment (2-3 sentences) on this ${category || "post"} by ${author}:\n"${content}"`
        break
      }
      case "chatgptKnowledgeComment": {
        provider = "chatgpt"
        const [author, title, existingHumanCommentCount] = (prompt || "").split("|||")
        const commentCount = Number(existingHumanCommentCount || "0")
        finalPrompt = `You are ChatGPT (${CHATGPT_VERSION_LABEL}) joining a quiet discussion on Readative.
Write exactly one natural, supportive comment in 2-3 sentences.
Sound like a thoughtful community member, not a moderator or bot disclaimer.
The goal is to gently start discussion on a low-interaction post after 6 quiet hours.
Do not mention low interaction, algorithms, or that you were triggered automatically.
${commentCount > 0 ? "Build on the existing discussion without repeating it." : "Be the first helpful reply and invite reflection."}

Post title: ${title || "Untitled"}
Post author: ${author || "Unknown"}
Post content:
${content || ""}
`
        break
      }
      case "tts":
        return res.json({ audio: null })
      default:
        finalPrompt = prompt || content || ""
    }

    if (!finalPrompt.trim()) {
      console.error("Empty prompt for type:", type)
      return res.status(400).json({ text: "", error: "Empty prompt" })
    }

    console.log(`AI request type=${type}, prompt length=${finalPrompt.length}`)
    const text =
      provider === "chatgpt"
        ? await callChatGPT(finalPrompt)
        : await callGemini(finalPrompt)
    console.log(`AI response length=${text.length}, preview=${text.slice(0, 80)}`)

    return res.json({ text })
  } catch (error) {
    console.error("AI route error:", error)
    return res.status(500).json({ text: "", error: "Internal server error" })
  }
}
