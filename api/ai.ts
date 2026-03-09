import type { VercelRequest, VercelResponse } from "@vercel/node"

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
  if (req.method === "OPTIONS") return res.status(200).end()
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" })

  try {
    const { type, prompt, content, topic, language } = req.body
    let finalPrompt = ""

    switch (type) {
      case "answer":
        finalPrompt = prompt || ""
        break
      case "hashtags":
        finalPrompt = `Generate 5-6 relevant hashtags (with # prefix, space-separated) for this content. Return only hashtags:\n${content}`
        break
      case "exam":
        finalPrompt = `Generate 5 MCQ questions based on:\n${topic}\nFormat: Q: ...\nA) ...\nB) ...\nC) ...\nD) ...\nAnswer: ...`
        break
      case "translate":
        finalPrompt = `Translate to ${language}. Return only translation:\n${content}`
        break
      case "autoReply": {
        const [author, category] = (prompt || "").split("|||")
        finalPrompt = `Write ONE short smart comment (2-3 sentences) on this ${category || "post"} by ${author}:\n"${content}"`
        break
      }
      case "tts":
        return res.json({ audio: null })
      default:
        finalPrompt = prompt || content || ""
    }

    const text = await callGemini(finalPrompt)
    return res.json({ text })
  } catch (error) {
    console.error("AI route error:", error)
    return res.status(500).json({ text: "" })
  }
}