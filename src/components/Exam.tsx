import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { geminiService } from "../services/gemini";
import { UserProfile, ExamQuestion } from "../types";
import { Brain, CheckCircle2, XCircle, ArrowRight, Trophy } from "lucide-react";
import { SEO } from "./SEO";
// import confetti from "canvas-confetti";

interface ExamProps {
  user: UserProfile | null;
  refreshProfile: () => void;
}

export function Exam({ user, refreshProfile }: ExamProps) {
  const [exam, setExam] = useState<ExamQuestion[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  const startExam = async () => {
    if (!user || user.readPosts.length === 0) return;
    setIsLoading(true);
    try {
      // Get topics from read posts (mocking for now, in real app we'd fetch post details)
      const topics = ["Motivation", "Short Stories", "Life Lessons"];
      const questions = await geminiService.generateExam(topics);
      setExam(questions);
      setCurrentIndex(0);
      setScore(0);
      setIsFinished(false);
    } catch (error) {
      console.error("Exam generation failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = (index: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(index);
    if (index === exam![currentIndex].correctIndex) {
      setScore(prev => prev + 1);
    }
  };

  const nextQuestion = () => {
    if (currentIndex < exam!.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
    } else {
      finishExam();
    }
  };

  const finishExam = async () => {
    setIsFinished(true);
    const finalScore = Math.round((score / exam!.length) * 100);
    if (user) {
      await fetch(`/api/profile/${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...user, examScore: user.examScore + finalScore })
      });
      refreshProfile();
    }
    if (finalScore > 70) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  };

  if (!user || user.readPosts.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-black/5 p-8">
        <SEO 
          title="Exams & Quizzes" 
          description="Test your knowledge and reading comprehension with AI-generated exams on any topic."
          keywords={["exams", "quiz", "test", "learning", "study"]}
        />
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Brain className="w-10 h-10 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Not Enough Reading Data</h2>
        <p className="text-gray-500 mb-8 max-w-sm mx-auto">Read at least one post to unlock personalized exams based on your reading history.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mb-4" />
        <p className="text-emerald-600 font-medium animate-pulse">Generating your personalized exam...</p>
      </div>
    );
  }

  if (isFinished) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-12 bg-white rounded-3xl border border-black/5 p-8"
      >
        <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Trophy className="w-12 h-12 text-yellow-600" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Exam Completed!</h2>
        <p className="text-gray-500 mb-8">You scored {Math.round((score / exam!.length) * 100)}%</p>
        <div className="flex flex-col gap-3">
          <button 
            onClick={startExam}
            className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all"
          >
            Take Another Exam
          </button>
        </div>
      </motion.div>
    );
  }

  if (!exam) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-black/5 p-8">
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Brain className="w-10 h-10 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Ready for a Challenge?</h2>
        <p className="text-gray-500 mb-8">We've prepared questions based on the posts you've read recently.</p>
        <button 
          onClick={startExam}
          className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 mx-auto"
        >
          Start Exam
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    );
  }

  const currentQ = exam[currentIndex];

  return (
    <div className="bg-white rounded-3xl border border-black/5 p-8">
      <div className="flex justify-between items-center mb-8">
        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider">
          Question {currentIndex + 1} of {exam.length}
        </span>
        <div className="flex gap-1">
          {exam.map((_, i) => (
            <div key={i} className={`h-1.5 w-8 rounded-full ${i <= currentIndex ? 'bg-emerald-600' : 'bg-gray-100'}`} />
          ))}
        </div>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-8 leading-relaxed">
        {currentQ.question}
      </h2>

      <div className="space-y-3 mb-8">
        {currentQ.options.map((option, i) => (
          <button
            key={i}
            onClick={() => handleAnswer(i)}
            disabled={selectedOption !== null}
            className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between ${
              selectedOption === null 
                ? 'border-gray-100 hover:border-emerald-200 hover:bg-emerald-50' 
                : i === currentQ.correctIndex 
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : selectedOption === i 
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-100 opacity-50'
            }`}
          >
            <span className="font-medium">{option}</span>
            {selectedOption !== null && i === currentQ.correctIndex && <CheckCircle2 className="w-5 h-5" />}
            {selectedOption === i && i !== currentQ.correctIndex && <XCircle className="w-5 h-5" />}
          </button>
        ))}
      </div>

      {selectedOption !== null && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={nextQuestion}
          className="w-full bg-emerald-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2"
        >
          {currentIndex === exam.length - 1 ? "Finish Exam" : "Next Question"}
          <ArrowRight className="w-5 h-5" />
        </motion.button>
      )}
    </div>
  );
}
