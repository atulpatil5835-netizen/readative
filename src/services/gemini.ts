import { ExamQuestion } from "../types"

type AIRequest = {
  type: string
  prompt?: string
  content?: string
  topic?: string
  language?: string
}

type AIResponse = {
  text?: string
  audio?: string | null
}

function parseExamQuestions(rawText: string): ExamQuestion[] {
  if (!rawText.trim()) return []

  const blocks = rawText
    .split(/\n(?=Q\s*[:.)])/gi)
    .map((block) => block.trim())
    .filter(Boolean)

  const questions: ExamQuestion[] = []

  for (const block of blocks) {
    const questionMatch = block.match(/Q\s*[:.)]\s*(.+)/i)
    const optionMatches = [...block.matchAll(/^[A-D]\)\s*(.+)$/gim)]
    const answerMatch = block.match(/Answer\s*:\s*([A-D1-4])/i)

    if (!questionMatch || optionMatches.length < 2 || !answerMatch) {
      continue
    }

    const options = optionMatches.map((match) => match[1].trim())
    const answerToken = answerMatch[1].toUpperCase()
    const answerMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, "1": 0, "2": 1, "3": 2, "4": 3 }
    const correctIndex = answerMap[answerToken]

    if (typeof correctIndex !== "number" || correctIndex >= options.length) {
      continue
    }

    questions.push({
      question: questionMatch[1].trim(),
      options,
      correctIndex,
    })
  }

  return questions
}

async function callAI(payload: AIRequest): Promise<AIResponse> {
  try {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      throw new Error(`AI request failed (${res.status})`)
    }

    const contentType = res.headers.get("content-type") || ""
    if (!contentType.includes("application/json")) {
      const bodyPreview = (await res.text()).slice(0, 120)
      throw new Error(`AI API returned non-JSON response: ${bodyPreview}`)
    }

    return (await res.json()) as AIResponse
  } catch (error) {
    console.error("AI backend error:", error)
    return { text: "", audio: null }
  }
}

export const geminiService = {
  async getBotResponse(prompt: string): Promise<string> {
    const res = await callAI({
      type: "answer",
      prompt: `You are a helpful, friendly AI assistant on Readative - a reading and writing platform.
Answer the following question clearly and helpfully:

${prompt}`,
    })
    return res.text || "Sorry, I couldn't get a response. Please try again."
  },

  async generateAnswer(prompt: string): Promise<string> {
    const res = await callAI({ type: "answer", prompt })
    return res.text || ""
  },

  async generateSmartAnswer(question: string): Promise<string> {
    const res = await callAI({
      type: "answer",
      prompt: `You are a knowledgeable, thoughtful contributor on Readative's Q&A section (like Quora).
Answer this question in a clear, insightful, and engaging way. Use 2-4 paragraphs max.

Question: ${question}`,
    })
    return res.text || "Unable to generate an answer right now."
  },

  async generateHashtags(content: string): Promise<string[]> {
    const res = await callAI({ type: "hashtags", content })
    const raw = res.text || ""
    return raw
      .split(/[\s,]+/)
      .map((token) => token.replace(/^#/, "").trim())
      .filter((token) => token.length > 0)
      .slice(0, 6)
  },

  async generateExam(topic: string | string[]): Promise<ExamQuestion[]> {
    const normalizedTopic = Array.isArray(topic) ? topic.join(", ") : topic
    const res = await callAI({ type: "exam", topic: normalizedTopic })
    return parseExamQuestions(res.text || "")
  },

  async translateText(content: string, language: string): Promise<string> {
    const res = await callAI({ type: "translate", content, language })
    return res.text || content
  },

  async generateTTS(content: string): Promise<string | null> {
    const res = await callAI({ type: "tts", content })
    return res.audio || null
  },

  async generateAutoReply(content: string, author: string, category: string): Promise<string> {
    const res = await callAI({
      type: "autoReply",
      content,
      prompt: `${author}|||${category}`,
    })
    return res.text || ""
  },
}

export { callAI }