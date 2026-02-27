import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { geminiService } from "../services/gemini";
import { Send, Sparkles, FileText, Download } from "lucide-react";
import { SEO } from "./SEO";
// import ReactMarkdown from "react-markdown";
// import { jsPDF } from "jspdf";

export function Bot() {
  const [messages, setMessages] = useState<{ role: 'user' | 'bot', content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input;
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const response = await geminiService.getBotResponse(userMsg);
      setMessages(prev => [...prev, { role: 'bot', content: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'bot', content: "Sorry, I'm having trouble connecting right now." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadNotes = (content: string) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Readative AI Notes", 20, 20);
    doc.setFontSize(12);
    const splitText = doc.splitTextToSize(content, 170);
    doc.text(splitText, 20, 30);
    doc.save("readative-notes.pdf");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
      <SEO 
        title="AI Assistant" 
        description="Chat with Readative AI to get help with writing, reading comprehension, and creative ideas."
        keywords={["AI chat", "writing assistant", "reading helper", "chatbot"]}
      />
      <div className="p-4 border-b border-black/5 flex items-center justify-between bg-emerald-50/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-emerald-900">Problem Solver Bot</h2>
            <p className="text-xs text-emerald-600 font-medium">Always here to help</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-gray-400 font-medium">Ask me anything about stories, jokes, or problems!</h3>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-4 rounded-2xl ${
              msg.role === 'user' 
                ? 'bg-emerald-600 text-white rounded-tr-none' 
                : 'bg-gray-100 text-gray-800 rounded-tl-none'
            }`}>
              <div className="prose prose-sm max-w-none">
                {/* <ReactMarkdown>{msg.content}</ReactMarkdown> */}
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
              {msg.role === 'bot' && (
                <button 
                  onClick={() => downloadNotes(msg.content)}
                  className="mt-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-60 hover:opacity-100 transition-opacity"
                >
                  <Download className="w-3 h-3" />
                  Save as PDF Notes
                </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 p-4 rounded-2xl rounded-tl-none flex gap-1">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <div className="p-4 bg-gray-50 border-t border-black/5">
        <div className="flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your question here..."
            className="flex-1 bg-white border border-black/5 rounded-2xl px-6 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-emerald-600 text-white w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-emerald-700 disabled:opacity-50 transition-all"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
