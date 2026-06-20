import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Award,
  BookOpenText,
  Check,
  Clock3,
  Github,
  Globe,
  ImagePlus,
  Instagram,
  Linkedin,
  MessageCircle,
  MessageSquareReply,
  Pencil,
  Save,
  ShieldCheck,
  Sparkles,
  Tags,
  ThumbsUp,
  TrendingUp,
  User,
  X,
  Youtube,
} from "lucide-react";
import {
  collection,
  type DocumentData,
  documentId,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  type QueryDocumentSnapshot,
  startAfter,
  where,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import {
  KnowledgeEntry,
  KnowledgeImageAsset,
  SmartQuestion,
  UserProfile,
  UserSocialLinks,
} from "../types";
import { SEO } from "./SEO";
import { GoogleSignInPrompt } from "./Auth";
import { KnowledgeCardList } from "./KnowledgeCardList";
import { ProfileAvatar } from "./ProfileAvatar";
import { ProfileAvatarPicker } from "./ProfileAvatarPicker";
import { ReadativeRMark } from "./ReadativeLoader";
import {
  changeProfileBanner,
  changeProfilePhoto,
  changeProfileUsername,
  getUsernameChangeRemaining,
  updateProfileDetails,
} from "../utils/userProfiles";
import { type KnowledgeIdentity } from "../utils/knowledgeIdentity";
import { buildAbsoluteRouteUrl, navigateToRoute } from "../utils/routes";
import { hydrateUserProfile } from "../utils/profileData";
import { signInWithGoogleAccount } from "../utils/googleAuth";
import {
  canViewKnowledgeEntry,
  normalizeKnowledgeVisibility,
} from "../utils/knowledgePrivacy";
import { ProfileSocialLinks } from "./ProfileSocialLinks";
import { KnowledgeCardSkeleton, ProfileSkeleton } from "./Skeletons";
import {
  getContributorLevel,
  getTrustMetrics,
  mergeTrustIds,
  normalizeTrustCount,
  normalizeTrustIdArray,
} from "../utils/trustSystem";
import { getSaveMetrics } from "../utils/bookmarks";
import { useHighlights } from "../context/HighlightsContext";
import { ProfileHighlights } from "./ProfileHighlights";

type ProfileSection = "shared" | "activity" | "liked" | "saved" | "highlights";
type ProfileActivityType =
  | "post"
  | "answer"
  | "comment"
  | "helpful"
  | "trust"
  | "level";
type ProfilePaginationMode = "ordered" | "fallback" | null;
type KnowledgePendingAction = {
  type: "helpful" | "misleading" | "comment" | "save";
  entryId: string;
};

const PROFILE_POST_PAGE_SIZE = 20;
const PROFILE_POST_FALLBACK_PAGE_SIZE = 40;
const PROFILE_SHARED_COMPATIBILITY_LIMIT = 40;
const PROFILE_TRACKED_LIKE_LOOKUP_LIMIT = 120;
const FIRESTORE_IN_QUERY_LIMIT = 30;
const PROFILE_DIRECTORY_LIMIT = 80;
const PROFILE_SMARTTALK_SUMMARY_LIMIT = 50;

type ProfileSharedMatchField = "authorId" | "authorEmail" | "author";

interface ProfileSharedMatchSource {
  key: string;
  field: ProfileSharedMatchField;
  value: string;
}

const EXPERTISE_KEYWORDS = [
  {
    label: "AI",
    keywords: ["ai", "artificial intelligence", "llm", "prompt", "openai", "copilot"],
  },
  {
    label: "Programming",
    keywords: ["programming", "code", "coding", "developer", "javascript", "typescript", "python", "react", "api"],
  },
  {
    label: "Marketing",
    keywords: ["marketing", "growth", "seo", "content", "brand", "campaign", "ads"],
  },
  {
    label: "Cybersecurity",
    keywords: ["security", "cybersecurity", "privacy", "auth", "password", "threat", "risk"],
  },
  {
    label: "Productivity",
    keywords: ["productivity", "workflow", "automation", "focus", "template", "shortcut"],
  },
  {
    label: "Design",
    keywords: ["design", "ui", "ux", "figma", "prototype", "interface"],
  },
  {
    label: "Startups",
    keywords: ["startup", "founder", "mvp", "fundraising", "launch", "customer"],
  },
] as const;

interface ProfileProps {
  currentIdentity: KnowledgeIdentity | null;
  viewedAuthorId: string | null;
  onIdentityChange: (identity: KnowledgeIdentity | null) => void;
  onOpenProfile: (authorId: string) => void;
  onOpenEntry: (entryId: string) => void;
}

interface ProfileSmartTalkSummary {
  answers: number;
  questions: number;
  bestAnswers: number;
  expertiseText: string[];
  activityItems: ProfileActivityItem[];
  bestAnswer: ProfileActivityItem | null;
}

const EMPTY_PROFILE_SMARTTALK_SUMMARY: ProfileSmartTalkSummary = {
  answers: 0,
  questions: 0,
  bestAnswers: 0,
  expertiseText: [],
  activityItems: [],
  bestAnswer: null,
};

type ProfileContributorLevel = ReturnType<typeof getContributorLevel>;

interface ProfileTrustInsights {
  trustScore: number;
  helpfulRatio: number;
  contributorLevel: ProfileContributorLevel;
  postsCreated: number;
  helpfulReceived: number;
  smartTalkAnswers: number;
  bestAnswers: number;
  communityTrustPercent: number;
}

interface ProfileActivityItem {
  id: string;
  type: ProfileActivityType;
  title: string;
  detail: string;
  createdAt: number;
}

function sortKnowledge(entries: KnowledgeEntry[]) {
  return [...entries].sort((left, right) => right.createdAt - left.createdAt);
}

function mergeProfileKnowledgeEntries(
  currentEntries: KnowledgeEntry[],
  nextEntries: KnowledgeEntry[],
) {
  const entriesById = new Map<string, KnowledgeEntry>();

  currentEntries.forEach((entry) => {
    entriesById.set(entry.id, entry);
  });

  nextEntries.forEach((entry) => {
    entriesById.set(entry.id, entry);
  });

  return sortKnowledge([...entriesById.values()]);
}

function normalizeProfileMatchValue(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function normalizeProfileMatchKey(value: unknown) {
  return normalizeProfileMatchValue(value).toLowerCase();
}

function uniqueProfileMatchValues(values: unknown[], normalize = false) {
  const seen = new Set<string>();
  const output: string[] = [];

  values.forEach((value) => {
    const normalized = normalize
      ? normalizeProfileMatchKey(value)
      : normalizeProfileMatchValue(value);
    if (!normalized) return;

    const key = normalized.toLowerCase();
    if (seen.has(key)) return;

    seen.add(key);
    output.push(normalized);
  });

  return output;
}

function getProfileSharedMatchSources({
  activeAuthorId,
  profile,
  currentIdentity,
  isOwnProfile,
}: {
  activeAuthorId: string;
  profile: UserProfile;
  currentIdentity: KnowledgeIdentity | null;
  isOwnProfile: boolean;
}): ProfileSharedMatchSource[] {
  const ownIdentityValues = isOwnProfile
    ? [
        currentIdentity?.authorId,
        currentIdentity?.displayName,
        currentIdentity?.email,
      ]
    : [];
  const authorIdValues = uniqueProfileMatchValues([
    activeAuthorId,
    profile.id,
    profile.username,
    profile.usernameLower,
    profile.email,
    ...ownIdentityValues,
  ]);
  const authorEmailValues = uniqueProfileMatchValues(
    [profile.email, isOwnProfile ? currentIdentity?.email : null],
    true,
  );
  const authorNameValues = uniqueProfileMatchValues([
    profile.username,
    profile.usernameLower,
    profile.displayName,
    isOwnProfile ? currentIdentity?.displayName : null,
  ]);

  return [
    ...authorIdValues.map((value) => ({
      key: `authorId:${value.toLowerCase()}`,
      field: "authorId" as const,
      value,
    })),
    ...authorEmailValues.map((value) => ({
      key: `authorEmail:${value}`,
      field: "authorEmail" as const,
      value,
    })),
    ...authorNameValues.map((value) => ({
      key: `author:${value.toLowerCase()}`,
      field: "author" as const,
      value,
    })),
  ];
}

function matchesProfileSharedSource(
  entry: KnowledgeEntry,
  source: ProfileSharedMatchSource,
) {
  if (source.field === "authorEmail") {
    return normalizeProfileMatchKey(entry.authorEmail) === source.value;
  }

  if (source.field === "author") {
    return normalizeProfileMatchKey(entry.author) === source.value.toLowerCase();
  }

  const entryAuthorId = normalizeProfileMatchValue(entry.authorId);
  return (
    entryAuthorId === source.value ||
    entryAuthorId.toLowerCase() === source.value.toLowerCase()
  );
}

function reconcileRealtimeProfilePage(
  currentEntries: KnowledgeEntry[],
  realtimeEntries: KnowledgeEntry[],
) {
  if (
    currentEntries.length <= PROFILE_POST_PAGE_SIZE ||
    realtimeEntries.length < PROFILE_POST_PAGE_SIZE
  ) {
    return realtimeEntries;
  }

  const realtimeEntryIds = new Set(realtimeEntries.map((entry) => entry.id));
  const oldestRealtimeEntry = realtimeEntries[realtimeEntries.length - 1];
  const retainedEntries = currentEntries.filter(
    (entry) =>
      !realtimeEntryIds.has(entry.id) &&
      entry.createdAt <= oldestRealtimeEntry.createdAt,
  );

  return sortKnowledge([...realtimeEntries, ...retainedEntries]);
}

function formatCooldown(remainingMs: number) {
  if (remainingMs <= 0) return "You can change your username now.";

  const days = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  return `Username can be changed again in about ${days} day${days === 1 ? "" : "s"}.`;
}

function getProfileDisplayName(profile: UserProfile) {
  return profile.displayName?.trim() || profile.username;
}

function getProfileTrustInsights(
  profile: UserProfile,
  sharedEntries: KnowledgeEntry[],
  smartTalkSummary: ProfileSmartTalkSummary,
): ProfileTrustInsights {
  const postHelpful = sharedEntries.reduce(
    (total, entry) => total + getTrustMetrics(entry).helpfulCount,
    0,
  );
  const postMisleading = sharedEntries.reduce(
    (total, entry) => total + getTrustMetrics(entry).misleadingCount,
    0,
  );
  const helpfulReceived = Math.max(
    postHelpful,
    normalizeTrustCount(profile.helpfulCount),
  );
  const misleadingReceived = Math.max(
    postMisleading,
    normalizeTrustCount(profile.misleadingCount),
  );
  const signalTotal = helpfulReceived + misleadingReceived;
  const helpfulRatio =
    signalTotal > 0 ? Math.round((helpfulReceived / signalTotal) * 100) : 0;
  const communityTrustPercent = signalTotal > 0 ? helpfulRatio : 75;
  const bestAnswers = Math.max(
    smartTalkSummary.bestAnswers,
    normalizeTrustCount(profile.bestAnswerCount),
  );
  const smartTalkAnswers = Math.max(smartTalkSummary.answers, bestAnswers);
  const computedScore = Math.max(
    0,
    Math.round(
      sharedEntries.length * 5 +
        helpfulReceived * 6 +
        smartTalkAnswers * 4 +
        bestAnswers * 12 -
        misleadingReceived * 8,
    ),
  );
  const trustScore = Math.max(
    computedScore,
    normalizeTrustCount(profile.reputationScore),
  );

  return {
    trustScore,
    helpfulRatio,
    contributorLevel: getContributorLevel(trustScore),
    postsCreated: sharedEntries.length,
    helpfulReceived,
    smartTalkAnswers,
    bestAnswers,
    communityTrustPercent,
  };
}

function getProfileTrustColor(trustPercent: number) {
  if (trustPercent >= 88) return "#059669";
  if (trustPercent >= 72) return "#0d9488";
  if (trustPercent >= 55) return "#d97706";
  return "#e11d48";
}

function addExpertiseScore(
  scores: Map<string, number>,
  sourceText: string,
  weight = 1,
) {
  const text = sourceText.toLowerCase();
  EXPERTISE_KEYWORDS.forEach(({ label, keywords }) => {
    const matchedKeywords = keywords.filter((keyword) => text.includes(keyword));
    if (matchedKeywords.length > 0) {
      scores.set(label, (scores.get(label) || 0) + matchedKeywords.length * weight);
    }
  });
}

function inferExpertiseTags(
  sharedEntries: KnowledgeEntry[],
  smartTalkSummary: ProfileSmartTalkSummary,
) {
  const scores = new Map<string, number>();

  sharedEntries.forEach((entry) => {
    addExpertiseScore(scores, [entry.title, entry.content, entry.excerpt || ""].join(" "));
    entry.hashtags.forEach((tag) => addExpertiseScore(scores, tag, 2));
  });

  smartTalkSummary.expertiseText.forEach((text) => addExpertiseScore(scores, text));

  const inferredTags = [...scores.entries()]
    .filter(([, score]) => score > 0)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([label]) => label);

  return inferredTags.length > 0 ? inferredTags : ["Technology"];
}

function readSmartTalkText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readProfileTimestamp(value: unknown, fallback = Date.now()) {
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

function readLegacyKnowledgeAuthorId(data: Partial<KnowledgeEntry>) {
  const legacyData = data as Partial<KnowledgeEntry> &
    Record<string, unknown>;
  const candidates = [
    legacyData.authorId,
    legacyData.userId,
    legacyData.uid,
    legacyData.authorUid,
    legacyData.userUid,
    legacyData.creatorId,
    legacyData.ownerId,
    legacyData.createdBy,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
}

function getProfileSmartTalkSummary(
  activeAuthorId: string,
  docs: Array<QueryDocumentSnapshot<DocumentData>>,
): ProfileSmartTalkSummary {
  return docs.reduce<ProfileSmartTalkSummary>(
    (summary, snapshot) => {
      const data = snapshot.data();
      const questionAuthorId =
        typeof data.authorId === "string" ? data.authorId : "";

      if (questionAuthorId === activeAuthorId) {
        summary.questions += 1;
        const questionText = readSmartTalkText(data.content);
        summary.expertiseText.push(questionText);
        summary.activityItems.push({
          id: `smarttalk-question-${snapshot.id}`,
          type: "answer",
          title: "Started a SmartTalk discussion",
          detail: questionText || "Asked the community a question.",
          createdAt: readProfileTimestamp(data.createdAt),
        });
      }

      if (Array.isArray(data.answers)) {
        data.answers.forEach((answer: unknown) => {
          if (!answer || typeof answer !== "object") return;

          const answerData = answer as Record<string, unknown>;
          if (answerData.authorId !== activeAuthorId) return;

          summary.answers += 1;
          const answerText = readSmartTalkText(answerData.content);
          const answerCreatedAt = readProfileTimestamp(
            answerData.createdAt,
            readProfileTimestamp(data.createdAt),
          );
          const answerActivity = {
            id: `smarttalk-answer-${snapshot.id}-${String(answerData.id || summary.answers)}`,
            type: "answer" as const,
            title: "Answered SmartTalk question",
            detail: answerText || readSmartTalkText(data.content) || "Shared an answer.",
            createdAt: answerCreatedAt,
          };
          summary.expertiseText.push(answerText);
          summary.activityItems.push(answerActivity);

          if (answerData.bestAnswer === true) {
            summary.bestAnswers += 1;
            if (
              !summary.bestAnswer ||
              answerActivity.createdAt > summary.bestAnswer.createdAt
            ) {
              summary.bestAnswer = {
                ...answerActivity,
                id: `best-${answerActivity.id}`,
                title: "Best SmartTalk answer",
              };
            }
          }
        });
      }

      return summary;
    },
    {
      ...EMPTY_PROFILE_SMARTTALK_SUMMARY,
      expertiseText: [],
      activityItems: [],
      bestAnswer: null,
    },
  );
}

function buildProfileActivityTimeline(
  profile: UserProfile,
  sharedEntries: KnowledgeEntry[],
  smartTalkSummary: ProfileSmartTalkSummary,
  insights: ProfileTrustInsights,
): ProfileActivityItem[] {
  const timeline: ProfileActivityItem[] = [];
  const latestPostAt = sharedEntries[0]?.createdAt || profile.updatedAt || profile.createdAt;

  sharedEntries.slice(0, 8).forEach((entry) => {
    timeline.push({
      id: `post-${entry.id}`,
      type: "post",
      title: "Published a post",
      detail: entry.title,
      createdAt: entry.createdAt,
    });

    entry.comments
      .filter((comment) => comment.authorId === profile.id)
      .slice(0, 2)
      .forEach((comment) => {
        timeline.push({
          id: `comment-${entry.id}-${comment.id}`,
          type: "comment",
          title: "Commented on discussion",
          detail: comment.text || entry.title,
          createdAt: comment.createdAt,
        });
      });
  });

  if (insights.helpfulReceived > 0) {
    timeline.push({
      id: "helpful-received",
      type: "helpful",
      title: "Received Helpful votes",
      detail: `${insights.helpfulReceived.toLocaleString()} helpful marks from the community.`,
      createdAt: latestPostAt,
    });
  }

  if (insights.trustScore > 0) {
    timeline.push({
      id: "trust-score",
      type: "trust",
      title: "Trust score increased",
      detail: `Trust score ${insights.trustScore.toLocaleString()} / ${insights.communityTrustPercent}% trusted.`,
      createdAt: profile.updatedAt || latestPostAt,
    });
  }

  timeline.push({
    id: "contributor-level",
    type: "level",
    title: "Contributor level upgraded",
    detail: insights.contributorLevel,
    createdAt: profile.updatedAt || latestPostAt,
  });

  return [...timeline, ...smartTalkSummary.activityItems]
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 16);
}

function hydrateKnowledgeFromSnapshot(id: string, data: Partial<KnowledgeEntry>) {
  const normalizeTimestamp = (value: unknown, fallback = Date.now()) => {
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
  };
  const normalizeStringArray = (value: unknown) =>
    Array.isArray(value)
      ? [...new Set(value)]
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.replace(/^#/, "").trim().toLowerCase())
          .filter(Boolean)
      : [];
  const helpfulIds = mergeTrustIds(
    normalizeTrustIdArray(data.likes),
    normalizeTrustIdArray(data.helpfulIds),
  );
  const misleadingIds = mergeTrustIds(
    normalizeTrustIdArray(data.dislikes),
    normalizeTrustIdArray(data.misleadingIds),
  );
  const helpfulCount = Math.max(
    helpfulIds.length,
    normalizeTrustCount(data.likeCount),
    normalizeTrustCount(data.helpfulCount),
  );
  const misleadingCount = Math.max(
    misleadingIds.length,
    normalizeTrustCount(data.dislikeCount),
    normalizeTrustCount(data.misleadingCount),
  );
  const saveMetrics = getSaveMetrics(data);
  const createdAt = normalizeTimestamp(data.createdAt);
  const comments = Array.isArray(data.comments)
    ? data.comments
        .filter((comment) => Boolean(comment && typeof comment === "object"))
        .map((comment) => {
          const safeComment = comment as Partial<
            KnowledgeEntry["comments"][number]
          >;

          return {
            id:
              typeof safeComment.id === "string" && safeComment.id
                ? safeComment.id
                : Math.random().toString(36).slice(2, 11),
            author:
              typeof safeComment.author === "string"
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
        })
    : [];

  return {
    ...data,
    id,
    author: typeof data.author === "string" ? data.author : "",
    authorId: readLegacyKnowledgeAuthorId(data),
    authorEmail: typeof data.authorEmail === "string" ? data.authorEmail : "",
    title: typeof data.title === "string" ? data.title : "",
    content: typeof data.content === "string" ? data.content : "",
    visibility: normalizeKnowledgeVisibility(data.visibility),
    comments,
    likes: helpfulIds,
    likeCount: helpfulCount,
    helpfulIds,
    helpfulCount,
    dislikes: misleadingIds,
    dislikeCount: misleadingCount,
    misleadingIds,
    misleadingCount,
    savedBy: saveMetrics.savedBy,
    saveCount: saveMetrics.saveCount,
    hashtags: normalizeStringArray(data.hashtags),
    mentions: Array.isArray(data.mentions) ? data.mentions : [],
    createdAt,
    updatedAt:
      data.updatedAt === null || data.updatedAt === undefined
        ? null
        : normalizeTimestamp(data.updatedAt, createdAt),
  } as KnowledgeEntry;
}

function hydrateProfileKnowledgeDocs(
  docs: Array<QueryDocumentSnapshot<DocumentData>>,
  visibleAuthorId: string | null | undefined,
  includeEntry: (entry: KnowledgeEntry) => boolean = () => true,
) {
  return sortKnowledge(
    docs
      .map((item) =>
        hydrateKnowledgeFromSnapshot(
          item.id,
          item.data() as Partial<KnowledgeEntry>,
        ),
      )
      .filter(
        (entry) =>
          includeEntry(entry) && canViewKnowledgeEntry(entry, visibleAuthorId),
      ),
  );
}

function hydrateSavedSmartTalkQuestion(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): SmartQuestion {
  const data = snapshot.data();
  const saveMetrics = getSaveMetrics(data);

  return {
    id: snapshot.id,
    author:
      typeof data.author === "string" && data.author ? data.author : "Unknown",
    authorId: typeof data.authorId === "string" ? data.authorId : "",
    content: typeof data.content === "string" ? data.content : "",
    createdAt: readProfileTimestamp(data.createdAt),
    answers: Array.isArray(data.answers) ? data.answers : [],
    category: typeof data.category === "string" ? data.category : null,
    difficulty: typeof data.difficulty === "string" ? data.difficulty : null,
    savedBy: saveMetrics.savedBy,
    saveCount: saveMetrics.saveCount,
  };
}

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function sortProfileLikedEntries(
  entries: KnowledgeEntry[],
  trackedLikedEntryIds: string[],
) {
  if (trackedLikedEntryIds.length === 0) {
    return sortKnowledge(entries);
  }

  const likedOrder = new Map(
    trackedLikedEntryIds.map((entryId, index) => [entryId, index] as const),
  );

  return [...entries].sort((left, right) => {
    const leftOrder = likedOrder.get(left.id);
    const rightOrder = likedOrder.get(right.id);

    if (leftOrder !== undefined && rightOrder !== undefined) {
      return rightOrder - leftOrder;
    }

    if (leftOrder !== undefined) return -1;
    if (rightOrder !== undefined) return 1;

    return right.createdAt - left.createdAt;
  });
}

function isMissingFirestoreIndexError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code).toLowerCase()
      : "";

  return (
    code === "failed-precondition" ||
    message.includes("index") ||
    message.includes("requires an index")
  );
}

export function Profile({
  currentIdentity,
  viewedAuthorId,
  onIdentityChange,
  onOpenProfile,
  onOpenEntry,
}: ProfileProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [sharedEntries, setSharedEntries] = useState<KnowledgeEntry[]>([]);
  const [likedEntries, setLikedEntries] = useState<KnowledgeEntry[]>([]);
  const [savedEntries, setSavedEntries] = useState<KnowledgeEntry[]>([]);
  const [savedQuestions, setSavedQuestions] = useState<SmartQuestion[]>([]);
  const [sharedEntryCursor, setSharedEntryCursor] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [likedEntryCursor, setLikedEntryCursor] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreSharedEntries, setHasMoreSharedEntries] = useState(false);
  const [hasMoreLikedEntries, setHasMoreLikedEntries] = useState(false);
  const [sharedPaginationMode, setSharedPaginationMode] =
    useState<ProfilePaginationMode>(null);
  const [likedPaginationMode, setLikedPaginationMode] =
    useState<ProfilePaginationMode>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingSharedEntries, setIsLoadingSharedEntries] = useState(false);
  const [isLoadingLikedEntries, setIsLoadingLikedEntries] = useState(false);
  const [isLoadingSavedItems, setIsLoadingSavedItems] = useState(false);
  const [isLoadingMoreSharedEntries, setIsLoadingMoreSharedEntries] =
    useState(false);
  const [isLoadingMoreLikedEntries, setIsLoadingMoreLikedEntries] =
    useState(false);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const [directoryLoadError, setDirectoryLoadError] = useState<string | null>(null);
  const [showIdentityPrompt, setShowIdentityPrompt] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showBannerPicker, setShowBannerPicker] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [isSavingBanner, setIsSavingBanner] = useState(false);
  const [avatarSaveError, setAvatarSaveError] = useState<string | null>(null);
  const [bannerSaveError, setBannerSaveError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileEditError, setProfileEditError] = useState<string | null>(null);
  const [smartTalkSummary, setSmartTalkSummary] =
    useState<ProfileSmartTalkSummary>(EMPTY_PROFILE_SMARTTALK_SUMMARY);
  const [section, setSection] = useState<ProfileSection>("shared");
  const { highlights } = useHighlights();
  const [pendingAction, setPendingAction] =
    useState<KnowledgePendingAction | null>(null);
  const activeAuthorIdRef = useRef<string | null>(null);
  const visibleAuthorIdRef = useRef<string | null | undefined>(null);
  const isLoadingMoreSharedEntriesRef = useRef(false);
  const isLoadingMoreLikedEntriesRef = useRef(false);
  const handleIdentityRequired = useCallback(
    (action: KnowledgePendingAction) => setPendingAction(action),
    [],
  );

  const activeAuthorId = viewedAuthorId || currentIdentity?.authorId || null;
  const isOwnProfile =
    Boolean(currentIdentity?.authorId) &&
    activeAuthorId === currentIdentity?.authorId;

  useEffect(() => {
    activeAuthorIdRef.current = activeAuthorId;
  }, [activeAuthorId]);

  useEffect(() => {
    visibleAuthorIdRef.current = currentIdentity?.authorId;
  }, [currentIdentity?.authorId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [activeAuthorId]);

  useEffect(() => {
    const handleUrlChange = () => {
      if (typeof window !== "undefined") {
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.split("?")[1] || "");
        const tabParam = searchParams.get("tab") || hashParams.get("tab");
        if (tabParam === "saved") {
          setSection("saved");
        } else if (tabParam === "highlights" && isOwnProfile) {
          setSection("highlights");
        } else {
          setSection("shared");
        }
      }
    };

    handleUrlChange();
    window.addEventListener("popstate", handleUrlChange);
    window.addEventListener("hashchange", handleUrlChange);
    window.addEventListener("readative:routechange", handleUrlChange);
    return () => {
      window.removeEventListener("popstate", handleUrlChange);
      window.removeEventListener("hashchange", handleUrlChange);
      window.removeEventListener("readative:routechange", handleUrlChange);
    };
  }, [activeAuthorId, isOwnProfile]);

  useEffect(() => {
    let cancelled = false;

    if (!activeAuthorId) {
      setSmartTalkSummary(EMPTY_PROFILE_SMARTTALK_SUMMARY);
      return;
    }

    const loadSmartTalkSummary = async () => {
      try {
        const snapshot = await getDocs(
          query(
            collection(db, "smarttalk"),
            orderBy("createdAt", "desc"),
            limit(PROFILE_SMARTTALK_SUMMARY_LIMIT),
          ),
        );

        if (!cancelled) {
          setSmartTalkSummary(
            getProfileSmartTalkSummary(activeAuthorId, snapshot.docs),
          );
        }
      } catch (error) {
        console.warn("SmartTalk profile summary failed:", error);
        if (!cancelled) {
          setSmartTalkSummary(EMPTY_PROFILE_SMARTTALK_SUMMARY);
        }
      }
    };

    void loadSmartTalkSummary();

    return () => {
      cancelled = true;
    };
  }, [activeAuthorId]);

  useEffect(() => {
    if (!activeAuthorId) {
      setProfile(null);
      setSharedEntries([]);
      setLikedEntries([]);
      setSavedEntries([]);
      setSavedQuestions([]);
      setSharedEntryCursor(null);
      setLikedEntryCursor(null);
      setHasMoreSharedEntries(false);
      setHasMoreLikedEntries(false);
      setSharedPaginationMode(null);
      setLikedPaginationMode(null);
      setIsLoadingProfile(false);
      setIsLoadingSharedEntries(false);
      setIsLoadingLikedEntries(false);
      setIsLoadingSavedItems(false);
      setIsLoadingMoreSharedEntries(false);
      setIsLoadingMoreLikedEntries(false);
      isLoadingMoreSharedEntriesRef.current = false;
      isLoadingMoreLikedEntriesRef.current = false;
      return;
    }

    setIsLoadingProfile(true);
    setIsLoadingSharedEntries(true);
    setSharedEntries([]);
    setLikedEntries([]);
    setSavedEntries([]);
    setSavedQuestions([]);
    setSharedEntryCursor(null);
    setLikedEntryCursor(null);
    setHasMoreSharedEntries(false);
    setHasMoreLikedEntries(false);
    setSharedPaginationMode(null);
    setLikedPaginationMode(null);
    setIsLoadingMoreSharedEntries(false);
    setIsLoadingMoreLikedEntries(false);
    setIsLoadingSavedItems(false);
    isLoadingMoreSharedEntriesRef.current = false;
    isLoadingMoreLikedEntriesRef.current = false;

    const unsubscribers: Array<() => void> = [];
    const hydrateEntries = (snapshot: {
      docs: Array<QueryDocumentSnapshot<DocumentData>>;
    }) => hydrateProfileKnowledgeDocs(snapshot.docs, currentIdentity?.authorId);
    const startProfileEntriesListener = ({
      orderedQuery,
      fallbackQuery,
      label,
      onEntries,
      onCursorChange,
      onHasMoreChange,
      onPaginationModeChange,
      errorMessage,
    }: {
      orderedQuery: ReturnType<typeof query>;
      fallbackQuery: ReturnType<typeof query>;
      label: string;
      onEntries: (entries: KnowledgeEntry[]) => void;
      onCursorChange: (
        cursor: QueryDocumentSnapshot<DocumentData> | null,
      ) => void;
      onHasMoreChange: (hasMore: boolean) => void;
      onPaginationModeChange: (mode: ProfilePaginationMode) => void;
      errorMessage: string;
    }) => {
      let activeUnsubscribe: (() => void) | null = null;

      const startFallbackListener = () => {
        activeUnsubscribe = onSnapshot(
          fallbackQuery,
          (snapshot) => {
            onEntries(hydrateEntries(snapshot));
            onCursorChange(snapshot.docs[snapshot.docs.length - 1] || null);
            onHasMoreChange(
              snapshot.docs.length === PROFILE_POST_FALLBACK_PAGE_SIZE,
            );
            onPaginationModeChange("fallback");
            setIsLoadingSharedEntries(false);
            setProfileLoadError(null);
          },
          (error) => {
            console.error(`${label} fallback listener error:`, error);
            onEntries([]);
            onCursorChange(null);
            onHasMoreChange(false);
            onPaginationModeChange(null);
            setIsLoadingSharedEntries(false);
            setProfileLoadError(errorMessage);
          },
        );
      };

      activeUnsubscribe = onSnapshot(
        orderedQuery,
        (snapshot) => {
          onEntries(hydrateEntries(snapshot));
          onCursorChange(snapshot.docs[snapshot.docs.length - 1] || null);
          onHasMoreChange(snapshot.docs.length === PROFILE_POST_PAGE_SIZE);
          onPaginationModeChange("ordered");
          setIsLoadingSharedEntries(false);
          setProfileLoadError(null);
        },
        (error) => {
          if (isMissingFirestoreIndexError(error)) {
            console.warn(
              `${label} ordered listener needs an index; using limited fallback listener.`,
              error,
            );
            activeUnsubscribe?.();
            startFallbackListener();
            return;
          }

          console.error(`${label} listener error:`, error);
          onEntries([]);
          onCursorChange(null);
          onHasMoreChange(false);
          onPaginationModeChange(null);
          setIsLoadingSharedEntries(false);
          setProfileLoadError(errorMessage);
        },
      );

      return () => activeUnsubscribe?.();
    };

    unsubscribers.push(
      onSnapshot(
        doc(db, "userProfiles", activeAuthorId),
        (snapshot) => {
          if (!snapshot.exists()) {
            setProfile(null);
            setIsLoadingProfile(false);
            setProfileLoadError(null);
            return;
          }

          setProfile(
            hydrateUserProfile(
              snapshot.data() as Partial<UserProfile>,
              snapshot.id,
            ),
          );
          setIsLoadingProfile(false);
          setProfileLoadError(null);
        },
        (error) => {
          console.error("Profile listener error:", error);
          setProfile(null);
          setIsLoadingProfile(false);
          setProfileLoadError(
            "Could not load this profile right now. Please refresh in a moment."
          );
        }
      )
    );

    unsubscribers.push(
      startProfileEntriesListener({
        orderedQuery: query(
          collection(db, "knowledge"),
          where("authorId", "==", activeAuthorId),
          orderBy("createdAt", "desc"),
          limit(PROFILE_POST_PAGE_SIZE),
        ),
        fallbackQuery: query(
          collection(db, "knowledge"),
          where("authorId", "==", activeAuthorId),
          limit(PROFILE_POST_FALLBACK_PAGE_SIZE),
        ),
        label: "Shared knowledge",
        onEntries: (entries) =>
          setSharedEntries((currentEntries) =>
            reconcileRealtimeProfilePage(currentEntries, entries),
          ),
        onCursorChange: setSharedEntryCursor,
        onHasMoreChange: setHasMoreSharedEntries,
        onPaginationModeChange: setSharedPaginationMode,
        errorMessage: "Could not load shared posts for this profile right now.",
      })
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [activeAuthorId, currentIdentity?.authorId, isOwnProfile]);

  useEffect(() => {
    let cancelled = false;

    if (!activeAuthorId || !profile) {
      return;
    }

    const sources = getProfileSharedMatchSources({
      activeAuthorId,
      profile,
      currentIdentity,
      isOwnProfile,
    });

    const loadCompatibleSharedEntries = async () => {
      const sourceResults = await Promise.all(
        sources.map(async (source) => {
          const orderedQuery = query(
            collection(db, "knowledge"),
            where(source.field, "==", source.value),
            orderBy("createdAt", "desc"),
            limit(PROFILE_SHARED_COMPATIBILITY_LIMIT),
          );
          const fallbackQuery = query(
            collection(db, "knowledge"),
            where(source.field, "==", source.value),
            limit(PROFILE_SHARED_COMPATIBILITY_LIMIT),
          );

          try {
            const snapshot = await getDocs(orderedQuery);
            if (snapshot.docs.length === 0) {
              const fallbackSnapshot = await getDocs(fallbackQuery);
              return { source, docs: fallbackSnapshot.docs };
            }

            return { source, docs: snapshot.docs };
          } catch (error) {
            if (!isMissingFirestoreIndexError(error)) {
              console.warn("Profile shared compatibility query failed:", error);
              return null;
            }

            try {
              const snapshot = await getDocs(fallbackQuery);
              return { source, docs: snapshot.docs };
            } catch (fallbackError) {
              console.warn(
                "Profile shared compatibility fallback failed:",
                fallbackError,
              );
              return null;
            }
          }
        }),
      );

      if (cancelled) {
        return;
      }

      const successfulResults = sourceResults.filter(
        (
          result,
        ): result is {
          source: ProfileSharedMatchSource;
          docs: Array<QueryDocumentSnapshot<DocumentData>>;
        } => Boolean(result),
      );
      const docsById = new Map<string, QueryDocumentSnapshot<DocumentData>>();

      successfulResults.forEach(({ docs }) => {
        docs.forEach((item) => {
          docsById.set(item.id, item);
        });
      });

      const compatibleEntries = hydrateProfileKnowledgeDocs(
        [...docsById.values()],
        currentIdentity?.authorId,
        (entry) =>
          sources.some((source) => matchesProfileSharedSource(entry, source)),
      );

      if (compatibleEntries.length > 0) {
        setSharedEntries((currentEntries) =>
          mergeProfileKnowledgeEntries(currentEntries, compatibleEntries),
        );
        setProfileLoadError(null);
      }

      setHasMoreSharedEntries(
        (current) =>
          current ||
          successfulResults.some(
            ({ docs }) => docs.length === PROFILE_SHARED_COMPATIBILITY_LIMIT,
          ),
      );
      setIsLoadingSharedEntries(false);
    };

    void loadCompatibleSharedEntries();

    return () => {
      cancelled = true;
    };
  }, [activeAuthorId, currentIdentity, isOwnProfile, profile]);

  useEffect(() => {
    let cancelled = false;

    const loadProfilesDirectory = async () => {
      try {
        const snapshot = await getDocs(
          query(
            collection(db, "userProfiles"),
            orderBy("usernameLower", "asc"),
            limit(PROFILE_DIRECTORY_LIMIT),
          ),
        );

        if (cancelled) return;

        const data = snapshot.docs.map((item) =>
          hydrateUserProfile(item.data() as Partial<UserProfile>, item.id),
        );

        setProfiles(data);
        setDirectoryLoadError(null);
      } catch (error) {
        if (cancelled) return;

        console.error("User directory load error:", error);
        setProfiles([]);
        setDirectoryLoadError(
          "The profile directory is temporarily unavailable. Mentions and profile previews may be limited."
        );
      }
    };

    void loadProfilesDirectory();

    return () => {
      cancelled = true;
    };
  }, []);

  const usernameCooldown = profile ? getUsernameChangeRemaining(profile) : 0;
  const trackedLikedEntryIds =
    profile?.id === activeAuthorId ? profile.likedKnowledgeIds : [];
  const trackedLikedEntryIdsKey = trackedLikedEntryIds.join("\u001f");
  const likedEntryCount = Math.max(
    trackedLikedEntryIds.length,
    likedEntries.length,
  );
  const savedKnowledgeIds = profile?.savedKnowledgeIds || [];
  const savedSmartTalkIds = profile?.savedSmartTalkIds || [];
  const savedKnowledgeIdsKey = savedKnowledgeIds.join("\u001f");
  const savedSmartTalkIdsKey = savedSmartTalkIds.join("\u001f");
  const savedItemCount = Math.max(
    savedKnowledgeIds.length + savedSmartTalkIds.length,
    savedEntries.length + savedQuestions.length,
  );
  const orderedLikedEntries = useMemo(
    () => sortProfileLikedEntries(likedEntries, trackedLikedEntryIds),
    [likedEntries, trackedLikedEntryIdsKey],
  );
  const profileDisplayName = profile ? getProfileDisplayName(profile) : "";
  const profileUrl =
    profile
      ? buildAbsoluteRouteUrl("profile", { profileAuthorId: profile.id })
      : buildAbsoluteRouteUrl("profile");
  const profileSchema = profile
      ? {
        "@context": "https://schema.org",
        "@type": "Person",
        name: profileDisplayName,
        alternateName: `@${profile.username}`,
        description:
          profile.bio || "A Readative member publishing and curating knowledge.",
        url: profileUrl,
        sameAs: Object.values(profile.socialLinks || {}).filter(Boolean),
      }
    : undefined;
  const profileTrustInsights = useMemo(
    () =>
      profile
        ? getProfileTrustInsights(profile, sharedEntries, smartTalkSummary)
        : null,
    [profile, sharedEntries, smartTalkSummary],
  );
  const expertiseTags = useMemo(
    () => inferExpertiseTags(sharedEntries, smartTalkSummary),
    [sharedEntries, smartTalkSummary],
  );
  const activityTimeline = useMemo(
    () =>
      profile && profileTrustInsights
        ? buildProfileActivityTimeline(
            profile,
            sharedEntries,
            smartTalkSummary,
            profileTrustInsights,
          )
        : [],
    [profile, profileTrustInsights, sharedEntries, smartTalkSummary],
  );
  const mostHelpfulPost = useMemo(
    () =>
      sharedEntries.length > 0
        ? [...sharedEntries].sort((left, right) => {
            const leftMetrics = getTrustMetrics(left);
            const rightMetrics = getTrustMetrics(right);

            return (
              rightMetrics.helpfulCount - leftMetrics.helpfulCount ||
              rightMetrics.communityTrustPercent - leftMetrics.communityTrustPercent ||
              right.createdAt - left.createdAt
            );
          })[0]
        : null,
    [sharedEntries],
  );
  const recentContributionItems = useMemo(
    () =>
      activityTimeline
        .filter(
          (item) =>
            item.type === "post" ||
            item.type === "answer" ||
            item.type === "comment",
        )
        .slice(0, 3),
    [activityTimeline],
  );

  useEffect(() => {
    if (!activeAuthorId || !profile || section !== "liked") {
      setLikedEntries([]);
      setLikedEntryCursor(null);
      setHasMoreLikedEntries(false);
      setLikedPaginationMode(null);
      setIsLoadingLikedEntries(false);
      setIsLoadingMoreLikedEntries(false);
      isLoadingMoreLikedEntriesRef.current = false;
      return;
    }

    setIsLoadingLikedEntries(true);
    setLikedEntryCursor(null);
    setHasMoreLikedEntries(false);
    setLikedPaginationMode(null);
    setIsLoadingMoreLikedEntries(false);
    isLoadingMoreLikedEntriesRef.current = false;
    const targetAuthorId = activeAuthorId;
    const visibleAuthorId = currentIdentity?.authorId;
    const trackedEntryIds = [...new Set(trackedLikedEntryIds)]
      .slice(-PROFILE_TRACKED_LIKE_LOOKUP_LIMIT);

    if (trackedEntryIds.length > 0) {
      setLikedEntryCursor(null);
      setHasMoreLikedEntries(false);
      setLikedPaginationMode(null);
      const chunkEntries = new Map<number, KnowledgeEntry[]>();
      const likedEntryChunks = chunkItems(trackedEntryIds, FIRESTORE_IN_QUERY_LIMIT);
      const unsubscribers = likedEntryChunks.map((entryIds, chunkIndex) =>
        onSnapshot(
          query(
            collection(db, "knowledge"),
            where(documentId(), "in", entryIds),
          ),
          (snapshot) => {
            chunkEntries.set(
              chunkIndex,
              hydrateProfileKnowledgeDocs(
                snapshot.docs,
                visibleAuthorId,
                (entry) => getTrustMetrics(entry).helpfulIds.includes(targetAuthorId),
              ),
            );

            setLikedEntries(
              sortProfileLikedEntries(
                [...chunkEntries.values()].flat(),
                trackedEntryIds,
              ).slice(0, PROFILE_TRACKED_LIKE_LOOKUP_LIMIT),
            );
            setIsLoadingLikedEntries(false);
            setProfileLoadError(null);
          },
          (error) => {
            console.error("Liked knowledge ID listener error:", error);
            setIsLoadingLikedEntries(false);
            setProfileLoadError(
              "Could not load helpful posts for this profile right now.",
            );
          },
        ),
      );

      return () => {
        unsubscribers.forEach((unsubscribe) => unsubscribe());
      };
    }

    let activeUnsubscribe: (() => void) | null = null;
    const hydrateLikedEntries = (snapshot: {
      docs: Array<QueryDocumentSnapshot<DocumentData>>;
    }) =>
      hydrateProfileKnowledgeDocs(snapshot.docs, visibleAuthorId, (entry) =>
        getTrustMetrics(entry).helpfulIds.includes(targetAuthorId),
      );

    const startFallbackLikedListener = () => {
      activeUnsubscribe = onSnapshot(
        query(
          collection(db, "knowledge"),
          where("likes", "array-contains", targetAuthorId),
          limit(PROFILE_POST_FALLBACK_PAGE_SIZE),
        ),
        (snapshot) => {
          const entries = hydrateLikedEntries(snapshot);
          setLikedEntries((currentEntries) =>
            reconcileRealtimeProfilePage(currentEntries, entries),
          );
          setLikedEntryCursor(snapshot.docs[snapshot.docs.length - 1] || null);
          setHasMoreLikedEntries(
            snapshot.docs.length === PROFILE_POST_FALLBACK_PAGE_SIZE,
          );
          setLikedPaginationMode("fallback");
          setIsLoadingLikedEntries(false);
          setProfileLoadError(null);
        },
        (error) => {
          console.error("Liked knowledge fallback listener error:", error);
          setLikedEntries([]);
          setLikedEntryCursor(null);
          setHasMoreLikedEntries(false);
          setLikedPaginationMode(null);
          setIsLoadingLikedEntries(false);
          setProfileLoadError("Could not load helpful posts for this profile right now.");
        },
      );
    };

    activeUnsubscribe = onSnapshot(
      query(
        collection(db, "knowledge"),
        where("likes", "array-contains", targetAuthorId),
        orderBy("createdAt", "desc"),
        limit(PROFILE_POST_PAGE_SIZE),
      ),
      (snapshot) => {
        const entries = hydrateLikedEntries(snapshot);
        setLikedEntries((currentEntries) =>
          reconcileRealtimeProfilePage(currentEntries, entries),
        );
        setLikedEntryCursor(snapshot.docs[snapshot.docs.length - 1] || null);
        setHasMoreLikedEntries(snapshot.docs.length === PROFILE_POST_PAGE_SIZE);
        setLikedPaginationMode("ordered");
        setIsLoadingLikedEntries(false);
        setProfileLoadError(null);
      },
      (error) => {
        if (isMissingFirestoreIndexError(error)) {
          console.warn(
            "Liked knowledge ordered listener needs an index; using limited fallback listener.",
            error,
          );
          activeUnsubscribe?.();
          startFallbackLikedListener();
          return;
        }

        console.error("Liked knowledge listener error:", error);
        setLikedEntries([]);
        setLikedEntryCursor(null);
        setHasMoreLikedEntries(false);
        setLikedPaginationMode(null);
        setIsLoadingLikedEntries(false);
        setProfileLoadError("Could not load helpful posts for this profile right now.");
      },
    );

    return () => {
      activeUnsubscribe?.();
    };
  }, [
    activeAuthorId,
    currentIdentity?.authorId,
    profile,
    section,
    trackedLikedEntryIdsKey,
  ]);

  useEffect(() => {
    if (!profile || section !== "saved") {
      setSavedEntries([]);
      setSavedQuestions([]);
      setIsLoadingSavedItems(false);
      return;
    }

    let cancelled = false;
    const visibleAuthorId = currentIdentity?.authorId;
    const knowledgeIds = [...new Set(savedKnowledgeIds)].slice(
      -PROFILE_TRACKED_LIKE_LOOKUP_LIMIT,
    );
    const smartTalkIds = [...new Set(savedSmartTalkIds)].slice(
      -PROFILE_TRACKED_LIKE_LOOKUP_LIMIT,
    );

    if (knowledgeIds.length === 0 && smartTalkIds.length === 0) {
      setSavedEntries([]);
      setSavedQuestions([]);
      setIsLoadingSavedItems(false);
      return;
    }

    setIsLoadingSavedItems(true);

    const loadSavedItems = async () => {
      try {
        const [knowledgeChunks, smartTalkChunks] = await Promise.all([
          Promise.all(
            chunkItems(knowledgeIds, FIRESTORE_IN_QUERY_LIMIT).map((entryIds) =>
              getDocs(
                query(
                  collection(db, "knowledge"),
                  where(documentId(), "in", entryIds),
                ),
              ),
            ),
          ),
          Promise.all(
            chunkItems(smartTalkIds, FIRESTORE_IN_QUERY_LIMIT).map((questionIds) =>
              getDocs(
                query(
                  collection(db, "smarttalk"),
                  where(documentId(), "in", questionIds),
                ),
              ),
            ),
          ),
        ]);

        if (cancelled) return;

        const knowledgeOrder = new Map(
          knowledgeIds.map((entryId, index) => [entryId, index] as const),
        );
        const smartTalkOrder = new Map(
          smartTalkIds.map((questionId, index) => [questionId, index] as const),
        );

        setSavedEntries(
          knowledgeChunks
            .flatMap((snapshot) =>
              hydrateProfileKnowledgeDocs(snapshot.docs, visibleAuthorId),
            )
            .sort(
              (left, right) =>
                (knowledgeOrder.get(right.id) ?? -1) -
                (knowledgeOrder.get(left.id) ?? -1),
            ),
        );
        setSavedQuestions(
          smartTalkChunks
            .flatMap((snapshot) =>
              snapshot.docs.map((item) => hydrateSavedSmartTalkQuestion(item)),
            )
            .sort(
              (left, right) =>
                (smartTalkOrder.get(right.id) ?? -1) -
                (smartTalkOrder.get(left.id) ?? -1),
            ),
        );
        setProfileLoadError(null);
      } catch (error) {
        console.error("Saved profile items failed:", error);
        if (!cancelled) {
          setSavedEntries([]);
          setSavedQuestions([]);
          setProfileLoadError("Could not load saved items right now.");
        }
      } finally {
        if (!cancelled) setIsLoadingSavedItems(false);
      }
    };

    void loadSavedItems();

    return () => {
      cancelled = true;
    };
  }, [
    currentIdentity?.authorId,
    profile,
    savedKnowledgeIdsKey,
    savedSmartTalkIdsKey,
    section,
  ]);

  const loadMoreSharedEntries = useCallback(async () => {
    const requestedAuthorId = activeAuthorId;
    const requestedVisibleAuthorId = currentIdentity?.authorId;
    const cursor = sharedEntryCursor;
    const paginationMode = sharedPaginationMode;

    if (
      !requestedAuthorId ||
      !cursor ||
      !paginationMode ||
      isLoadingMoreSharedEntriesRef.current
    ) {
      return;
    }

    isLoadingMoreSharedEntriesRef.current = true;
    setIsLoadingMoreSharedEntries(true);

    try {
      const pageSize =
        paginationMode === "ordered"
          ? PROFILE_POST_PAGE_SIZE
          : PROFILE_POST_FALLBACK_PAGE_SIZE;
      const pageQuery =
        paginationMode === "ordered"
          ? query(
              collection(db, "knowledge"),
              where("authorId", "==", requestedAuthorId),
              orderBy("createdAt", "desc"),
              startAfter(cursor),
              limit(pageSize),
            )
          : query(
              collection(db, "knowledge"),
              where("authorId", "==", requestedAuthorId),
              startAfter(cursor),
              limit(pageSize),
            );
      const snapshot = await getDocs(pageQuery);

      if (
        activeAuthorIdRef.current !== requestedAuthorId ||
        visibleAuthorIdRef.current !== requestedVisibleAuthorId
      ) {
        return;
      }

      const entries = hydrateProfileKnowledgeDocs(
        snapshot.docs,
        requestedVisibleAuthorId,
      );

      setSharedEntries((currentEntries) =>
        mergeProfileKnowledgeEntries(currentEntries, entries),
      );
      setSharedEntryCursor(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMoreSharedEntries(snapshot.docs.length === pageSize);
      setProfileLoadError(null);
    } catch (error) {
      if (
        activeAuthorIdRef.current === requestedAuthorId &&
        visibleAuthorIdRef.current === requestedVisibleAuthorId
      ) {
        console.error("Shared knowledge pagination error:", error);
        setHasMoreSharedEntries(false);
        setProfileLoadError("Could not load more shared posts right now.");
      }
    } finally {
      isLoadingMoreSharedEntriesRef.current = false;
      if (
        activeAuthorIdRef.current === requestedAuthorId &&
        visibleAuthorIdRef.current === requestedVisibleAuthorId
      ) {
        setIsLoadingMoreSharedEntries(false);
      }
    }
  }, [
    activeAuthorId,
    currentIdentity?.authorId,
    sharedEntryCursor,
    sharedPaginationMode,
  ]);

  const loadMoreLikedEntries = useCallback(async () => {
    const requestedAuthorId = activeAuthorId;
    const requestedVisibleAuthorId = currentIdentity?.authorId;
    const cursor = likedEntryCursor;
    const paginationMode = likedPaginationMode;

    if (
      !requestedAuthorId ||
      trackedLikedEntryIds.length > 0 ||
      !cursor ||
      !paginationMode ||
      isLoadingMoreLikedEntriesRef.current
    ) {
      return;
    }

    isLoadingMoreLikedEntriesRef.current = true;
    setIsLoadingMoreLikedEntries(true);

    try {
      const pageSize =
        paginationMode === "ordered"
          ? PROFILE_POST_PAGE_SIZE
          : PROFILE_POST_FALLBACK_PAGE_SIZE;
      const pageQuery =
        paginationMode === "ordered"
          ? query(
              collection(db, "knowledge"),
              where("likes", "array-contains", requestedAuthorId),
              orderBy("createdAt", "desc"),
              startAfter(cursor),
              limit(pageSize),
            )
          : query(
              collection(db, "knowledge"),
              where("likes", "array-contains", requestedAuthorId),
              startAfter(cursor),
              limit(pageSize),
            );
      const snapshot = await getDocs(pageQuery);

      if (
        activeAuthorIdRef.current !== requestedAuthorId ||
        visibleAuthorIdRef.current !== requestedVisibleAuthorId
      ) {
        return;
      }

      const entries = hydrateProfileKnowledgeDocs(
        snapshot.docs,
        requestedVisibleAuthorId,
        (entry) => getTrustMetrics(entry).helpfulIds.includes(requestedAuthorId),
      );

      setLikedEntries((currentEntries) =>
        mergeProfileKnowledgeEntries(currentEntries, entries),
      );
      setLikedEntryCursor(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMoreLikedEntries(snapshot.docs.length === pageSize);
      setProfileLoadError(null);
    } catch (error) {
      if (
        activeAuthorIdRef.current === requestedAuthorId &&
        visibleAuthorIdRef.current === requestedVisibleAuthorId
      ) {
        console.error("Liked knowledge pagination error:", error);
        setHasMoreLikedEntries(false);
        setProfileLoadError("Could not load more helpful posts right now.");
      }
    } finally {
      isLoadingMoreLikedEntriesRef.current = false;
      if (
        activeAuthorIdRef.current === requestedAuthorId &&
        visibleAuthorIdRef.current === requestedVisibleAuthorId
      ) {
        setIsLoadingMoreLikedEntries(false);
      }
    }
  }, [
    activeAuthorId,
    currentIdentity?.authorId,
    likedEntryCursor,
    likedPaginationMode,
    trackedLikedEntryIds.length,
  ]);

  const handleClaimIdentity = async () => {
    const nextIdentity = await signInWithGoogleAccount();
    onIdentityChange(nextIdentity);
    setShowIdentityPrompt(false);
  };

  const handleSaveProfileSettings = async ({
    displayName,
    username,
    jobTitle,
    bio,
    socialLinks,
    showSocialLinksOnPosts,
  }: {
    displayName: string;
    username: string;
    jobTitle: string;
    bio: string;
    socialLinks: UserSocialLinks;
    showSocialLinksOnPosts: boolean;
  }) => {
    if (!profile || !isOwnProfile) return;

    setIsSavingProfile(true);
    setProfileEditError(null);

    try {
      let updatedProfile = await updateProfileDetails(profile, {
        displayName,
        jobTitle,
        bio,
        socialLinks,
        showSocialLinksOnPosts,
      });

      if (username.trim().toLowerCase() !== profile.usernameLower) {
        updatedProfile = await changeProfileUsername(updatedProfile, username);
        onIdentityChange({
          displayName: updatedProfile.username,
          authorId: updatedProfile.id,
        });
      }

      setProfile(updatedProfile);
      setShowEditProfile(false);
    } catch (error) {
      setProfileEditError(
        error instanceof Error
          ? error.message
          : "Could not save profile changes right now.",
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangeAvatar = async (nextProfileImage: KnowledgeImageAsset) => {
    if (!profile || !isOwnProfile) return;

    setAvatarSaveError(null);
    setIsSavingAvatar(true);

    try {
      const updatedProfile = await changeProfilePhoto(profile, nextProfileImage);
      setProfile(updatedProfile);
      setShowAvatarPicker(false);
    } catch (error) {
      console.error("Failed to save avatar:", error);
      setAvatarSaveError(
        error instanceof Error
          ? error.message
          : "Could not save your profile picture right now."
      );
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleChangeBanner = async (nextBannerImage: KnowledgeImageAsset) => {
    if (!profile || !isOwnProfile) return;

    setBannerSaveError(null);
    setIsSavingBanner(true);

    try {
      const updatedProfile = await changeProfileBanner(profile, nextBannerImage);
      setProfile(updatedProfile);
      setShowBannerPicker(false);
    } catch (error) {
      console.error("Failed to save banner:", error);
      setBannerSaveError(
        error instanceof Error
          ? error.message
          : "Could not save your banner photo right now.",
      );
    } finally {
      setIsSavingBanner(false);
    }
  };

  const handleGoogleSignInForPendingAction = async () => {
    if (!pendingAction) return;

    const nextIdentity = await signInWithGoogleAccount();
    onIdentityChange(nextIdentity);

    window.dispatchEvent(
      new CustomEvent("knowledge-action", {
        detail: {
          ...pendingAction,
          username: nextIdentity.displayName,
          authorId: nextIdentity.authorId,
        },
      })
    );
    setPendingAction(null);
  };

  if (!currentIdentity && !viewedAuthorId) {
    return (
      <div className="space-y-6 pb-20">
        <SEO
          title="Profile | Readative"
          description="Sign in with Google to unlock your Readative profile, posts, and helpful feedback."
          robots="noindex"
        />

        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-slate-950 px-6 py-7 text-white">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-emerald-300">
              <ReadativeRMark className="h-7 w-7 text-2xl tracking-tight" />
            </div>
            <h2 className="text-3xl font-black tracking-normal">
              Build your Readative profile
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
              Sign in with Google to create posts, save knowledge, join SmartTalk,
              and build reputation from helpful contributions.
            </p>
          </div>
          <div className="grid gap-3 px-5 py-5 sm:grid-cols-2">
            {[
              {
                label: "Create posts",
                detail: "Publish knowledge under a durable profile.",
                icon: BookOpenText,
              },
              {
                label: "Save knowledge",
                detail: "Keep useful posts connected to your account.",
                icon: Save,
              },
              {
                label: "Join SmartTalk",
                detail: "Answer questions and continue discussions.",
                icon: MessageSquareReply,
              },
              {
                label: "Build reputation",
                detail: "Earn trust from helpful community signals.",
                icon: Award,
              },
            ].map((benefit) => {
              const BenefitIcon = benefit.icon;

              return (
                <div
                  key={benefit.label}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <BenefitIcon className="h-5 w-5 text-emerald-700" />
                  <p className="mt-3 text-sm font-black text-slate-950">
                    {benefit.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {benefit.detail}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="border-t border-slate-100 px-5 py-5">
            <button
              onClick={() => setShowIdentityPrompt(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
            >
              <ShieldCheck className="h-4 w-4" />
              Continue with Google
            </button>
          </div>
        </div>

        {showIdentityPrompt && (
          <GoogleSignInPrompt
            title="Sign in to view your profile"
            submitLabel="Continue with Google"
            onConfirm={handleClaimIdentity}
            onClose={() => setShowIdentityPrompt(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <SEO
        title={profile ? `${profileDisplayName} | Readative` : "Profile | Readative"}
        description="Explore user profiles, shared knowledge, and helpful posts on Readative."
        type="profile"
        url={profileUrl}
        schema={profileSchema}
        robots={!isLoadingProfile && !profile ? "noindex" : "index"}
      />

      {profileLoadError && (
        <ProfileNotice
          title="Profile loading issue"
          body={profileLoadError}
        />
      )}

      {directoryLoadError && (
        <ProfileNotice
          title="Profile directory issue"
          body={directoryLoadError}
        />
      )}

      {isLoadingProfile ? (
        <ProfileSkeleton />
      ) : !profile ? (
        <div className="rounded-[30px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
          <User className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-4 text-xl font-black text-slate-900">
            Profile not found
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            This user profile does not exist yet.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <div className="relative h-36 bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_48%,#2563eb_100%)] sm:h-44">
              {profile.bannerImage && (
                <img
                  src={profile.bannerImage.dataUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              )}
            </div>

            <div className="px-5 pb-5 sm:px-6 sm:pb-6">
              <div className="-mt-12 flex flex-wrap items-end justify-between gap-3 sm:-mt-14">
                <div
                  className="relative rounded-[30px] p-1 shadow-[0_14px_36px_rgba(15,23,42,0.16)]"
                  style={{
                    background: `conic-gradient(${getProfileTrustColor(
                      profileTrustInsights?.communityTrustPercent || 75,
                    )} ${(profileTrustInsights?.communityTrustPercent || 75) * 3.6}deg, #e2e8f0 0deg)`,
                  }}
                >
                  <div className="rounded-[26px] bg-white p-1">
                    <ProfileAvatar
                      authorId={profile.id}
                      image={profile.profileImage}
                      photoUrl={profile.photoUrl}
                      username={profileDisplayName}
                      size="xl"
                      className="border-slate-200 bg-white"
                    />
                  </div>
                  {profileTrustInsights && (
                    <span className="absolute -bottom-1 -right-1 inline-flex h-8 w-8 items-center justify-center rounded-full border-4 border-white bg-slate-950 text-white shadow-sm">
                      <Award className="h-4 w-4" />
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                    {isOwnProfile ? "Your Profile" : "Community Profile"}
                  </span>
                  {profileTrustInsights && (
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-emerald-600 shadow-sm"
                      title={`${profileTrustInsights.contributorLevel}: ${profileTrustInsights.trustScore.toLocaleString()} trust score`}
                      aria-label={`${profileTrustInsights.contributorLevel}: ${profileTrustInsights.trustScore.toLocaleString()} trust score`}
                    >
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    </span>
                  )}
                  {isOwnProfile && (
                    <button
                      onClick={() => {
                        setProfileEditError(null);
                        setShowEditProfile(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="break-words text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                    {profileDisplayName}
                  </h2>
                  <ProfileSocialLinks
                    socialLinks={profile.socialLinks}
                    compact
                    className="pt-1"
                  />
                </div>

                <p className="mt-1 text-sm font-semibold text-slate-500">
                  @{profile.username}
                </p>

                {profile.jobTitle && (
                  <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-slate-800">
                    {profile.jobTitle}
                  </p>
                )}

                {profile.bio && (
                  <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {profile.bio}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400">
                  <span>Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
                  {isOwnProfile && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatCooldown(usernameCooldown)}
                    </span>
                  )}
                </div>
              </div>

              {profileTrustInsights && (
                <>
                  <ProfileTrustOverview
                    insights={profileTrustInsights}
                    expertiseTags={expertiseTags}
                  />
                  <ProfileDiscoveryHighlights
                    expertiseTags={expertiseTags}
                    recentItems={recentContributionItems}
                    mostHelpfulPost={mostHelpfulPost}
                    bestAnswer={smartTalkSummary.bestAnswer}
                    onOpenEntry={onOpenEntry}
                  />
                </>
              )}
            </div>
          </div>

          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
            <SectionButton
              active={section === "shared"}
              onClick={() => setSection("shared")}
              label="Posts"
              count={hasMoreSharedEntries ? `${sharedEntries.length}+` : sharedEntries.length}
            />
            <SectionButton
              active={section === "activity"}
              onClick={() => setSection("activity")}
              label="Activity"
              count={activityTimeline.length}
            />
            <SectionButton
              active={section === "saved"}
              onClick={() => setSection("saved")}
              label="Saved"
              count={savedItemCount}
            />
            {isOwnProfile && (
              <SectionButton
                active={section === "highlights"}
                onClick={() => setSection("highlights")}
                label="Highlights"
                count={highlights.length}
              />
            )}
          </div>

          {section === "shared" && (
            <KnowledgeSection
              title={
                isOwnProfile
                  ? "Your shared knowledge"
                  : `${profileDisplayName}'s shared knowledge`
              }
              emptyMessage="No shared knowledge yet."
              entries={sharedEntries}
              isLoading={isLoadingSharedEntries}
              hasMore={hasMoreSharedEntries}
              isLoadingMore={isLoadingMoreSharedEntries}
              onLoadMore={loadMoreSharedEntries}
              currentIdentity={currentIdentity}
              profiles={profiles}
              onIdentityRequired={handleIdentityRequired}
              onOpenProfile={onOpenProfile}
              onOpenEntry={onOpenEntry}
            />
          )}

          {section === "activity" && (
            <ProfileActivityTimeline
              items={activityTimeline}
              isLoading={isLoadingSharedEntries}
            />
          )}

          {section === "saved" && (
            <ProfileSavedSection
              entries={savedEntries}
              questions={savedQuestions}
              isLoading={isLoadingSavedItems}
              currentIdentity={currentIdentity}
              profiles={profiles}
              onIdentityRequired={handleIdentityRequired}
              onOpenProfile={onOpenProfile}
              onOpenEntry={onOpenEntry}
            />
          )}

          {section === "highlights" && isOwnProfile && (
            <ProfileHighlights />
          )}
        </>
      )}

      {showIdentityPrompt && (
        <GoogleSignInPrompt
          title="Continue with Google"
          submitLabel="Continue with Google"
          onConfirm={handleClaimIdentity}
          onClose={() => setShowIdentityPrompt(false)}
        />
      )}

      {showEditProfile && profile && (
        <EditProfileModal
          profile={profile}
          usernameCooldown={usernameCooldown}
          isSaving={isSavingProfile}
          errorMessage={profileEditError}
          onChangePhoto={() => {
            setAvatarSaveError(null);
            setShowAvatarPicker(true);
          }}
          onChangeBanner={() => {
            setBannerSaveError(null);
            setShowBannerPicker(true);
          }}
          onSave={handleSaveProfileSettings}
          onClose={() => {
            if (isSavingProfile) return;
            setProfileEditError(null);
            setShowEditProfile(false);
          }}
        />
      )}

      {showAvatarPicker && profile && (
        <ProfileAvatarPicker
          currentImage={profile.profileImage}
          username={profileDisplayName || profile.username}
          isSaving={isSavingAvatar}
          errorMessage={avatarSaveError}
          onSave={handleChangeAvatar}
          onClose={() => {
            if (isSavingAvatar) return;
            setAvatarSaveError(null);
            setShowAvatarPicker(false);
          }}
        />
      )}

      {showBannerPicker && profile && (
        <ProfileAvatarPicker
          currentImage={profile.bannerImage}
          username={profileDisplayName || profile.username}
          variant="banner"
          isSaving={isSavingBanner}
          errorMessage={bannerSaveError}
          onSave={handleChangeBanner}
          onClose={() => {
            if (isSavingBanner) return;
            setBannerSaveError(null);
            setShowBannerPicker(false);
          }}
        />
      )}

      {pendingAction && (
        <GoogleSignInPrompt
          title={
            pendingAction.type === "helpful"
              ? "Sign in to mark helpful"
              : pendingAction.type === "misleading"
                ? "Sign in to mark misleading"
                : pendingAction.type === "save"
                  ? "Sign in to save"
                  : "Sign in to comment"
          }
          description="Use your Google account so this activity is saved to your profile on every browser and device."
          submitLabel="Continue with Google"
          onConfirm={handleGoogleSignInForPendingAction}
          onClose={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}

function EditProfileModal({
  profile,
  usernameCooldown,
  isSaving,
  errorMessage,
  onChangePhoto,
  onChangeBanner,
  onSave,
  onClose,
}: {
  profile: UserProfile;
  usernameCooldown: number;
  isSaving: boolean;
  errorMessage: string | null;
  onChangePhoto: () => void;
  onChangeBanner: () => void;
  onSave: (input: {
    displayName: string;
    username: string;
    jobTitle: string;
    bio: string;
    socialLinks: UserSocialLinks;
    showSocialLinksOnPosts: boolean;
  }) => void | Promise<void>;
  onClose: () => void;
}) {
  const [displayName, setDisplayName] = useState(getProfileDisplayName(profile));
  const [username, setUsername] = useState(profile.username);
  const [jobTitle, setJobTitle] = useState(profile.jobTitle || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [linkedin, setLinkedin] = useState(profile.socialLinks.linkedin || "");
  const [instagram, setInstagram] = useState(
    profile.socialLinks.instagram || "",
  );
  const [github, setGithub] = useState(profile.socialLinks.github || "");
  const [twitter, setTwitter] = useState(profile.socialLinks.twitter || "");
  const [website, setWebsite] = useState(profile.socialLinks.website || "");
  const [youtube, setYoutube] = useState(profile.socialLinks.youtube || "");
  const [showSocialLinksOnPosts, setShowSocialLinksOnPosts] = useState(
    profile.showSocialLinksOnPosts,
  );

  const handleSave = () => {
    void onSave({
      displayName,
      username,
      jobTitle,
      bio,
      socialLinks: {
        linkedin,
        instagram,
        github,
        twitter,
        website,
        youtube,
      },
      showSocialLinksOnPosts,
    });
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center overflow-y-auto bg-slate-950/35 p-3 pt-16 backdrop-blur-sm sm:p-4 sm:pt-20">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.2)]">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Close edit profile"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
            Edit Profile
          </p>
          <h2 className="mt-1 pr-10 text-2xl font-black tracking-tight text-slate-950">
            Profile settings
          </h2>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <div className="relative h-24 bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_48%,#2563eb_100%)]">
              {profile.bannerImage && (
                <img
                  src={profile.bannerImage.dataUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
              <button
                type="button"
                onClick={onChangeBanner}
                disabled={isSaving}
                className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-xs font-bold text-slate-800 shadow-sm transition-colors hover:bg-white disabled:opacity-50"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                Banner
              </button>
            </div>

            <div className="-mt-9 flex items-end gap-4 px-4 pb-4">
              <ProfileAvatar
                authorId={profile.id}
                image={profile.profileImage}
                photoUrl={profile.photoUrl}
                username={displayName}
                size="lg"
                className="border-slate-200 bg-white ring-4 ring-white"
              />
              <div className="min-w-0 flex-1 pb-1">
                <p className="truncate text-sm font-bold text-slate-900">
                  {displayName || profile.username}
                </p>
                <p className="text-xs font-semibold text-slate-500">
                  @{profile.username}
                </p>
              </div>
              <button
                type="button"
                onClick={onChangePhoto}
                disabled={isSaving}
                className="mb-1 inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                Photo
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
              label="Name"
              value={displayName}
              onChange={setDisplayName}
              placeholder="Your public name"
            />
            <div>
              <TextInput
                label="Username"
                value={username}
                onChange={setUsername}
                placeholder="username"
              />
              <p className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                <Clock3 className="h-4 w-4" />
                {formatCooldown(usernameCooldown)}
              </p>
            </div>
          </div>

          <TextInput
            label="Job title / headline"
            value={jobTitle}
            onChange={setJobTitle}
            placeholder="Founder, Product Designer, Student..."
          />

          <div>
            <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="A short intro for your profile"
              maxLength={220}
              className="mt-2 min-h-[92px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <p className="mt-1 text-right text-[11px] font-semibold text-slate-400">
              {bio.length}/220
            </p>
          </div>

          <div className="grid gap-3">
            <SocialInput
              icon={<Linkedin className="h-4 w-4" />}
              label="LinkedIn"
              value={linkedin}
              onChange={setLinkedin}
              placeholder="https://www.linkedin.com/in/username"
            />
            <SocialInput
              icon={<Instagram className="h-4 w-4" />}
              label="Instagram"
              value={instagram}
              onChange={setInstagram}
              placeholder="https://www.instagram.com/username"
            />
            <SocialInput
              icon={<Github className="h-4 w-4" />}
              label="GitHub"
              value={github}
              onChange={setGithub}
              placeholder="https://github.com/username"
            />
            <SocialInput
              icon={<span className="text-sm font-black">X</span>}
              label="X / Twitter"
              value={twitter}
              onChange={setTwitter}
              placeholder="https://x.com/username"
            />
            <SocialInput
              icon={<Globe className="h-4 w-4" />}
              label="Website"
              value={website}
              onChange={setWebsite}
              placeholder="https://yourdomain.com"
            />
            <SocialInput
              icon={<Youtube className="h-4 w-4" />}
              label="YouTube"
              value={youtube}
              onChange={setYoutube}
              placeholder="https://www.youtube.com/@channel"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              type="checkbox"
              checked={showSocialLinksOnPosts}
              onChange={(event) => setShowSocialLinksOnPosts(event.target.checked)}
              className="sr-only"
            />
            <span
              className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                showSocialLinksOnPosts
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-slate-300 bg-white text-transparent"
              }`}
            >
              <Check className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-slate-900">
                Show social buttons on my posts
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                When checked, readers can open your added social links directly
                from your post cards on Home.
              </span>
            </span>
          </label>

          {errorMessage && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {errorMessage}
            </p>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={handleSave}
            disabled={
              isSaving ||
              username.trim().length < 3 ||
              displayName.trim().length < 2
            }
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 sm:w-auto"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function SocialInput({
  icon,
  label,
  value,
  onChange,
  placeholder,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
        {icon}
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-slate-700 outline-none"
      />
    </label>
  );
}

function ProfileTrustOverview({
  insights,
  expertiseTags,
}: {
  insights: ProfileTrustInsights;
  expertiseTags: string[];
}) {
  const contributorTitle = `${insights.contributorLevel}: ${insights.trustScore.toLocaleString()} trust score`;
  const compactStats = [
    ["Trust Score", insights.trustScore.toLocaleString()],
    ["Helpful", insights.helpfulReceived.toLocaleString()],
    ["Posts", insights.postsCreated.toLocaleString()],
    ["SmartTalk", insights.smartTalkAnswers.toLocaleString()],
    ["Trust", `${insights.communityTrustPercent}%`],
  ];

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm"
          title={contributorTitle}
          aria-label={contributorTitle}
        >
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
        </span>
        {compactStats.map(([label, value]) => (
          <span
            key={label}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600"
          >
            <span className="text-slate-400">{label}</span>
            <span className="text-slate-950">{value}</span>
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
          <Tags className="h-3.5 w-3.5" />
          Topics
        </span>
        {expertiseTags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700"
          >
            <Sparkles className="h-3 w-3" />
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function ProfileDiscoveryHighlights({
  expertiseTags,
  recentItems,
  mostHelpfulPost,
  bestAnswer,
  onOpenEntry,
}: {
  expertiseTags: string[];
  recentItems: ProfileActivityItem[];
  mostHelpfulPost: KnowledgeEntry | null;
  bestAnswer: ProfileActivityItem | null;
  onOpenEntry: (entryId: string) => void;
}) {
  const helpfulMetrics = mostHelpfulPost ? getTrustMetrics(mostHelpfulPost) : null;

  return (
    <section className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
        <Sparkles className="h-3.5 w-3.5 text-sky-600" />
        Discovery
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 px-3 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
            Top Topics
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {expertiseTags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-indigo-700 shadow-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (mostHelpfulPost) onOpenEntry(mostHelpfulPost.id);
          }}
          disabled={!mostHelpfulPost}
          className="rounded-xl bg-slate-50 px-3 py-3 text-left transition-colors hover:bg-emerald-50 disabled:cursor-default disabled:hover:bg-slate-50"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
            Most Helpful Post
          </p>
          <p className="mt-2 line-clamp-2 text-sm font-black leading-5 text-slate-950">
            {mostHelpfulPost?.title || "No posts yet"}
          </p>
          {helpfulMetrics && (
            <p className="mt-1 text-[11px] font-bold text-slate-500">
              {helpfulMetrics.helpfulCount} helpful / {helpfulMetrics.communityTrustPercent}% trust
            </p>
          )}
        </button>

        <div className="rounded-xl bg-slate-50 px-3 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
            Recent Contributions
          </p>
          <div className="mt-2 space-y-1.5">
            {recentItems.length > 0 ? (
              recentItems.map((item) => (
                <p
                  key={item.id}
                  className="line-clamp-1 text-xs font-bold text-slate-700"
                >
                  {item.detail}
                </p>
              ))
            ) : (
              <p className="text-xs font-bold text-slate-400">
                No recent contributions yet
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 px-3 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
            Best SmartTalk Answer
          </p>
          <p className="mt-2 line-clamp-2 text-sm font-black leading-5 text-slate-950">
            {bestAnswer?.detail || "No best answer yet"}
          </p>
          {bestAnswer && (
            <p className="mt-1 text-[11px] font-bold text-slate-500">
              {new Date(bestAnswer.createdAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function ProfileActivityTimeline({
  items,
  isLoading,
}: {
  items: ProfileActivityItem[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm">
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex gap-3">
              <span className="h-8 w-8 animate-pulse rounded-full bg-slate-100" />
              <span className="h-12 flex-1 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center shadow-sm">
        <Clock3 className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm font-semibold text-slate-500">
          Activity will appear as this contributor posts, answers, and earns trust.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="space-y-1">
        {items.map((item, index) => (
          <div key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
            {index < items.length - 1 && (
              <span className="absolute left-4 top-9 h-[calc(100%-2rem)] w-px bg-slate-200" />
            )}
            <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600">
              <ProfileActivityIcon type={item.type} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-black text-slate-950">{item.title}</p>
                <span className="text-[11px] font-semibold text-slate-400">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">
                {item.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileActivityIcon({ type }: { type: ProfileActivityType }) {
  if (type === "post") return <BookOpenText className="h-4 w-4" />;
  if (type === "answer") return <MessageSquareReply className="h-4 w-4" />;
  if (type === "comment") return <MessageCircle className="h-4 w-4" />;
  if (type === "helpful") return <ThumbsUp className="h-4 w-4" />;
  if (type === "trust") return <TrendingUp className="h-4 w-4" />;
  return <Award className="h-4 w-4" />;
}

function ProfileSavedSection({
  entries,
  questions,
  isLoading,
  currentIdentity,
  profiles,
  onIdentityRequired,
  onOpenProfile,
  onOpenEntry,
}: {
  entries: KnowledgeEntry[];
  questions: SmartQuestion[];
  isLoading: boolean;
  currentIdentity: KnowledgeIdentity | null;
  profiles: UserProfile[];
  onIdentityRequired: (action: KnowledgePendingAction) => void;
  onOpenProfile: (authorId: string) => void;
  onOpenEntry: (entryId: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm">
        <div className="space-y-3" aria-busy="true" aria-live="polite">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (entries.length === 0 && questions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center shadow-sm">
        <Save className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm font-semibold text-slate-500">
          Saved posts and SmartTalk discussions will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {questions.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
            <MessageSquareReply className="h-4 w-4 text-indigo-600" />
            Saved SmartTalk
          </div>
          <div className="space-y-2">
            {questions.map((question) => (
              <button
                key={question.id}
                type="button"
                onClick={() => navigateToRoute("smarttalk")}
                className="w-full rounded-xl bg-slate-50 px-3 py-3 text-left transition-colors hover:bg-indigo-50"
              >
                <p className="line-clamp-2 text-sm font-black leading-5 text-slate-950">
                  {question.content}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-400">
                  <span>{question.answers.length} answers</span>
                  {question.category && (
                    <>
                      <span>/</span>
                      <span className="capitalize">{question.category}</span>
                    </>
                  )}
                  {question.difficulty && (
                    <>
                      <span>/</span>
                      <span className="capitalize">{question.difficulty}</span>
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {entries.length > 0 && (
        <KnowledgeSection
          title="Saved posts"
          emptyMessage="No saved posts yet."
          entries={entries}
          isLoading={false}
          currentIdentity={currentIdentity}
          profiles={profiles}
          onIdentityRequired={onIdentityRequired}
          onOpenProfile={onOpenProfile}
          onOpenEntry={onOpenEntry}
        />
      )}
    </div>
  );
}

function SectionButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number | string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-2 text-xs font-bold transition-all ${
        active
          ? "bg-slate-900 text-white"
          : "text-slate-500 hover:bg-slate-100"
      }`}
    >
      {label} <span className={active ? "text-white/80" : "text-slate-400"}>({count})</span>
    </button>
  );
}

function KnowledgeSection({
  title,
  emptyMessage,
  entries,
  isLoading,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  currentIdentity,
  profiles,
  onIdentityRequired,
  onOpenProfile,
  onOpenEntry,
}: {
  title: string;
  emptyMessage: string;
  entries: KnowledgeEntry[];
  isLoading: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  currentIdentity: KnowledgeIdentity | null;
  profiles: UserProfile[];
  onIdentityRequired: (action: KnowledgePendingAction) => void;
  onOpenProfile: (authorId: string) => void;
  onOpenEntry: (entryId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
          <BookOpenText className="h-5 w-5 text-emerald-600" />
          {title}
        </h3>
      </div>

      {isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          <KnowledgeCardSkeleton compact />
          <KnowledgeCardSkeleton showImage={false} compact />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
          <ThumbsUp className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm text-slate-400">{emptyMessage}</p>
        </div>
      ) : (
        <>
          <KnowledgeCardList
            entries={entries}
            currentIdentity={currentIdentity}
            profiles={profiles}
            onIdentityRequired={onIdentityRequired}
            onOpenProfile={onOpenProfile}
            onOpenEntry={onOpenEntry}
          />

          {hasMore && onLoadMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-wait disabled:opacity-60"
              >
                {isLoadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProfileNotice({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 shadow-sm">
      <p className="font-bold">{title}</p>
      <p className="mt-1 leading-6">{body}</p>
    </div>
  );
}
