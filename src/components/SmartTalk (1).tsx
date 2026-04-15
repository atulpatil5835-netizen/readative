import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ThumbsUp, ThumbsDown, Trophy, Star, Send, Sparkles, User, X } from "lucide-react";
import { SEO } from "./SEO";
import {
  collection, addDoc, onSnapshot, query,
  orderBy, serverTimestamp, doc, updateDoc, arrayUnion,
} from "firebase/firestore";
import { db } from "../firebase/firebase";

interface Answer {
  id: string;
  author: string;
  authorId: string;
  content: string;
  likes: string[];
  dislikes: string[];
  createdAt: number;
  isAI?: boolean;
}

interface Question {
  id: string;
  author: string;
  authorId: string;
  content: string;
  answers: Answer[];
  createdAt: number;
  aiAnswered?: boolean;
}

// Stable guest ID so votes persist across reloads
function getGuestId(): string {
  let id = localStorage.getItem("guestId");
  if (!id) {
    id = "guest_" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem("guestId", id);
  }
  return id;
}

// ── Username prompt modal ─────────────────────────────────────────────────

interface NamePromptProps {
  label: string;
  placeholder?: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
}

function NamePrompt({ label, placeholder = "your_name", onConfirm, onClose }: NamePromptProps) {
  const [name, setName] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-xs bg-white rounded-2xl shadow-2xl p-6 relative"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
        <div className="text-center mb-4">
          <div className="text-2xl mb-2">💬</div>
          <h2 className="text-lg font-bold text-gray-800">{label}</h2>
          <p className="text-gray-500 text-sm mt-1">Just tell us who you are</p>
        </div>
        <div className="relative mb-4">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-base">@</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && onConfirm(name.trim())}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-gray-800"
            placeholder={placeholder}
            autoFocus
          />
        </div>
        <button
          onClick={() => name.trim() && onConfirm(name.trim())}
          disabled={!name.trim()}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
        >
          Continue
        </button>
      </motion.div>
    </div>
  );
}

// ── SmartTalk ─────────────────────────────────────────────────────────────

const AI_ANSWER_DELAY_HOURS = 6;

