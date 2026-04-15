import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ThumbsUp,
  ThumbsDown,
  Trophy,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import { SEO } from "./SEO";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { UsernamePrompt } from "./Auth";
import {
  clearGuestName,
  getGuestId,
  getGuestName,
  saveGuestName,
} from "../utils/guestIdentity";

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

type NamePromptState =
  | { type: "ask" }
  | { type: "answer"; questionId: string }
  | null;

const AI_ANSWER_DELAY_HOURS = 6;

export function SmartTalk() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [answerInputs, setAnswerInputs] = useState<Record<string, string>>({});
  const [isAnswering, setIsAnswering] = useState<Record<string, boolean>>({});
  const [aiAnswering, setAiAnswering] = useState<Record<string, boolean>>({});
  const [namePrompt, setNamePrompt] = useState<NamePromptState>(null);
  const [guestName, setGuestName] = useState<string | null>(() => getGuestName());

  const guestId = getGuestId();

  useEffect(() => {
    const smartTalkQuery = query(
      collection(db, "smarttalk"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      smartTalkQuery,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
          createdAt:
            item.data().createdAt?.toMillis?.() ||
            item.data().createdAt ||
            Date.now(),
        })) as Question[];

        setQuestions(data);
        setIsLoading(false);
        data.forEach((question) => {
          void checkAndTriggerAIAnswer(question);
        });
      },
      (error) => {
        console.error("Firestore SmartTalk error:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const checkAndTriggerAIAnswer = async (question: Question) => {
    if (question.aiAnswered) return;
    if ((question.answers || []).length > 0) return;

    const ageHours = (Date.now() - question.createdAt) / (1000 * 60 * 60);
    if (ageHours < AI_ANSWER_DELAY_HOURS) return;

    setAiAnswering((current) => {
      if (current[question.id]) return current;
      void triggerAIAnswer(question);
      return { ...current, [question.id]: true };
    });
  };

  const triggerAIAnswer = async (question: Question) => {
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "answer",
          prompt: `You are Gemini, a helpful AI assistant on Readative, a reading and writing platform.
Answer this community question clearly, helpfully, and in 2-3 paragraphs.

Question: "${question.content}"

Write a thoughtful, insightful answer. Be direct and informative.`,
        }),
      });

      const data = await response.json();
      if (!data.text?.trim()) return;

      const aiAnswer: Answer = {
        id: Math.random().toString(36).slice(2, 11),
        author: "Gemini AI",
        authorId: "gemini-ai",
        content: data.text.trim(),
        likes: [],
        dislikes: [],
        createdAt: Date.now(),
        isAI: true,
      };

      await updateDoc(doc(db, "smarttalk", question.id), {
        answers: arrayUnion(aiAnswer),
        aiAnswered: true,
      });
    } catch (error) {
      console.error("AI answer failed for question", question.id, error);
    }
  };

  const submitQuestion = async (authorName: string) => {
    const normalizedName = saveGuestName(authorName);
    const questionText = newQuestion.trim();
    if (!normalizedName || !questionText) return;

    setGuestName(normalizedName);
    setIsAsking(true);

    try {
      await addDoc(collection(db, "smarttalk"), {
        author: normalizedName,
        authorId: guestId,
        content: questionText,
        answers: [],
        aiAnswered: false,
        createdAt: serverTimestamp(),
      });
      setNewQuestion("");
    } catch (error) {
      console.error("Failed to post question:", error);
    } finally {
      setIsAsking(false);
    }
  };

  const handleAsk = () => {
    if (!newQuestion.trim()) return;

    if (guestName) {
      void submitQuestion(guestName);
      return;
    }

    setNamePrompt({ type: "ask" });
  };

  const submitAnswer = async (questionId: string, authorName: string) => {
    const answerText = answerInputs[questionId]?.trim();
    const normalizedName = saveGuestName(authorName);
    if (!normalizedName || !answerText) return;

    setGuestName(normalizedName);
    setIsAnswering((current) => ({ ...current, [questionId]: true }));

    try {
      const answer: Answer = {
        id: Math.random().toString(36).slice(2, 11),
        author: normalizedName,
        authorId: guestId,
        content: answerText,
        likes: [],
        dislikes: [],
        createdAt: Date.now(),
        isAI: false,
      };

      await updateDoc(doc(db, "smarttalk", questionId), {
        answers: arrayUnion(answer),
      });

      setAnswerInputs((current) => ({ ...current, [questionId]: "" }));
    } catch (error) {
      console.error("Failed to post answer:", error);
    } finally {
      setIsAnswering((current) => ({ ...current, [questionId]: false }));
    }
  };

  const handleAnswer = (questionId: string) => {
    if (!answerInputs[questionId]?.trim()) return;

    if (guestName) {
      void submitAnswer(questionId, guestName);
      return;
    }

    setNamePrompt({ type: "answer", questionId });
  };

  const handleVote = async (
    question: Question,
    answerId: string,
    voteType: "like" | "dislike"
  ) => {
    const updatedAnswers = question.answers.map((answer) => {
      if (answer.id !== answerId) return answer;

      const likes = answer.likes || [];
      const dislikes = answer.dislikes || [];
      const alreadyLiked = likes.includes(guestId);
      const alreadyDisliked = dislikes.includes(guestId);

      if (voteType === "like") {
        return {
          ...answer,
          likes: alreadyLiked
            ? likes.filter((id) => id !== guestId)
            : [...likes, guestId],
          dislikes: dislikes.filter((id) => id !== guestId),
        };
      }

      return {
        ...answer,
        dislikes: alreadyDisliked
          ? dislikes.filter((id) => id !== guestId)
          : [...dislikes, guestId],
        likes: likes.filter((id) => id !== guestId),
      };
    });

    try {
      await updateDoc(doc(db, "smarttalk", question.id), {
        answers: updatedAnswers,
      });
    } catch (error) {
      console.error("Failed to vote:", error);
    }
  };

  const getAnswerBorderClass = (
    answer: Answer,
    isTop: boolean,
    isWorst: boolean
  ) => {
    if (answer.isAI) return "border-2 border-purple-200 bg-purple-50/40";
    if (isTop) {
      return "border-4 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]";
    }

    const score = (answer.likes?.length || 0) - (answer.dislikes?.length || 0);
    if (isWorst && score < -1) return "border-2 border-red-300 bg-red-50";
    if (score >= 10) return "border-2 border-emerald-600";
    if (score >= 5) return "border-2 border-emerald-400";
    if (score >= 1) return "border border-emerald-200";
    return "border border-gray-200";
  };

  const handlePromptConfirm = (username: string) => {
    if (!namePrompt) return;

    const normalizedName = saveGuestName(username);
    setGuestName(normalizedName);
    const prompt = namePrompt;
    setNamePrompt(null);

    if (prompt.type === "ask") {
      void submitQuestion(normalizedName);
      return;
    }

    void submitAnswer(prompt.questionId, normalizedName);
  };

  return (
    <div className="space-y-6 pb-20">
      <SEO
        title="SmartTalk - Q&A Community | Readative"
        description="Ask questions and get community answers on Readative."
        keywords={["Q&A", "questions", "answers", "community", "reading"]}
      />

      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-8 text-white shadow-lg">
        <h2 className="text-3xl font-bold mb-1 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-yellow-300" />
          SmartTalk
        </h2>

        <p className="text-indigo-100 mb-2 text-sm">
          Anyone can ask or answer. Votes are limited to one like or one dislike
          per visitor.
        </p>
        <p className="text-indigo-100 mb-6 text-sm">
          Unanswered questions still get a Gemini AI response after 6 hours.
        </p>

        {guestName ? (
          <p className="text-xs text-indigo-100 mb-3">
            Posting as{" "}
            <span className="font-semibold text-white">@{guestName}</span>
            {" · "}
            <button
              onClick={() => {
                clearGuestName();
                setGuestName(null);
              }}
              className="underline underline-offset-2"
            >
              switch
            </button>
          </p>
        ) : (
          <p className="text-xs text-indigo-100 mb-3">
            Add your name once, then start asking and answering.
          </p>
        )}

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

      {isLoading ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading questions...</p>
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          No questions yet. Be the first to ask!
        </div>
      ) : (
        <div className="space-y-6">
          {questions.map((question) => {
            const humanAnswers = (question.answers || []).filter(
              (answer) => !answer.isAI
            );
            const aiAnswers = (question.answers || []).filter(
              (answer) => answer.isAI
            );

            const sortedHumanAnswers = [...humanAnswers].sort(
              (left, right) =>
                ((right.likes?.length || 0) - (right.dislikes?.length || 0)) -
                ((left.likes?.length || 0) - (left.dislikes?.length || 0))
            );

            const topAnswerId =
              sortedHumanAnswers[0] &&
              (sortedHumanAnswers[0].likes?.length || 0) -
                (sortedHumanAnswers[0].dislikes?.length || 0) >
                0
                ? sortedHumanAnswers[0].id
                : null;

            const worstAnswerId =
              sortedHumanAnswers.length > 1
                ? sortedHumanAnswers[sortedHumanAnswers.length - 1].id
                : null;

            const allSortedAnswers = [...sortedHumanAnswers, ...aiAnswers];

            return (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-6 shadow-sm border border-black/5"
              >
                <div className="flex items-start gap-4 mb-5">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 leading-snug">
                      {question.content}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Asked by{" "}
                      <span className="font-semibold">{question.author}</span>
                      {" · "}
                      {new Date(question.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pl-4 border-l-2 border-gray-100 ml-5 mb-5">
                  <AnimatePresence>
                    {allSortedAnswers.length === 0 ? (
                      <p className="text-sm text-gray-400 italic py-2">
                        No answers yet. Be the first or wait 6 hours for Gemini
                        AI to answer.
                      </p>
                    ) : (
                      allSortedAnswers.map((answer) => {
                        const isTop = answer.id === topAnswerId;
                        const isWorst = answer.id === worstAnswerId;
                        const likeCount = answer.likes?.length || 0;
                        const dislikeCount = answer.dislikes?.length || 0;
                        const score = likeCount - dislikeCount;
                        const userLiked = (answer.likes || []).includes(guestId);
                        const userDisliked = (answer.dislikes || []).includes(
                          guestId
                        );

                        return (
                          <motion.div
                            key={answer.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`rounded-2xl p-4 transition-all duration-300 bg-gray-50 ${getAnswerBorderClass(
                              answer,
                              isTop,
                              isWorst
                            )}`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                {answer.isAI ? (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                                      <Sparkles className="w-3 h-3 text-white" />
                                    </div>
                                    <span className="text-xs font-bold text-purple-700">
                                      Gemini AI
                                    </span>
                                    <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-bold">
                                      AI
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-xs font-bold text-gray-700">
                                    {answer.author}
                                  </span>
                                )}

                                {isTop && !answer.isAI && (
                                  <span className="flex items-center gap-1 text-yellow-600 text-[10px] font-bold bg-yellow-50 px-2 py-0.5 rounded-full">
                                    <Trophy className="w-3 h-3" /> Top Answer
                                  </span>
                                )}

                                {!answer.isAI && score !== 0 && (
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      score > 0
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-red-100 text-red-600"
                                    }`}
                                  >
                                    {score > 0 ? `+${score}` : score}
                                  </span>
                                )}
                              </div>

                              <span className="text-[10px] text-gray-400 flex-shrink-0">
                                {new Date(answer.createdAt).toLocaleTimeString(
                                  [],
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </span>
                            </div>

                            <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap mb-3">
                              {answer.content}
                            </p>

                            <div className="flex items-center gap-4">
                              <button
                                onClick={() =>
                                  void handleVote(question, answer.id, "like")
                                }
                                className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                                  userLiked
                                    ? "text-emerald-600"
                                    : "text-gray-400 hover:text-emerald-600"
                                }`}
                              >
                                <ThumbsUp
                                  className={`w-4 h-4 ${
                                    userLiked ? "fill-current" : ""
                                  }`}
                                />
                                {likeCount}
                              </button>

                              <button
                                onClick={() =>
                                  void handleVote(
                                    question,
                                    answer.id,
                                    "dislike"
                                  )
                                }
                                className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                                  userDisliked
                                    ? "text-red-500"
                                    : "text-gray-400 hover:text-red-500"
                                }`}
                              >
                                <ThumbsDown
                                  className={`w-4 h-4 ${
                                    userDisliked ? "fill-current" : ""
                                  }`}
                                />
                                {dislikeCount}
                              </button>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex gap-2 mt-2">
                  <input
                    value={answerInputs[question.id] || ""}
                    onChange={(e) =>
                      setAnswerInputs((current) => ({
                        ...current,
                        [question.id]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleAnswer(question.id)
                    }
                    placeholder="Write your answer..."
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                  />
                  <button
                    onClick={() => handleAnswer(question.id)}
                    disabled={
                      !answerInputs[question.id]?.trim() || isAnswering[question.id]
                    }
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-all"
                  >
                    {isAnswering[question.id] ? (
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

      <AnimatePresence>
        {namePrompt && (
          <UsernamePrompt
            title={
              namePrompt.type === "ask" ? "Who is asking?" : "Who is answering?"
            }
            description="Add your display name so everyone can see who posted it."
            submitLabel={namePrompt.type === "ask" ? "Ask" : "Answer"}
            initialValue={guestName || ""}
            onConfirm={handlePromptConfirm}
            onClose={() => setNamePrompt(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
