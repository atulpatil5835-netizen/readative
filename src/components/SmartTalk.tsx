import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SmartQuestion, SmartAnswer, UserProfile } from "../types";
import { geminiService } from "../services/gemini";
import { MessageSquarePlus, ThumbsUp, ThumbsDown, Sparkles, User, Bot, Trophy, Star } from "lucide-react";
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
          content: "The most effective way is to just write anything. Even if it's nonsense. Lower your standards for the first draft. Often, writer's block is just perfectionism in disguise.",
          type: "ai",
          likes: 15,
          dislikes: 1,
          createdAt: Date.now() - 90000
        },
        {
          id: "a2",
          author: "Writer123",
          content: "I usually go for a walk. Fresh air helps clear the mind.",
          type: "user",
          likes: 8,
          dislikes: 2,
          createdAt: Date.now() - 80000
        }
      ]
    }
  ]);
  const [newQuestion, setNewQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);

  const handleAsk = async () => {
    if (!user) {
      alert("Please login to ask questions.");
      return;
    }
    if (!newQuestion.trim()) return;
    setIsAsking(true);

    const questionId = Date.now().toString();
    const question: SmartQuestion = {
      id: questionId,
      author: "You",
      content: newQuestion,
      createdAt: Date.now(),
      answers: []
    };

    setQuestions(prev => [question, ...prev]);
    setNewQuestion("");

    // Generate AI Answer
    try {
      const aiContent = await geminiService.generateSmartAnswer(question.content);
      const aiAnswer: SmartAnswer = {
        id: `ai-${Date.now()}`,
        author: "Readative AI",
        content: aiContent,
        type: "ai",
        likes: 0,
        dislikes: 0,
        createdAt: Date.now()
      };
      
      setQuestions(prev => prev.map(q => 
        q.id === questionId 
          ? { ...q, answers: [aiAnswer, ...q.answers] }
          : q
      ));
    } catch (e) {
      console.error(e);
    } finally {
      setIsAsking(false);
    }
  };

  const handleVote = (questionId: string, answerId: string, type: 'like' | 'dislike') => {
    if (!user) {
      alert("Please login to vote.");
      return;
    }
    setQuestions(prev => prev.map(q => {
      if (q.id !== questionId) return q;
      return {
        ...q,
        answers: q.answers.map(a => {
          if (a.id !== answerId) return a;
          return {
            ...a,
            likes: type === 'like' ? a.likes + 1 : a.likes,
            dislikes: type === 'dislike' ? a.dislikes + 1 : a.dislikes
          };
        })
      };
    }));
  };

  const getBorderClass = (answer: SmartAnswer, isTop: boolean) => {
    if (isTop) return "border-yellow-400 border-4 shadow-[0_0_15px_rgba(250,204,21,0.5)]";
    
    const score = answer.likes - answer.dislikes;
    if (score === 0) return "border-gray-200 border";
    
    if (score > 0) {
      if (score < 5) return "border-emerald-300 border-2";
      if (score < 10) return "border-emerald-500 border-2";
      return "border-emerald-600 border-4";
    } else {
      if (score > -5) return "border-red-300 border-2";
      if (score > -10) return "border-red-500 border-2";
      return "border-red-600 border-4";
    }
  };

  const qaSchema = {
    "@context": "https://schema.org",
    "@type": "QAPage",
    "mainEntity": questions.map(q => ({
      "@type": "Question",
      "name": q.content,
      "text": q.content,
      "answerCount": q.answers.length,
      "upvoteCount": 0,
      "dateCreated": new Date(q.createdAt).toISOString(),
      "author": {
        "@type": "Person",
        "name": q.author
      },
      "acceptedAnswer": q.answers.length > 0 ? {
        "@type": "Answer",
        "text": q.answers[0].content,
        "upvoteCount": q.answers[0].likes,
        "url": `https://readative.com/smarttalk#${q.answers[0].id}`,
        "dateCreated": new Date(q.answers[0].createdAt).toISOString(),
        "author": {
          "@type": "Person",
          "name": q.answers[0].author
        }
      } : undefined,
      "suggestedAnswer": q.answers.slice(1).map(a => ({
        "@type": "Answer",
        "text": a.content,
        "upvoteCount": a.likes,
        "dateCreated": new Date(a.createdAt).toISOString(),
        "author": {
          "@type": "Person",
          "name": a.author
        }
      }))
    }))
  };

  return (
    <div className="space-y-8 pb-20">
      <SEO 
        title="SmartTalk - Q&A" 
        description="Ask smart questions and get AI-powered answers. Join the discussion on writing, reading, and creativity."
        keywords={["Q&A", "questions", "answers", "AI help", "writing advice"]}
        schema={qaSchema}
      />
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-8 text-white shadow-lg">
        <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-yellow-300" />
          SmartTalk
        </h2>
        <p className="text-indigo-100 mb-6">Ask smart questions, get smart answers. Community & AI powered.</p>
        
        <div className="flex gap-2">
          <input
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Ask a question..."
            className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-indigo-200 focus:outline-none focus:bg-white/20 transition-all"
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
          />
          <button 
            onClick={handleAsk}
            disabled={isAsking || !newQuestion.trim()}
            className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors disabled:opacity-50"
          >
            {isAsking ? "Asking..." : "Ask"}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {questions.map(q => {
          const sortedAnswers = [...q.answers].sort((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes));
          const topAnswerId = sortedAnswers.length > 0 ? sortedAnswers[0].id : null;

          return (
            <motion.div 
              key={q.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-6 shadow-sm border border-black/5"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{q.content}</h3>
                  <p className="text-xs text-gray-500 mt-1">Asked by {q.author} • {new Date(q.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="space-y-4 pl-4 border-l-2 border-gray-100 ml-5">
                <AnimatePresence>
                  {sortedAnswers.map(a => {
                    const isTop = a.id === topAnswerId && (a.likes - a.dislikes) > 0;
                    return (
                      <motion.div 
                        key={a.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`rounded-2xl p-4 bg-gray-50 transition-all duration-300 ${getBorderClass(a, isTop)}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            {a.type === 'ai' ? (
                              <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                <Bot className="w-3 h-3" />
                                AI Answer
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-500">{a.author}</span>
                                {user && a.author !== user.name && (
                                  <button 
                                    onClick={() => toggleFollow(a.author)}
                                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                                      user.following.includes(a.author)
                                        ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                                        : "border border-gray-200 text-gray-400 hover:border-indigo-200 hover:text-indigo-600"
                                    }`}
                                  >
                                    <Star className={`w-3 h-3 ${user.following.includes(a.author) ? "fill-current" : ""}`} />
                                    {user.following.includes(a.author) ? "Interested" : "Interest"}
                                  </button>
                                )}
                              </div>
                            )}
                            {isTop && (
                              <div className="flex items-center gap-1 text-yellow-600 text-xs font-bold">
                                <Trophy className="w-3 h-3" />
                                Top Answer
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs font-mono text-gray-400">
                            {new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        
                        <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{a.content}</p>
                        
                        <div className="flex items-center gap-4 mt-4">
                          <button 
                            onClick={() => handleVote(q.id, a.id, 'like')}
                            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-emerald-600 transition-colors"
                          >
                            <ThumbsUp className="w-4 h-4" />
                            {a.likes}
                          </button>
                          <button 
                            onClick={() => handleVote(q.id, a.id, 'dislike')}
                            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-red-600 transition-colors"
                          >
                            <ThumbsDown className="w-4 h-4" />
                            {a.dislikes}
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {q.answers.length === 0 && (
                  <p className="text-sm text-gray-400 italic">No answers yet. Be the first!</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
