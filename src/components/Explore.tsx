import {
  type MouseEvent,
  type ReactNode,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowLeft,
  Award,
  BookOpenText,
  CalendarDays,
  ChevronRight,
  Clock3,
  Compass,
  Flame,
  Hash,
  Layers3,
  MessageSquareMore,
  Search,
  Sparkles,
  ThumbsUp,
  TrendingUp,
  UserRound,
} from "lucide-react";
import {
  collection,
  type DocumentData,
  getDocs,
  limit,
  orderBy,
  query,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import {
  type KnowledgeComment,
  type KnowledgeEntry,
  type Question,
  type SmartAnswer,
  type UserProfile,
} from "../types";
import { SEO } from "./SEO";
import { DiscoverySearch } from "./DiscoverySearch";
import { ProfileAvatar } from "./ProfileAvatar";
import { hydrateUserProfile } from "../utils/profileData";
import {
  getAnswerHelpfulScore,
  getContributorLevel,
  getTrustMetrics,
  normalizeTrustCount,
  normalizeTrustIdArray,
} from "../utils/trustSystem";
import { getSaveMetrics } from "../utils/bookmarks";
import { formatReadingMinutes } from "../utils/contentIntelligence";
import {
  canViewKnowledgeEntry,
  normalizeKnowledgeVisibility,
} from "../utils/knowledgePrivacy";
import { type KnowledgeIdentity } from "../utils/knowledgeIdentity";
import {
  buildAbsoluteRouteUrl,
  buildPublicPath,
  navigateToRoute,
} from "../utils/routes";
import {
  buildBreadcrumbSchema,
  buildCollectionPageSchema,
  buildDiscussionForumPostingSchema,
  buildItemListSchema,
  buildOrganizationSchema,
  buildWebSiteSchema,
} from "../utils/seoSchemas";
import {
  SEO_TOPICS,
  getCategoryBySlug,
  getRelatedTopicsForCategory,
  getTopicBySlug,
  normalizeSeoSlug,
  type SeoCategoryDefinition,
  type SeoTopicDefinition,
} from "../utils/seoTaxonomy";
import { tokenizeSearch } from "../utils/searchHelpers";

const EXPLORE_POST_LIMIT = 80;
const EXPLORE_SMARTTALK_LIMIT = 50;
const EXPLORE_PROFILE_LIMIT = 80;
const DAY_MS = 24 * 60 * 60 * 1000;

const EXPLORE_TOPICS = SEO_TOPICS;

type ExploreTopic = SeoTopicDefinition;
type ExploreQuestion = Question;

interface TopicStats {
  id: string;
  label: string;
  collectionTitle: string;
  keywords: readonly string[];
  postCount: number;
  discussionCount: number;
  answerCount: number;
  helpfulTotal: number;
  score: number;
  latestActivity: number;
}

interface ContributorDiscovery {
  authorId: string;
  displayName: string;
  username: string;
  posts: number;
  helpful: number;
  misleading: number;
  answers: number;
  bestAnswers: number;
  trustScore: number;
  level: ReturnType<typeof getContributorLevel>;
  profile?: UserProfile;
}

interface ExploreProps {
  currentIdentity: KnowledgeIdentity | null;
  selectedTopic: string | null;
  onOpenProfile: (authorId: string) => void;
  onOpenEntry: (entryId: string) => void;
  onOpenTopic: (topicId: string | null) => void;
  onOpenSmartTalk: (questionId?: string, selectedCategory?: string | null) => void;
}

function normalizeTimestamp(value: unknown, fallback = Date.now()) {
  if (
    value &&
    typeof value === "object" &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return [...new Set(value)]
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/^#/, "").trim().toLowerCase())
    .filter(Boolean);
}

function normalizeTopicSlug(value: string | null | undefined) {
  const normalized = normalizeSeoSlug(value);
  return normalized && normalized !== "all" ? normalized : null;
}

function titleCaseTopic(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getTopicDefinition(topicId: string | null): ExploreTopic | null {
  const normalized = normalizeTopicSlug(topicId);
  if (!normalized) return null;

  const knownTopic = getTopicBySlug(normalized);
  if (knownTopic) return knownTopic;

  const category = getCategoryBySlug(normalized);
  if (category) {
    return {
      id: category.id,
      label: category.label,
      categoryId: category.id,
      path: `/topic/${category.id}`,
      collectionTitle: `${category.label} Essentials`,
      description: category.description,
      keywords: category.keywords,
      tagSlugs: category.tagSlugs,
      aliases: category.aliases,
    };
  }

  const label = titleCaseTopic(normalized);
  const phrase = normalized.replace(/-/g, " ");

  return {
    id: normalized,
    label,
    categoryId: "technology",
    path: `/topic/${normalized}`,
    collectionTitle: `${label} Essentials`,
    description: `Readative posts, discussions, contributors, and resources about ${label}.`,
    keywords: [normalized, phrase],
    tagSlugs: [],
    aliases: [],
  };
}

function summarizeSchemaText(value: string, maxLength = 160) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;

  return `${normalized.slice(0, maxLength - 3).trim()}...`;
}

function buildExploreSchemas({
  activeTopic,
  category,
  pageUrl,
  pageDescription,
  topPosts,
  activeDiscussions,
}: {
  activeTopic: ExploreTopic | null;
  category: SeoCategoryDefinition | null;
  pageUrl: string;
  pageDescription: string;
  topPosts: KnowledgeEntry[];
  activeDiscussions: ExploreQuestion[];
}) {
  const collectionName = activeTopic
    ? `${activeTopic.label} Topic`
    : "Readative Explore";
  const itemList = buildItemListSchema({
    name: `${collectionName} Highlights`,
    url: pageUrl,
    items: [
      ...topPosts.slice(0, 5).map((entry) => ({
        name: entry.title,
        url: buildAbsoluteRouteUrl("knowledge", { focusedEntryId: entry.id }),
        description: entry.excerpt || summarizeSchemaText(entry.content),
      })),
      ...activeDiscussions.slice(0, 5).map((question) => ({
        name: summarizeSchemaText(question.content, 90),
        url: "/smarttalk",
        description: `${question.answers.length} SmartTalk answer${
          question.answers.length === 1 ? "" : "s"
        }`,
      })),
    ],
  });
  const schemas = [
    buildOrganizationSchema(),
    buildWebSiteSchema(),
    buildCollectionPageSchema({
      name: collectionName,
      url: pageUrl,
      description: pageDescription,
      about: activeTopic
        ? [activeTopic.label, category?.label || "", ...activeTopic.keywords].filter(
            (value): value is string => Boolean(value),
          )
        : "Technology topics, SmartTalk discussions, helpful posts, and contributors",
      itemList,
    }),
    buildBreadcrumbSchema([
      { name: "Home", url: "/" },
      { name: "Explore", url: "/explore" },
      ...(activeTopic ? [{ name: activeTopic.label, url: activeTopic.path }] : []),
    ]),
  ];

  return [
    ...schemas,
    ...activeDiscussions.slice(0, 5).map((question) =>
      buildDiscussionForumPostingSchema({
        headline: summarizeSchemaText(question.content, 90),
        text: question.content,
        url: "/smarttalk",
        authorName: question.author,
        datePublished: new Date(question.createdAt).toISOString(),
        answerCount: question.answers.length,
        keywords: activeTopic ? [activeTopic.label, ...activeTopic.keywords] : [],
      }),
    ),
  ];
}

function hydrateExploreComments(value: unknown): KnowledgeComment[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((comment) => comment && typeof comment === "object")
    .map((comment) => {
      const safeComment = comment as Partial<KnowledgeComment>;

      return {
        id:
          typeof safeComment.id === "string" && safeComment.id
            ? safeComment.id
            : Math.random().toString(36).slice(2, 11),
        author:
          typeof safeComment.author === "string" && safeComment.author
            ? safeComment.author
            : "Unknown",
        ...(typeof safeComment.authorId === "string" && safeComment.authorId
          ? { authorId: safeComment.authorId }
          : {}),
        text: typeof safeComment.text === "string" ? safeComment.text : "",
        mentions: Array.isArray(safeComment.mentions)
          ? safeComment.mentions
          : [],
        createdAt: normalizeTimestamp(safeComment.createdAt),
      };
    });
}

function hydrateExploreEntry(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): KnowledgeEntry {
  const data = snapshot.data() as Partial<KnowledgeEntry>;
  const helpfulIds = [
    ...new Set([
      ...normalizeTrustIdArray(data.likes),
      ...normalizeTrustIdArray(data.helpfulIds),
    ]),
  ];
  const saveMetrics = getSaveMetrics(data);
  const misleadingIds = [
    ...new Set([
      ...normalizeTrustIdArray(data.dislikes),
      ...normalizeTrustIdArray(data.misleadingIds),
    ]),
  ];

  return {
    id: snapshot.id,
    author: typeof data.author === "string" ? data.author : "Unknown",
    authorId: typeof data.authorId === "string" ? data.authorId : "",
    authorEmail: typeof data.authorEmail === "string" ? data.authorEmail : "",
    title: typeof data.title === "string" ? data.title : "Untitled insight",
    content: typeof data.content === "string" ? data.content : "",
    visibility: normalizeKnowledgeVisibility(data.visibility),
    hashtags: normalizeStringArray(data.hashtags),
    likes: helpfulIds,
    likeCount: Math.max(
      helpfulIds.length,
      normalizeTrustCount(data.likeCount),
      normalizeTrustCount(data.helpfulCount),
    ),
    helpfulIds,
    helpfulCount: Math.max(
      helpfulIds.length,
      normalizeTrustCount(data.likeCount),
      normalizeTrustCount(data.helpfulCount),
    ),
    dislikes: misleadingIds,
    dislikeCount: Math.max(
      misleadingIds.length,
      normalizeTrustCount(data.dislikeCount),
      normalizeTrustCount(data.misleadingCount),
    ),
    misleadingIds,
    misleadingCount: Math.max(
      misleadingIds.length,
      normalizeTrustCount(data.dislikeCount),
      normalizeTrustCount(data.misleadingCount),
    ),
    comments: hydrateExploreComments(data.comments),
    mentions: Array.isArray(data.mentions) ? data.mentions : [],
    createdAt: normalizeTimestamp(data.createdAt),
    updatedAt:
      data.updatedAt === null || data.updatedAt === undefined
        ? null
        : normalizeTimestamp(data.updatedAt),
    images: Array.isArray(data.images) ? data.images : [],
    imageLayout: data.imageLayout || null,
    imageDataUrl: typeof data.imageDataUrl === "string" ? data.imageDataUrl : null,
    imageMimeType:
      typeof data.imageMimeType === "string" ? data.imageMimeType : null,
    imageWidth: typeof data.imageWidth === "number" ? data.imageWidth : null,
    imageHeight: typeof data.imageHeight === "number" ? data.imageHeight : null,
    imageOptimizedAt:
      typeof data.imageOptimizedAt === "number" ? data.imageOptimizedAt : null,
    excerpt: typeof data.excerpt === "string" ? data.excerpt : null,
    readingMinutes:
      typeof data.readingMinutes === "number" ? data.readingMinutes : null,
    qualityScore: typeof data.qualityScore === "number" ? data.qualityScore : null,
    contentKind: typeof data.contentKind === "string" ? data.contentKind : null,
    category: typeof data.category === "string" ? data.category : null,
    savedBy: saveMetrics.savedBy,
    saveCount: saveMetrics.saveCount,
  };
}

function hydrateExploreAnswer(answer: unknown): SmartAnswer {
  const safeAnswer =
    answer && typeof answer === "object"
      ? (answer as Partial<SmartAnswer>)
      : {};
  const helpfulIds = [
    ...new Set([
      ...normalizeTrustIdArray(safeAnswer.likes),
      ...normalizeTrustIdArray(safeAnswer.helpfulIds),
    ]),
  ];
  const misleadingIds = [
    ...new Set([
      ...normalizeTrustIdArray(safeAnswer.dislikes),
      ...normalizeTrustIdArray(safeAnswer.misleadingIds),
    ]),
  ];

  return {
    id:
      typeof safeAnswer.id === "string" && safeAnswer.id
        ? safeAnswer.id
        : Math.random().toString(36).slice(2, 11),
    author:
      typeof safeAnswer.author === "string" && safeAnswer.author
        ? safeAnswer.author
        : "Unknown",
    authorId: typeof safeAnswer.authorId === "string" ? safeAnswer.authorId : "",
    content: typeof safeAnswer.content === "string" ? safeAnswer.content : "",
    likes: helpfulIds,
    dislikes: misleadingIds,
    helpfulIds,
    helpfulCount: Math.max(
      helpfulIds.length,
      normalizeTrustCount(safeAnswer.helpfulCount),
      normalizeTrustCount((safeAnswer as { likeCount?: unknown }).likeCount),
    ),
    misleadingIds,
    misleadingCount: Math.max(
      misleadingIds.length,
      normalizeTrustCount(safeAnswer.misleadingCount),
      normalizeTrustCount((safeAnswer as { dislikeCount?: unknown }).dislikeCount),
    ),
    bestAnswer: safeAnswer.bestAnswer === true,
    createdAt: normalizeTimestamp(safeAnswer.createdAt),
  };
}

function hydrateExploreQuestion(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): ExploreQuestion {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    author:
      typeof data.author === "string" && data.author ? data.author : "Unknown",
    authorId: typeof data.authorId === "string" ? data.authorId : "",
    content: typeof data.content === "string" ? data.content : "",
    answers: Array.isArray(data.answers)
      ? data.answers.map((answer) => hydrateExploreAnswer(answer))
      : [],
    createdAt: normalizeTimestamp(data.createdAt),
  };
}

function getEntryTopicText(entry: Pick<KnowledgeEntry, "title" | "content" | "hashtags" | "author">) {
  return [entry.title, entry.content, entry.hashtags.join(" "), entry.author]
    .join(" ")
    .toLowerCase();
}

function getQuestionTopicText(question: ExploreQuestion) {
  return [
    question.content,
    question.author,
    ...question.answers.map((answer) => answer.content),
    ...question.answers.map((answer) => answer.author),
  ]
    .join(" ")
    .toLowerCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesTopicKeyword(text: string, keyword: string) {
  const normalizedKeyword = keyword.toLowerCase().trim();
  if (!normalizedKeyword) return false;

  if (/^[a-z0-9+#]{1,3}$/.test(normalizedKeyword)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedKeyword)}([^a-z0-9]|$)`).test(
      text,
    );
  }

  return text.includes(normalizedKeyword);
}

function getExploreTopicMatchValues(topic: ExploreTopic) {
  return [
    topic.id,
    topic.label,
    ...topic.aliases,
    ...topic.keywords,
    ...topic.tagSlugs,
  ].map((value) => value.toLowerCase());
}

function matchesTopicText(text: string, topic: ExploreTopic) {
  const normalizedText = text.toLowerCase();
  return getExploreTopicMatchValues(topic).some((keyword) =>
    includesTopicKeyword(normalizedText, keyword),
  );
}

function matchesTopicEntry(entry: KnowledgeEntry, topic: ExploreTopic) {
  const hashtagMatch = entry.hashtags.some(
    (tag) => {
      const normalizedTag = normalizeTopicSlug(tag);
      if (!normalizedTag) return false;

      return (
        normalizedTag === topic.id ||
        getExploreTopicMatchValues(topic).some(
          (keyword) => normalizeTopicSlug(keyword) === normalizedTag,
        )
      );
    },
  );
  const categoryMatch =
    topic.id === topic.categoryId &&
    getCategoryBySlug(entry.category)?.id === topic.categoryId;

  return categoryMatch || hashtagMatch || matchesTopicText(getEntryTopicText(entry), topic);
}

function matchesTopicQuestion(question: ExploreQuestion, topic: ExploreTopic) {
  return matchesTopicText(getQuestionTopicText(question), topic);
}

function getRecencyBoost(timestamp: number, now: number) {
  const ageDays = Math.max(0, (now - timestamp) / DAY_MS);
  if (ageDays <= 1) return 16;
  if (ageDays <= 7) return 10;
  if (ageDays <= 31) return 5;
  return 0;
}

function getEntryScore(entry: KnowledgeEntry, now = Date.now()) {
  const metrics = getTrustMetrics(entry);
  const qualityScore =
    typeof entry.qualityScore === "number" && Number.isFinite(entry.qualityScore)
      ? entry.qualityScore
      : 0;

  return (
    metrics.helpfulCount * 5 +
    metrics.communityTrustPercent * 0.8 +
    entry.comments.length * 2 +
    qualityScore * 0.35 +
    getRecencyBoost(entry.updatedAt || entry.createdAt, now) -
    metrics.misleadingCount * 3
  );
}

function getDiscussionActivity(question: ExploreQuestion, now = Date.now()) {
  const latestAnswerAt = question.answers.reduce(
    (latest, answer) => Math.max(latest, answer.createdAt),
    question.createdAt,
  );
  const bestAnswerBonus = question.answers.some((answer) => answer.bestAnswer)
    ? 16
    : 0;
  const unansweredBonus = question.answers.length === 0 ? 18 : 0;
  const helpfulScore = question.answers.reduce(
    (total, answer) => total + Math.max(0, getAnswerHelpfulScore(answer)),
    0,
  );

  return {
    latestActivity: latestAnswerAt,
    score:
      question.answers.length * 6 +
      helpfulScore * 4 +
      bestAnswerBonus +
      unansweredBonus +
      getRecencyBoost(latestAnswerAt, now),
  };
}

function formatCompactDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

function matchesTerms(text: string, terms: string[]) {
  const normalizedText = text.toLowerCase();

  return terms.every((term) => {
    const normalized = term.replace(/^[@#]/, "");
    return Boolean(normalized) && normalizedText.includes(normalized);
  });
}

function buildContributorRankings({
  entries,
  questions,
  profiles,
  profileById,
  includeDirectoryProfiles,
}: {
  entries: KnowledgeEntry[];
  questions: ExploreQuestion[];
  profiles: UserProfile[];
  profileById: Map<string, UserProfile>;
  includeDirectoryProfiles: boolean;
}): ContributorDiscovery[] {
  const contributorStats = new Map<
    string,
    Omit<ContributorDiscovery, "trustScore" | "level" | "profile">
  >();

  entries.forEach((entry) => {
    if (!entry.authorId) return;

    const profile = profileById.get(entry.authorId);
    const metrics = getTrustMetrics(entry);
    const current = contributorStats.get(entry.authorId) || {
      authorId: entry.authorId,
      displayName: profile?.displayName || entry.author,
      username: profile?.username || entry.author,
      posts: 0,
      helpful: normalizeTrustCount(profile?.helpfulCount),
      misleading: normalizeTrustCount(profile?.misleadingCount),
      answers: 0,
      bestAnswers: normalizeTrustCount(profile?.bestAnswerCount),
    };

    contributorStats.set(entry.authorId, {
      ...current,
      posts: current.posts + 1,
      helpful: current.helpful + metrics.helpfulCount,
      misleading: current.misleading + metrics.misleadingCount,
    });
  });

  questions.forEach((question) => {
    question.answers.forEach((answer) => {
      if (!answer.authorId) return;

      const profile = profileById.get(answer.authorId);
      const current = contributorStats.get(answer.authorId) || {
        authorId: answer.authorId,
        displayName: profile?.displayName || answer.author,
        username: profile?.username || answer.author,
        posts: 0,
        helpful: normalizeTrustCount(profile?.helpfulCount),
        misleading: normalizeTrustCount(profile?.misleadingCount),
        answers: 0,
        bestAnswers: normalizeTrustCount(profile?.bestAnswerCount),
      };

      contributorStats.set(answer.authorId, {
        ...current,
        answers: current.answers + 1,
        bestAnswers: current.bestAnswers + (answer.bestAnswer ? 1 : 0),
        helpful: current.helpful + getTrustMetrics(answer).helpfulCount,
      });
    });
  });

  if (includeDirectoryProfiles) {
    profiles.forEach((profile) => {
      if (contributorStats.has(profile.id)) return;

      contributorStats.set(profile.id, {
        authorId: profile.id,
        displayName: profile.displayName || profile.username,
        username: profile.username,
        posts: 0,
        helpful: normalizeTrustCount(profile.helpfulCount),
        misleading: normalizeTrustCount(profile.misleadingCount),
        answers: 0,
        bestAnswers: normalizeTrustCount(profile.bestAnswerCount),
      });
    });
  }

  return [...contributorStats.values()]
    .map((contributor) => {
      const profile = profileById.get(contributor.authorId);
      const trustScore = Math.max(
        normalizeTrustCount(profile?.reputationScore),
        contributor.posts * 5 +
          contributor.helpful * 6 +
          contributor.answers * 4 +
          contributor.bestAnswers * 12 -
          contributor.misleading * 8,
      );

      return {
        ...contributor,
        trustScore,
        level: getContributorLevel(trustScore),
        profile,
      };
    })
    .filter(
      (contributor) =>
        contributor.trustScore > 0 ||
        contributor.posts > 0 ||
        contributor.answers > 0,
    )
    .sort(
      (left, right) =>
        right.trustScore - left.trustScore ||
        right.helpful - left.helpful ||
        left.displayName.localeCompare(right.displayName),
    );
}

export function Explore({
  currentIdentity,
  selectedTopic,
  onOpenProfile,
  onOpenEntry,
  onOpenTopic,
  onOpenSmartTalk,
}: ExploreProps) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [questions, setQuestions] = useState<ExploreQuestion[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    let cancelled = false;

    const loadExploreData = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [knowledgeSnapshot, smartTalkSnapshot, profileSnapshot] =
          await Promise.all([
            getDocs(
              query(
                collection(db, "knowledge"),
                orderBy("createdAt", "desc"),
                limit(EXPLORE_POST_LIMIT),
              ),
            ),
            getDocs(
              query(
                collection(db, "smarttalk"),
                orderBy("createdAt", "desc"),
                limit(EXPLORE_SMARTTALK_LIMIT),
              ),
            ),
            getDocs(
              query(collection(db, "userProfiles"), limit(EXPLORE_PROFILE_LIMIT)),
            ),
          ]);

        if (cancelled) return;

        setEntries(
          knowledgeSnapshot.docs
            .map((snapshot) => hydrateExploreEntry(snapshot))
            .filter((entry) =>
              canViewKnowledgeEntry(entry, currentIdentity?.authorId),
            ),
        );
        setQuestions(
          smartTalkSnapshot.docs.map((snapshot) =>
            hydrateExploreQuestion(snapshot),
          ),
        );
        setProfiles(
          profileSnapshot.docs.map((snapshot) =>
            hydrateUserProfile(snapshot.data() as Partial<UserProfile>, snapshot.id),
          ),
        );
      } catch (error) {
        console.error("Explore data load failed:", error);
        if (!cancelled) {
          setLoadError("Explore is temporarily unavailable. Please refresh in a moment.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadExploreData();

    return () => {
      cancelled = true;
    };
  }, [currentIdentity?.authorId]);

  useEffect(() => {
    setSearchQuery("");
  }, [selectedTopic]);

  const activeTopic = useMemo(
    () => getTopicDefinition(selectedTopic),
    [selectedTopic],
  );
  const activeTopicCategory = useMemo(
    () => (activeTopic ? getCategoryBySlug(activeTopic.categoryId) : null),
    [activeTopic],
  );
  const relatedTopics = useMemo(
    () =>
      activeTopicCategory && activeTopic
        ? getRelatedTopicsForCategory(activeTopicCategory.id)
            .filter((topic) => topic.id !== activeTopic.id)
            .slice(0, 5)
        : [],
    [activeTopic, activeTopicCategory],
  );
  const now = useMemo(() => Date.now(), [entries, questions]);
  const searchTerms = useMemo(
    () => tokenizeSearch(deferredSearchQuery, 8),
    [deferredSearchQuery],
  );
  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  const topicStats = useMemo<TopicStats[]>(() => {
    const topics = activeTopic
      ? [activeTopic, ...EXPLORE_TOPICS.filter((topic) => topic.id !== activeTopic.id)]
      : [...EXPLORE_TOPICS];

    return topics
      .map((topic) => {
        const topicPosts = entries.filter((entry) => matchesTopicEntry(entry, topic));
        const topicQuestions = questions.filter((question) =>
          matchesTopicQuestion(question, topic),
        );
        const helpfulTotal = topicPosts.reduce(
          (total, entry) => total + getTrustMetrics(entry).helpfulCount,
          0,
        );
        const misleadingTotal = topicPosts.reduce(
          (total, entry) => total + getTrustMetrics(entry).misleadingCount,
          0,
        );
        const answerCount = topicQuestions.reduce(
          (total, question) => total + question.answers.length,
          0,
        );
        const answerHelpful = topicQuestions.reduce(
          (total, question) =>
            total +
            question.answers.reduce(
              (answerTotal, answer) =>
                answerTotal + Math.max(0, getAnswerHelpfulScore(answer)),
              0,
            ),
          0,
        );
        const latestPostAt = topicPosts.reduce(
          (latest, entry) => Math.max(latest, entry.updatedAt || entry.createdAt),
          0,
        );
        const latestQuestionAt = topicQuestions.reduce(
          (latest, question) =>
            Math.max(latest, getDiscussionActivity(question, now).latestActivity),
          0,
        );
        const latestActivity = Math.max(latestPostAt, latestQuestionAt);

        return {
          ...topic,
          postCount: topicPosts.length,
          discussionCount: topicQuestions.length,
          answerCount,
          helpfulTotal,
          latestActivity,
          score:
            topicPosts.length * 5 +
            topicQuestions.length * 7 +
            answerCount * 3 +
            helpfulTotal * 5 +
            answerHelpful * 4 +
            getRecencyBoost(latestActivity, now) -
            misleadingTotal * 4,
        };
      })
      .filter((topic) => topic.score > 0 || topic.id === activeTopic?.id)
      .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label));
  }, [activeTopic, entries, now, questions]);

  const scopedEntries = useMemo(
    () =>
      activeTopic
        ? entries.filter((entry) => matchesTopicEntry(entry, activeTopic))
        : entries,
    [activeTopic, entries],
  );
  const scopedQuestions = useMemo(
    () =>
      activeTopic
        ? questions.filter((question) => matchesTopicQuestion(question, activeTopic))
        : questions,
    [activeTopic, questions],
  );

  const allContributors = useMemo(
    () =>
      buildContributorRankings({
        entries,
        questions,
        profiles,
        profileById,
        includeDirectoryProfiles: true,
      }),
    [entries, profileById, profiles, questions],
  );

  const topContributors = useMemo(
    () =>
      buildContributorRankings({
        entries: scopedEntries,
        questions: scopedQuestions,
        profiles,
        profileById,
        includeDirectoryProfiles: !activeTopic,
      }).slice(0, 5),
    [activeTopic, profileById, profiles, scopedEntries, scopedQuestions],
  );

  const trendingTopics = useMemo(
    () => topicStats.filter((topic) => topic.score > 0).slice(0, 6),
    [topicStats],
  );

  const activeDiscussions = useMemo(
    () =>
      [...scopedQuestions]
        .sort((left, right) => {
          const leftActivity = getDiscussionActivity(left, now);
          const rightActivity = getDiscussionActivity(right, now);

          return (
            rightActivity.score - leftActivity.score ||
            rightActivity.latestActivity - leftActivity.latestActivity
          );
        })
        .slice(0, 5),
    [now, scopedQuestions],
  );

  const topPosts = useMemo(
    () =>
      [...scopedEntries]
        .sort((left, right) => getEntryScore(right, now) - getEntryScore(left, now))
        .slice(0, 5),
    [now, scopedEntries],
  );

  const latestPosts = useMemo(
    () =>
      [...scopedEntries]
        .sort((left, right) => right.createdAt - left.createdAt)
        .slice(0, 5),
    [scopedEntries],
  );

  const learningCollections = useMemo(
    () =>
      (activeTopic ? [activeTopic] : EXPLORE_TOPICS)
        .map((topic) => {
          const topicEntries = entries
            .filter((entry) => matchesTopicEntry(entry, topic))
            .sort((left, right) => getEntryScore(right, now) - getEntryScore(left, now));
          const topicQuestions = questions
            .filter((question) => matchesTopicQuestion(question, topic))
            .sort(
              (left, right) =>
                getDiscussionActivity(right, now).score -
                getDiscussionActivity(left, now).score,
            );

          return {
            ...topic,
            entries: topicEntries.slice(0, 3),
            questions: topicQuestions.slice(0, 2),
            total: topicEntries.length + topicQuestions.length,
          };
        })
        .filter((collection) => collection.total > 0)
        .sort((left, right) => right.total - left.total)
        .slice(0, activeTopic ? 1 : 4),
    [activeTopic, entries, now, questions],
  );

  const dailyPulse = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfToday = today.getTime();
    return {
      newInsights: entries.filter((entry) => entry.createdAt >= startOfToday).length,
      activeDiscussions: activeDiscussions.length,
      trendingTopics: trendingTopics.length,
      topTopic: trendingTopics[0]?.label || "Technology",
    };
  }, [activeDiscussions.length, entries, trendingTopics]);

  const resurfacingSections = useMemo(() => {
    const seenIds = new Set<string>();
    const popularThisMonth = [...entries]
      .filter((entry) => entry.createdAt >= now - 31 * DAY_MS)
      .sort((left, right) => getEntryScore(right, now) - getEntryScore(left, now))
      .slice(0, 3);
    popularThisMonth.forEach((entry) => seenIds.add(entry.id));

    const recommendedReads = [...entries]
      .filter((entry) => !seenIds.has(entry.id))
      .sort((left, right) => {
        const leftMetrics = getTrustMetrics(left);
        const rightMetrics = getTrustMetrics(right);

        return (
          rightMetrics.communityTrustPercent - leftMetrics.communityTrustPercent ||
          rightMetrics.helpfulCount - leftMetrics.helpfulCount ||
          right.createdAt - left.createdAt
        );
      })
      .slice(0, 3);
    recommendedReads.forEach((entry) => seenIds.add(entry.id));

    const missedReads = [...entries]
      .filter((entry) => !seenIds.has(entry.id) && entry.createdAt < now - 7 * DAY_MS)
      .sort((left, right) => getEntryScore(right, now) - getEntryScore(left, now))
      .slice(0, 3);

    return {
      popularThisMonth,
      recommendedReads,
      missedReads,
    };
  }, [entries, now]);

  const unifiedSearch = useMemo(() => {
    if (searchTerms.length === 0) return null;

    const posts = entries
      .filter((entry) =>
        matchesTerms(
          [
            entry.title,
            entry.content,
            entry.author,
            entry.hashtags.join(" "),
          ].join(" "),
          searchTerms,
        ),
      )
      .sort((left, right) => getEntryScore(right, now) - getEntryScore(left, now))
      .slice(0, 5);
    const searchQuestions = questions
      .filter((question) => matchesTerms(getQuestionTopicText(question), searchTerms))
      .sort(
        (left, right) =>
          getDiscussionActivity(right, now).score -
          getDiscussionActivity(left, now).score,
      )
      .slice(0, 5);
    const topics = topicStats
      .filter((topic) =>
        matchesTerms([topic.label, topic.id, topic.keywords.join(" ")].join(" "), searchTerms),
      )
      .slice(0, 5);
    const people = allContributors
      .filter((contributor) =>
        matchesTerms(
          [
            contributor.displayName,
            contributor.username,
            contributor.profile?.jobTitle || "",
            contributor.profile?.bio || "",
          ].join(" "),
          searchTerms,
        ),
      )
      .slice(0, 5);

    return {
      posts,
      questions: searchQuestions,
      topics,
      people,
      count: posts.length + searchQuestions.length + topics.length + people.length,
    };
  }, [allContributors, entries, now, questions, searchTerms, topicStats]);

  const pageTitle = activeTopic
    ? `${activeTopic.label} Topic | Readative`
    : "Explore | Readative";
  const pageDescription = activeTopic
    ? activeTopic.description
    : "Explore trending technology topics, active SmartTalk discussions, helpful posts, and top contributors on Readative.";
  const pageUrl = activeTopic
    ? buildAbsoluteRouteUrl("explore", { selectedTopic: activeTopic.id })
    : buildAbsoluteRouteUrl("explore");
  const shouldNoIndexExplorePage =
    Boolean(activeTopic) &&
    !isLoading &&
    scopedEntries.length === 0 &&
    scopedQuestions.length === 0;

  return (
    <div className="space-y-5 pb-20">
      <SEO
        title={pageTitle}
        description={pageDescription}
        url={pageUrl}
        keywords={[
          "technology topics",
          "SmartTalk",
          "helpful posts",
          "contributors",
          ...(activeTopic ? [activeTopic.label] : []),
        ]}
        robots={shouldNoIndexExplorePage ? "noindex" : "index"}
        schema={buildExploreSchemas({
          activeTopic,
          category: activeTopicCategory,
          pageUrl,
          pageDescription,
          topPosts,
          activeDiscussions,
        })}
      />

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        {activeTopic && (
          <a
            href="/explore"
            onClick={(event) => {
              event.preventDefault();
              onOpenTopic(null);
            }}
            className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:border-sky-200 hover:text-sky-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Explore
          </a>
        )}
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
            {activeTopic ? <Hash className="h-5 w-5" /> : <Compass className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-600">
              {activeTopic ? "Topic Page" : "Explore"}
            </p>
            <h1 className="text-xl font-black tracking-tight text-slate-950">
              {activeTopic
                ? activeTopic.label
                : "What the community is learning"}
            </h1>
            {activeTopic && (
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {scopedEntries.length} posts / {scopedQuestions.length} discussions
              </p>
            )}
          </div>
        </div>
      </div>

      {activeTopic && activeTopicCategory && (
        <TopicKnowledgeBrief
          topic={activeTopic}
          category={activeTopicCategory}
          relatedTopics={relatedTopics}
          onOpenTopic={onOpenTopic}
          onOpenCategory={(categoryId) =>
            navigateToRoute("smarttalk", { selectedTopic: categoryId })
          }
        />
      )}

      <DiscoverySearch
        theme="emerald"
        placeholder="Search posts, questions, topics, people"
        value={searchQuery}
        onChange={setSearchQuery}
        onClear={() => setSearchQuery("")}
        ariaLabel="Unified search"
      />

      {loadError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {loadError}
        </div>
      )}

      {isLoading ? (
        <ExploreSkeleton />
      ) : unifiedSearch ? (
        <UnifiedSearchResults
          query={searchQuery.trim()}
          results={unifiedSearch}
          onOpenEntry={onOpenEntry}
          onOpenProfile={onOpenProfile}
          onOpenTopic={onOpenTopic}
          onOpenSmartTalk={onOpenSmartTalk}
        />
      ) : (
        <>
          <DailyPulse pulse={dailyPulse} />

          {trendingTopics.length > 0 && (
            <ExploreSection icon={<Flame className="h-4 w-4" />} title="Trending Topics">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {trendingTopics.map((topic) => (
                  <a
                    key={topic.id}
                    href={`/topic/${encodeURIComponent(topic.id)}`}
                    onClick={(event) => {
                      event.preventDefault();
                      onOpenTopic(topic.id);
                    }}
                    className={`rounded-2xl border px-3 py-3 text-left shadow-sm transition-colors ${
                      activeTopic?.id === topic.id
                        ? "border-sky-200 bg-sky-50"
                        : "border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-black text-slate-950">{topic.label}</p>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {topic.postCount} posts / {topic.discussionCount} talks
                    </p>
                  </a>
                ))}
              </div>
            </ExploreSection>
          )}

          {topPosts.length > 0 && (
            <ExploreSection
              icon={<ThumbsUp className="h-4 w-4" />}
              title={activeTopic ? "Top Posts" : "Most Helpful Posts"}
            >
              <DiscoveryPostList entries={topPosts} onOpenEntry={onOpenEntry} />
            </ExploreSection>
          )}

          {activeTopic && latestPosts.length > 0 && (
            <ExploreSection icon={<Clock3 className="h-4 w-4" />} title="Latest Posts">
              <DiscoveryPostList entries={latestPosts} onOpenEntry={onOpenEntry} compact />
            </ExploreSection>
          )}

          {activeDiscussions.length > 0 && (
            <ExploreSection
              icon={<MessageSquareMore className="h-4 w-4" />}
              title="Active Discussions"
            >
              <div className="space-y-2">
                {activeDiscussions.map((question) => (
                  <DiscoveryListRow
                    key={question.id}
                    href={buildPublicPath("smarttalk", {
                      selectedTopic: question.category,
                      focusedEntryId: question.id,
                    })}
                    onClick={(event) => {
                      event.preventDefault();
                      onOpenSmartTalk(question.id, question.category);
                    }}
                    tone="discussion"
                  >
                    <p className="line-clamp-2 text-sm font-bold leading-5 text-slate-900">
                      {question.content}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-400">
                      <span>{question.answers.length} answers</span>
                      <span>/</span>
                      <span>{formatCompactDate(getDiscussionActivity(question, now).latestActivity)}</span>
                    </div>
                  </DiscoveryListRow>
                ))}
              </div>
            </ExploreSection>
          )}

          {topContributors.length > 0 && (
            <ExploreSection icon={<Award className="h-4 w-4" />} title="Top Contributors">
              <ContributorList contributors={topContributors} onOpenProfile={onOpenProfile} />
            </ExploreSection>
          )}

          {learningCollections.length > 0 && (
            <ExploreSection
              icon={<Layers3 className="h-4 w-4" />}
              title="Learning Collections"
            >
              <div className="space-y-3">
                {learningCollections.map((collection) => (
                  <div
                    key={collection.id}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <a
                        href={`/topic/${encodeURIComponent(collection.id)}`}
                        onClick={(event) => {
                          event.preventDefault();
                          onOpenTopic(collection.id);
                        }}
                        className="min-w-0 text-left font-black text-slate-950 transition-colors hover:text-sky-700"
                      >
                        {collection.collectionTitle}
                      </a>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
                        {collection.total}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {collection.entries.map((entry) => (
                        <a
                          key={entry.id}
                          href={`/post/${entry.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            onOpenEntry(entry.id);
                          }}
                          className="flex w-full items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-left transition-colors hover:bg-emerald-50"
                        >
                          <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          <span className="line-clamp-1 text-xs font-bold text-slate-700">
                            {entry.title}
                          </span>
                        </a>
                      ))}
                      {collection.questions.map((question) => (
                        <a
                          key={question.id}
                          href={buildPublicPath("smarttalk", {
                            selectedTopic: question.category,
                            focusedEntryId: question.id,
                          })}
                          onClick={(event) => {
                            event.preventDefault();
                            onOpenSmartTalk(question.id, question.category);
                          }}
                          className="flex w-full items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-left transition-colors hover:bg-indigo-100"
                        >
                          <MessageSquareMore className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                          <span className="line-clamp-1 text-xs font-bold text-slate-700">
                            {question.content}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ExploreSection>
          )}

          {!activeTopic && (
            <ResurfacingGrid
              popularThisMonth={resurfacingSections.popularThisMonth}
              recommendedReads={resurfacingSections.recommendedReads}
              missedReads={resurfacingSections.missedReads}
              onOpenEntry={onOpenEntry}
            />
          )}

          {activeTopic && scopedEntries.length === 0 && scopedQuestions.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center shadow-sm">
              <BookOpenText className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-500">
                This topic will fill in as related posts and SmartTalk discussions grow.
              </p>
            </div>
          )}

          {!activeTopic && entries.length === 0 && questions.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center shadow-sm">
              <BookOpenText className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-500">
                Explore will populate as posts and SmartTalk discussions grow.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DailyPulse({
  pulse,
}: {
  pulse: {
    newInsights: number;
    activeDiscussions: number;
    trendingTopics: number;
    topTopic: string;
  };
}) {
  const items = [
    ["New Insights", pulse.newInsights.toLocaleString()],
    ["Active Discussions", pulse.activeDiscussions.toLocaleString()],
    ["Trending Topics", pulse.trendingTopics.toLocaleString()],
    ["Top Topic Today", pulse.topTopic],
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
        <TrendingUp className="h-4 w-4 text-sky-600" />
        Today's Pulse
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              {label}
            </p>
            <p className="mt-1 truncate text-sm font-black text-slate-950">
              {value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TopicKnowledgeBrief({
  topic,
  category,
  relatedTopics,
  onOpenTopic,
  onOpenCategory,
}: {
  topic: ExploreTopic;
  category: SeoCategoryDefinition;
  relatedTopics: SeoTopicDefinition[];
  onOpenTopic: (topicId: string | null) => void;
  onOpenCategory: (categoryId: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-600">
            Topic
          </p>
          <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">
            {topic.label}
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
            {topic.description}
          </p>
        </div>
        <a
          href={`/category/${encodeURIComponent(category.id)}`}
          onClick={(event) => {
            event.preventDefault();
            onOpenCategory(category.id);
          }}
          className="w-fit rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
        >
          {category.label}
        </a>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <TopicBriefText label="What" value={topic.description} />
        <TopicBriefText label="Why" value={category.why} />
        <TopicBriefText label="Who" value={category.who} />
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
            Benefits
          </p>
          <ul className="mt-1 space-y-1.5 text-slate-600">
            {category.benefits.map((benefit) => (
              <li key={benefit} className="leading-5">
                {benefit}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
            Examples
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[topic.label, ...category.examples].slice(0, 6).map((example) => (
              <span
                key={example}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600"
              >
                {example}
              </span>
            ))}
          </div>
        </div>

        {relatedTopics.length > 0 && (
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
              Related Topics
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {relatedTopics.map((relatedTopic) => (
                <a
                  key={relatedTopic.id}
                  href={`/topic/${encodeURIComponent(relatedTopic.id)}`}
                  onClick={(event) => {
                    event.preventDefault();
                    onOpenTopic(relatedTopic.id);
                  }}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black text-slate-600 transition-colors hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                >
                  {relatedTopic.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function TopicBriefText({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 leading-5 text-slate-600">{value}</p>
    </div>
  );
}

function UnifiedSearchResults({
  query,
  results,
  onOpenEntry,
  onOpenProfile,
  onOpenTopic,
  onOpenSmartTalk,
}: {
  query: string;
  results: {
    posts: KnowledgeEntry[];
    questions: ExploreQuestion[];
    topics: TopicStats[];
    people: ContributorDiscovery[];
    count: number;
  };
  onOpenEntry: (entryId: string) => void;
  onOpenProfile: (authorId: string) => void;
  onOpenTopic: (topicId: string | null) => void;
  onOpenSmartTalk: (questionId?: string, selectedCategory?: string | null) => void;
}) {
  if (results.count === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center shadow-sm">
        <Search className="mx-auto h-8 w-8 text-slate-300" />
        <h2 className="mt-3 text-lg font-black text-slate-950">
          No matches for "{query}"
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Try a broader keyword, topic, or contributor name.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="px-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
        {results.count} unified result{results.count === 1 ? "" : "s"}
      </p>
      {results.posts.length > 0 && (
        <ExploreSection icon={<BookOpenText className="h-4 w-4" />} title="Posts">
          <DiscoveryPostList entries={results.posts} onOpenEntry={onOpenEntry} compact />
        </ExploreSection>
      )}
      {results.questions.length > 0 && (
        <ExploreSection icon={<MessageSquareMore className="h-4 w-4" />} title="Questions">
          <div className="space-y-2">
            {results.questions.map((question) => (
              <DiscoveryListRow
                key={question.id}
                href={buildPublicPath("smarttalk", {
                  selectedTopic: question.category,
                  focusedEntryId: question.id,
                })}
                onClick={(event) => {
                  event.preventDefault();
                  onOpenSmartTalk(question.id, question.category);
                }}
                tone="discussion"
              >
                <p className="line-clamp-2 text-sm font-bold leading-5 text-slate-900">
                  {question.content}
                </p>
                <p className="mt-1 text-[11px] font-bold text-slate-400">
                  {question.answers.length} answers / {question.author}
                </p>
              </DiscoveryListRow>
            ))}
          </div>
        </ExploreSection>
      )}
      {results.topics.length > 0 && (
        <ExploreSection icon={<Hash className="h-4 w-4" />} title="Topics">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {results.topics.map((topic) => (
              <a
                key={topic.id}
                href={`/topic/${encodeURIComponent(topic.id)}`}
                onClick={(event) => {
                  event.preventDefault();
                  onOpenTopic(topic.id);
                }}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left shadow-sm transition-colors hover:border-sky-200 hover:bg-sky-50/60"
              >
                <p className="text-sm font-black text-slate-950">{topic.label}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {topic.postCount} posts
                </p>
              </a>
            ))}
          </div>
        </ExploreSection>
      )}
      {results.people.length > 0 && (
        <ExploreSection icon={<UserRound className="h-4 w-4" />} title="People">
          <ContributorList contributors={results.people} onOpenProfile={onOpenProfile} />
        </ExploreSection>
      )}
    </div>
  );
}

function DiscoveryPostList({
  entries,
  onOpenEntry,
  compact = false,
}: {
  entries: KnowledgeEntry[];
  onOpenEntry: (entryId: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const metrics = getTrustMetrics(entry);

        return (
          <DiscoveryListRow
            key={entry.id}
            href={`/post/${entry.id}`}
            onClick={(e) => {
              e.preventDefault();
              onOpenEntry(entry.id);
            }}
            tone="post"
          >
            <p className="line-clamp-2 text-sm font-black leading-5 text-slate-950">
              {entry.title}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500">
              <span>{metrics.helpfulCount} helpful</span>
              {!compact && (
                <>
                  <span>/</span>
                  <span>{metrics.communityTrustPercent}% trust</span>
                </>
              )}
              <span>/</span>
              <span>{formatReadingMinutes(entry.readingMinutes)}</span>
              <span>/</span>
              <span>{formatCompactDate(entry.createdAt)}</span>
            </div>
          </DiscoveryListRow>
        );
      })}
    </div>
  );
}

function DiscoveryListRow({
  children,
  href,
  onClick,
  tone,
}: {
  children: ReactNode;
  href: string;
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  tone: "post" | "discussion";
}) {
  const hoverClasses =
    tone === "post"
      ? "hover:border-emerald-200 hover:bg-emerald-50/40"
      : "hover:border-indigo-200 hover:bg-indigo-50/50";

  return (
    <a
      href={href}
      onClick={onClick}
      className={`block w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left shadow-sm transition-colors ${hoverClasses}`}
    >
      {children}
    </a>
  );
}

function ContributorList({
  contributors,
  onOpenProfile,
}: {
  contributors: ContributorDiscovery[];
  onOpenProfile: (authorId: string) => void;
}) {
  return (
    <div className="space-y-2">
      {contributors.map((contributor) => (
        <a
          key={contributor.authorId}
          href={`/profile/${encodeURIComponent(contributor.authorId)}`}
          onClick={(event) => {
            event.preventDefault();
            onOpenProfile(contributor.authorId);
          }}
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50/40"
        >
          <ProfileAvatar
            authorId={contributor.authorId}
            image={contributor.profile?.profileImage}
            photoUrl={contributor.profile?.photoUrl}
            username={contributor.displayName}
            size="sm"
            className="border-slate-200"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-slate-950">
              {contributor.displayName}
            </p>
            <p className="truncate text-[11px] font-semibold text-slate-400">
              @{contributor.username}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <p className="text-xs font-black text-slate-900">
              {contributor.trustScore}
            </p>
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700"
              title={`${contributor.level}: ${contributor.trustScore} trust score`}
              aria-label={`${contributor.level}: ${contributor.trustScore} trust score`}
            >
              <Award className="h-3.5 w-3.5" />
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}

function ResurfacingGrid({
  popularThisMonth,
  recommendedReads,
  missedReads,
  onOpenEntry,
}: {
  popularThisMonth: KnowledgeEntry[];
  recommendedReads: KnowledgeEntry[];
  missedReads: KnowledgeEntry[];
  onOpenEntry: (entryId: string) => void;
}) {
  const sections = [
    {
      title: "Popular This Month",
      icon: <CalendarDays className="h-4 w-4" />,
      entries: popularThisMonth,
    },
    {
      title: "Recommended Reads",
      icon: <Sparkles className="h-4 w-4" />,
      entries: recommendedReads,
    },
    {
      title: "You Might Have Missed",
      icon: <Clock3 className="h-4 w-4" />,
      entries: missedReads,
    },
  ].filter((section) => section.entries.length > 0);

  if (sections.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {sections.map((section) => (
        <section
          key={section.title}
          className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm"
        >
          <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
            <span className="text-sky-600">{section.icon}</span>
            {section.title}
          </div>
          <div className="space-y-2">
            {section.entries.map((entry) => (
              <a
                key={entry.id}
                href={`/post/${entry.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  onOpenEntry(entry.id);
                }}
                className="w-full border-t border-slate-100 pt-2 text-left first:border-t-0 first:pt-0"
              >
                <p className="line-clamp-2 text-xs font-bold leading-5 text-slate-800">
                  {entry.title}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                  {formatCompactDate(entry.createdAt)}
                </p>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ExploreSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <span className="text-sky-600">{icon}</span>
        <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function ExploreSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      {Array.from({ length: 4 }).map((_, sectionIndex) => (
        <div key={sectionIndex} className="space-y-3">
          <div className="h-4 w-40 animate-pulse rounded-full bg-slate-200" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((__, itemIndex) => (
              <div
                key={itemIndex}
                className="h-16 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