export function SmartTalk() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [answerInputs, setAnswerInputs] = useState<Record<string, string>>({});
  const [isAnswering, setIsAnswering] = useState<Record<string, boolean>>({});
  const [aiAnswering, setAiAnswering] = useState<Record<string, boolean>>({});

  // Name prompt state
  const [namePrompt, setNamePrompt] = useState<{
    label: string;
    onConfirm: (name: string) => void;
  } | null>(null);

  const guestId = getGuestId();

  useEffect(() => {
    const q = query(collection(db, "smarttalk"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toMillis?.() || d.data().createdAt || Date.now(),
      })) as Question[];
      setQuestions(data);
      setIsLoading(false);
      data.forEach((q) => checkAndTriggerAIAnswer(q));
    }, (error) => {
      console.error("Firestore SmartTalk error:", error);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const checkAndTriggerAIAnswer = async (q: Question) => {
    if (q.aiAnswered) return;
    if ((q.answers || []).length > 0) return;
    const ageHours = (Date.now() - q.createdAt) / (1000 * 60 * 60);
    if (ageHours < AI_ANSWER_DELAY_HOURS) return;
    setAiAnswering((prev) => {
      if (prev[q.id]) return prev;
      triggerAIAnswer(q);
      return { ...prev, [q.id]: true };
    });
  };

  const triggerAIAnswer = async (q: Question) => {
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "answer",
          prompt: `You are Gemini, a helpful AI assistant on Readative — a reading and writing platform.
Answer this community question clearly, helpfully and in 2-3 paragraphs:

Question: "${q.content}"

Write a thoughtful, insightful answer. Be direct and informative.`,
        }),
      });
      const data = await res.json();
      if (!data.text?.trim()) return;

      const aiAnswer: Answer = {
        id: Math.random().toString(36).substr(2, 9),
        author: "Gemini AI",
        authorId: "gemini-ai",
        content: data.text.trim(),
        likes: [],
        dislikes: [],
        createdAt: Date.now(),
        isAI: true,
      };

      await updateDoc(doc(db, "smarttalk", q.id), {
        answers: arrayUnion(aiAnswer),
        aiAnswered: true,
      });
    } catch (e) {
      console.error("AI answer failed for question", q.id, e);
    }
  };

  // ── Ask ──────────────────────────────────────────────────────────────

  const handleAsk = () => {
    if (!newQuestion.trim()) return;
    setNamePrompt({
      label: "Who's asking?",
      onConfirm: async (name) => {
        setNamePrompt(null);
        setIsAsking(true);
        try {
          await addDoc(collection(db, "smarttalk"), {
            author: name,
            authorId: guestId,
            content: newQuestion.trim(),
            answers: [],
            aiAnswered: false,
            createdAt: serverTimestamp(),
          });
          setNewQuestion("");
        } catch (e) {
          console.error("Failed to post question:", e);
        } finally {
          setIsAsking(false);
        }
      },
    });
  };

  // ── Answer ───────────────────────────────────────────────────────────

  const handleAnswer = (questionId: string) => {
    const text = answerInputs[questionId]?.trim();
    if (!text) return;
    setNamePrompt({
      label: "Who's answering?",
      onConfirm: async (name) => {
        setNamePrompt(null);
        setIsAnswering((prev) => ({ ...prev, [questionId]: true }));
        try {
          const answer: Answer = {
            id: Math.random().toString(36).substr(2, 9),
            author: name,
            authorId: guestId,
            content: text,
            likes: [],
            dislikes: [],
            createdAt: Date.now(),
            isAI: false,
          };
          await updateDoc(doc(db, "smarttalk", questionId), { answers: arrayUnion(answer) });
          setAnswerInputs((prev) => ({ ...prev, [questionId]: "" }));
        } catch (e) {
          console.error("Failed to post answer:", e);
        } finally {
          setIsAnswering((prev) => ({ ...prev, [questionId]: false }));
        }
      },
    });
  };

  // ── Vote ─────────────────────────────────────────────────────────────

  const handleVote = async (question: Question, answerId: string, type: "like" | "dislike") => {
    const updatedAnswers = question.answers.map((a) => {
      if (a.id !== answerId) return a;
      const likes = a.likes || [];
      const dislikes = a.dislikes || [];
      const alreadyLiked = likes.includes(guestId);
      const alreadyDisliked = dislikes.includes(guestId);
      if (type === "like") {
        return {
          ...a,
          likes: alreadyLiked ? likes.filter((id) => id !== guestId) : [...likes, guestId],
          dislikes: dislikes.filter((id) => id !== guestId),
        };
      } else {
        return {
          ...a,
          dislikes: alreadyDisliked ? dislikes.filter((id) => id !== guestId) : [...dislikes, guestId],
          likes: likes.filter((id) => id !== guestId),
        };
      }
    });
    try {
      await updateDoc(doc(db, "smarttalk", question.id), { answers: updatedAnswers });
    } catch (e) {
      console.error("Failed to vote:", e);
    }
  };

  const getAnswerBorderClass = (answer: Answer, isTop: boolean, isWorst: boolean) => {
    if (answer.isAI) return "border-2 border-purple-200 bg-purple-50/40";
    if (isTop) return "border-4 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]";
    const score = (answer.likes?.length || 0) - (answer.dislikes?.length || 0);
    if (isWorst && score < -1) return "border-2 border-red-300 bg-red-50";
    if (score >= 10) return "border-2 border-emerald-600";
    if (score >= 5) return "border-2 border-emerald-400";
    if (score >= 1) return "border border-emerald-200";
    return "border border-gray-200";
  };

  return (
    <div className="space-y-6 pb-20">
      <SEO
        title="SmartTalk - Q&A Community | Readative"
        description="Ask questions and get community answers on Readative."
        keywords={["Q&A", "questions", "answers", "community", "reading", "Readative"]}
      />

      {/* Ask Box */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-8 text-white shadow-lg">
        <h2 className="text-3xl font-bold mb-1 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-yellow-300" />
          SmartTalk
        </h2>
        <p className="text-indigo-100 mb-6 text-sm">
          Ask anything — community answers, votes decide the best. Unanswered questions get a Gemini AI response after 6 hours.
        </p>
        <div className="flex gap-2">
          <input
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="Ask a question..."
            className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-indigo-200 focus:outline-none focus:bg-white/20 transition-all text-sm"
          />
          <button
            onClick={handleAsk}
            disabled={isAsking || !newQuestion.trim()}
            className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors disabled:opacity-50 text-sm"
          >
            {isAsking ? "Posting..." : "Ask"}
          </button>
        </div>
      </div>

      {/* Questions List */}
      {isLoading ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading questions...</p>
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No questions yet. Be the first to ask!</div>
      ) : (
        <div className="space-y-6">
          {questions.map((q) => {
            const humanAnswers = (q.answers || []).filter((a) => !a.isAI);
            const aiAnswers = (q.answers || []).filter((a) => a.isAI);
            const sortedHuman = [...humanAnswers].sort(
              (a, b) =>
                ((b.likes?.length || 0) - (b.dislikes?.length || 0)) -
                ((a.likes?.length || 0) - (a.dislikes?.length || 0))
            );
            const topAnswerId =
              sortedHuman[0] &&
              (sortedHuman[0].likes?.length || 0) - (sortedHuman[0].dislikes?.length || 0) > 0
                ? sortedHuman[0].id
                : null;
            const worstAnswerId =
              sortedHuman.length > 1 ? sortedHuman[sortedHuman.length - 1].id : null;
            const allSorted = [...sortedHuman, ...aiAnswers];

            return (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-6 shadow-sm border border-black/5"
              >
                {/* Question Header */}
                <div className="flex items-start gap-4 mb-5">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 leading-snug">{q.content}</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Asked by <span className="font-semibold">{q.author}</span> ·{" "}
                      {new Date(q.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Answers */}
                <div className="space-y-3 pl-4 border-l-2 border-gray-100 ml-5 mb-5">
                  <AnimatePresence>
                    {allSorted.length === 0 ? (
                      <p className="text-sm text-gray-400 italic py-2">
                        No answers yet. Be the first — or wait 6 hours for Gemini AI to answer!
                      </p>
                    ) : (
                      allSorted.map((a) => {
                        const isTop = a.id === topAnswerId;
                        const isWorst = a.id === worstAnswerId;
                        const likeCount = a.likes?.length || 0;
                        const dislikeCount = a.dislikes?.length || 0;
                        const score = likeCount - dislikeCount;
                        const userLiked = (a.likes || []).includes(guestId);
                        const userDisliked = (a.dislikes || []).includes(guestId);

                        return (
                          <motion.div
                            key={a.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`rounded-2xl p-4 transition-all duration-300 bg-gray-50 ${getAnswerBorderClass(a, isTop, isWorst)}`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                {a.isAI ? (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                                      <Sparkles className="w-3 h-3 text-white" />
                                    </div>
                                    <span className="text-xs font-bold text-purple-700">Gemini AI</span>
                                    <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-bold">AI</span>
                                  </div>
                                ) : (
                                  <span className="text-xs font-bold text-gray-700">{a.author}</span>
                                )}

                                {isTop && !a.isAI && (
                                  <span className="flex items-center gap-1 text-yellow-600 text-[10px] font-bold bg-yellow-50 px-2 py-0.5 rounded-full">
                                    <Trophy className="w-3 h-3" /> Top Answer
                                  </span>
                                )}

                                {!a.isAI && score !== 0 && (
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${score > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                                    {score > 0 ? `+${score}` : score}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-gray-400 flex-shrink-0">
                                {new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>

                            <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap mb-3">{a.content}</p>

                            <div className="flex items-center gap-4">
                              <button
                                onClick={() => handleVote(q, a.id, "like")}
                                className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${userLiked ? "text-emerald-600" : "text-gray-400 hover:text-emerald-600"}`}
                              >
                                <ThumbsUp className={`w-4 h-4 ${userLiked ? "fill-current" : ""}`} />
                                {likeCount}
                              </button>
                              <button
                                onClick={() => handleVote(q, a.id, "dislike")}
                                className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${userDisliked ? "text-red-500" : "text-gray-400 hover:text-red-500"}`}
                              >
                                <ThumbsDown className={`w-4 h-4 ${userDisliked ? "fill-current" : ""}`} />
                                {dislikeCount}
                              </button>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </AnimatePresence>
                </div>

                {/* Answer Input — open to everyone */}
                <div className="flex gap-2 mt-2">
                  <input
                    value={answerInputs[q.id] || ""}
                    onChange={(e) => setAnswerInputs((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && handleAnswer(q.id)}
                    placeholder="Write your answer..."
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                  />
                  <button
                    onClick={() => handleAnswer(q.id)}
                    disabled={!answerInputs[q.id]?.trim() || isAnswering[q.id]}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-all"
                  >
                    {isAnswering[q.id] ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Name Prompt Modal */}
      <AnimatePresence>
        {namePrompt && (
          <NamePrompt
            label={namePrompt.label}
            onConfirm={namePrompt.onConfirm}
            onClose={() => setNamePrompt(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
