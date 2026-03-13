import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { UserProfile } from "../types";
import { ThumbsUp, ThumbsDown, Trophy, Star, Send, Sparkles, User } from "lucide-react";
import { SEO } from "./SEO";
import {
  collection, addDoc, onSnapshot, query,
  orderBy, serverTimestamp, doc, updateDoc, arrayUnion
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

interface SmartTalkProps {
  user: UserProfile | null;
  toggleFollow: (authorName: string) => void;
}

const AI_ANSWER_DELAY_HOURS = 6;

export function SmartTalk({ user, toggleFollow }: SmartTalkProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [answerInputs, setAnswerInputs] = useState<Record<string, string>>({});
  const [isAnswering, setIsAnswering] = useState<Record<string, boolean>>({});
  const [aiAnswering, setAiAnswering] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const q = query(collection(db, "smarttalk"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toMillis?.() || d.data().createdAt || Date.now(),
      })) as Question[];
      setQuestions(data);
      setIsLoading(false);

      // Check each question — if old enough, no answers, and not yet AI-answered → trigger AI
      data.forEach(q => checkAndTriggerAIAnswer(q));
    }, (error) => {
      console.error("Firestore SmartTalk error:", error);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const checkAndTriggerAIAnswer = async (q: Question) => {
    // Skip if: already has answers, already AI answered, or too recent
    if (q.aiAnswered) return;
    if ((q.answers || []).length > 0) return;
    const ageHours = (Date.now() - q.createdAt) / (1000 * 60 * 60);
    if (ageHours < AI_ANSWER_DELAY_HOURS) return;
    // Only trigger once per question per session
    setAiAnswering(prev => {
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

  const handleAsk = async () => {
    if (!user) { alert("Please login to ask questions."); return; }
    if (!newQuestion.trim()) return;
    setIsAsking(true);
    try {
      await addDoc(collection(db, "smarttalk"), {
        author: user.name,
        authorId: user.id,
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
  };

  const handleAnswer = async (questionId: string) => {
    if (!user) { alert("Please login to answer."); return; }
    const text = answerInputs[questionId]?.trim();
    if (!text) return;
    setIsAnswering(prev => ({ ...prev, [questionId]: true }));
    try {
      const answer: Answer = {
        id: Math.random().toString(36).substr(2, 9),
        author: user.name,
        authorId: user.id,
        content: text,
        likes: [],
        dislikes: [],
        createdAt: Date.now(),
        isAI: false,
      };
      await updateDoc(doc(db, "smarttalk", questionId), { answers: arrayUnion(answer) });
      setAnswerInputs(prev => ({ ...prev, [questionId]: "" }));
    } catch (e) {
      console.error("Failed to post answer:", e);
    } finally {
      setIsAnswering(prev => ({ ...prev, [questionId]: false }));
    }
  };

  const handleVote = async (question: Question, answerId: string, type: "like" | "dislike") => {
    if (!user) { alert("Please login to vote."); return; }
    const updatedAnswers = question.answers.map(a => {
      if (a.id !== answerId) return a;
      const likes = a.likes || [];
      const dislikes = a.dislikes || [];
      const alreadyLiked = likes.includes(user.id);
      const alreadyDisliked = dislikes.includes(user.id);
      if (type === "like") {
        return { ...a, likes: alreadyLiked ? likes.filter(id => id !== user.id) : [...likes, user.id], dislikes: dislikes.filter(id => id !== user.id) };
      } else {
        return { ...a, dislikes: alreadyDisliked ? dislikes.filter(id => id !== user.id) : [...dislikes, user.id], likes: likes.filter(id => id !== user.id) };
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
        description="Ask questions and get community answers on Readative. AI-powered Q&A platform for readers and writers."
        keywords={["Q&A", "questions", "answers", "community", "reading", "Readative"]}
      />

      {/* Ask Box */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-8 text-white shadow-lg">
        <h2 className="text-3xl font-bold mb-1 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-yellow-300" />
          SmartTalk
        </h2>
        <p className="text-indigo-100 mb-6 text-sm">Ask anything — community answers, votes decide the best. Unanswered questions get a Gemini AI response after 6 hours.</p>
        <div className="flex gap-2">
          <input
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="Ask a question..."
            className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-indigo-200 focus:outline-none focus:bg-white/20 transition-all text-sm"
          />
          <button onClick={handleAsk} disabled={isAsking || !newQuestion.trim()}
            className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors disabled:opacity-50 text-sm">
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
          {questions.map(q => {
            const humanAnswers = (q.answers || []).filter(a => !a.isAI);
            const aiAnswers = (q.answers || []).filter(a => a.isAI);
            const sortedHuman = [...humanAnswers].sort((a, b) =>
              ((b.likes?.length || 0) - (b.dislikes?.length || 0)) -
              ((a.likes?.length || 0) - (a.dislikes?.length || 0))
            );
            const topAnswerId = sortedHuman[0] && (sortedHuman[0].likes?.length || 0) - (sortedHuman[0].dislikes?.length || 0) > 0
              ? sortedHuman[0].id : null;
            const worstAnswerId = sortedHuman.length > 1 ? sortedHuman[sortedHuman.length - 1].id : null;
            // Show AI answers after human answers
            const allSorted = [...sortedHuman, ...aiAnswers];

            return (
              <motion.div key={q.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-6 shadow-sm border border-black/5">

                {/* Question Header */}
                <div className="flex items-start gap-4 mb-5">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 leading-snug">{q.content}</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Asked by <span className="font-semibold">{q.author}</span> · {new Date(q.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Answers */}
                <div className="space-y-3 pl-4 border-l-2 border-gray-100 ml-5 mb-5">
                  <AnimatePresence>
                    {allSorted.length === 0 ? (
                      <p className="text-sm text-gray-400 italic py-2">No answers yet. Be the first — or wait 6 hours for Gemini AI to answer!</p>
                    ) : (
                      allSorted.map((a) => {
                        const isTop = a.id === topAnswerId;
                        const isWorst = a.id === worstAnswerId;
                        const likeCount = a.likes?.length || 0;
                        const dislikeCount = a.dislikes?.length || 0;
                        const score = likeCount - dislikeCount;
                        const userLiked = user ? (a.likes || []).includes(user.id) : false;
                        const userDisliked = user ? (a.dislikes || []).includes(user.id) : false;

                        return (
                          <motion.div key={a.id} layout
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            className={`rounded-2xl p-4 transition-all duration-300 bg-gray-50 ${getAnswerBorderClass(a, isTop, isWorst)}`}>

                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                {/* AI avatar or user initial */}
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

                                {/* Follow button for human answers */}
                                {!a.isAI && user && a.authorId !== user.id && (
                                  <button onClick={() => toggleFollow(a.author)}
                                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                                      user.following?.includes(a.author)
                                        ? "bg-indigo-100 text-indigo-700"
                                        : "border border-gray-200 text-gray-400 hover:text-indigo-600"
                                    }`}>
                                    <Star className={`w-3 h-3 ${user.following?.includes(a.author) ? "fill-current" : ""}`} />
                                    {user.following?.includes(a.author) ? "Following" : "Follow"}
                                  </button>
                                )}

                                {/* Top answer badge */}
                                {isTop && !a.isAI && (
                                  <span className="flex items-center gap-1 text-yellow-600 text-[10px] font-bold bg-yellow-50 px-2 py-0.5 rounded-full">
                                    <Trophy className="w-3 h-3" /> Top Answer
                                  </span>
                                )}

                                {/* Score badge for human answers */}
                                {!a.isAI && score !== 0 && (
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    score > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                                  }`}>
                                    {score > 0 ? `+${score}` : score}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-gray-400 flex-shrink-0">
                                {new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>

                            <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap mb-3">{a.content}</p>

                            {/* Votes — allow voting on AI answers too */}
                            <div className="flex items-center gap-4">
                              <button onClick={() => handleVote(q, a.id, "like")}
                                className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                                  userLiked ? "text-emerald-600" : "text-gray-400 hover:text-emerald-600"
                                }`}>
                                <ThumbsUp className={`w-4 h-4 ${userLiked ? "fill-current" : ""}`} />
                                {likeCount}
                              </button>
                              <button onClick={() => handleVote(q, a.id, "dislike")}
                                className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                                  userDisliked ? "text-red-500" : "text-gray-400 hover:text-red-500"
                                }`}>
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

                {/* Answer Input */}
                {user ? (
                  <div className="flex gap-2 mt-2">
                    <input
                      value={answerInputs[q.id] || ""}
                      onChange={(e) => setAnswerInputs(prev => ({ ...prev, [q.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && handleAnswer(q.id)}
                      placeholder="Write your answer..."
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                    />
                    <button onClick={() => handleAnswer(q.id)}
                      disabled={!answerInputs[q.id]?.trim() || isAnswering[q.id]}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-all">
                      {isAnswering[q.id]
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                ) : (
                  <p className="text-center text-sm text-gray-400 bg-gray-50 rounded-xl py-3">Please login to answer</p>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
