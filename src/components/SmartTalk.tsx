import { useDeferredValue, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
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
  limit,
  serverTimestamp,
  doc,
  runTransaction,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { GoogleSignInPrompt } from "./Auth";
import { DiscoverySearch } from "./DiscoverySearch";
import { moderateContent } from "../utils/contentModeration";
import { renderRichText } from "../utils/renderRichText";
import { signInWithGoogleAccount } from "../utils/googleAuth";
import { type KnowledgeIdentity } from "../utils/knowledgeIdentity";

const SMART_TALK_REALTIME_LIMIT = 50;

interface Answer {
  id: string;
  author: string;
  authorId?: string;
  content: string;
  likes: string[];
  dislikes: string[];
  createdAt: number;
}

interface Question {
  id: string;
  author: string;
  authorId: string;
  content: string;
  answers: Answer[];
  createdAt: number;
}

type VoteType = "like" | "dislike";

type SmartTalkPromptState =
  | { type: "ask" }
  | { type: "answer"; questionId: string }
  | {
      type: "vote";
      question: Question;
      answerId: string;
      voteType: VoteType;
    }
  | null;

interface SmartTalkProps {
  currentIdentity: KnowledgeIdentity | null;
  onIdentityChange: (identity: KnowledgeIdentity | null) => void;
}

function tokenizeSearch(input: string) {
  return input.trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 10);
}

