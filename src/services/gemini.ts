const API_KEY = process.env.GEMINI_API_KEY || "";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export const geminiService = {
  async generateHashtags(content: string) {
    try {
      const response = await fetch(`${BASE_URL}/gemini-3-flash-preview:generateContent?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Analyze this text and generate 3-5 relevant hashtags. Return ONLY the hashtags separated by spaces. Text: ${content}` }] }]
        })
      });
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return text.trim().split(/\s+/) || [];
    } catch (error) {
      console.error("Error generating hashtags:", error);
      return [];
    }
  },

  async getBotResponse(query: string) {
    try {
      const response = await fetch(`${BASE_URL}/gemini-3-flash-preview:generateContent?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: query }] }],
          systemInstruction: { parts: [{ text: "You are Readative Bot, a helpful assistant for writers and readers. You help solve problems, explain stories, and provide insights. You can also format your output for notes." }] }
        })
      });
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't process that.";
    } catch (error) {
      console.error("Error getting bot response:", error);
      return "I'm sorry, I couldn't process that.";
    }
  },

  async generateExam(topics: string[]) {
    try {
      const response = await fetch(`${BASE_URL}/gemini-3-flash-preview:generateContent?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Generate 5 multiple choice questions based on these topics: ${topics.join(", ")}. 
          Return the response in JSON format:
          [{ "question": "...", "options": ["...", "...", "...", "..."], "correctIndex": 0 }]` }] }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
      return JSON.parse(text);
    } catch (error) {
      console.error("Error generating exam:", error);
      return [];
    }
  },

  async generateAutoReply(content: string, authorName: string) {
    try {
      const response = await fetch(`${BASE_URL}/gemini-3-flash-preview:generateContent?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `You are a helpful and encouraging AI assistant on a social media platform for writers. 
          Read this post by ${authorName}: "${content}".
          Generate a short, encouraging, and relevant comment reply to the author. 
          Tag the author by starting the reply with "@${authorName}".
          Keep it under 30 words.` }] }]
        })
      });
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (error) {
      console.error("Error generating auto-reply:", error);
      return null;
    }
  },

  async generateTTS(text: string, voice: 'Kore' | 'Puck' | 'Zephyr' | 'Fenrir' | 'Charon' = 'Kore') {
    try {
      const response = await fetch(`${BASE_URL}/gemini-2.5-flash-preview-tts:generateContent?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Read this with emotion and natural flow: ${text}` }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice }
              }
            }
          }
        })
      });
      const data = await response.json();
      const base64Audio = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        return `data:audio/mp3;base64,${base64Audio}`;
      }
      return null;
    } catch (error) {
      console.error("Error generating TTS:", error);
      return null;
    }
  },

  async generateSmartAnswer(question: string) {
    try {
      const response = await fetch(`${BASE_URL}/gemini-3-flash-preview:generateContent?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `You are a wise and knowledgeable expert. Answer this question concisely and helpfully: "${question}". Keep it under 100 words.` }] }]
        })
      });
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't come up with an answer right now.";
    } catch (error) {
      console.error("Error generating smart answer:", error);
      return "I couldn't come up with an answer right now.";
    }
  },

  async translateText(text: string, targetLanguage: string) {
    try {
      const response = await fetch(`${BASE_URL}/gemini-3-flash-preview:generateContent?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Translate the following text to ${targetLanguage}. Return ONLY the translated text. Text: "${text}"` }] }]
        })
      });
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || text;
    } catch (error) {
      console.error("Error translating text:", error);
      return text;
    }
  }
};
