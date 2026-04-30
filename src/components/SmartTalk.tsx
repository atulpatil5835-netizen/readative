import { useDeferredValue, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Link2,
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
  runTransaction,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { UsernamePrompt } from "./Auth";
import { DiscoverySearch } from "./DiscoverySearch";
import {
  clearGuestName,
  getGuestId,
  getGuestName,
  saveGuestName,
} from "../utils/guestIdentity";
import { moderateContent } from "../utils/contentModeration";
import { renderRichText } from "../utils/renderRichText";

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

type NamePromptState =
  | { type: "ask" }
  | { type: "answer"; questionId: string }
  | null;

type VoteType = "like" | "dislike";

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

export function SmartTalk() {
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
  const [namePrompt, setNamePrompt] = useState<NamePromptState>(null);
  const [guestName, setGuestName] = useState<string | null>(() =>
    getGuestName(),
  );
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

  const guestId = getGuestId();
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    const smartTalkQuery = query(
      collection(db, "smarttalk"),
      orderBy("createdAt", "desc"),
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

  const submitQuestion = async (authorName: string) => {
    const normalizedName = saveGuestName(authorName);
    const questionText = newQuestion.trim();
    if (!normalizedName || !questionText) return;

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

    setGuestName(normalizedName);
    setIsAsking(true);
    setIsModeratingQuestion(false);

    try {
      await addDoc(collection(db, "smarttalk"), {
        author: normalizedName,
        authorId: guestId,
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

    setGuestName(normalizedName);
    setIsAnswering((current) => ({ ...current, [questionId]: true }));
    setModeratingAnswerId(null);

    try {
      const answer: Answer = {
        id: Math.random().toString(36).slice(2, 11),
        author: normalizedName,
        authorId: guestId,
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

    if (guestName) {
      void submitAnswer(questionId, guestName);
      return;
    }

    setNamePrompt({ type: "answer", questionId });
  };

  const handleVote = async (
    question: Question,
    answerId: string,
    voteType: VoteType,
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
            ? toggleSmartTalkVote(answer, guestId, voteType)
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

  const getAnswerScore = (answer: Answer) =>
    (answer.likes?.length || 0) - (answer.dislikes?.length || 0);

  const getAnswerBorderClass = (
    answer: Answer,
    isTop: boolean,
    isWorst: boolean,
  ) => {
    if (isTop) {
      return "border-4 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]";
    }

    const score = getAnswerScore(answer);
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
    const userLiked = (answer.likes || []).includes(guestId);
    const userDisliked = (answer.dislikes || []).includes(guestId);

    return (
      <div
        key={answer.id}
        className={`rounded-2xl p-4 transition-all duration-300 bg-gray-50 ${getAnswerBorderClass(
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
              <span className="flex items-center gap-1 text-yellow-600 text-[10px] font-bold bg-yellow-50 px-2 py-0.5 rounded-full">
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
          Learning questions only. Casual chat, sexual content, and low-value
          posts are filtered before they go live.
        </p>

        {moderationMessage && (
          <div className="mb-4 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white">
            {moderationMessage}
          </div>
        )}

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
            placeholder="Ask a learning question. You can add links like [NotebookLM](https://notebooklm.google.com)"
            className="w-full resize-none bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white placeholder-indigo-200 focus:outline-none focus:bg-white/20 transition-all text-sm"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-xs text-indigo-100">
              <Link2 className="w-3.5 h-3.5" />
              Use `[title](https://example.com)` for clickable links. Press
              `Enter` to send and `Shift+Enter` for a new line.
            </p>
            <button
              onClick={handleAsk}
              disabled={isAsking || isModeratingQuestion || !newQuestion.trim()}
              className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors disabled:opacity-50 text-sm"
            >
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
                className="bg-white rounded-3xl p-6 shadow-sm border border-black/5"
              >
                <div className="flex items-start gap-4 mb-5">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 leading-snug">
                      {renderRichText({ text: question.content })}
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
                            <div>
                              <p className="text-sm font-semibold text-indigo-700">
                                Showing the top answer first
                              </p>
                              <p className="text-xs text-indigo-500">
                                {hiddenAnswerCount} more answer
                                {hiddenAnswerCount === 1 ? "" : "s"} hidden
                                below.
                              </p>
                            </div>

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
                    placeholder="Write a useful answer. You can add links like [NotebookLM](https://notebooklm.google.com)"
                    className="w-full resize-none bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="flex items-center gap-2 text-xs text-gray-400">
                      <Link2 className="w-3.5 h-3.5" />
                      Use `[title](https://example.com)` for clickable links.
                      Press `Enter` to send and `Shift+Enter` for a new line.
                    </p>
                    <button
                      onClick={() => handleAnswer(question.id)}
                      disabled={
                        !answerInputs[question.id]?.trim() ||
                        isAnswering[question.id] ||
                        moderatingAnswerId === question.id
                      }
                      className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-all"
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
    </div>
  );
}
