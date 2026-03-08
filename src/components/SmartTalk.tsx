import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SmartQuestion, SmartAnswer, UserProfile } from "../types";
import { geminiService } from "../services/gemini";
import { ThumbsUp, ThumbsDown, Sparkles, User, Bot, Trophy, Star, Send } from "lucide-react";
import { SEO } from "./SEO";

interface SmartTalkProps {
  user: UserProfile | null;
  toggleFollow: (authorName: string) => void;
}

export function SmartTalk({ user, toggleFollow }: SmartTalkProps) {
  const [questions, setQuestions] = useState<SmartQuestion[]>([
    {
      id: "1",
      author: "CuriousMind",
      content: "What is the most effective way to overcome writer's block?",
      createdAt: Date.now() - 100000,
      answers: [
        {
          id: "a1",
          author: "Readative AI",
          content: "The most effective way is to just write anything — even nonsense. Lower your standards for the first draft. Writer's block is often perfectionism in disguise.",
          type: "ai",
          likes: 15,
          dislikes: 1,
          createdAt: Date.now() - 90000,
        },
        {
          id: "a2",
          author: "Writer123",
          content: "I usually go for a walk. Fresh air helps clear the mind and gives new perspective.",
          type: "user",
          likes: 8,
          dislikes: 2,
          createdAt: Date.now() - 80000,
        },
      ],
    },
  ]);

  const [newQuestion, setNewQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [answerInputs, setAnswerInputs] = useState<Record<string, string>>({});
  const [loadingAnswers, setLoadingAnswers] = useState<Record<string, boolean>>({});

  const handleAsk = async () => {
    if (!user) { alert("Please login to ask questions."); return; }
    if (!newQuestion.trim()) return;
    setIsAsking(true);

    const questionId = Date.now().toString();
    const question: SmartQuestion = {
      id: questionId,
      author: user.name,
      content: newQuestion.trim(),
      createdAt: Date.now(),
      answers: [],
    };

    setQuestions(prev => [question, ...prev]);
    setNewQuestion("");
    setLoadingAnswers(prev => ({ ...prev, [questionId]: true }));

    try {
      const aiContent = await geminiService.generateSmartAnswer(question.content);
      const aiAnswer: SmartAnswer = {
        id: `ai-${Date.now()}`,
        author: "Readative AI",
        content: aiContent,
        type: "ai",
        likes: 0,
        dislikes: 0,
        createdAt: Date.now(),
      };
      setQuestions(prev =>
        prev.map(q => q.id === questionId ? { ...q, answers: [aiAnswer] } : q)
      );
    } catch (e) {
      console.error("AI answer error:", e);
    } finally {
      setIsAsking(false);
      setLoadingAnswers(prev => ({ ...prev, [questionId]: false }));
    }
  };

  const handleUserAnswer = (questionId: string) => {
    if (!user) { alert("Please login to answer."); return; }
    const text = answerInputs[questionId]?.trim();
    if (!text) return;

    const answer: SmartAnswer = {
      id: `user-${Date.now()}`,
      author: user.name,
      content: text,
      type: "user",
      likes: 0,
      dislikes: 0,
      createdAt: Date.now(),
    };

    setQuestions(prev =>
      prev.map(q => q.id === questionId ? { ...q, answers: [...q.answers, answer] } : q)
    );
    setAnswerInputs(prev => ({ ...prev, [questionId]: "" }));
  };

  const handleVote = (questionId: string, answerId: string, type: 'like' | 'dislike') => {
    if (!user) { alert("Please login to vote."); return; }
    setQuestions(prev => prev.map(q => {
      if (q.id !== questionId) return q;
      return {
        ...q,
        answers: q.answers.map(a => {
          if (a.id !== answerId) return a;
          return {
            ...a,
            likes: type === 'like' ? a.likes + 1 : a.likes,
            dislikes: type === 'dislike' ? a.dislikes + 1 : a.dislikes,
          };
        }),
      };
    }));
  };

  const getBorderClass = (answer: SmartAnswer, isTop: boolean) => {
    if (isTop) return "border-yellow-400 border-4 shadow-[0_0_15px_rgba(250,204,21,0.4)]";
    const score = answer.likes - answer.dislikes;
    if (score <= 0) return "border border-gray-200";
    if (score < 5) return "border-2 border-emerald-300";
    if (score < 10) return "border-2 border-emerald-500";
    return "border-4 border-emerald-600";
  };

  return (
    <div className="space-y-6 pb-20">
      <SEO
        title="SmartTalk - Q&A"
        description="Ask smart questions and get AI-powered answers on Readative."
        keywords={["Q&A", "questions", "answers", "AI help"]}
      />

      {/* Ask Box */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-8 text-white shadow-lg">
        <h2 className="text-3xl font-bold mb-1 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-yellow-300" />
          SmartTalk
        </h2>
        <p className="text-indigo-100 mb-6 text-sm">Ask anything — AI answers instantly, community follows.</p>
        <div className="flex gap-2">
          <input
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            placeholder="Ask a question..."
            className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-indigo-200 focus:outline-none focus:bg-white/20 transition-all text-sm"
          />
          <button
            onClick={handleAsk}
            disabled={isAsking || !newQuestion.trim()}
            className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors disabled:opacity-50 text-sm"
          >
            {isAsking ? "Asking..." : "Ask"}
          </button>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {questions.map(q => {
          const sortedAnswers = [...q.answers].sort((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes));
          const topAnswerId = sortedAnswers.length > 0 && (sortedAnswers[0].likes - sortedAnswers[0].dislikes) > 0
            ? sortedAnswers[0].id : null;
          const isLoadingAI = loadingAnswers[q.id];

          return (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-6 shadow-sm border border-black/5"
            >
              {/* Question */}
              <div className="flex items-start gap-4 mb-5">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 leading-snug">{q.content}</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Asked by <span className="font-semibold">{q.author}</span> · {new Date(q.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* AI loading state */}
              {isLoadingAI && (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl mb-4 border border-emerald-100">
                  <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-white flex-shrink-0">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                  </div>
                  <div className="flex gap-1 items-center">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                    <span className="text-xs text-emerald-600 font-medium ml-2">AI is thinking...</span>
                  </div>
                </div>
              )}

              {/* Answers */}
              <div className="space-y-3 pl-4 border-l-2 border-gray-100 ml-5 mb-5">
                <AnimatePresence>
                  {sortedAnswers.map(a => {
                    const isTop = a.id === topAnswerId;
                    return (
                      <motion.div
                        key={a.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`rounded-2xl p-4 transition-all duration-300 ${
                          a.type === 'ai' ? 'bg-emerald-50' : 'bg-gray-50'
                        } ${getBorderClass(a, isTop)}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {a.type === 'ai' ? (
                              <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                <Bot className="w-3 h-3" />
                                AI Answer
                              </div>
                            ) : (
                              <>
                                <span className="text-xs font-bold text-gray-600">{a.author}</span>
                                {user && a.author !== user.name && (
                                  <button
                                    onClick={() => toggleFollow(a.author)}
                                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                                      user.following.includes(a.author)
                                        ? "bg-indigo-100 text-indigo-700"
                                        : "border border-gray-200 text-gray-400 hover:text-indigo-600"
                                    }`}
                                  >
                                    <Star className={`w-3 h-3 ${user.following.includes(a.author) ? "fill-current" : ""}`} />
                                    {user.following.includes(a.author) ? "Following" : "Follow"}
                                  </button>
                                )}
                              </>
                            )}
                            {isTop && (
                              <span className="flex items-center gap-1 text-yellow-600 text-[10px] font-bold">
                                <Trophy className="w-3 h-3" /> Top Answer
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400">
                            {new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{a.content}</p>

                        <div className="flex items-center gap-4 mt-3">
                          <button onClick={() => handleVote(q.id, a.id, 'like')}
                            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-emerald-600 transition-colors">
                            <ThumbsUp className="w-4 h-4" /> {a.likes}
                          </button>
                          <button onClick={() => handleVote(q.id, a.id, 'dislike')}
                            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-red-500 transition-colors">
                            <ThumbsDown className="w-4 h-4" /> {a.dislikes}
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {q.answers.length === 0 && !isLoadingAI && (
                  <p className="text-sm text-gray-400 italic py-2">No answers yet. Be the first!</p>
                )}
              </div>

              {/* User Answer Input */}
              {user && (
                <div className="flex gap-2 mt-2">
                  <input
                    value={answerInputs[q.id] || ""}
                    onChange={(e) => setAnswerInputs(prev => ({ ...prev, [q.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleUserAnswer(q.id)}
                    placeholder="Write your answer..."
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                  />
                  <button
                    onClick={() => handleUserAnswer(q.id)}
                    disabled={!answerInputs[q.id]?.trim()}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}