function matchesSmartTalkSearch(question: Question, terms: string[]) {
  if (terms.length === 0) return true;

  const people = [
    question.author,
    ...(question.answers || []).map((answer) => answer.author),
  ]
    .filter(Boolean)
    .map((value) => value.toLowerCase());
  const searchableText = [
    question.author,
    question.content,
    ...(question.answers || []).map((answer) => answer.author),
    ...(question.answers || []).map((answer) => answer.content),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return terms.every((term) => {
    if (term.startsWith("@")) {
      const normalized = term.slice(1);
      return (
        Boolean(normalized) &&
        people.some((person) => person.includes(normalized))
      );
    }

    const normalized = term.startsWith("#") ? term.slice(1) : term;
    return Boolean(normalized) && searchableText.includes(normalized);
  });
}

function normalizeSmartTalkAnswer(
  answer: Partial<Answer> & {
    createdAt?: number | { toMillis?: () => number };
  },
): Answer {
  const rawCreatedAt = answer.createdAt as
    | number
    | { toMillis?: () => number }
    | undefined;

  return {
    id: answer.id || Math.random().toString(36).slice(2, 11),
    author: answer.author || "Unknown",
    authorId: answer.authorId || "",
    content: answer.content || "",
    likes: answer.likes || [],
    dislikes: answer.dislikes || [],
    createdAt:
      rawCreatedAt &&
      typeof rawCreatedAt === "object" &&
      typeof rawCreatedAt.toMillis === "function"
        ? rawCreatedAt.toMillis()
        : typeof rawCreatedAt === "number"
          ? rawCreatedAt
          : Date.now(),
  };
}

function normalizeSmartTalkQuestion(
  id: string,
  data: Partial<Question> & {
    createdAt?: number | { toMillis?: () => number };
    answers?: Array<
      Partial<Answer> & {
        createdAt?: number | { toMillis?: () => number };
      }
    >;
  },
): Question {
  const rawCreatedAt = data.createdAt as
    | number
    | { toMillis?: () => number }
    | undefined;

  return {
    id,
    author: data.author || "Unknown",
    authorId: data.authorId || "",
    content: data.content || "",
    answers: (data.answers || []).map((answer) =>
      normalizeSmartTalkAnswer(answer),
    ),
    createdAt:
      rawCreatedAt &&
      typeof rawCreatedAt === "object" &&
      typeof rawCreatedAt.toMillis === "function"
        ? rawCreatedAt.toMillis()
        : typeof rawCreatedAt === "number"
          ? rawCreatedAt
          : Date.now(),
  };
}

function serializeSmartTalkAnswer(answer: Answer) {
  return {
    id: answer.id,
    author: answer.author,
    ...(answer.authorId ? { authorId: answer.authorId } : {}),
    content: answer.content,
    likes: answer.likes || [],
    dislikes: answer.dislikes || [],
    createdAt: answer.createdAt,
  };
}

function toggleSmartTalkVote(
  answer: Answer,
  voterId: string,
  voteType: VoteType,
): Answer {
  const likes = answer.likes || [];
  const dislikes = answer.dislikes || [];
  const alreadyLiked = likes.includes(voterId);
  const alreadyDisliked = dislikes.includes(voterId);

  if (voteType === "like") {
    return {
      ...answer,
      likes: alreadyLiked
        ? likes.filter((id) => id !== voterId)
        : [...likes, voterId],
      dislikes: dislikes.filter((id) => id !== voterId),
    };
  }

  return {
    ...answer,
    dislikes: alreadyDisliked
      ? dislikes.filter((id) => id !== voterId)
      : [...dislikes, voterId],
    likes: likes.filter((id) => id !== voterId),
  };
}

export function SmartTalk({
  currentIdentity,
  onIdentityChange,
}: SmartTalkProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [isModeratingQuestion, setIsModeratingQuestion] = useState(false);
  const [answerInputs, setAnswerInputs] = useState<Record<string, string>>({});
  const [isAnswering, setIsAnswering] = useState<Record<string, boolean>>({});
  const [moderatingAnswerId, setModeratingAnswerId] = useState<string | null>(
    null,
  );
  const [namePrompt, setNamePrompt] = useState<SmartTalkPromptState>(null);
  const [moderationMessage, setModerationMessage] = useState<string | null>(
    null,
  );
  const [answerMessages, setAnswerMessages] = useState<Record<string, string>>(
    {},
  );
  const [expandedAnswers, setExpandedAnswers] = useState<
    Record<string, boolean>
  >({});
  const [searchQuery, setSearchQuery] = useState("");

  const activeAuthorId = currentIdentity?.authorId || null;
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    const smartTalkQuery = query(
      collection(db, "smarttalk"),
      orderBy("createdAt", "desc"),
      limit(SMART_TALK_REALTIME_LIMIT),
    );

    const unsubscribe = onSnapshot(
      smartTalkQuery,
      (snapshot) => {
        const data = snapshot.docs.map((item) =>
          normalizeSmartTalkQuestion(item.id, item.data() as Partial<Question>),
        );

        setQuestions(data);
        setIsLoading(false);
      },
      (error) => {
        console.error("Firestore SmartTalk error:", error);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const submitQuestion = async (authorIdentity: KnowledgeIdentity) => {
    const questionText = newQuestion.trim();
    if (!questionText) return;

    setModerationMessage(null);
    setIsModeratingQuestion(true);

    const moderation = await moderateContent("smarttalk-question", {
      content: questionText,
    });

    if (!moderation.allowed) {
      setModerationMessage(moderation.message);
      setIsModeratingQuestion(false);
      return;
    }

    setIsAsking(true);
    setIsModeratingQuestion(false);

    try {
      await addDoc(collection(db, "smarttalk"), {
        author: authorIdentity.displayName,
        authorId: authorIdentity.authorId,
        content: questionText,
        answers: [],
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

    setModerationMessage(null);

    if (currentIdentity) {
      void submitQuestion(currentIdentity);
      return;
    }

    setNamePrompt({ type: "ask" });
  };

  const submitAnswer = async (
    questionId: string,
    authorIdentity: KnowledgeIdentity,
  ) => {
    const answerText = answerInputs[questionId]?.trim();
    if (!answerText) return;

    setModerationMessage(null);
    setAnswerMessages((current) => ({ ...current, [questionId]: "" }));
    setModeratingAnswerId(questionId);

    const moderation = await moderateContent("smarttalk-answer", {
      content: answerText,
    });

    if (!moderation.allowed) {
      setModeratingAnswerId(null);
      setAnswerMessages((current) => ({
        ...current,
        [questionId]: moderation.message,
      }));
      return;
    }

    setIsAnswering((current) => ({ ...current, [questionId]: true }));
    setModeratingAnswerId(null);

    try {
      const answer: Answer = {
        id: Math.random().toString(36).slice(2, 11),
        author: authorIdentity.displayName,
        authorId: authorIdentity.authorId,
        content: answerText,
        likes: [],
        dislikes: [],
        createdAt: Date.now(),
      };

      await updateDoc(doc(db, "smarttalk", questionId), {
        answers: arrayUnion(answer),
      });

      setAnswerInputs((current) => ({ ...current, [questionId]: "" }));
      setAnswerMessages((current) => ({ ...current, [questionId]: "" }));
      setExpandedAnswers((current) => ({ ...current, [questionId]: true }));
    } catch (error) {
      console.error("Failed to post answer:", error);
      setAnswerMessages((current) => ({
        ...current,
        [questionId]: "Could not post your answer right now. Please try again.",
      }));
    } finally {
      setIsAnswering((current) => ({ ...current, [questionId]: false }));
    }
  };

  const handleAnswer = (questionId: string) => {
    if (!answerInputs[questionId]?.trim()) return;

    setModerationMessage(null);
    setAnswerMessages((current) => ({ ...current, [questionId]: "" }));

    if (currentIdentity) {
      void submitAnswer(questionId, currentIdentity);
      return;
    }

    setNamePrompt({ type: "answer", questionId });
  };

  const applyVote = async (
    question: Question,
    answerId: string,
    voteType: VoteType,
    voterId: string,
  ) => {
    try {
      const questionRef = doc(db, "smarttalk", question.id);

      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(questionRef);
        if (!snapshot.exists()) return;

        const currentQuestion = normalizeSmartTalkQuestion(
          snapshot.id,
          snapshot.data() as Partial<Question>,
        );

        const updatedAnswers = (currentQuestion.answers || []).map((answer) =>
          answer.id === answerId
            ? toggleSmartTalkVote(answer, voterId, voteType)
            : answer,
        );

        transaction.update(questionRef, {
          answers: updatedAnswers.map(serializeSmartTalkAnswer),
        });
      });
    } catch (error) {
      console.error("Failed to vote:", error);
    }
  };

  const handleVote = async (
    question: Question,
    answerId: string,
    voteType: VoteType,
  ) => {
    if (!currentIdentity) {
      setNamePrompt({ type: "vote", question, answerId, voteType });
      return;
    }

    await applyVote(question, answerId, voteType, currentIdentity.authorId);
  };

  const getAnswerScore = (answer: Answer) =>
    (answer.likes?.length || 0) - (answer.dislikes?.length || 0);

  const getAnswerBorderClass = (
    answer: Answer,
    isTop: boolean,
    isWorst: boolean,
  ) => {
    if (isTop) {
      return "border border-amber-200 bg-amber-50/40";
    }

    const score = getAnswerScore(answer);
    if (isWorst && score < -1) return "border border-rose-200 bg-rose-50";
    if (score >= 10) return "border border-emerald-300";
    if (score >= 5) return "border border-emerald-200";
    if (score >= 1) return "border border-emerald-200";
    return "border border-slate-200";
  };

  const handlePromptConfirm = async () => {
    if (!namePrompt) return;

    const prompt = namePrompt;
    const nextIdentity = await signInWithGoogleAccount();
    onIdentityChange(nextIdentity);

    if (prompt.type === "ask") {
      setNamePrompt(null);
      void submitQuestion(nextIdentity);
      return;
    }

    if (prompt.type === "answer") {
      setNamePrompt(null);
      void submitAnswer(prompt.questionId, nextIdentity);
      return;
    }

    setNamePrompt(null);
    void applyVote(
      prompt.question,
      prompt.answerId,
      prompt.voteType,
      nextIdentity.authorId,
    );
  };

  const searchTerms = tokenizeSearch(deferredSearchQuery);
  const visibleQuestions =
    searchTerms.length === 0
      ? questions
      : questions.filter((question) =>
          matchesSmartTalkSearch(question, searchTerms),
        );
  const hasSearchQuery = searchQuery.trim().length > 0;

  const renderAnswerCard = (
    question: Question,
    answer: Answer,
    {
      isTop = false,
      isWorst = false,
    }: {
      isTop?: boolean;
      isWorst?: boolean;
    } = {},
  ) => {
    const likeCount = answer.likes?.length || 0;
    const dislikeCount = answer.dislikes?.length || 0;
    const score = getAnswerScore(answer);
    const userLiked = activeAuthorId
      ? (answer.likes || []).includes(activeAuthorId)
      : false;
    const userDisliked = activeAuthorId
      ? (answer.dislikes || []).includes(activeAuthorId)
      : false;

    return (
      <div
        key={answer.id}
        className={`rounded-2xl p-4 transition-all duration-300 ${getAnswerBorderClass(
          answer,
          isTop,
          isWorst,
        )}`}
      >
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-700">
              {answer.author}
            </span>

            {isTop && (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                <Trophy className="w-3 h-3" /> Top Answer
              </span>
            )}

            {score !== 0 && (
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
            {new Date(answer.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap mb-3">
          {renderRichText({ text: answer.content })}
        </p>

        <div className="flex items-center gap-4">
          <button
            onClick={() => void handleVote(question, answer.id, "like")}
            className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
              userLiked
                ? "text-emerald-600"
                : "text-gray-400 hover:text-emerald-600"
            }`}
          >
            <ThumbsUp
              className={`w-4 h-4 ${userLiked ? "fill-current" : ""}`}
            />
            {likeCount}
          </button>

          <button
            onClick={() => void handleVote(question, answer.id, "dislike")}
            className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
              userDisliked ? "text-red-500" : "text-gray-400 hover:text-red-500"
            }`}
          >
            <ThumbsDown
              className={`w-4 h-4 ${userDisliked ? "fill-current" : ""}`}
            />
            {dislikeCount}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      <SEO
        title="SmartTalk - Q&A Community | Readative"
        description="Ask learning-focused questions and get thoughtful community answers on Readative."
        keywords={[
          "Q&A",
          "learning questions",
          "answers",
          "community",
          "knowledge",
        ]}
      />

      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-2xl font-black tracking-tight text-slate-950">
                SmartTalk
              </h2>
              {currentIdentity && (
                <p className="truncate text-xs font-semibold text-slate-500">
                  @{currentIdentity.displayName}
                </p>
              )}
            </div>
          </div>
        </div>

        {moderationMessage && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {moderationMessage}
          </div>
        )}

        <div className="space-y-3">
          <textarea
            value={newQuestion}
            onChange={(e) => {
              setNewQuestion(e.target.value);
              if (moderationMessage) setModerationMessage(null);
            }}
            enterKeyHint="send"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAsk();
              }
            }}
            rows={3}
            placeholder="Ask something useful..."
            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
          />
          <div className="flex justify-end">
            <button
              onClick={handleAsk}
              disabled={isAsking || isModeratingQuestion || !newQuestion.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 sm:w-auto"
            >
              <Send className="h-4 w-4" />
              {isAsking || isModeratingQuestion ? "Posting..." : "Ask"}
            </button>
          </div>
        </div>
      </div>

      <DiscoverySearch
        theme="indigo"
        placeholder="Search"
        value={searchQuery}
        onChange={setSearchQuery}
        onClear={() => setSearchQuery("")}
        ariaLabel="Search SmartTalk"
      />

      {isLoading ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading questions...</p>
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          No questions yet. Be the first to ask!
        </div>
      ) : visibleQuestions.length === 0 ? (
        <div className="rounded-[30px] border border-dashed border-indigo-200 bg-white px-6 py-16 text-center shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-500">
            No Search Matches
          </p>
          <h3 className="mt-3 text-xl font-black text-slate-900">
            No SmartTalk posts matched "{searchQuery.trim()}"
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Try a broader phrase or search by the author with @username.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleQuestions.map((question) => {
            const sortedAnswers = [...(question.answers || [])].sort(
              (left, right) =>
                getAnswerScore(right) - getAnswerScore(left) ||
                left.createdAt - right.createdAt,
            );
            const topAnswerId = sortedAnswers[0]?.id || null;

            const worstAnswerId =
              sortedAnswers.length > 1
                ? sortedAnswers[sortedAnswers.length - 1].id
                : null;

            const featuredAnswer = sortedAnswers[0] || null;
            const hiddenAnswers = sortedAnswers.slice(1);
            const answersExpanded = Boolean(expandedAnswers[question.id]);
            const hiddenAnswerCount = hiddenAnswers.length;

            return (
              <div
                key={question.id}
                className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-5 flex items-start gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-indigo-50">
                    <User className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold leading-snug text-slate-950">
                      {renderRichText({ text: question.content })}
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Asked by{" "}
                      <span className="font-semibold">{question.author}</span>
                      {" · "}
                      {new Date(question.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="mb-5 ml-4 space-y-3 border-l border-slate-100 pl-4">
                  {sortedAnswers.length === 0 ? (
                    <p className="text-sm text-gray-400 italic py-2">
                      No answers yet. Be the first to help.
                    </p>
                  ) : (
                    <>
                      {featuredAnswer &&
                        renderAnswerCard(question, featuredAnswer, {
                          isTop:
                            Boolean(topAnswerId) &&
                            featuredAnswer.id === topAnswerId,
                          isWorst: featuredAnswer.id === worstAnswerId,
                        })}

                      {hiddenAnswerCount > 0 && (
                        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm font-semibold text-indigo-700">
                              {hiddenAnswerCount} more answer
                              {hiddenAnswerCount === 1 ? "" : "s"}
                            </p>
                            <button
                              onClick={() =>
                                setExpandedAnswers((current) => ({
                                  ...current,
                                  [question.id]: !current[question.id],
                                }))
                              }
                              className="inline-flex items-center justify-center gap-2 rounded-full border border-indigo-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-indigo-700 transition-colors hover:bg-indigo-100"
                            >
                              {answersExpanded ? (
                                <>
                                  See less <ChevronUp className="w-4 h-4" />
                                </>
                              ) : (
                                <>
                                  See {hiddenAnswerCount} more
                                  <ChevronDown className="w-4 h-4" />
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {answersExpanded &&
                        hiddenAnswers.map((answer) =>
                          renderAnswerCard(question, answer, {
                            isTop:
                              Boolean(topAnswerId) && answer.id === topAnswerId,
                            isWorst: answer.id === worstAnswerId,
                          }),
                        )}
                    </>
                  )}
                </div>

                <div className="mt-2 space-y-3">
                  <textarea
                    value={answerInputs[question.id] || ""}
                    onChange={(e) =>
                      setAnswerInputs((current) => ({
                        ...current,
                        [question.id]: e.target.value,
                      }))
                    }
                    onInput={() =>
                      setAnswerMessages((current) => ({
                        ...current,
                        [question.id]: "",
                      }))
                    }
                    enterKeyHint="send"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAnswer(question.id);
                      }
                    }}
                    rows={3}
                    placeholder="Write an answer..."
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleAnswer(question.id)}
                      disabled={
                        !answerInputs[question.id]?.trim() ||
                        isAnswering[question.id] ||
                        moderatingAnswerId === question.id
                      }
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-indigo-700 disabled:opacity-40 sm:w-auto"
                    >
                      {isAnswering[question.id] ||
                      moderatingAnswerId === question.id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Answer
                        </>
                      )}
                    </button>
                  </div>
                  {answerMessages[question.id] && (
                    <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                      {answerMessages[question.id]}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {namePrompt && (
        <GoogleSignInPrompt
          title={
            namePrompt.type === "ask"
              ? "Sign in to ask"
              : namePrompt.type === "answer"
                ? "Sign in to answer"
                : "Sign in to vote"
          }
          description="Use Google to keep SmartTalk synced with your profile."
          submitLabel="Continue with Google"
          onConfirm={handlePromptConfirm}
          onClose={() => setNamePrompt(null)}
        />
      )}
    </div>
  );
}
