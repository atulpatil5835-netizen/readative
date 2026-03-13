import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { UserProfile } from "../types";
import { SEO } from "./SEO";
import { BookOpen, Trophy, RefreshCw, CheckCircle, XCircle, Sparkles, Lock } from "lucide-react";
import { db } from "../firebase/firebase";
import { collection, query, getDocs, doc, getDoc, setDoc, orderBy } from "firebase/firestore";

interface MCQOption { label: string; text: string; }
interface MCQQuestion {
  id: string;
  question: string;
  options: MCQOption[];
  correct: string;
  postId: string;
  postContent: string;
  postAuthor: string;
}

interface ExamProps {
  user: UserProfile | null;
  refreshProfile: () => void;
}

type ExamState = "idle" | "generating" | "active" | "finished";

export function Exam({ user, refreshProfile }: ExamProps) {
  const [examState, setExamState] = useState<ExamState>("idle");
  const [questions, setQuestions] = useState<MCQQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [likedPosts, setLikedPosts] = useState<any[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pastScores, setPastScores] = useState<{ score: number; total: number; date: number }[]>([]);
  const [generatingProgress, setGeneratingProgress] = useState(0);

  useEffect(() => {
    if (!user) return;
    loadLikedPosts();
    loadPastScores();
  }, [user]);

  const loadLikedPosts = async () => {
    if (!user) return;
    setIsLoadingPosts(true);
    try {
      const snapshot = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc")));
      const allPosts = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      const liked = allPosts.filter(p => (p.likes || []).includes(user.id) && p.content?.length > 50);
      setLikedPosts(liked);
    } catch (e) {
      console.error("Failed to load liked posts:", e);
    } finally {
      setIsLoadingPosts(false);
    }
  };

  const loadPastScores = async () => {
    if (!user) return;
    try {
      const snap = await getDoc(doc(db, "examScores", user.id));
      if (snap.exists()) setPastScores(snap.data().scores || []);
    } catch (e) {
      console.error("Failed to load past scores:", e);
    }
  };

  const extractJSON = (text: string): any => {
    try { return JSON.parse(text.trim()); } catch {}
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) { try { return JSON.parse(fenceMatch[1].trim()); } catch {} }
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) { try { return JSON.parse(text.substring(start, end + 1)); } catch {} }
    return null;
  };

  // Single MCQ generator with timeout — avoids Vercel 10s limit
  const generateMCQFromPost = async (post: any): Promise<MCQQuestion | null> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout per question

    try {
      const prompt = `You are a quiz master. Based on the following post, generate ONE multiple choice question.

Post by ${post.author} (${post.type}):
"${post.content.substring(0, 250)}"

Return ONLY a raw JSON object, no markdown, no extra text:
{"question":"...","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correct":"A"}`;

      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "exam", prompt }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (!response.ok) return null;
      const data = await response.json();
      if (!data.text) return null;

      const parsed = extractJSON(data.text);
      if (!parsed?.question || !parsed?.options?.length || !parsed?.correct) return null;

      return {
        id: Math.random().toString(36).substr(2, 9),
        question: parsed.question,
        options: parsed.options,
        correct: parsed.correct.toUpperCase().charAt(0),
        postId: post.id,
        postContent: post.content.substring(0, 120) + (post.content.length > 120 ? "..." : ""),
        postAuthor: post.author,
      };
    } catch (e: any) {
      clearTimeout(timeout);
      if (e.name === "AbortError") console.warn("MCQ generation timed out for post", post.id);
      else console.error("Failed to generate MCQ:", e);
      return null;
    }
  };

  const startExam = async () => {
    if (!user) return;
    if (likedPosts.length < 3) {
      setError(`Like at least 3 posts to generate an exam. You have ${likedPosts.length} so far.`);
      return;
    }
    setError(null);
    setExamState("generating");
    setGeneratingProgress(0);
    setScore(0);
    setCurrentIdx(0);
    setAnswers({});
    setSelectedAnswer(null);
    setIsAnswered(false);

    try {
      const shuffled = [...likedPosts].sort(() => Math.random() - 0.5).slice(0, 5);

      // Run all in parallel for speed — avoids sequential timeout issues
      const results = await Promise.allSettled(
        shuffled.map(async (post, i) => {
          const mcq = await generateMCQFromPost(post);
          setGeneratingProgress(prev => prev + 20); // 20% per question
          return mcq;
        })
      );

      const mcqs = results
        .filter(r => r.status === "fulfilled" && r.value !== null)
        .map(r => (r as PromiseFulfilledResult<MCQQuestion>).value);

      if (mcqs.length === 0) {
        setError("Could not generate questions. Check your internet and try again.");
        setExamState("idle");
        return;
      }

      setQuestions(mcqs);
      setExamState("active");
    } catch (e) {
      console.error("Exam generation failed:", e);
      setError("Something went wrong. Please try again.");
      setExamState("idle");
    }
  };

  const handleAnswer = (label: string) => {
    if (isAnswered) return;
    setSelectedAnswer(label);
    setIsAnswered(true);
    setAnswers(prev => ({ ...prev, [currentIdx]: label }));
    if (label === questions[currentIdx].correct) setScore(prev => prev + 1);
  };

  const handleNext = async () => {
    if (currentIdx + 1 >= questions.length) {
      setExamState("finished");
      await saveScore();
    } else {
      setCurrentIdx(prev => prev + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
    }
  };

  const saveScore = async () => {
    if (!user) return;
    try {
      const ref = doc(db, "examScores", user.id);
      const snap = await getDoc(ref);
      const existing = snap.exists() ? snap.data().scores || [] : [];
      const newEntry = { score, total: questions.length, date: Date.now() };
      await setDoc(ref, { scores: [newEntry, ...existing].slice(0, 10) });
      setPastScores([newEntry, ...existing].slice(0, 10));
    } catch (e) {
      console.error("Failed to save score:", e);
    }
  };

  const resetExam = () => {
    setExamState("idle");
    setQuestions([]);
    setCurrentIdx(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setScore(0);
    setAnswers({});
    setError(null);
    setGeneratingProgress(0);
    loadLikedPosts();
  };

  const getOptionClass = (label: string) => {
    if (!isAnswered) return "border-2 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer";
    const correct = questions[currentIdx].correct;
    if (label === correct) return "border-2 border-emerald-500 bg-emerald-50 text-emerald-800";
    if (label === selectedAnswer && label !== correct) return "border-2 border-red-400 bg-red-50 text-red-700";
    return "border-2 border-gray-200 opacity-50";
  };

  const percentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Lock className="w-12 h-12 text-gray-300" />
        <p className="text-gray-500 font-medium">Please login to take the exam</p>
      </div>
    );
  }

  if (examState === "generating") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-lg font-bold text-gray-800">Generating your exam...</p>
          <p className="text-sm text-gray-400 mt-1">Creating questions from your liked posts</p>
        </div>
        {/* Progress bar */}
        <div className="w-64 bg-gray-100 rounded-full h-2">
          <div className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(generatingProgress, 95)}%` }} />
        </div>
        <p className="text-xs text-gray-400">{Math.min(generatingProgress, 95)}% complete</p>
      </div>
    );
  }

  if (examState === "active") {
    const q = questions[currentIdx];
    const progress = ((currentIdx) / questions.length) * 100;
    return (
      <div className="space-y-6 pb-20">
        <SEO title="Reading Exam | Readative" description="Test your reading knowledge with AI-generated questions." keywords={["exam", "quiz", "reading", "Readative"]} />
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-black/5">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-bold text-gray-600">Question {currentIdx + 1} of {questions.length}</span>
            <span className="text-sm font-bold text-emerald-600">Score: {score}/{currentIdx}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-indigo-600 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
          <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Based on post by {q.postAuthor}</p>
          <p className="text-sm text-indigo-800 leading-relaxed italic">"{q.postContent}"</p>
        </div>
        <motion.div key={q.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
          <h3 className="text-lg font-bold text-gray-900 mb-6 leading-snug">{q.question}</h3>
          <div className="space-y-3">
            {q.options.map((opt) => (
              <button key={opt.label} onClick={() => handleAnswer(opt.label)}
                className={`w-full text-left p-4 rounded-xl transition-all flex items-center gap-3 ${getOptionClass(opt.label)}`}>
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  isAnswered && opt.label === q.correct ? "bg-emerald-500 text-white" :
                  isAnswered && opt.label === selectedAnswer && opt.label !== q.correct ? "bg-red-400 text-white" :
                  "bg-gray-100 text-gray-600"
                }`}>{opt.label}</span>
                <span className="text-sm font-medium">{opt.text}</span>
                {isAnswered && opt.label === q.correct && <CheckCircle className="w-5 h-5 text-emerald-500 ml-auto" />}
                {isAnswered && opt.label === selectedAnswer && opt.label !== q.correct && <XCircle className="w-5 h-5 text-red-400 ml-auto" />}
              </button>
            ))}
          </div>
          {isAnswered && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
              <div className={`p-3 rounded-xl text-sm font-medium mb-4 ${
                selectedAnswer === q.correct ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
              }`}>
                {selectedAnswer === q.correct ? "✅ Correct!" : `❌ Wrong! Correct answer is ${q.correct}`}
              </div>
              <button onClick={handleNext}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors">
                {currentIdx + 1 >= questions.length ? "See Results" : "Next Question →"}
              </button>
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  }

  if (examState === "finished") {
    return (
      <div className="space-y-6 pb-20">
        <SEO title="Exam Results | Readative" description="Your reading exam results." keywords={["exam", "results", "Readative"]} />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl p-8 shadow-sm border border-black/5 text-center">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${
            percentage >= 80 ? "bg-emerald-100" : percentage >= 60 ? "bg-yellow-100" : "bg-red-100"
          }`}>
            <Trophy className={`w-12 h-12 ${percentage >= 80 ? "text-emerald-600" : percentage >= 60 ? "text-yellow-500" : "text-red-400"}`} />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">{score} / {questions.length}</h2>
          <p className="text-5xl font-black mb-2 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{percentage}%</p>
          <p className="text-gray-500 mb-8">
            {percentage >= 80 ? "🎉 Excellent! You're a great reader!" : percentage >= 60 ? "👍 Good job! Keep reading more!" : "📚 Keep learning! Like more posts to improve."}
          </p>
          <div className="text-left space-y-3 mb-8">
            <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider">Review</h3>
            {questions.map((q, idx) => (
              <div key={q.id} className={`p-3 rounded-xl text-sm flex items-start gap-3 ${answers[idx] === q.correct ? "bg-emerald-50" : "bg-red-50"}`}>
                {answers[idx] === q.correct
                  ? <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />}
                <div>
                  <p className="font-medium text-gray-800">{q.question}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Your answer: <strong>{answers[idx] || "—"}</strong> · Correct: <strong className="text-emerald-600">{q.correct}</strong></p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={resetExam}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4" /> Take Another Exam
          </button>
        </motion.div>
        {pastScores.length > 1 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-black/5">
            <h3 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wider">Past Scores</h3>
            <div className="space-y-2">
              {pastScores.slice(0, 5).map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{new Date(s.date).toLocaleDateString()}</span>
                  <span className={`font-bold px-3 py-0.5 rounded-full text-xs ${
                    Math.round((s.score/s.total)*100) >= 80 ? "bg-emerald-100 text-emerald-700" :
                    Math.round((s.score/s.total)*100) >= 60 ? "bg-yellow-100 text-yellow-700" :
                    "bg-red-100 text-red-600"
                  }`}>{s.score}/{s.total} ({Math.round((s.score/s.total)*100)}%)</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // IDLE
  return (
    <div className="space-y-6 pb-20">
      <SEO
        title="Reading Exam | Readative"
        description="Test your reading knowledge with AI-generated MCQ questions based on posts you liked."
        keywords={["reading exam", "quiz", "MCQ", "reading test", "Readative"]}
      />
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-8 text-white shadow-lg">
        <h2 className="text-3xl font-bold mb-1 flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-yellow-300" />
          Reading Exam
        </h2>
        <p className="text-indigo-100 text-sm">Like posts on the home feed to generate exam questions!</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/5 text-center">
          <p className="text-2xl font-black text-indigo-600">{likedPosts.length}</p>
          <p className="text-xs text-gray-400 mt-1">Liked Posts</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/5 text-center">
          <p className="text-2xl font-black text-emerald-600">{pastScores.length}</p>
          <p className="text-xs text-gray-400 mt-1">Exams Taken</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/5 text-center">
          <p className="text-2xl font-black text-yellow-500">
            {pastScores.length > 0 ? `${Math.round((pastScores[0].score / pastScores[0].total) * 100)}%` : "—"}
          </p>
          <p className="text-xs text-gray-400 mt-1">Last Score</p>
        </div>
      </div>
      {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-600">{error}</div>}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-black/5">
        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" /> How it works
        </h3>
        <div className="space-y-3">
          {[
            { step: "1", text: "Like posts on the Home feed", color: "bg-indigo-100 text-indigo-700" },
            { step: "2", text: "Start exam — AI generates MCQs from your liked posts", color: "bg-purple-100 text-purple-700" },
            { step: "3", text: "Answer questions and track your score over time", color: "bg-emerald-100 text-emerald-700" },
          ].map(item => (
            <div key={item.step} className="flex items-start gap-3">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${item.color}`}>{item.step}</span>
              <p className="text-sm text-gray-600 pt-1">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
      <button onClick={startExam} disabled={isLoadingPosts || likedPosts.length < 3}
        className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 shadow-lg">
        {isLoadingPosts
          ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Loading...</>
          : likedPosts.length < 3
          ? <><Lock className="w-5 h-5" /> Like {3 - likedPosts.length} more posts to unlock</>
          : <><Sparkles className="w-5 h-5" /> Start Exam ({likedPosts.length} posts available)</>}
      </button>
      {pastScores.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-black/5">
          <h3 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wider">Past Scores</h3>
          <div className="space-y-2">
            {pastScores.slice(0, 5).map((s, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{new Date(s.date).toLocaleDateString()}</span>
                <span className={`font-bold px-3 py-0.5 rounded-full text-xs ${
                  Math.round((s.score/s.total)*100) >= 80 ? "bg-emerald-100 text-emerald-700" :
                  Math.round((s.score/s.total)*100) >= 60 ? "bg-yellow-100 text-yellow-700" :
                  "bg-red-100 text-red-600"
                }`}>{s.score}/{s.total} ({Math.round((s.score/s.total)*100)}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
