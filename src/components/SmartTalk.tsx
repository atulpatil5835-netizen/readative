import {
  type ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Flame,
  HelpCircle,
  ThumbsUp,
  Trophy,
  Send,
  ShieldAlert,
  ShieldCheck,
  User,
} from "lucide-react";
import { SEO } from "./SEO";
import { ReadativeLoader, ReadativeRMark } from "./ReadativeLoader";
import {
  collection,
  addDoc,
  type DocumentData,
  getCountFromServer,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  doc,
  startAfter,
  type QueryDocumentSnapshot,
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
import { SmartTalkQuestionSkeleton } from "./Skeletons";
import {
  getAnswerHelpfulScore,
  getTrustMetrics,
  mergeTrustIds,
  normalizeTrustCount,
  normalizeTrustIdArray,
} from "../utils/trustSystem";
import { getSaveMetrics, toggleSmartTalkSave } from "../utils/bookmarks";
import {
  KNOWLEDGE_CATEGORY_SUGGESTIONS,
  type SmartTalkDifficulty,
  normalizeSmartTalkDifficulty,
  suggestKnowledgeCategory,
} from "../utils/contentIntelligence";
import {
  buildBreadcrumbSchema,
  buildCollectionPageSchema,
  buildDiscussionForumPostingSchema,
  buildFAQPageSchema,
  buildItemListSchema,
  buildOrganizationSchema,
  buildWebSiteSchema,
} from "../utils/seoSchemas";
import {
  SEO_CATEGORIES,
  getCategoryBySlug,
} from "../utils/seoTaxonomy";
import { buildPublicPath, navigateToRoute } from "../utils/routes";
import type { Answer, Question } from "../types";
import { tokenizeSearch } from "../utils/searchHelpers";

const SMART_TALK_PAGE_SIZE = 50;

type VoteType = "helpful" | "misleading";

type SmartTalkPromptState =
  | { type: "ask" }
  | { type: "answer"; questionId: string }
  | {
      type: "vote";
      question: Question;
      answerId: string;
      voteType: VoteType;
    }
  | { type: "save"; question: Question }
  | null;

interface SmartTalkProps {
  currentIdentity: KnowledgeIdentity | null;
  onIdentityChange: (identity: KnowledgeIdentity | null) => void;
  selectedCategory?: string | null;
  focusedQuestionId?: string | null;
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
  const helpfulIds = mergeTrustIds(
    normalizeTrustIdArray(answer.likes),
    normalizeTrustIdArray(answer.helpfulIds),
  );
  const misleadingIds = mergeTrustIds(
    normalizeTrustIdArray(answer.dislikes),
    normalizeTrustIdArray(answer.misleadingIds),
  );
  const helpfulCount = Math.max(
    helpfulIds.length,
    normalizeTrustCount(answer.helpfulCount),
  );
  const misleadingCount = Math.max(
    misleadingIds.length,
    normalizeTrustCount(answer.misleadingCount),
  );

  return {
    id:
      typeof answer.id === "string" && answer.id
        ? answer.id
        : Math.random().toString(36).slice(2, 11),
    author:
      typeof answer.author === "string" && answer.author ? answer.author : "Unknown",
    authorId: typeof answer.authorId === "string" ? answer.authorId : "",
    content: typeof answer.content === "string" ? answer.content : "",
    likes: helpfulIds,
    dislikes: misleadingIds,
    helpfulIds,
    helpfulCount,
    misleadingIds,
    misleadingCount,
    bestAnswer: answer.bestAnswer === true,
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

  const saveMetrics = getSaveMetrics(data);

  return {
    id,
    author: typeof data.author === "string" && data.author ? data.author : "Unknown",
    authorId: typeof data.authorId === "string" ? data.authorId : "",
    content: typeof data.content === "string" ? data.content : "",
    answers: Array.isArray(data.answers)
      ? data.answers.map((answer) => normalizeSmartTalkAnswer(answer))
      : [],
    createdAt:
      rawCreatedAt &&
      typeof rawCreatedAt === "object" &&
      typeof rawCreatedAt.toMillis === "function"
        ? rawCreatedAt.toMillis()
        : typeof rawCreatedAt === "number"
          ? rawCreatedAt
          : Date.now(),
    category: typeof data.category === "string" ? data.category : null,
    difficulty: normalizeSmartTalkDifficulty(data.difficulty),
    savedBy: saveMetrics.savedBy,
    saveCount: saveMetrics.saveCount,
  };
}

function summarizeSmartTalkText(value: string, maxLength = 160) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;

  return `${normalized.slice(0, maxLength - 3).trim()}...`;
}

function getSmartTalkCategoryLabel(category: string | null | undefined) {
  if (!category) return null;

  return getCategoryBySlug(category)?.label || category;
}

function buildSmartTalkSchemas(
  questions: Question[],
  focusedQuestion: Question | null,
  selectedCategory: string | null,
) {
  const pageUrl = focusedQuestion
    ? buildPublicPath("smarttalk", { focusedEntryId: focusedQuestion.id })
    : buildPublicPath("smarttalk", { selectedTopic: selectedCategory });
  const pageLabel = selectedCategory
    ? getSmartTalkCategoryLabel(selectedCategory) || "SmartTalk"
    : "SmartTalk";

  if (focusedQuestion) {
    const primaryAnswer =
      focusedQuestion.answers.find((answer) => answer.bestAnswer) ||
      focusedQuestion.answers[0];

    return [
      buildOrganizationSchema(),
      buildWebSiteSchema(),
      buildBreadcrumbSchema([
        { name: "Home", url: "/" },
        { name: "SmartTalk", url: "/smarttalks" },
        { name: summarizeSmartTalkText(focusedQuestion.content, 90), url: pageUrl },
      ]),
      buildDiscussionForumPostingSchema({
        headline: summarizeSmartTalkText(focusedQuestion.content, 90),
        text: focusedQuestion.content,
        url: pageUrl,
        authorName: focusedQuestion.author,
        authorUrl: focusedQuestion.authorId
          ? `/profile/${encodeURIComponent(focusedQuestion.authorId)}`
          : undefined,
        datePublished: new Date(focusedQuestion.createdAt).toISOString(),
        answerCount: focusedQuestion.answers.length,
        keywords: [
          getSmartTalkCategoryLabel(focusedQuestion.category) || "SmartTalk",
          focusedQuestion.difficulty || "",
        ].filter((value): value is string => Boolean(value)),
        answers: focusedQuestion.answers.map((answer) => ({
          text: answer.content,
          authorName: answer.author,
          authorUrl: answer.authorId
            ? `/profile/${encodeURIComponent(answer.authorId)}`
            : undefined,
        })),
      }),
      buildFAQPageSchema({
        url: pageUrl,
        questions: [{
          question: focusedQuestion.content,
          answer: primaryAnswer?.content,
          suggestedAnswers: focusedQuestion.answers.map((answer) => ({
            text: answer.content,
            authorName: answer.author,
          })),
        }],
      }),
    ];
  }

  const itemList = buildItemListSchema({
    name: "SmartTalk Discussion List",
    url: pageUrl,
    items: questions.slice(0, 10).map((question) => ({
      name: summarizeSmartTalkText(question.content, 90),
      url: buildPublicPath("smarttalk", { focusedEntryId: question.id }),
      description: `${question.answers.length} answer${
        question.answers.length === 1 ? "" : "s"
      }`,
    })),
  });

  return [
    buildOrganizationSchema(),
    buildWebSiteSchema(),
    buildCollectionPageSchema({
      name: pageLabel,
      url: pageUrl,
      description:
        "SmartTalk is Readative's discussion space for knowledge questions, practical answers, and topic-focused learning conversations.",
      about: selectedCategory
        ? pageLabel
        : SEO_CATEGORIES.map((category) => category.label),
      itemList,
    }),
    buildBreadcrumbSchema([
      { name: "Home", url: "/" },
      ...(selectedCategory ? [{ name: "SmartTalk", url: "/smarttalks" }] : []),
      { name: pageLabel, url: pageUrl },
    ]),
    ...questions.slice(0, 10).map((question) =>
      buildDiscussionForumPostingSchema({
        headline: summarizeSmartTalkText(question.content, 90),
        text: question.content,
        url: buildPublicPath("smarttalk", { focusedEntryId: question.id }),
        authorName: question.author,
        authorUrl: question.authorId
          ? `/profile/${encodeURIComponent(question.authorId)}`
          : undefined,
        datePublished: new Date(question.createdAt).toISOString(),
        answerCount: question.answers.length,
        keywords: [
          getSmartTalkCategoryLabel(question.category) || "SmartTalk",
          question.difficulty || "",
        ].filter((value): value is string => Boolean(value)),
      }),
    ),
  ];
}

function serializeSmartTalkAnswer(answer: Answer) {
  const metrics = getTrustMetrics(answer);

  return {
    id: answer.id,
    author: answer.author,
    ...(answer.authorId ? { authorId: answer.authorId } : {}),
    content: answer.content,
    likes: metrics.helpfulIds,
    dislikes: metrics.misleadingIds,
    helpfulIds: metrics.helpfulIds,
    helpfulCount: metrics.helpfulCount,
    misleadingIds: metrics.misleadingIds,
    misleadingCount: metrics.misleadingCount,
    ...(answer.bestAnswer ? { bestAnswer: true } : {}),
    createdAt: answer.createdAt,
  };
}

function toggleSmartTalkVote(
  answer: Answer,
  voterId: string,
  voteType: VoteType,
): Answer {
  const metrics = getTrustMetrics(answer);
  const likes = metrics.helpfulIds;
  const dislikes = metrics.misleadingIds;
  const alreadyLiked = likes.includes(voterId);
  const alreadyDisliked = dislikes.includes(voterId);

  const nextHelpfulIds =
    voteType === "helpful"
      ? alreadyLiked
        ? likes.filter((id) => id !== voterId)
        : [...likes, voterId]
      : likes.filter((id) => id !== voterId);
  const nextMisleadingIds =
    voteType === "misleading"
      ? alreadyDisliked
        ? dislikes.filter((id) => id !== voterId)
        : [...dislikes, voterId]
      : dislikes.filter((id) => id !== voterId);

  return {
    ...answer,
    likes: nextHelpfulIds,
    helpfulIds: nextHelpfulIds,
    helpfulCount: nextHelpfulIds.length,
    dislikes: nextMisleadingIds,
    misleadingIds: nextMisleadingIds,
    misleadingCount: nextMisleadingIds.length,
  };
}

function mergeSmartTalkQuestions(
  primaryQuestions: Question[],
  existingQuestions: Question[],
) {
  const merged = new Map<string, Question>();

  primaryQuestions.forEach((question) => merged.set(question.id, question));
  existingQuestions.forEach((question) => {
    if (!merged.has(question.id)) {
      merged.set(question.id, question);
    }
  });

  return [...merged.values()];
}

export function SmartTalk({
  currentIdentity,
  onIdentityChange,
  selectedCategory = null,
  focusedQuestionId = null,
}: SmartTalkProps) {
  const [firstPageQuestions, setFirstPageQuestions] = useState<Question[]>([]);
  const [loadedPageQuestions, setLoadedPageQuestions] = useState<Question[]>([]);
  const [totalQuestionCount, setTotalQuestionCount] = useState<number | null>(null);
  const [lastQuestionSnapshot, setLastQuestionSnapshot] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreQuestions, setHasMoreQuestions] = useState(false);
  const [isLoadingMoreQuestions, setIsLoadingMoreQuestions] = useState(false);
  const [paginationMessage, setPaginationMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState("");
  const [newQuestionCategory, setNewQuestionCategory] = useState("");
  const [newQuestionDifficulty, setNewQuestionDifficulty] =
    useState<SmartTalkDifficulty | "">("");
  const [isAskModalOpen, setIsAskModalOpen] = useState(false);
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
  const [savingQuestionIds, setSavingQuestionIds] = useState<Record<string, boolean>>(
    {},
  );
  const [searchQuery, setSearchQuery] = useState("");

  const activeAuthorId = currentIdentity?.authorId || null;
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const firstPageQuestionsRef = useRef<Question[]>([]);
  const loadedPageQuestionsRef = useRef<Question[]>([]);
  const totalQuestionCountRef = useRef<number | null>(null);
  const useIndexFallbackRef = useRef(false);
  const questions = useMemo(() => {
    const merged = mergeSmartTalkQuestions(firstPageQuestions, loadedPageQuestions);
    return merged.sort((left, right) => right.createdAt - left.createdAt);
  }, [firstPageQuestions, loadedPageQuestions]);
  const suggestedQuestionCategory = useMemo(
    () => suggestKnowledgeCategory(newQuestion, newQuestion),
    [newQuestion],
  );

  const loadTotalQuestionCount = useCallback(async () => {
    try {
      const q = selectedCategory
        ? query(collection(db, "smarttalk"), where("category", "==", selectedCategory))
        : collection(db, "smarttalk");
      const countSnapshot = await getCountFromServer(q);
      const nextCount = countSnapshot.data().count;
      totalQuestionCountRef.current = nextCount;
      setTotalQuestionCount(nextCount);
    } catch (error) {
      console.error("Firestore SmartTalk count error:", error);
    }
  }, [selectedCategory]);

  useEffect(() => {
    firstPageQuestionsRef.current = firstPageQuestions;
  }, [firstPageQuestions]);

  useEffect(() => {
    loadedPageQuestionsRef.current = loadedPageQuestions;
  }, [loadedPageQuestions]);

  useEffect(() => {
    totalQuestionCountRef.current = totalQuestionCount;
    if (totalQuestionCount !== null && questions.length >= totalQuestionCount) {
      setHasMoreQuestions(false);
    }
  }, [questions.length, totalQuestionCount]);

  useEffect(() => {
    void loadTotalQuestionCount();

    // Reset pagination state when selectedCategory changes to reload fresh list
    setLoadedPageQuestions([]);
    loadedPageQuestionsRef.current = [];
    setLastQuestionSnapshot(null);
    setIsLoading(true);

    let unsubscribe: (() => void) | null = null;
    let isCancelled = false;

    const startListener = (useOrdered: boolean) => {
      let q;
      if (selectedCategory) {
        if (useOrdered) {
          q = query(
            collection(db, "smarttalk"),
            where("category", "==", selectedCategory),
            orderBy("createdAt", "desc"),
            limit(SMART_TALK_PAGE_SIZE),
          );
        } else {
          q = query(
            collection(db, "smarttalk"),
            where("category", "==", selectedCategory),
            limit(SMART_TALK_PAGE_SIZE),
          );
        }
      } else {
        q = query(
          collection(db, "smarttalk"),
          orderBy("createdAt", "desc"),
          limit(SMART_TALK_PAGE_SIZE),
        );
      }

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (isCancelled) return;
          const data = snapshot.docs.map((item) =>
            normalizeSmartTalkQuestion(item.id, item.data() as Partial<Question>),
          );
          if (!useOrdered && selectedCategory) {
            data.sort((left, right) => right.createdAt - left.createdAt);
          }
          const firstPageCursor = snapshot.docs[snapshot.docs.length - 1] || null;
          const loadedIds = new Set([
            ...data.map((question) => question.id),
            ...loadedPageQuestionsRef.current.map((question) => question.id),
          ]);
          const totalCount = totalQuestionCountRef.current;

          firstPageQuestionsRef.current = data;
          setFirstPageQuestions(data);
          if (loadedPageQuestionsRef.current.length === 0) {
            setLastQuestionSnapshot(firstPageCursor);
          }
          setHasMoreQuestions(
            snapshot.docs.length === SMART_TALK_PAGE_SIZE &&
              (totalCount === null || loadedIds.size < totalCount),
          );
          setIsLoading(false);
        },
        (error) => {
          if (isCancelled) return;
          const message = error instanceof Error ? error.message.toLowerCase() : String(error);
          const needsIndex = message.includes("index") || message.includes("requires an index");
          if (needsIndex && useOrdered && selectedCategory) {
            console.info("SmartTalk category ordered query needs an index; using fallback.");
            useIndexFallbackRef.current = true;
            startListener(false);
          } else {
            console.error("Firestore SmartTalk error:", error);
            setIsLoading(false);
          }
        }
      );
    };

    startListener(!useIndexFallbackRef.current);

    return () => {
      isCancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [loadTotalQuestionCount, selectedCategory]);

  const loadMoreQuestions = async () => {
    if (!lastQuestionSnapshot || isLoadingMoreQuestions) return;

    setIsLoadingMoreQuestions(true);
    setPaginationMessage(null);

    try {
      let q;
      if (selectedCategory) {
        if (useIndexFallbackRef.current) {
          q = query(
            collection(db, "smarttalk"),
            where("category", "==", selectedCategory),
            startAfter(lastQuestionSnapshot),
            limit(SMART_TALK_PAGE_SIZE),
          );
        } else {
          q = query(
            collection(db, "smarttalk"),
            where("category", "==", selectedCategory),
            orderBy("createdAt", "desc"),
            startAfter(lastQuestionSnapshot),
            limit(SMART_TALK_PAGE_SIZE),
          );
        }
      } else {
        q = query(
          collection(db, "smarttalk"),
          orderBy("createdAt", "desc"),
          startAfter(lastQuestionSnapshot),
          limit(SMART_TALK_PAGE_SIZE),
        );
      }

      let nextSnapshot;
      try {
        nextSnapshot = await getDocs(q);
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : String(error);
        const needsIndex = message.includes("index") || message.includes("requires an index");
        if (needsIndex && selectedCategory && !useIndexFallbackRef.current) {
          useIndexFallbackRef.current = true;
          q = query(
            collection(db, "smarttalk"),
            where("category", "==", selectedCategory),
            startAfter(lastQuestionSnapshot),
            limit(SMART_TALK_PAGE_SIZE),
          );
          nextSnapshot = await getDocs(q);
        } else {
          throw error;
        }
      }

      const nextQuestions = nextSnapshot.docs.map((item) =>
        normalizeSmartTalkQuestion(item.id, item.data() as Partial<Question>),
      );
      const nextLoadedPageQuestions = mergeSmartTalkQuestions(
        loadedPageQuestionsRef.current,
        nextQuestions,
      );
      const loadedQuestionIds = new Set([
        ...firstPageQuestionsRef.current.map((question) => question.id),
        ...nextLoadedPageQuestions.map((question) => question.id),
      ]);

      loadedPageQuestionsRef.current = nextLoadedPageQuestions;
      setLoadedPageQuestions(nextLoadedPageQuestions);
      setLastQuestionSnapshot(
        nextSnapshot.docs[nextSnapshot.docs.length - 1] || lastQuestionSnapshot,
      );
      setHasMoreQuestions(
        nextSnapshot.docs.length === SMART_TALK_PAGE_SIZE &&
          (totalQuestionCount === null || loadedQuestionIds.size < totalQuestionCount),
      );
    } catch (error) {
      console.error("Firestore SmartTalk pagination error:", error);
      setPaginationMessage("Could not load more questions right now.");
    } finally {
      setIsLoadingMoreQuestions(false);
    }
  };

  const [fetchedQuestion, setFetchedQuestion] = useState<Question | null>(null);
  const [isQuestionLoading, setIsQuestionLoading] = useState(false);

  useEffect(() => {
    if (!focusedQuestionId) {
      setFetchedQuestion(null);
      return;
    }

    const localQ = questions.find((q) => q.id === focusedQuestionId);
    if (localQ) {
      setFetchedQuestion(localQ);
      return;
    }

    setIsQuestionLoading(true);
    const docRef = doc(db, "smarttalk", focusedQuestionId);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setFetchedQuestion(
            normalizeSmartTalkQuestion(docSnap.id, docSnap.data() as Partial<Question>),
          );
        } else {
          setFetchedQuestion(null);
        }
        setIsQuestionLoading(false);
      },
      (error) => {
        console.error("Error fetching single question:", error);
        setIsQuestionLoading(false);
      }
    );

    return () => unsubscribe();
  }, [focusedQuestionId, questions]);

  const focusedQuestion = fetchedQuestion || questions.find((q) => q.id === focusedQuestionId) || null;

  const getLastActivity = (q: Question) => {
    if (!q.answers || q.answers.length === 0) {
      return q.createdAt;
    }
    const answerTimes = q.answers.map(a => a.createdAt);
    return Math.max(q.createdAt, ...answerTimes);
  };

  const focusedQuestionRow = useMemo(() => {
    if (!focusedQuestion) return null;
    const sortedAnswers = [...(focusedQuestion.answers || [])].sort(
      (left, right) =>
        getAnswerHelpfulScore(right) - getAnswerHelpfulScore(left) ||
        left.createdAt - right.createdAt,
    );
    const topAnswerId = sortedAnswers[0]?.id || null;
    const worstAnswerId =
      sortedAnswers.length > 1
        ? sortedAnswers[sortedAnswers.length - 1].id
        : null;

    return {
      question: focusedQuestion,
      sortedAnswers,
      topAnswerId,
      worstAnswerId,
      featuredAnswer: sortedAnswers[0] || null,
      hiddenAnswers: sortedAnswers.slice(1),
    };
  }, [focusedQuestion]);

  const submitQuestion = async (authorIdentity: KnowledgeIdentity) => {
    const questionText = newQuestion.trim();
    if (!questionText) return false;

    setModerationMessage(null);
    setIsModeratingQuestion(true);

    const moderation = await moderateContent("smarttalk-question", {
      content: questionText,
    });

    if (!moderation.allowed) {
      setModerationMessage(moderation.message);
      setIsModeratingQuestion(false);
      return false;
    }

    setIsAsking(true);
    setIsModeratingQuestion(false);

    try {
      await addDoc(collection(db, "smarttalk"), {
        author: authorIdentity.displayName,
        authorId: authorIdentity.authorId,
        content: questionText,
        ...(newQuestionCategory ? { category: newQuestionCategory } : {}),
        ...(newQuestionDifficulty ? { difficulty: newQuestionDifficulty } : {}),
        answers: [],
        savedBy: [],
        saveCount: 0,
        createdAt: serverTimestamp(),
      });
      void loadTotalQuestionCount();
      setNewQuestion("");
      setNewQuestionCategory("");
      setNewQuestionDifficulty("");
      return true;
    } catch (error) {
      console.error("Failed to post question:", error);
      return false;
    } finally {
      setIsAsking(false);
    }
  };

  const handleAsk = () => {
    if (!newQuestion.trim()) {
      setIsAskModalOpen(true);
      return;
    }

    setModerationMessage(null);

    if (currentIdentity) {
      void submitQuestion(currentIdentity).then((posted) => {
        if (posted) setIsAskModalOpen(false);
      });
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
        helpfulIds: [],
        helpfulCount: 0,
        misleadingIds: [],
        misleadingCount: 0,
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
      let bestAnswerNotification:
        | { question: Question; answer: Answer }
        | null = null;

      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(questionRef);
        if (!snapshot.exists()) return;

        const currentQuestion = normalizeSmartTalkQuestion(
          snapshot.id,
          snapshot.data() as Partial<Question>,
        );

        const previousRankedAnswers = [...(currentQuestion.answers || [])].sort(
          (left, right) =>
            getAnswerHelpfulScore(right) - getAnswerHelpfulScore(left) ||
            left.createdAt - right.createdAt,
        );
        const previousPositiveTopAnswer =
          previousRankedAnswers[0] &&
          getAnswerHelpfulScore(previousRankedAnswers[0]) > 0
            ? previousRankedAnswers[0]
            : null;
        const previousBestAnswerId =
          (currentQuestion.answers || []).find((answer) => answer.bestAnswer)?.id ||
          previousPositiveTopAnswer?.id ||
          null;
        const updatedAnswers = (currentQuestion.answers || []).map((answer) =>
          answer.id === answerId
            ? toggleSmartTalkVote(answer, voterId, voteType)
            : answer,
        );
        const rankedAnswers = [...updatedAnswers].sort(
          (left, right) =>
            getAnswerHelpfulScore(right) - getAnswerHelpfulScore(left) ||
            left.createdAt - right.createdAt,
        );
        const topAnswer =
          rankedAnswers[0] && getAnswerHelpfulScore(rankedAnswers[0]) > 0
            ? rankedAnswers[0]
            : null;
        const answersWithBest = updatedAnswers.map((answer) => ({
          ...answer,
          bestAnswer: Boolean(topAnswer && answer.id === topAnswer.id),
        }));

        if (
          voteType === "helpful" &&
          topAnswer?.id === answerId &&
          topAnswer.authorId &&
          previousBestAnswerId !== topAnswer.id
        ) {
          bestAnswerNotification = {
            question: currentQuestion,
            answer: { ...topAnswer, bestAnswer: true },
          };
        }

        transaction.update(questionRef, {
          answers: answersWithBest.map(serializeSmartTalkAnswer),
        });
      });

      const notification = bestAnswerNotification;
      if (notification) {
        void import("../utils/notifications")
          .then(({ notifyBestAnswerEarned }) =>
            notifyBestAnswerEarned(notification.question, notification.answer),
          )
          .catch((error) => {
            console.warn("Best answer notification failed; vote was saved.", error);
          });
      }
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

  const handleToggleSaveQuestion = async (question: Question) => {
    if (!currentIdentity) {
      setNamePrompt({ type: "save", question });
      return;
    }

    const metrics = getSaveMetrics(question);
    const shouldSave = !metrics.savedBy.includes(currentIdentity.authorId);

    setSavingQuestionIds((current) => ({ ...current, [question.id]: true }));
    try {
      await toggleSmartTalkSave({
        question,
        actorId: currentIdentity.authorId,
        shouldSave,
      });
    } catch (error) {
      console.error("Failed to update saved SmartTalk discussion:", error);
    } finally {
      setSavingQuestionIds((current) => ({ ...current, [question.id]: false }));
    }
  };

  const getAnswerScore = (answer: Answer) => getAnswerHelpfulScore(answer);

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
      void submitQuestion(nextIdentity).then((posted) => {
        if (posted) setIsAskModalOpen(false);
      });
      return;
    }

    if (prompt.type === "answer") {
      setNamePrompt(null);
      void submitAnswer(prompt.questionId, nextIdentity);
      return;
    }

    if (prompt.type === "save") {
      setNamePrompt(null);
      void toggleSmartTalkSave({
        question: prompt.question,
        actorId: nextIdentity.authorId,
        shouldSave: true,
      });
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

  const searchTerms = useMemo(
    () => tokenizeSearch(deferredSearchQuery),
    [deferredSearchQuery],
  );

  useEffect(() => {
    if (!focusedQuestionId) return;

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" });
    });
  }, [focusedQuestionId]);

  useEffect(() => {
    if (!isAskModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isAsking && !isModeratingQuestion) {
        setIsAskModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAskModalOpen, isAsking, isModeratingQuestion]);
  const visibleQuestions = useMemo(
    () =>
      searchTerms.length === 0
        ? questions
        : questions.filter((question) =>
            matchesSmartTalkSearch(question, searchTerms),
          ),
    [questions, searchTerms],
  );
  const trendingDiscussions = useMemo(
    () =>
      questions
        .filter((question) => question.answers.length >= 2)
        .sort(
          (left, right) =>
            right.answers.length - left.answers.length ||
            right.createdAt - left.createdAt,
        )
        .slice(0, 3),
    [questions],
  );
  const questionsNeedingAnswers = useMemo(
    () =>
      questions
        .filter((question) => question.answers.length === 0)
        .sort((left, right) => right.createdAt - left.createdAt)
        .slice(0, 3),
    [questions],
  );
  const topAnswers = useMemo(
    () =>
      questions
        .flatMap((question) =>
          question.answers.map((answer) => ({
            question,
            answer,
            score: getAnswerHelpfulScore(answer),
          })),
        )
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 3),
    [questions],
  );
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
    const trustMetrics = getTrustMetrics(answer);
    const likeCount = trustMetrics.helpfulCount;
    const dislikeCount = trustMetrics.misleadingCount;
    const score = getAnswerScore(answer);
    const userLiked = activeAuthorId
      ? trustMetrics.helpfulIds.includes(activeAuthorId)
      : false;
    const userDisliked = activeAuthorId
      ? trustMetrics.misleadingIds.includes(activeAuthorId)
      : false;

    return (
      <div
        key={answer.id}
        className={`rounded-lg p-4 transition-all duration-200 ${getAnswerBorderClass(
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
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">
                <Trophy className="h-3 w-3" /> Best Answer
              </span>
            )}

            {score !== 0 && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  score > 0
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-red-100 text-red-600"
                }`}
              >
                {score > 0 ? `+${score}` : score}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
              <ShieldCheck className="h-3 w-3" />
              {trustMetrics.communityTrustPercent}% trust
            </span>
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleVote(question, answer.id, "helpful")}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-black transition-colors ${
              userLiked
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
            }`}
          >
            <ThumbsUp
              className={`h-4 w-4 ${userLiked ? "fill-current" : ""}`}
            />
            Helpful
            {likeCount}
          </button>

          <button
            type="button"
            onClick={() => void handleVote(question, answer.id, "misleading")}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-black transition-colors ${
              userDisliked
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-slate-200 bg-white text-slate-500 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"
            }`}
          >
            <ShieldAlert
              className={`h-4 w-4 ${userDisliked ? "fill-current" : ""}`}
            />
            Misleading
            {dislikeCount}
          </button>
        </div>
      </div>
    );
  };

  const relatedFocusedQuestions = focusedQuestion
    ? questions
        .filter(
          (question) =>
            question.id !== focusedQuestion.id &&
            (!focusedQuestion.category || question.category === focusedQuestion.category),
        )
        .slice(0, 4)
    : [];
  const smartTalkPageUrl = focusedQuestion
    ? buildPublicPath("smarttalk", { focusedEntryId: focusedQuestion.id })
    : buildPublicPath("smarttalk", { selectedTopic: selectedCategory });
  const smartTalkPageTitle = focusedQuestion
    ? `${summarizeSmartTalkText(focusedQuestion.content, 90)} | SmartTalk | Readative`
    : selectedCategory
      ? `${getSmartTalkCategoryLabel(selectedCategory) || "SmartTalk"} Questions | Readative`
      : "SmartTalk - Q&A Community | Readative";
  const smartTalkPageDescription = focusedQuestion
    ? summarizeSmartTalkText(focusedQuestion.content, 160)
    : selectedCategory
      ? `Explore ${getSmartTalkCategoryLabel(selectedCategory) || selectedCategory} questions and practical community answers on Readative SmartTalk.`
      : "Ask learning-focused questions and get thoughtful community answers on Readative.";

  return (
    <div className="space-y-6 pb-20">
      <SEO
        title={smartTalkPageTitle}
        description={smartTalkPageDescription}
        url={smartTalkPageUrl}
        type={focusedQuestion ? "article" : "website"}
        robots={
          (!isLoading && questions.length === 0) ||
          (focusedQuestionId && !isQuestionLoading && !focusedQuestion)
            ? "noindex"
            : "index"
        }
        schema={buildSmartTalkSchemas(questions, focusedQuestion, selectedCategory)}
        keywords={[
          "Q&A",
          "learning questions",
          "answers",
          "community",
          "knowledge",
        ]}
      />

      {focusedQuestionId ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => navigateToRoute("smarttalk", { selectedTopic: selectedCategory })}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to questions
          </button>

          {isQuestionLoading && !focusedQuestion ? (
            <div className="space-y-4" aria-busy="true" aria-live="polite">
              <SmartTalkQuestionSkeleton />
            </div>
          ) : !focusedQuestion ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-gray-500">
              Question not found or has been deleted.
            </div>
          ) : (() => {
            const row = focusedQuestionRow;
            if (!row) return null;
            const {
              question,
              sortedAnswers,
              topAnswerId,
              worstAnswerId,
              featuredAnswer,
              hiddenAnswers,
            } = row;
            const answersExpanded = Boolean(expandedAnswers[question.id]);
            const hiddenAnswerCount = hiddenAnswers.length;
            const questionSaveMetrics = getSaveMetrics(question);
            const isQuestionSaved = activeAuthorId
              ? questionSaveMetrics.savedBy.includes(activeAuthorId)
              : false;

            return (
              <div
                id={`question-${question.id}`}
                data-publisher-content="smarttalk-question"
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_14px_38px_rgba(15,23,42,0.07)]"
              >
                <div className="mb-5 flex items-start gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-indigo-50">
                    <User className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold leading-snug text-slate-950">
                      {renderRichText({ text: question.content })}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span>
                      Asked by{" "}
                      <span className="font-semibold">{question.author}</span>
                      {" / "}
                      {new Date(question.createdAt).toLocaleDateString()}
                      </span>
                      {question.category && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-indigo-700">
                          {getSmartTalkCategoryLabel(question.category)}
                        </span>
                      )}
                      {question.difficulty && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                          {question.difficulty}
                        </span>
                      )}
                      {question.answers.length > 0 && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                          Best Discussion
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleToggleSaveQuestion(question)}
                    disabled={savingQuestionIds[question.id]}
                    className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-black transition-colors disabled:opacity-60 ${
                      isQuestionSaved
                        ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                    }`}
                    aria-label={
                      isQuestionSaved
                        ? "Remove saved SmartTalk discussion"
                        : "Save SmartTalk discussion"
                    }
                    title={isQuestionSaved ? "Saved" : "Save"}
                  >
                    <Bookmark className={`h-4 w-4 ${isQuestionSaved ? "fill-current" : ""}`} />
                    {questionSaveMetrics.saveCount > 0 && (
                      <span>{questionSaveMetrics.saveCount}</span>
                    )}
                  </button>
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
                              type="button"
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
                    rows={2}
                    placeholder="Write an answer..."
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleAnswer(question.id)}
                      disabled={
                        !answerInputs[question.id]?.trim() ||
                        isAnswering[question.id] ||
                        moderatingAnswerId === question.id
                      }
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-indigo-700 disabled:opacity-40 sm:w-auto"
                    >
                      {isAnswering[question.id] ||
                      moderatingAnswerId === question.id ? (
                        <ReadativeLoader size="xs" tone="light" />
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
          })()}
          {focusedQuestion && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">
                Keep exploring
              </p>
              <h2 className="mt-2 text-lg font-black tracking-tight text-slate-950">
                Related Questions
              </h2>
              <div className="mt-3 grid gap-2">
                {relatedFocusedQuestions.length > 0 ? (
                  relatedFocusedQuestions.map((question) => (
                    <a
                      key={question.id}
                      href={buildPublicPath("smarttalk", { focusedEntryId: question.id })}
                      onClick={(event) => {
                        event.preventDefault();
                        navigateToRoute("smarttalk", { focusedEntryId: question.id });
                      }}
                      className="rounded-lg border border-slate-100 px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:border-indigo-200 hover:text-indigo-700"
                    >
                      {summarizeSmartTalkText(question.content, 120)}
                    </a>
                  ))
                ) : (
                  <a href="/smarttalks" className="text-sm font-bold text-indigo-700">
                    Browse all SmartTalk questions
                  </a>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
                {focusedQuestion.category && (
                  <a
                    href={`/category/${encodeURIComponent(focusedQuestion.category)}`}
                    className="rounded-full bg-indigo-50 px-3 py-1.5 text-indigo-700"
                  >
                    Category: {getSmartTalkCategoryLabel(focusedQuestion.category)}
                  </a>
                )}
                {focusedQuestion.authorId && (
                  <a
                    href={`/profile/${encodeURIComponent(focusedQuestion.authorId)}`}
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700"
                  >
                    Author: {focusedQuestion.author}
                  </a>
                )}
                <a href="/posts" className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
                  Related Posts
                </a>
                {relatedFocusedQuestions[0] && (
                  <a
                    href={buildPublicPath("smarttalk", {
                      focusedEntryId: relatedFocusedQuestions[0].id,
                    })}
                    className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700"
                  >
                    Next Reading
                  </a>
                )}
              </div>
            </section>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                  <ReadativeRMark className="h-5 w-5 text-xl tracking-tight" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-xl font-black tracking-tight text-slate-950">
                    SmartTalk
                  </h2>
                  <p className="truncate text-xs font-semibold text-slate-500">
                    {totalQuestionCount ?? questions.length} Questions
                    {currentIdentity ? ` / @${currentIdentity.displayName}` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAsk}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white transition-colors hover:bg-indigo-700"
              >
                <HelpCircle className="h-4 w-4" />
                Ask question
              </button>
            </div>
          </div>

          <SmartTalkKnowledgeBrief />

          <DiscoverySearch
            theme="indigo"
            placeholder="Search"
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={() => setSearchQuery("")}
            ariaLabel="Search SmartTalk"
          />

          {!isLoading &&
            (trendingDiscussions.length >= 2 ||
              questionsNeedingAnswers.length >= 2 ||
              topAnswers.length >= 2) && (
              <div className="grid gap-3 sm:grid-cols-3">
                {trendingDiscussions.length >= 2 && (
                  <SmartTalkDiscoveryBlock
                    icon={<Flame className="h-4 w-4" />}
                    title="Trending Discussions"
                    items={trendingDiscussions.map((question) => ({
                      id: question.id,
                      text: question.content,
                      meta: `${question.answers.length} answers`,
                    }))}
                  />
                )}
                {questionsNeedingAnswers.length >= 2 && (
                  <SmartTalkDiscoveryBlock
                    icon={<HelpCircle className="h-4 w-4" />}
                    title="Needs Answers"
                    items={questionsNeedingAnswers.map((question) => ({
                      id: question.id,
                      text: question.content,
                      meta: "No answers yet",
                    }))}
                  />
                )}
                {topAnswers.length >= 2 && (
                  <SmartTalkDiscoveryBlock
                    icon={<Trophy className="h-4 w-4" />}
                    title="Top Answers"
                    items={topAnswers.map(({ answer, score }) => ({
                      id: answer.id,
                      text: answer.content,
                      meta: `+${score} helpful`,
                    }))}
                  />
                )}
              </div>
            )}

          {selectedCategory && (
            <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Category Filter</span>
                <h3 className="text-sm font-bold text-slate-900 leading-none mt-0.5 capitalize">
                  {getSmartTalkCategoryLabel(selectedCategory)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => navigateToRoute("smarttalk")}
                className="text-xs font-bold text-indigo-600 hover:underline uppercase tracking-[0.1em]"
              >
                Clear filter
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-4" aria-busy="true" aria-live="polite">
              {Array.from({ length: 3 }).map((_, index) => (
                <SmartTalkQuestionSkeleton key={index} />
              ))}
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              No questions yet. Be the first to ask!
            </div>
          ) : visibleQuestions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-indigo-200 bg-white px-6 py-16 text-center shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-500">
                No Search Matches
              </p>
              <h3 className="mt-3 text-xl font-black text-slate-900">
                No SmartTalk questions matched "{searchQuery.trim()}"
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Try a broader phrase or search by the author with @username.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleQuestions.map((question) => {
                const lastActivityTime = getLastActivity(question);
                const formattedLastActivity = new Date(lastActivityTime).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });

                return (
                  <a
                    key={question.id}
                    href={buildPublicPath("smarttalk", {
                      selectedTopic: selectedCategory,
                      focusedEntryId: question.id,
                    })}
                    onClick={(event) => {
                      event.preventDefault();
                      navigateToRoute("smarttalk", {
                        selectedTopic: selectedCategory,
                        focusedEntryId: question.id,
                      });
                    }}
                    className="group block rounded-xl border border-slate-200 bg-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.03)] transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-[0_12px_24px_rgba(99,102,241,0.08)]"
                  >
                    <h3 className="text-base font-bold leading-snug text-slate-950 group-hover:text-indigo-700 transition-colors">
                      {question.content}
                    </h3>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>Asked by <span className="font-semibold text-slate-700">{question.author}</span></span>
                        <span>•</span>
                        <span className="font-medium text-slate-500">{question.answers.length} {question.answers.length === 1 ? "answer" : "answers"}</span>
                        <span>•</span>
                        <span>Active {formattedLastActivity}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {question.category && (
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-indigo-700">
                            {getSmartTalkCategoryLabel(question.category)}
                          </span>
                        )}
                        {question.difficulty && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">
                            {question.difficulty}
                          </span>
                        )}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}

          {!isLoading && hasMoreQuestions && (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => void loadMoreQuestions()}
                disabled={isLoadingMoreQuestions}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-5 py-2.5 text-sm font-black text-indigo-700 shadow-sm transition-colors hover:bg-indigo-50 disabled:opacity-60"
              >
                {isLoadingMoreQuestions ? (
                  <ReadativeLoader size="xs" tone="indigo" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {isLoadingMoreQuestions ? "Loading..." : "Load More"}
              </button>
              {paginationMessage && (
                <p className="text-xs font-semibold text-amber-600">
                  {paginationMessage}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {isAskModalOpen && (
        <div
          className="fixed inset-0 z-[55] flex items-end justify-center bg-slate-950/35 p-3 backdrop-blur-[1px] sm:items-center"
          onClick={() => {
            if (isAsking || isModeratingQuestion) return;
            setIsAskModalOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="smarttalk-ask-title"
            className="readative-dialog-surface w-full max-w-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-600">
                  SmartTalk
                </p>
                <h3 id="smarttalk-ask-title" className="text-lg font-black tracking-tight text-slate-950">
                  Ask a question
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAskModalOpen(false)}
                disabled={isAsking || isModeratingQuestion}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                aria-label="Close ask question"
              >
                <ChevronDown className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 px-4 py-4">
              {moderationMessage && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  {moderationMessage}
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                    Category
                  </label>
                  <select
                    value={newQuestionCategory}
                    onChange={(event) => setNewQuestionCategory(event.target.value)}
                    className="mt-1 w-full bg-transparent text-sm font-bold text-slate-700 outline-none"
                    aria-label="SmartTalk category"
                  >
                    <option value="">Optional</option>
                    {KNOWLEDGE_CATEGORY_SUGGESTIONS.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                    Difficulty
                  </label>
                  <select
                    value={newQuestionDifficulty}
                    onChange={(event) =>
                      setNewQuestionDifficulty(
                        event.target.value as SmartTalkDifficulty | "",
                      )
                    }
                    className="mt-1 w-full bg-transparent text-sm font-bold text-slate-700 outline-none"
                    aria-label="SmartTalk difficulty"
                  >
                    <option value="">Optional</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
              {suggestedQuestionCategory &&
                newQuestionCategory !== suggestedQuestionCategory.id && (
                  <button
                    type="button"
                    onClick={() =>
                      setNewQuestionCategory(suggestedQuestionCategory.id)
                    }
                    className="inline-flex w-fit rounded-full bg-indigo-50 px-3 py-1.5 text-[11px] font-black text-indigo-700 transition-colors hover:bg-indigo-100"
                  >
                    Use suggested {suggestedQuestionCategory.label}
                  </button>
                )}
              <textarea
                value={newQuestion}
                onChange={(event) => {
                  setNewQuestion(event.target.value);
                  if (moderationMessage) setModerationMessage(null);
                }}
                enterKeyHint="send"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleAsk();
                  }
                }}
                rows={5}
                autoFocus
                placeholder="Ask something useful..."
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAsk}
                  disabled={
                    isAsking || isModeratingQuestion || !newQuestion.trim()
                  }
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 sm:w-auto"
                >
                  {isAsking || isModeratingQuestion ? (
                    <ReadativeLoader size="xs" tone="light" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {isAsking || isModeratingQuestion ? "Posting..." : "Post question"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {namePrompt && (
        <GoogleSignInPrompt
          title={
            namePrompt.type === "ask"
              ? "Sign in to ask"
              : namePrompt.type === "answer"
                ? "Sign in to answer"
                : namePrompt.type === "save"
                  ? "Sign in to save"
                  : "Sign in to add trust feedback"
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

function SmartTalkDiscoveryBlock({
  icon,
  title,
  items,
}: {
  icon: ReactNode;
  title: string;
  items: Array<{ id: string; text: string; meta: string }>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
        <span className="text-indigo-600">{icon}</span>
        {title}
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="border-t border-slate-100 pt-2 first:border-t-0 first:pt-0">
            <p className="line-clamp-2 text-xs font-bold leading-5 text-slate-800">
              {item.text}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
              {item.meta}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SmartTalkKnowledgeBrief() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-600">
        Discussion Knowledge
      </p>
      <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">
        Questions, answers, and topic discussions
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
        SmartTalk organizes practical questions and community answers around Readative's permanent knowledge pillars.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {SEO_CATEGORIES.map((category) => (
          <a
            key={category.id}
            href={category.path}
            onClick={(event) => {
              event.preventDefault();
              navigateToRoute("smarttalk", { selectedTopic: category.id });
            }}
            className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700"
          >
            {category.label}
          </a>
        ))}
      </div>
    </section>
  );
}
