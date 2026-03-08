type AIRequest = {
  type: string
  prompt?: string
  content?: string
  topic?: string
  language?: string
}

async function callAI(payload: AIRequest) {
  try {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error("AI request failed")
    return await res.json()
  } catch (error) {
    console.error("AI backend error:", error)
    return { text: "", audio: null }
  }
}

export const geminiService = {
  // ✅ Bot uses this
  async getBotResponse(prompt: string): Promise<string> {
    const res = await callAI({
      type: "answer",
      prompt: `You are a helpful, friendly AI assistant on Readative — a reading and writing platform. 
Answer the following question clearly and helpfully:

${prompt}`,
    })
    return res.text || "Sorry, I couldn't get a response. Please try again."
  },

  async generateAnswer(prompt: string): Promise<string> {
    const res = await callAI({ type: "answer", prompt })
    return res.text || ""
  },

  // ✅ SmartTalk uses this
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
    const raw: string = res.text || ""
    return raw
      .split(/[\s,]+/)
      .map((t: string) => t.replace(/^#/, "").trim())
      .filter((t: string) => t.length > 0)
      .slice(0, 6)
  },

  async generateExam(topic: string): Promise<string> {
    const res = await callAI({ type: "exam", topic })
    return res.text || ""
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