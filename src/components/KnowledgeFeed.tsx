import {
  type ChangeEvent,
  useDeferredValue,
  type KeyboardEvent,
  type ComponentType,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BookOpenText,
  Bot,
  Code2,
  Flame,
  Globe2,
  ImagePlus,
  Lock,
  Megaphone,
  Palette,
  Rocket,
  Send,
  Smartphone,
  Tag,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  startAfter,
  where,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import {
  KnowledgeComment,
  KnowledgeEntry,
  KnowledgeImageAsset,
  KnowledgeImageLayout,
  KnowledgeVisibility,
  UserProfile,
} from "../types";
import { SEO } from "./SEO";
import { GoogleSignInPrompt } from "./Auth";
import { KnowledgeCardList } from "./KnowledgeCardList";
import { KnowledgeImageCarousel } from "./KnowledgeImageCarousel";
import { DiscoverySearch } from "./DiscoverySearch";
import { ReadativeLoader, ReadativeRMark } from "./ReadativeLoader";
import { type KnowledgeIdentity } from "../utils/knowledgeIdentity";
import { hydrateUserProfile } from "../utils/profileData";
import { signInWithGoogleAccount } from "../utils/googleAuth";
import {
  buildAbsoluteRouteUrl,
  navigateToRoute,
  parseRouteFromLocation,
  ROUTE_CHANGE_EVENT,
} from "../utils/routes";
import {
  getKnowledgeFeedSnapshot,
  markKnowledgeEntrySeen,
  reconcileKnowledgeFeedOrder,
  rankKnowledgeEntries,
} from "../utils/feedPersonalization";
import { getGuestId } from "../utils/guestIdentity";
import {
  getKnowledgeEntryImageLayout,
  getKnowledgeEntryImages,
  getKnowledgeImageLayoutSettings,
} from "../utils/knowledgeImages";
import {
  canViewKnowledgeEntry,
  normalizeKnowledgeVisibility,
} from "../utils/knowledgePrivacy";
import {
  createExcerpt,
  estimateReadMinutes,
  extractInlineHashtags,
  mergeHashtags,
  parseManualHashtags,
  resolveMentions,
} from "../utils/knowledgeEntryHelpers";

type PendingAction = { type: "like" | "comment"; entryId: string } | null;

const DEFAULT_IMAGE_LAYOUT: KnowledgeImageLayout = "wide";
const MAX_TOTAL_INLINE_IMAGE_CHARS = 760_000;
const FEED_PAGE_SIZE = 10;
const FEED_LOAD_TIMEOUT_MS = 9000;
const FEED_BACKGROUND_PAGE_DELAY_MS = 1200;
const FEED_BACKGROUND_PREFETCH_PAGE_LIMIT = 1;
const FEED_CACHE_STORAGE_WRITE_TIMEOUT_MS = 1800;
const FEED_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FEED_CACHE_MEMORY_ENTRY_LIMIT = 120;
const FEED_CACHE_STORAGE_ENTRY_LIMIT = 32;
const FEED_CACHE_STORAGE_IMAGE_CHAR_BUDGET = 900_000;
const FEED_CACHE_KEY_PREFIX = "readativeKnowledgeFeedCache:v2";
const FEED_CACHE_LEGACY_KEY_PREFIXES = ["readativeKnowledgeFeedCache:v1"];
const PROFILE_DIRECTORY_IDLE_TIMEOUT_MS = 2600;
const PROFILE_DIRECTORY_LIMIT = 80;
const TRENDING_FEED_LIMIT = 12;
const TRENDING_FEED_PAGE_SIZE = 18;
const TOPIC_FEED_PAGE_SIZE = 18;
const FIRESTORE_ARRAY_CONTAINS_ANY_LIMIT = 30;

type FeedTopicId =
  | "all"
  | "trending"
  | "ai"
  | "apps"
  | "productivity"
  | "marketing"
  | "software"
  | "tools"
  | "startups"
  | "design"
  | "learning";

interface FeedTopicFilter {
  id: FeedTopicId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  keywords: string[];
}

function ReadativeTopicIcon({ className = "" }: { className?: string }) {
  return (
    <ReadativeRMark
      className={`${className} text-[11px] tracking-tight text-current`}
    />
  );
}

const FEED_TOPIC_FILTERS: FeedTopicFilter[] = [
  {
    id: "all",
    label: "All",
    icon: ReadativeTopicIcon,
    keywords: [],
  },
  {
    id: "trending",
    label: "Trending",
    icon: Flame,
    keywords: [],
  },
  {
    id: "ai",
    label: "AI",
    icon: Bot,
    keywords: [
      "ai",
      "artificial intelligence",
      "chatgpt",
      "openai",
      "prompt",
      "llm",
      "generative ai",
      "ai automation",
      "machine learning",
      "claude",
      "copilot",
    ],
  },
  {
    id: "apps",
    label: "Apps",
    icon: Smartphone,
    keywords: [
      "app",
      "apps",
      "application",
      "mobile",
      "ios",
      "android",
      "extension",
      "saas",
      "web app",
    ],
  },
  {
    id: "productivity",
    label: "Productivity",
    icon: Zap,
    keywords: [
      "productivity",
      "workflow",
      "time",
      "focus",
      "habit",
      "automation",
      "shortcut",
      "notion",
      "calendar",
      "template",
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    keywords: [
      "marketing",
      "growth",
      "seo",
      "content",
      "brand",
      "newsletter",
      "copywriting",
      "campaign",
      "social media",
      "sales",
    ],
  },
  {
    id: "software",
    label: "Software",
    icon: Code2,
    keywords: [
      "software",
      "coding",
      "code",
      "developer",
      "programming",
      "web",
      "api",
      "react",
      "typescript",
      "javascript",
      "python",
      "github",
    ],
  },
  {
    id: "tools",
    label: "Tools",
    icon: Wrench,
    keywords: [
      "tool",
      "tools",
      "resource",
      "template",
      "browser",
      "chrome",
      "extension",
      "platform",
    ],
  },
  {
    id: "startups",
    label: "Startups",
    icon: Rocket,
    keywords: [
      "startup",
      "founder",
      "business",
      "idea",
      "launch",
      "build",
      "mvp",
      "fundraising",
      "customer",
    ],
  },
  {
    id: "design",
    label: "Design",
    icon: Palette,
    keywords: [
      "design",
      "ui",
      "ux",
      "visual",
      "creative",
      "brand",
      "figma",
      "prototype",
      "interface",
    ],
  },
  {
    id: "learning",
    label: "Learning",
    icon: BookOpenText,
    keywords: [
      "learning",
      "study",
      "education",
      "guide",
      "notes",
      "course",
      "tutorial",
      "lesson",
      "research",
    ],
  },
];

interface SelectedImage extends KnowledgeImageAsset {
  fileName: string;
}

interface MentionState {
  query: string;
  start: number;
}

interface FeedMessage {
  tone: "success" | "warning";
  title: string;
  body: string;
}

type FeedPageLoadResult = "blocked" | "done" | "error" | "loaded";

interface LoadNextEntriesPageOptions {
  showLoadingState?: boolean;
  surfaceErrors?: boolean;
}

interface CachedKnowledgeFeed {
  entries: KnowledgeEntry[];
  visibleLikedEntryIds: string[];
  hasMoreServerEntries: boolean;
  cachedAt: number;
}

interface TopicFeedState {
  entries: KnowledgeEntry[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasLoaded: boolean;
  hasMore: boolean;
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  error: string | null;
}

interface IndependentKnowledgeFeedPage {
  entries: KnowledgeEntry[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

interface BrowserIdleCallbacks {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
}

interface PendingFeedStorageWrite {
  idleCallbackId: number | null;
  timeoutId: number | null;
}

const pendingFeedStorageWrites = new Map<string, PendingFeedStorageWrite>();

function createKnowledgeFeedRefreshSeed() {
  return Date.now() + Math.floor(Math.random() * 1_000_000);
}

function scrollKnowledgeFeedToTop(behavior: ScrollBehavior = "auto") {
  if (typeof window === "undefined") return;

  window.scrollTo({ top: 0, left: 0, behavior });

  if (behavior === "auto") {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }
}

interface KnowledgeFeedProps {
  identity: KnowledgeIdentity | null;
  onIdentityChange: (identity: KnowledgeIdentity | null) => void;
  onOpenProfile: (authorId: string) => void;
  focusedEntryId: string | null;
  onOpenEntry: (entryId: string) => void;
  composerOpenSignal: number;
  refreshSignal: number;
  isActive: boolean;
}

const knowledgeFeedMemoryCache = new Map<string, CachedKnowledgeFeed>();

function readSelectedHashtagFromLocation() {
  if (typeof window === "undefined") return null;

  return parseRouteFromLocation().selectedHashtag;
}

function tokenizeSearch(input: string) {
  return input.trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 10);
}

function matchesKnowledgeSearch(entry: KnowledgeEntry, terms: string[]) {
  if (terms.length === 0) return true;

  const hashtags = entry.hashtags.map((tag) => tag.toLowerCase());
  const people = [
    entry.author,
    ...(entry.mentions || []).map((mention) => mention.username),
    ...(entry.comments || []).map((comment) => comment.author || ""),
  ].map((value) => value.toLowerCase());
  const searchableText = [
    entry.title,
    entry.content,
    entry.author,
    ...entry.hashtags,
    ...(entry.mentions || []).map((mention) => mention.username),
    ...(entry.comments || []).map((comment) => comment.text),
    ...(entry.comments || []).map((comment) => comment.author || ""),
  ]
    .join(" ")
    .toLowerCase();

  return terms.every((term) => {
    if (term.startsWith("#")) {
      const normalized = term.slice(1);
      return (
        Boolean(normalized) && hashtags.some((tag) => tag.includes(normalized))
      );
    }

    if (term.startsWith("@")) {
      const normalized = term.slice(1);
      return (
        Boolean(normalized) &&
        people.some((person) => person.includes(normalized))
      );
    }

    return searchableText.includes(term);
  });
}

function normalizeKnowledgeTopicValue(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9+#\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStoredHashtagValue(value: string) {
  return value.replace(/^#/, "").trim().toLowerCase();
}

function getKnowledgeTopicSourceText(entry: KnowledgeEntry) {
  return entry.hashtags.join(" ");
}

function getKnowledgeTopicCorpus(entry: KnowledgeEntry) {
  const text = normalizeKnowledgeTopicValue(getKnowledgeTopicSourceText(entry));
  const rawTokens = text.match(/[a-z0-9+#]+/g) || [];
  const tokens = new Set(
    rawTokens.flatMap((token) =>
      token.startsWith("#") ? [token, token.slice(1)] : [token],
    ),
  );
  const compactHashtags = entry.hashtags
    .map((tag) => normalizeKnowledgeTopicValue(tag.replace(/^#/, "")))
    .map((tag) => tag.replace(/\s+/g, ""))
    .filter(Boolean);

  return {
    text: ` ${text} `,
    tokens,
    compactHashtags,
  };
}

function getTopicHashtagQueryValues(topic: FeedTopicFilter) {
  if (topic.id === "all" || topic.id === "trending") return [];

  const values = new Set<string>();
  topic.keywords.forEach((keyword) => {
    const normalizedKeyword = normalizeKnowledgeTopicValue(keyword);
    if (!normalizedKeyword) return;

    const compactKeyword = normalizedKeyword.replace(/\s+/g, "");
    const dashedKeyword = normalizedKeyword.replace(/\s+/g, "-");
    const underscoredKeyword = normalizedKeyword.replace(/\s+/g, "_");

    [normalizedKeyword, compactKeyword, dashedKeyword, underscoredKeyword]
      .map(normalizeStoredHashtagValue)
      .filter((value) => value && !value.includes(" "))
      .forEach((value) => values.add(value));
  });

  return [...values].slice(0, FIRESTORE_ARRAY_CONTAINS_ANY_LIMIT);
}

function getTopicKeywordTokenVariants(token: string) {
  const variants = new Set([token]);

  if (token.length > 2 && !token.endsWith("s")) {
    variants.add(`${token}s`);
  }

  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
    variants.add(token.slice(0, -1));
  }

  return variants;
}

function matchesTopicKeyword(
  corpus: ReturnType<typeof getKnowledgeTopicCorpus>,
  keyword: string,
) {
  const normalizedKeyword = normalizeKnowledgeTopicValue(keyword);
  if (!normalizedKeyword) return false;

  const keywordTokens = normalizedKeyword.split(/\s+/).filter(Boolean);
  const compactKeyword = keywordTokens.join("");

  if (keywordTokens.length > 1) {
    return (
      corpus.text.includes(` ${normalizedKeyword} `) ||
      corpus.compactHashtags.some(
        (tag) =>
          tag === compactKeyword ||
          (compactKeyword.length >= 5 && tag.includes(compactKeyword)),
      )
    );
  }

  const [keywordToken] = keywordTokens;
  const variants = getTopicKeywordTokenVariants(keywordToken);
  const matchesToken = [...variants].some((variant) =>
    corpus.tokens.has(variant),
  );
  if (matchesToken) return true;

  return corpus.compactHashtags.some((tag) =>
    [...variants].some(
      (variant) => tag === variant || (variant.length >= 4 && tag.includes(variant)),
    ),
  );
}

function matchesKnowledgeTopic(entry: KnowledgeEntry, topic: FeedTopicFilter) {
  if (topic.id === "all" || topic.id === "trending") return true;

  const corpus = getKnowledgeTopicCorpus(entry);

  return topic.keywords.some((keyword) => matchesTopicKeyword(corpus, keyword));
}

function getKnowledgeTrendingScore(entry: KnowledgeEntry) {
  const now = Date.now();
  const ageHours = Math.max(1, (now - entry.createdAt) / 3_600_000);
  const recencyBoost = Math.max(0, 6 - ageHours / 18);
  const qualityBoost = Math.max(0, (entry.qualityScore || 0) / 25);
  const likeCount = (entry.likes || []).length;
  const commentCount = (entry.comments || []).length;

  return (
    likeCount * 8 +
    commentCount * 4 +
    qualityBoost +
    recencyBoost
  );
}

function getTrendingKnowledgeEntries(
  entries: KnowledgeEntry[],
  maxEntries = TRENDING_FEED_LIMIT,
) {
  if (entries.length <= 1) return entries;

  const rankedEntries = [...entries].sort((left, right) => {
    const scoreDifference =
      getKnowledgeTrendingScore(right) - getKnowledgeTrendingScore(left);

    if (scoreDifference !== 0) return scoreDifference;
    return right.createdAt - left.createdAt;
  });
  const engagedEntries = rankedEntries.filter(
    (entry) => (entry.likes || []).length > 0,
  );
  const minimumTrendingCount = Math.min(4, entries.length);
  const trendingPool =
    engagedEntries.length >= minimumTrendingCount
      ? engagedEntries
      : rankedEntries;

  return trendingPool.slice(0, Math.min(maxEntries, trendingPool.length));
}

function getKnowledgeEntriesForTopic(
  entries: KnowledgeEntry[],
  topic: FeedTopicFilter,
) {
  if (topic.id === "all") return entries;
  if (topic.id === "trending") return getTrendingKnowledgeEntries(entries);

  return entries.filter((entry) => matchesKnowledgeTopic(entry, topic));
}

function buildKnowledgeSchemas(entry: KnowledgeEntry | null) {
  const baseUrl = buildAbsoluteRouteUrl("knowledge");
  const primaryImage = entry ? getKnowledgeEntryImages(entry)[0] : null;

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Readative Knowledge Feed",
    url: baseUrl,
    description:
      "Readative's knowledge feed helps people discover practical insights, visual explainers, AI tools, study notes, and SmartTalk ideas from creators.",
  };

  if (!entry) {
    return collectionSchema;
  }

  return [
    collectionSchema,
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: entry.title,
      description: createExcerpt(entry.content),
      author: {
        "@type": "Person",
        name: `@${entry.author}`,
      },
      datePublished: new Date(entry.createdAt).toISOString(),
      keywords: entry.hashtags.join(", "),
      mainEntityOfPage: buildAbsoluteRouteUrl("knowledge", {
        focusedEntryId: entry.id,
      }),
      image:
        primaryImage?.dataUrl && !primaryImage.dataUrl.startsWith("data:")
          ? [primaryImage.dataUrl]
          : undefined,
    },
  ];
}

function normalizeKnowledgeComments(comments: KnowledgeComment[] = []) {
  return comments.map((comment) => ({
    ...comment,
    createdAt:
      (comment.createdAt as { toMillis?: () => number })?.toMillis?.() ||
      comment.createdAt ||
      Date.now(),
  }));
}

function normalizeKnowledgeEntry(
  id: string,
  data: Partial<KnowledgeEntry> & {
    comments?: KnowledgeComment[];
    createdAt?: number | { toMillis?: () => number };
    updatedAt?: number | { toMillis?: () => number };
  },
): KnowledgeEntry {
  const {
    comments,
    createdAt,
    updatedAt,
    likes,
    mentions,
    images,
    imageLayout,
    visibility,
    ...restData
  } = data;
  const rawCreatedAt = createdAt as
    | number
    | { toMillis?: () => number }
    | undefined;
  const rawUpdatedAt = updatedAt as
    | number
    | { toMillis?: () => number }
    | undefined;

  return {
    author: "",
    authorId: "",
    authorEmail: "",
    title: "",
    content: "",
    visibility: normalizeKnowledgeVisibility(visibility),
    hashtags: [],
    ...restData,
    id,
    likes: likes || [],
    mentions: mentions || [],
    images: Array.isArray(images) ? images : [],
    imageLayout:
      imageLayout === "wide" || imageLayout === "portrait" ? imageLayout : null,
    comments: normalizeKnowledgeComments(comments || []),
    createdAt:
      rawCreatedAt &&
      typeof rawCreatedAt === "object" &&
      typeof rawCreatedAt.toMillis === "function"
        ? rawCreatedAt.toMillis()
        : typeof rawCreatedAt === "number"
          ? rawCreatedAt
          : Date.now(),
    updatedAt:
      rawUpdatedAt &&
      typeof rawUpdatedAt === "object" &&
      typeof rawUpdatedAt.toMillis === "function"
        ? rawUpdatedAt.toMillis()
        : typeof rawUpdatedAt === "number"
          ? rawUpdatedAt
          : null,
  };
}

function getKnowledgeFeedCacheKey(authorId?: string | null) {
  const ownerId =
    authorId?.trim() || (typeof window === "undefined" ? "server" : getGuestId());
  return `${FEED_CACHE_KEY_PREFIX}:${ownerId}`;
}

function normalizeCacheStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeCachedKnowledgeFeed(value: unknown): CachedKnowledgeFeed | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<CachedKnowledgeFeed>;
  const cachedAt =
    typeof candidate.cachedAt === "number" && Number.isFinite(candidate.cachedAt)
      ? candidate.cachedAt
      : 0;

  if (!cachedAt || Date.now() - cachedAt > FEED_CACHE_TTL_MS) {
    return null;
  }

  const entries = Array.isArray(candidate.entries)
    ? candidate.entries
        .map((entry) => {
          const data = entry as Partial<KnowledgeEntry>;
          const id = typeof data.id === "string" ? data.id.trim() : "";
          return id ? normalizeKnowledgeEntry(id, data) : null;
        })
        .filter((entry): entry is KnowledgeEntry => Boolean(entry))
        .slice(0, FEED_CACHE_MEMORY_ENTRY_LIMIT)
    : [];

  if (entries.length === 0) {
    return null;
  }

  const entryIds = new Set(entries.map((entry) => entry.id));
  return {
    entries,
    visibleLikedEntryIds: normalizeCacheStringArray(candidate.visibleLikedEntryIds),
    hasMoreServerEntries: candidate.hasMoreServerEntries !== false,
    cachedAt,
  };
}

function readKnowledgeFeedCache(authorId?: string | null): CachedKnowledgeFeed | null {
  if (typeof window === "undefined") {
    return null;
  }

  const cacheKey = getKnowledgeFeedCacheKey(authorId);
  const memoryCache = normalizeCachedKnowledgeFeed(
    knowledgeFeedMemoryCache.get(cacheKey),
  );
  if (memoryCache) {
    knowledgeFeedMemoryCache.set(cacheKey, memoryCache);
    return memoryCache;
  }

  knowledgeFeedMemoryCache.delete(cacheKey);

  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) {
      return null;
    }

    const storageCache = normalizeCachedKnowledgeFeed(JSON.parse(raw));
    if (!storageCache) {
      window.localStorage.removeItem(cacheKey);
      return null;
    }

    knowledgeFeedMemoryCache.set(cacheKey, storageCache);
    return storageCache;
  } catch {
    return null;
  }
}

function stripEntryImagesForStorage(entry: KnowledgeEntry): KnowledgeEntry {
  return {
    ...entry,
    images: [],
    imageDataUrl: null,
    imageMimeType: null,
    imageWidth: null,
    imageHeight: null,
    imageOptimizedAt: null,
  };
}

function keepEntryImagesForStorage(entry: KnowledgeEntry): KnowledgeEntry {
  const images = getKnowledgeEntryImages(entry);
  const primaryImage = images[0] || null;

  return {
    ...entry,
    images,
    imageLayout: images.length > 0 ? getKnowledgeEntryImageLayout(entry) : null,
    imageDataUrl: primaryImage?.dataUrl || null,
    imageMimeType: primaryImage?.mimeType || null,
    imageWidth: primaryImage?.width || null,
    imageHeight: primaryImage?.height || null,
    imageOptimizedAt: primaryImage?.optimizedAt || null,
  };
}

function prepareEntriesForStorageCache(entries: KnowledgeEntry[]) {
  let imageChars = 0;

  return entries.slice(0, FEED_CACHE_STORAGE_ENTRY_LIMIT).map((entry) => {
    const images = getKnowledgeEntryImages(entry);
    const entryImageChars = images.reduce(
      (total, image) => total + image.dataUrl.length,
      0,
    );

    if (
      images.length > 0 &&
      imageChars + entryImageChars <= FEED_CACHE_STORAGE_IMAGE_CHAR_BUDGET
    ) {
      imageChars += entryImageChars;
      return keepEntryImagesForStorage(entry);
    }

    return stripEntryImagesForStorage(entry);
  });
}

function removeLegacyKnowledgeFeedStorageCaches() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const legacyPrefixes = FEED_CACHE_LEGACY_KEY_PREFIXES.map(
      (prefix) => `${prefix}:`,
    );
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key && legacyPrefixes.some((prefix) => key.startsWith(prefix))) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Cache cleanup should never block the feed.
  }
}

function writeKnowledgeFeedStorageCache(
  cacheKey: string,
  cache: CachedKnowledgeFeed,
) {
  if (typeof window === "undefined") {
    return;
  }

  const storageCache: CachedKnowledgeFeed = {
    ...cache,
    entries: prepareEntriesForStorageCache(cache.entries),
    visibleLikedEntryIds: [],
  };

  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(storageCache));
  } catch {
    removeLegacyKnowledgeFeedStorageCaches();

    try {
      window.localStorage.setItem(
        cacheKey,
        JSON.stringify({
          ...storageCache,
          entries: cache.entries
            .slice(0, FEED_CACHE_STORAGE_ENTRY_LIMIT)
            .map(stripEntryImagesForStorage),
        }),
      );
    } catch {
      // Memory cache still covers tab switches when local storage is full.
    }
  }
}

function scheduleKnowledgeFeedStorageCacheWrite(
  cacheKey: string,
  cache: CachedKnowledgeFeed,
) {
  if (typeof window === "undefined") {
    return;
  }

  const browserIdle = window as unknown as BrowserIdleCallbacks;
  const pendingWrite = pendingFeedStorageWrites.get(cacheKey);
  if (pendingWrite) {
    if (
      pendingWrite.idleCallbackId !== null &&
      browserIdle.cancelIdleCallback
    ) {
      browserIdle.cancelIdleCallback(pendingWrite.idleCallbackId);
    }

    if (pendingWrite.timeoutId !== null) {
      window.clearTimeout(pendingWrite.timeoutId);
    }
  }

  const nextPendingWrite: PendingFeedStorageWrite = {
    idleCallbackId: null,
    timeoutId: null,
  };

  const runStorageWrite = () => {
    pendingFeedStorageWrites.delete(cacheKey);
    writeKnowledgeFeedStorageCache(cacheKey, cache);
  };

  if (browserIdle.requestIdleCallback) {
    nextPendingWrite.idleCallbackId = browserIdle.requestIdleCallback(
      runStorageWrite,
      {
        timeout: FEED_CACHE_STORAGE_WRITE_TIMEOUT_MS,
      },
    );
  } else {
    nextPendingWrite.timeoutId = window.setTimeout(runStorageWrite, 350);
  }

  pendingFeedStorageWrites.set(cacheKey, nextPendingWrite);
}

function writeKnowledgeFeedCache(
  authorId: string | null | undefined,
  cache: Omit<CachedKnowledgeFeed, "cachedAt">,
) {
  if (typeof window === "undefined" || cache.entries.length === 0) {
    return;
  }

  const cacheKey = getKnowledgeFeedCacheKey(authorId);
  const memoryEntries = cache.entries.slice(0, FEED_CACHE_MEMORY_ENTRY_LIMIT);
  const nextCache: CachedKnowledgeFeed = {
    ...cache,
    entries: memoryEntries,
    visibleLikedEntryIds: [],
    cachedAt: Date.now(),
  };

  knowledgeFeedMemoryCache.set(cacheKey, nextCache);
  scheduleKnowledgeFeedStorageCacheWrite(cacheKey, nextCache);
}

function isEntryLikedByAuthor(entry: KnowledgeEntry, authorId?: string | null) {
  return Boolean(authorId && (entry.likes || []).includes(authorId));
}

function reconcileRealtimeKnowledgeFeedOrder({
  entries,
  currentOrder,
  snapshot,
  newEntryIds,
  refreshSeed,
}: {
  entries: KnowledgeEntry[];
  currentOrder: string[];
  snapshot: ReturnType<typeof getKnowledgeFeedSnapshot>;
  newEntryIds: Set<string>;
  refreshSeed: number;
}) {
  const reconciledOrder = reconcileKnowledgeFeedOrder(
    entries,
    currentOrder,
    snapshot,
    { refreshSeed },
  );

  if (currentOrder.length === 0 || newEntryIds.size === 0) {
    return reconciledOrder;
  }

  const newEntries = entries.filter(
    (entry) =>
      newEntryIds.has(entry.id) &&
      !isEntryLikedByAuthor(entry, snapshot.currentUserId),
  );
  if (newEntries.length === 0) {
    return reconciledOrder;
  }

  const leadEntryIds = rankKnowledgeEntries(newEntries, snapshot, {
    refreshSeed,
  }).map((entry) => entry.id);
  const leadEntryIdSet = new Set(leadEntryIds);

  return [
    ...leadEntryIds,
    ...reconciledOrder.filter((entryId) => !leadEntryIdSet.has(entryId)),
  ];
}

function sortKnowledgeEntries(entries: KnowledgeEntry[]) {
  return [...entries].sort((left, right) => {
    const createdAtDiff = right.createdAt - left.createdAt;
    if (createdAtDiff !== 0) return createdAtDiff;
    return right.id.localeCompare(left.id);
  });
}

function mergeKnowledgeEntryPages(
  currentEntries: KnowledgeEntry[],
  nextEntries: KnowledgeEntry[],
) {
  const entryMap = new Map(
    currentEntries.map((entry) => [entry.id, entry] as const),
  );

  nextEntries.forEach((entry) => {
    entryMap.set(entry.id, entry);
  });

  return sortKnowledgeEntries([...entryMap.values()]);
}

function mergeRealtimeKnowledgePage(
  currentEntries: KnowledgeEntry[],
  firstPageEntries: KnowledgeEntry[],
) {
  if (firstPageEntries.length === 0) {
    return [];
  }

  const firstPageIds = new Set(firstPageEntries.map((entry) => entry.id));
  const oldestFirstPageCreatedAt =
    firstPageEntries[firstPageEntries.length - 1]?.createdAt || 0;
  const retainedOlderEntries = currentEntries.filter(
    (entry) =>
      !firstPageIds.has(entry.id) &&
      entry.createdAt < oldestFirstPageCreatedAt,
  );

  return mergeKnowledgeEntryPages(firstPageEntries, retainedOlderEntries);
}

function normalizeKnowledgeQueryDocs(
  docs: QueryDocumentSnapshot<DocumentData>[],
) {
  return docs.map((item) =>
    normalizeKnowledgeEntry(
      item.id,
      item.data() as Partial<KnowledgeEntry> & {
        comments?: KnowledgeComment[];
        createdAt?: number | { toMillis?: () => number };
      },
    ),
  );
}

function isFirestoreIndexError(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code).toLowerCase()
      : "";
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error);

  return (
    code === "failed-precondition" ||
    message.includes("index") ||
    message.includes("requires an index")
  );
}

async function getDocsWithIndexFallback(
  orderedQuery: Query<DocumentData>,
  fallbackQuery: Query<DocumentData>,
  context: string,
) {
  try {
    return await getDocs(orderedQuery);
  } catch (error) {
    if (!isFirestoreIndexError(error)) {
      throw error;
    }

    console.info(`${context} ordered query needs an index; using fallback.`, error);
    return getDocs(fallbackQuery);
  }
}

function getIndependentFeedPageSize(topic: FeedTopicFilter) {
  return topic.id === "trending" ? TRENDING_FEED_PAGE_SIZE : TOPIC_FEED_PAGE_SIZE;
}

function buildIndependentKnowledgeFeedPage(
  docs: QueryDocumentSnapshot<DocumentData>[],
  entries: KnowledgeEntry[],
  pageSize: number,
  previousCursor: QueryDocumentSnapshot<DocumentData> | null,
): IndependentKnowledgeFeedPage {
  return {
    entries,
    cursor: docs[docs.length - 1] || previousCursor,
    hasMore: docs.length === pageSize,
  };
}

async function loadHashtagKnowledgeEntries(
  selectedHashtag: string,
  topic: FeedTopicFilter,
  cursor: QueryDocumentSnapshot<DocumentData> | null = null,
): Promise<IndependentKnowledgeFeedPage> {
  const normalizedHashtag = normalizeStoredHashtagValue(selectedHashtag);
  if (!normalizedHashtag) {
    return { entries: [], cursor: null, hasMore: false };
  }

  const knowledgeCollection = collection(db, "knowledge");
  const pageSize = getIndependentFeedPageSize(topic);
  const orderedHashtagQuery = cursor
    ? query(
        knowledgeCollection,
        where("hashtags", "array-contains", normalizedHashtag),
        orderBy("createdAt", "desc"),
        startAfter(cursor),
        limit(pageSize),
      )
    : query(
        knowledgeCollection,
        where("hashtags", "array-contains", normalizedHashtag),
        orderBy("createdAt", "desc"),
        limit(pageSize),
      );
  const fallbackHashtagQuery = cursor
    ? query(
        knowledgeCollection,
        where("hashtags", "array-contains", normalizedHashtag),
        startAfter(cursor),
        limit(pageSize),
      )
    : query(
        knowledgeCollection,
        where("hashtags", "array-contains", normalizedHashtag),
        limit(pageSize),
      );
  const snapshot = await getDocsWithIndexFallback(
    orderedHashtagQuery,
    fallbackHashtagQuery,
    `#${normalizedHashtag} feed`,
  );
  const entries = sortKnowledgeEntries(normalizeKnowledgeQueryDocs(snapshot.docs));
  const pageEntries =
    topic.id === "trending"
      ? getTrendingKnowledgeEntries(entries, entries.length)
      : getKnowledgeEntriesForTopic(entries, topic);

  return buildIndependentKnowledgeFeedPage(
    snapshot.docs,
    pageEntries,
    pageSize,
    cursor,
  );
}

async function loadTrendingKnowledgeEntries(
  cursor: QueryDocumentSnapshot<DocumentData> | null = null,
): Promise<IndependentKnowledgeFeedPage> {
  const knowledgeCollection = collection(db, "knowledge");
  const snapshot = await getDocs(
    cursor
      ? query(
          knowledgeCollection,
          orderBy("createdAt", "desc"),
          startAfter(cursor),
          limit(TRENDING_FEED_PAGE_SIZE),
        )
      : query(
          knowledgeCollection,
          orderBy("createdAt", "desc"),
          limit(TRENDING_FEED_PAGE_SIZE),
        ),
  );

  const entries = normalizeKnowledgeQueryDocs(snapshot.docs);

  return buildIndependentKnowledgeFeedPage(
    snapshot.docs,
    getTrendingKnowledgeEntries(entries, entries.length),
    TRENDING_FEED_PAGE_SIZE,
    cursor,
  );
}

async function loadTopicKnowledgeEntries(
  topic: FeedTopicFilter,
  cursor: QueryDocumentSnapshot<DocumentData> | null = null,
): Promise<IndependentKnowledgeFeedPage> {
  if (topic.id === "all") {
    return { entries: [], cursor: null, hasMore: false };
  }
  if (topic.id === "trending") return loadTrendingKnowledgeEntries(cursor);

  const hashtagValues = getTopicHashtagQueryValues(topic);
  if (hashtagValues.length === 0) {
    return { entries: [], cursor: null, hasMore: false };
  }

  const knowledgeCollection = collection(db, "knowledge");
  const orderedTopicQuery = cursor
    ? query(
        knowledgeCollection,
        where("hashtags", "array-contains-any", hashtagValues),
        orderBy("createdAt", "desc"),
        startAfter(cursor),
        limit(TOPIC_FEED_PAGE_SIZE),
      )
    : query(
        knowledgeCollection,
        where("hashtags", "array-contains-any", hashtagValues),
        orderBy("createdAt", "desc"),
        limit(TOPIC_FEED_PAGE_SIZE),
      );
  const fallbackTopicQuery = cursor
    ? query(
        knowledgeCollection,
        where("hashtags", "array-contains-any", hashtagValues),
        startAfter(cursor),
        limit(TOPIC_FEED_PAGE_SIZE),
      )
    : query(
        knowledgeCollection,
        where("hashtags", "array-contains-any", hashtagValues),
        limit(TOPIC_FEED_PAGE_SIZE),
      );
  const snapshot = await getDocsWithIndexFallback(
    orderedTopicQuery,
    fallbackTopicQuery,
    `${topic.label} category feed`,
  );

  const entries = getKnowledgeEntriesForTopic(
    sortKnowledgeEntries(normalizeKnowledgeQueryDocs(snapshot.docs)),
    topic,
  );

  return buildIndependentKnowledgeFeedPage(
    snapshot.docs,
    entries,
    TOPIC_FEED_PAGE_SIZE,
    cursor,
  );
}

async function loadIndependentKnowledgeFeedEntries({
  topic,
  selectedHashtag,
  cursor = null,
}: {
  topic: FeedTopicFilter;
  selectedHashtag: string | null;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
}): Promise<IndependentKnowledgeFeedPage> {
  if (selectedHashtag) {
    return loadHashtagKnowledgeEntries(selectedHashtag, topic, cursor);
  }

  return loadTopicKnowledgeEntries(topic, cursor);
}

function mergeIndependentKnowledgeFeedEntries(
  currentEntries: KnowledgeEntry[],
  nextEntries: KnowledgeEntry[],
  topic: FeedTopicFilter,
) {
  const mergedEntries = mergeKnowledgeEntryPages(currentEntries, nextEntries);

  if (topic.id === "trending") {
    return getTrendingKnowledgeEntries(mergedEntries, mergedEntries.length);
  }

  return getKnowledgeEntriesForTopic(mergedEntries, topic);
}

function getIndependentFeedKey(
  topicId: FeedTopicId,
  selectedHashtag: string | null,
) {
  return selectedHashtag
    ? `hashtag:${normalizeStoredHashtagValue(selectedHashtag)}:topic:${topicId}`
    : `topic:${topicId}`;
}

export function KnowledgeFeed({
  identity,
  onIdentityChange,
  onOpenProfile,
  focusedEntryId,
  onOpenEntry,
  composerOpenSignal,
  refreshSignal,
  isActive,
}: KnowledgeFeedProps) {
  const initialRefreshSeed = useMemo(createKnowledgeFeedRefreshSeed, [
    identity?.authorId,
  ]);
  const initialFeedCache = useMemo(
    () => readKnowledgeFeedCache(identity?.authorId),
    [identity?.authorId],
  );
  const initialFeedOrder = useMemo(
    () =>
      initialFeedCache
        ? rankKnowledgeEntries(
            initialFeedCache.entries,
            getKnowledgeFeedSnapshot(),
            { refreshSeed: initialRefreshSeed, shuffleOnRefresh: true },
          ).map((entry) => entry.id)
        : [],
    [initialFeedCache, initialRefreshSeed],
  );
  const [entries, setEntries] = useState<KnowledgeEntry[]>(
    () => initialFeedCache?.entries || [],
  );
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(
    () => !initialFeedCache?.entries.length,
  );
  const [feedLoadError, setFeedLoadError] = useState<string | null>(null);
  const [profilesLoadError, setProfilesLoadError] = useState<string | null>(
    null,
  );
  const [isPosting, setIsPosting] = useState(false);
  const [isModerating, setIsModerating] = useState(false);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [showIdentityPrompt, setShowIdentityPrompt] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [publishAfterAccess, setPublishAfterAccess] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftVisibility, setDraftVisibility] =
    useState<KnowledgeVisibility>("public");
  const [hashtagInput, setHashtagInput] = useState("");
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [selectedImageLayout, setSelectedImageLayout] =
    useState<KnowledgeImageLayout>(DEFAULT_IMAGE_LAYOUT);
  const [activeMention, setActiveMention] = useState<MentionState | null>(null);
  const [feedMessage, setFeedMessage] = useState<FeedMessage | null>(null);
  const [selectedHashtag, setSelectedHashtag] = useState<string | null>(() =>
    readSelectedHashtagFromLocation(),
  );
  const [feedSearchQuery, setFeedSearchQuery] = useState("");
  const [selectedFeedTopic, setSelectedFeedTopic] =
    useState<FeedTopicId>("all");
  const [showRefreshFeedback, setShowRefreshFeedback] = useState(false);
  const [feedEntryOrder, setFeedEntryOrder] =
    useState<string[]>(initialFeedOrder);
  const [visibleLikedEntryIds, setVisibleLikedEntryIds] = useState<string[]>([]);
  const [hasMoreServerEntries, setHasMoreServerEntries] = useState(
    () => initialFeedCache?.hasMoreServerEntries ?? true,
  );
  const [isLoadingMoreEntries, setIsLoadingMoreEntries] = useState(false);
  const [isBackgroundLoadingEntries, setIsBackgroundLoadingEntries] =
    useState(false);
  const [topicFeedStates, setTopicFeedStates] = useState<
    Record<string, TopicFeedState>
  >({});

  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const entriesRef = useRef<KnowledgeEntry[]>(entries);
  const visibleLikedEntryIdsRef = useRef<string[]>(visibleLikedEntryIds);
  const feedRefreshSeedRef = useRef(initialRefreshSeed);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const paginationCursorRef =
    useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const hasMoreServerEntriesRef = useRef(hasMoreServerEntries);
  const hasPaginatedPastFirstPageRef = useRef(false);
  const hasAppliedInitialRealtimeRankRef = useRef(false);
  const isLoadingMoreEntriesRef = useRef(false);
  const hasLoadedProfilesDirectoryRef = useRef(false);
  const deferredFeedSearchQuery = useDeferredValue(feedSearchQuery);
  const selectedImageLayoutSettings =
    getKnowledgeImageLayoutSettings(selectedImageLayout);

  const updateHasMoreServerEntries = useCallback((hasMoreEntries: boolean) => {
    hasMoreServerEntriesRef.current = hasMoreEntries;
    setHasMoreServerEntries(hasMoreEntries);
  }, []);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  useEffect(() => {
    visibleLikedEntryIdsRef.current = visibleLikedEntryIds;
  }, [visibleLikedEntryIds]);

  useEffect(() => {
    if (entries.length === 0) return;

    writeKnowledgeFeedCache(identity?.authorId, {
      entries,
      visibleLikedEntryIds,
      hasMoreServerEntries,
    });
  }, [
    entries,
    feedEntryOrder,
    hasMoreServerEntries,
    identity?.authorId,
    visibleLikedEntryIds,
  ]);

  useEffect(() => {
    const nextRefreshSeed = createKnowledgeFeedRefreshSeed();
    feedRefreshSeedRef.current = nextRefreshSeed;
    hasAppliedInitialRealtimeRankRef.current = false;

    const cachedFeed = readKnowledgeFeedCache(identity?.authorId);
    visibleLikedEntryIdsRef.current = [];
    setVisibleLikedEntryIds([]);

    if (cachedFeed && entriesRef.current.length === 0) {
      entriesRef.current = cachedFeed.entries;
      setEntries(cachedFeed.entries);
      setFeedEntryOrder(
        rankKnowledgeEntries(
          cachedFeed.entries,
          getKnowledgeFeedSnapshot(),
          { refreshSeed: nextRefreshSeed, shuffleOnRefresh: true },
        ).map((entry) => entry.id),
      );
      updateHasMoreServerEntries(cachedFeed.hasMoreServerEntries);
      setIsLoading(false);
      return;
    }

    setFeedEntryOrder(
      rankKnowledgeEntries(
        entriesRef.current,
        getKnowledgeFeedSnapshot(),
        { refreshSeed: nextRefreshSeed, shuffleOnRefresh: true },
      ).map((entry) => entry.id),
    );
  }, [identity?.authorId, updateHasMoreServerEntries]);

  useEffect(() => {
    if (composerOpenSignal > 0) {
      setShowComposer(true);
      setFeedMessage(null);
    }
  }, [composerOpenSignal]);

  useEffect(() => {
    if (refreshSignal === 0) return;

    setFeedSearchQuery("");
    setFeedMessage(null);
    visibleLikedEntryIdsRef.current = [];
    setVisibleLikedEntryIds([]);
    feedRefreshSeedRef.current = createKnowledgeFeedRefreshSeed();
    const shouldShuffleAllPosts = selectedFeedTopic === "all" && !selectedHashtag;

    if (!shouldShuffleAllPosts) {
      setShowRefreshFeedback(false);
      return;
    }

    scrollKnowledgeFeedToTop();
    setFeedEntryOrder(
      rankKnowledgeEntries(entriesRef.current, getKnowledgeFeedSnapshot(), {
        refreshSeed: feedRefreshSeedRef.current,
        shuffleOnRefresh: true,
      }).map((entry) => entry.id),
    );
    setShowRefreshFeedback(true);
    const animationFrameId = window.requestAnimationFrame(scrollKnowledgeFeedToTop);

    const timeoutId = window.setTimeout(() => {
      setShowRefreshFeedback(false);
    }, 2400);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.clearTimeout(timeoutId);
    };
  }, [refreshSignal, selectedFeedTopic, selectedHashtag]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    if (entriesRef.current.length === 0) {
      setIsLoading(true);
    }

    const knowledgeQuery = query(
      collection(db, "knowledge"),
      orderBy("createdAt", "desc"),
      limit(FEED_PAGE_SIZE),
    );
    let didReceiveFeedResponse = false;
    const timeoutId =
      entriesRef.current.length === 0
        ? window.setTimeout(() => {
            if (didReceiveFeedResponse) return;

            setIsLoading(false);
            setFeedLoadError(
              "Posts are taking longer than expected to load. Please refresh, or try again in a moment.",
            );
          }, FEED_LOAD_TIMEOUT_MS)
        : null;

    const unsubscribe = onSnapshot(
      knowledgeQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (
          snapshot.metadata.fromCache &&
          snapshot.docs.length === 0 &&
          entriesRef.current.length === 0
        ) {
          return;
        }

        didReceiveFeedResponse = true;
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
        const data = snapshot.docs.map((item) =>
          normalizeKnowledgeEntry(
            item.id,
            item.data() as Partial<KnowledgeEntry> & {
              comments?: KnowledgeComment[];
              createdAt?: number | { toMillis?: () => number };
            },
          ),
        );
        if (!hasPaginatedPastFirstPageRef.current) {
          paginationCursorRef.current =
            snapshot.docs[snapshot.docs.length - 1] || null;
          updateHasMoreServerEntries(snapshot.docs.length === FEED_PAGE_SIZE);
        }

        const previousEntryIds = new Set(
          entriesRef.current.map((entry) => entry.id),
        );
        const newEntryIds = new Set(
          data
            .filter((entry) => !previousEntryIds.has(entry.id))
            .map((entry) => entry.id),
        );
        const nextFeedEntries = mergeRealtimeKnowledgePage(
          entriesRef.current,
          data,
        );
        const shouldApplyFreshSnapshotOrder =
          !hasAppliedInitialRealtimeRankRef.current;
        hasAppliedInitialRealtimeRankRef.current = true;
        entriesRef.current = nextFeedEntries;
        setEntries(nextFeedEntries);
        setFeedEntryOrder((currentOrder) => {
          const personalizationSnapshot = getKnowledgeFeedSnapshot();

          if (shouldApplyFreshSnapshotOrder) {
            return rankKnowledgeEntries(
              nextFeedEntries,
              personalizationSnapshot,
              {
                refreshSeed: feedRefreshSeedRef.current,
                shuffleOnRefresh: true,
              },
            ).map((entry) => entry.id);
          }

          return reconcileRealtimeKnowledgeFeedOrder({
            entries: nextFeedEntries,
            currentOrder,
            snapshot: personalizationSnapshot,
            newEntryIds,
            refreshSeed: feedRefreshSeedRef.current,
          });
        });

        setIsLoading(false);
        setFeedLoadError(null);
      },
      (error) => {
        didReceiveFeedResponse = true;
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
        console.error("Knowledge feed error:", error);
        setIsLoading(false);
        setFeedLoadError(
          "Could not load the latest posts right now. Please refresh in a moment.",
        );
      },
    );

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      unsubscribe();
    };
  }, [isActive, updateHasMoreServerEntries]);

  const loadNextEntriesPage = useCallback(
    async ({
      showLoadingState = true,
      surfaceErrors = true,
    }: LoadNextEntriesPageOptions = {}): Promise<FeedPageLoadResult> => {
      if (
        isLoadingMoreEntriesRef.current ||
        !hasMoreServerEntriesRef.current ||
        !paginationCursorRef.current
      ) {
        return isLoadingMoreEntriesRef.current ? "blocked" : "done";
      }

      isLoadingMoreEntriesRef.current = true;
      if (showLoadingState) {
        setIsLoadingMoreEntries(true);
      }
      if (surfaceErrors) {
        setFeedLoadError(null);
      }

      try {
        const nextPageQuery = query(
          collection(db, "knowledge"),
          orderBy("createdAt", "desc"),
          startAfter(paginationCursorRef.current),
          limit(FEED_PAGE_SIZE),
        );
        const snapshot = await getDocs(nextPageQuery);
        const data = snapshot.docs.map((item) =>
          normalizeKnowledgeEntry(
            item.id,
            item.data() as Partial<KnowledgeEntry> & {
              comments?: KnowledgeComment[];
              createdAt?: number | { toMillis?: () => number };
            },
          ),
        );

        hasPaginatedPastFirstPageRef.current = true;

        if (snapshot.docs.length > 0) {
          paginationCursorRef.current =
            snapshot.docs[snapshot.docs.length - 1] ||
            paginationCursorRef.current;
        }

        const hasAnotherPage = snapshot.docs.length === FEED_PAGE_SIZE;
        updateHasMoreServerEntries(hasAnotherPage);

        if (data.length > 0) {
          const nextFeedEntries = mergeKnowledgeEntryPages(
            entriesRef.current,
            data,
          );
          entriesRef.current = nextFeedEntries;
          setEntries(nextFeedEntries);
          setFeedEntryOrder((currentOrder) =>
            reconcileKnowledgeFeedOrder(
              nextFeedEntries,
              currentOrder,
              getKnowledgeFeedSnapshot(),
              {
                refreshSeed: feedRefreshSeedRef.current,
              },
            ),
          );
        }

        return hasAnotherPage ? "loaded" : "done";
      } catch (error) {
        console.error("Knowledge pagination error:", error);
        if (surfaceErrors) {
          setFeedLoadError(
            "Could not load more posts right now. Please try again in a moment.",
          );
        }
        return "error";
      } finally {
        isLoadingMoreEntriesRef.current = false;
        if (showLoadingState) {
          setIsLoadingMoreEntries(false);
        }
      }
    },
    [updateHasMoreServerEntries],
  );

  useEffect(() => {
    if (
      !isActive ||
      isLoading ||
      focusedEntryId ||
      !hasMoreServerEntries ||
      !paginationCursorRef.current ||
      typeof window === "undefined"
    ) {
      setIsBackgroundLoadingEntries(false);
      return;
    }

    let cancelled = false;
    const timeoutIds = new Set<number>();

    const waitForNextBackgroundPage = () =>
      new Promise<void>((resolve) => {
        const timeoutId = window.setTimeout(() => {
          timeoutIds.delete(timeoutId);
          resolve();
        }, FEED_BACKGROUND_PAGE_DELAY_MS);
        timeoutIds.add(timeoutId);
      });

    const preloadRemainingPages = async () => {
      setIsBackgroundLoadingEntries(true);

      try {
        await waitForNextBackgroundPage();

        let prefetchedPageCount = 0;
        while (
          !cancelled &&
          hasMoreServerEntriesRef.current &&
          paginationCursorRef.current &&
          prefetchedPageCount < FEED_BACKGROUND_PREFETCH_PAGE_LIMIT
        ) {
          const result = await loadNextEntriesPage({
            showLoadingState: false,
            surfaceErrors: false,
          });
          prefetchedPageCount += result === "loaded" ? 1 : 0;

          if (cancelled || result === "done" || result === "error") {
            break;
          }

          await waitForNextBackgroundPage();
        }
      } finally {
        if (!cancelled) {
          setIsBackgroundLoadingEntries(false);
        }
      }
    };

    void preloadRemainingPages();

    return () => {
      cancelled = true;
      timeoutIds.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      timeoutIds.clear();
    };
  }, [
    focusedEntryId,
    hasMoreServerEntries,
    isActive,
    isLoading,
    loadNextEntriesPage,
  ]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !isActive ||
      hasLoadedProfilesDirectoryRef.current
    ) {
      return;
    }

    let didStartLoad = false;
    let timeoutId: number | null = null;
    let idleCallbackId: number | null = null;
    const browserIdle = window as unknown as BrowserIdleCallbacks;

    const loadProfilesDirectory = async () => {
      didStartLoad = true;
      const profilesQuery = query(
        collection(db, "userProfiles"),
        orderBy("usernameLower", "asc"),
        limit(PROFILE_DIRECTORY_LIMIT),
      );

      try {
        const snapshot = await getDocs(profilesQuery);

        const data = snapshot.docs.map((item) =>
          hydrateUserProfile(item.data() as Partial<UserProfile>, item.id),
        );

        hasLoadedProfilesDirectoryRef.current = true;
        setProfiles(data);
        setProfilesLoadError(null);
      } catch (error) {
        console.error("Profile directory error:", error);
        setProfiles([]);
        setProfilesLoadError(
          "User mentions and profile previews may be incomplete for a moment.",
        );
      }
    };

    if (browserIdle.requestIdleCallback) {
      idleCallbackId = browserIdle.requestIdleCallback(() => {
        void loadProfilesDirectory();
      }, {
        timeout: PROFILE_DIRECTORY_IDLE_TIMEOUT_MS,
      });
    } else {
      timeoutId = window.setTimeout(() => {
        void loadProfilesDirectory();
      }, 1200);
    }

    return () => {
      if (didStartLoad) return;

      if (idleCallbackId !== null && browserIdle.cancelIdleCallback) {
        browserIdle.cancelIdleCallback(idleCallbackId);
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isActive]);

  useEffect(() => {
    if (!focusedEntryId) return;
    if (entriesRef.current.some((entry) => entry.id === focusedEntryId)) return;

    let cancelled = false;

    const loadFocusedEntry = async () => {
      try {
        const snapshot = await getDoc(doc(db, "knowledge", focusedEntryId));
        if (cancelled || !snapshot.exists()) return;

        const focusedEntry = normalizeKnowledgeEntry(
          snapshot.id,
          snapshot.data() as Partial<KnowledgeEntry> & {
            comments?: KnowledgeComment[];
            createdAt?: number | { toMillis?: () => number };
          },
        );

        if (entriesRef.current.some((entry) => entry.id === focusedEntry.id)) {
          return;
        }

        const nextEntries = mergeKnowledgeEntryPages(entriesRef.current, [
          focusedEntry,
        ]);
        entriesRef.current = nextEntries;
        setEntries(nextEntries);
        setFeedEntryOrder((currentOrder) => [
          focusedEntry.id,
          ...currentOrder.filter((entryId) => entryId !== focusedEntry.id),
        ]);
      } catch (error) {
        if (cancelled) return;

        console.error("Focused knowledge entry error:", error);
      }
    };

    void loadFocusedEntry();

    return () => {
      cancelled = true;
    };
  }, [focusedEntryId]);

  useEffect(() => {
    if (!focusedEntryId || entries.length === 0) return;

    const target = document.getElementById(`knowledge-${focusedEntryId}`);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [entries.length, focusedEntryId]);

  useEffect(() => {
    const syncSelectedHashtag = () => {
      setSelectedHashtag(readSelectedHashtagFromLocation());
    };

    syncSelectedHashtag();
    window.addEventListener("hashchange", syncSelectedHashtag);
    window.addEventListener("popstate", syncSelectedHashtag);
    window.addEventListener(ROUTE_CHANGE_EVENT, syncSelectedHashtag);

    return () => {
      window.removeEventListener("hashchange", syncSelectedHashtag);
      window.removeEventListener("popstate", syncSelectedHashtag);
      window.removeEventListener(ROUTE_CHANGE_EVENT, syncSelectedHashtag);
    };
  }, []);

  useEffect(() => {
    if (!isActive) return;

    document.documentElement.classList.add("readative-knowledge-feed");
    document.body.classList.add("readative-knowledge-feed");

    return () => {
      document.documentElement.classList.remove("readative-knowledge-feed");
      document.body.classList.remove("readative-knowledge-feed");
    };
  }, [isActive]);

  const currentAuthorId = identity?.authorId || null;
  const activeFeedTopic =
    FEED_TOPIC_FILTERS.find((topic) => topic.id === selectedFeedTopic) ||
    FEED_TOPIC_FILTERS[0];
  const normalizedSelectedHashtag = selectedHashtag
    ? normalizeStoredHashtagValue(selectedHashtag)
    : null;
  const shouldUseIndependentFeed =
    !focusedEntryId &&
    (Boolean(normalizedSelectedHashtag) || activeFeedTopic.id !== "all");
  const independentFeedKey = getIndependentFeedKey(
    activeFeedTopic.id,
    normalizedSelectedHashtag,
  );
  const activeTopicFeedState = topicFeedStates[independentFeedKey] || {
    entries: [],
    isLoading: false,
    isLoadingMore: false,
    hasLoaded: false,
    hasMore: false,
    cursor: null,
    error: null,
  };
  const visibleLikedEntryIdSet = useMemo(
    () => new Set(visibleLikedEntryIds),
    [visibleLikedEntryIds],
  );
  const viewableEntries = useMemo(
    () =>
      entries.filter((entry) => {
        if (!canViewKnowledgeEntry(entry, currentAuthorId)) {
          return false;
        }

        if (focusedEntryId && entry.id === focusedEntryId) {
          return true;
        }

        return (
          !isEntryLikedByAuthor(entry, currentAuthorId) ||
          visibleLikedEntryIdSet.has(entry.id)
        );
      }),
    [currentAuthorId, entries, focusedEntryId, visibleLikedEntryIdSet],
  );
  const focusedEntry = useMemo(
    () => viewableEntries.find((entry) => entry.id === focusedEntryId) || null,
    [viewableEntries, focusedEntryId],
  );
  const focusedEntryPrimaryImage = useMemo(
    () => (focusedEntry ? getKnowledgeEntryImages(focusedEntry)[0] || null : null),
    [focusedEntry],
  );
  const orderedEntries = useMemo(() => {
    const entryMap = new Map(
      viewableEntries.map((entry) => [entry.id, entry] as const),
    );
    const frozenEntries =
      feedEntryOrder.length > 0
        ? feedEntryOrder
            .map((entryId) => entryMap.get(entryId))
            .filter((entry): entry is KnowledgeEntry => Boolean(entry))
        : viewableEntries;
    const rankedEntryIds = new Set(frozenEntries.map((entry) => entry.id));
    const missingEntries = viewableEntries.filter(
      (entry) => !rankedEntryIds.has(entry.id),
    );
    const baseEntries = [...frozenEntries, ...missingEntries];

    if (focusedEntryId && focusedEntry) {
      return [
        focusedEntry,
        ...baseEntries.filter((entry) => entry.id !== focusedEntryId),
      ];
    }

    return baseEntries;
  }, [viewableEntries, feedEntryOrder, focusedEntry, focusedEntryId]);
  const independentFeedEntries = useMemo(() => {
    if (!shouldUseIndependentFeed) return null;

    return activeTopicFeedState.entries
      .filter((entry) => canViewKnowledgeEntry(entry, currentAuthorId))
      .filter(
        (entry) =>
          !isEntryLikedByAuthor(entry, currentAuthorId) ||
          visibleLikedEntryIdSet.has(entry.id),
      )
      .filter((entry) => {
        if (!normalizedSelectedHashtag) return true;

        return entry.hashtags.some(
          (tag) => normalizeStoredHashtagValue(tag) === normalizedSelectedHashtag,
        );
      })
      .filter((entry) => {
        if (
          activeFeedTopic.id === "all" ||
          activeFeedTopic.id === "trending"
        ) {
          return true;
        }

        return matchesKnowledgeTopic(entry, activeFeedTopic);
      });
  }, [
    activeFeedTopic,
    activeTopicFeedState.entries,
    currentAuthorId,
    normalizedSelectedHashtag,
    shouldUseIndependentFeed,
    visibleLikedEntryIdSet,
  ]);
  const visibleEntries = independentFeedEntries || orderedEntries;
  const filteredEntries = useMemo(() => {
    const searchTerms = tokenizeSearch(deferredFeedSearchQuery);
    if (searchTerms.length === 0) return visibleEntries;

    return visibleEntries.filter((entry) =>
      matchesKnowledgeSearch(entry, searchTerms),
    );
  }, [deferredFeedSearchQuery, visibleEntries]);
  const hasActiveSearch = feedSearchQuery.trim().length > 0;
  const hasActiveTopic = activeFeedTopic.id !== "all";
  const isIndependentFeedLoading =
    shouldUseIndependentFeed &&
    (activeTopicFeedState.isLoading ||
      (!activeTopicFeedState.hasLoaded && !activeTopicFeedState.error));
  const hasMoreIndependentEntries =
    shouldUseIndependentFeed &&
    !focusedEntryId &&
    activeTopicFeedState.hasLoaded &&
    activeTopicFeedState.hasMore &&
    Boolean(activeTopicFeedState.cursor);
  const hasMoreEntries =
    shouldUseIndependentFeed
      ? hasMoreIndependentEntries
      : !focusedEntryId &&
        hasMoreServerEntries &&
        Boolean(paginationCursorRef.current);
  const isActiveFeedLoadingMore = shouldUseIndependentFeed
    ? activeTopicFeedState.isLoadingMore
    : isLoadingMoreEntries;
  const shouldKeepLoadingEmptyFeed =
    (isIndependentFeedLoading && filteredEntries.length === 0 && !hasActiveSearch) ||
    (!focusedEntryId &&
      filteredEntries.length === 0 &&
      hasMoreEntries &&
      !hasActiveSearch &&
      !isActiveFeedLoadingMore &&
      (shouldUseIndependentFeed ? !activeTopicFeedState.error : !feedLoadError));

  const loadNextIndependentFeedPage = useCallback(
    async ({
      showLoadingState = true,
      surfaceErrors = true,
    }: LoadNextEntriesPageOptions = {}): Promise<FeedPageLoadResult> => {
      if (
        !shouldUseIndependentFeed ||
        activeTopicFeedState.isLoading ||
        activeTopicFeedState.isLoadingMore ||
        !activeTopicFeedState.hasMore ||
        !activeTopicFeedState.cursor
      ) {
        return activeTopicFeedState.isLoadingMore ? "blocked" : "done";
      }

      if (showLoadingState) {
        setTopicFeedStates((current) => {
          const existing = current[independentFeedKey];
          if (!existing || existing.isLoading || existing.isLoadingMore) {
            return current;
          }

          return {
            ...current,
            [independentFeedKey]: {
              ...existing,
              isLoadingMore: true,
              error: surfaceErrors ? null : existing.error,
            },
          };
        });
      }

      try {
        const page = await loadIndependentKnowledgeFeedEntries({
          topic: activeFeedTopic,
          selectedHashtag: normalizedSelectedHashtag,
          cursor: activeTopicFeedState.cursor,
        });

        setTopicFeedStates((current) => {
          const existing = current[independentFeedKey] || activeTopicFeedState;
          const nextEntries = mergeIndependentKnowledgeFeedEntries(
            existing.entries,
            page.entries,
            activeFeedTopic,
          );

          return {
            ...current,
            [independentFeedKey]: {
              ...existing,
              entries: nextEntries,
              isLoading: false,
              isLoadingMore: false,
              hasLoaded: true,
              hasMore: page.hasMore,
              cursor: page.cursor,
              error: null,
            },
          };
        });

        return page.hasMore ? "loaded" : "done";
      } catch (error) {
        console.error("Independent knowledge pagination error:", error);

        setTopicFeedStates((current) => {
          const existing = current[independentFeedKey] || activeTopicFeedState;

          return {
            ...current,
            [independentFeedKey]: {
              ...existing,
              isLoadingMore: false,
              hasLoaded: true,
              error: surfaceErrors
                ? activeFeedTopic.id === "trending"
                  ? "Could not load more trending posts right now. Please try again in a moment."
                  : normalizedSelectedHashtag
                    ? `Could not load more posts for #${normalizedSelectedHashtag} right now.`
                    : `Could not load more ${activeFeedTopic.label.toLowerCase()} posts right now.`
                : existing.error,
            },
          };
        });

        return "error";
      }
    },
    [
      activeFeedTopic,
      activeTopicFeedState,
      independentFeedKey,
      normalizedSelectedHashtag,
      shouldUseIndependentFeed,
    ],
  );

  const loadMoreActiveEntries = useCallback(
    (options?: LoadNextEntriesPageOptions) =>
      shouldUseIndependentFeed
        ? loadNextIndependentFeedPage(options)
        : loadNextEntriesPage(options),
    [loadNextEntriesPage, loadNextIndependentFeedPage, shouldUseIndependentFeed],
  );

  useEffect(() => {
    if (!isActive || !shouldUseIndependentFeed) return;
    if (activeTopicFeedState.isLoading || activeTopicFeedState.hasLoaded) return;

    let cancelled = false;

    setTopicFeedStates((current) => {
      const existing = current[independentFeedKey];
      if (existing?.isLoading || existing?.hasLoaded) return current;

      return {
        ...current,
        [independentFeedKey]: {
          entries: existing?.entries || [],
          isLoading: true,
          isLoadingMore: false,
          hasLoaded: false,
          hasMore: existing?.hasMore || false,
          cursor: existing?.cursor || null,
          error: null,
        },
      };
    });

    const loadFeed = async () => {
      try {
        const page = await loadIndependentKnowledgeFeedEntries({
          topic: activeFeedTopic,
          selectedHashtag: normalizedSelectedHashtag,
        });

        if (cancelled) return;

        setTopicFeedStates((current) => ({
          ...current,
          [independentFeedKey]: {
            entries: mergeIndependentKnowledgeFeedEntries(
              current[independentFeedKey]?.entries || [],
              page.entries,
              activeFeedTopic,
            ),
            isLoading: false,
            isLoadingMore: false,
            hasLoaded: true,
            hasMore: page.hasMore,
            cursor: page.cursor,
            error: null,
          },
        }));
      } catch (error) {
        if (cancelled) return;

        console.error("Independent knowledge feed error:", error);
        setTopicFeedStates((current) => ({
          ...current,
          [independentFeedKey]: {
            entries: current[independentFeedKey]?.entries || [],
            isLoading: false,
            isLoadingMore: false,
            hasLoaded: true,
            hasMore: current[independentFeedKey]?.hasMore || false,
            cursor: current[independentFeedKey]?.cursor || null,
            error:
              activeFeedTopic.id === "trending"
                ? "Could not load trending posts right now. Please try again in a moment."
                : normalizedSelectedHashtag
                  ? `Could not load posts for #${normalizedSelectedHashtag} right now.`
                  : `Could not load ${activeFeedTopic.label} posts right now.`,
          },
        }));
      }
    };

    void loadFeed();

    return () => {
      cancelled = true;
    };
  }, [
    activeFeedTopic,
    independentFeedKey,
    isActive,
    normalizedSelectedHashtag,
    shouldUseIndependentFeed,
  ]);

  useEffect(() => {
    if (!isActive || !hasMoreEntries || typeof window === "undefined") return;

    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;

    if (typeof window.IntersectionObserver !== "function") {
      return;
    }

    const observer = new window.IntersectionObserver(
      (observedEntries) => {
        if (!observedEntries.some((entry) => entry.isIntersecting)) {
          return;
        }

        void loadMoreActiveEntries();
      },
      {
        rootMargin: "600px 0px",
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreEntries, isActive, isActiveFeedLoadingMore, loadMoreActiveEntries]);

  useEffect(() => {
    if (
      !isActive ||
      !shouldKeepLoadingEmptyFeed ||
      isLoading ||
      isActiveFeedLoadingMore ||
      (!shouldUseIndependentFeed && isBackgroundLoadingEntries)
    ) {
      return;
    }

    void loadMoreActiveEntries({
      showLoadingState: true,
      surfaceErrors: true,
    });
  }, [
    isActive,
    isBackgroundLoadingEntries,
    isActiveFeedLoadingMore,
    isLoading,
    loadMoreActiveEntries,
    shouldKeepLoadingEmptyFeed,
    shouldUseIndependentFeed,
  ]);

  const filteredMentionProfiles = useMemo(() => {
    if (!activeMention) return [];

    return profiles
      .filter((profile) =>
        profile.usernameLower.startsWith(activeMention.query.toLowerCase()),
      )
      .slice(0, 6);
  }, [activeMention, profiles]);

  const updateMentionState = (value: string, cursorPosition: number) => {
    const beforeCursor = value.slice(0, cursorPosition);
    const match = beforeCursor.match(/(?:^|\s)@([a-z0-9_]*)$/i);

    if (!match) {
      setActiveMention(null);
      return;
    }

    const atIndex = beforeCursor.lastIndexOf("@");
    setActiveMention({
      query: match[1].toLowerCase(),
      start: atIndex,
    });
  };

  const resetComposer = () => {
    setDraftTitle("");
    setDraftContent("");
    setDraftVisibility("public");
    setHashtagInput("");
    setSelectedImages([]);
    setSelectedImageLayout(DEFAULT_IMAGE_LAYOUT);
    setActiveMention(null);
    setFeedMessage(null);
  };

  const publishKnowledge = async (currentIdentity: KnowledgeIdentity) => {
    const title = draftTitle.trim();
    const content = draftContent.trim();
    if (!title || !content) return;

    const seedHashtags = mergeHashtags(
      parseManualHashtags(hashtagInput),
      extractInlineHashtags(`${title}\n${content}`),
    );

    setFeedMessage(null);
    setIsModerating(true);

    const { moderateContent } = await import("../utils/contentModeration");
    const moderation = await moderateContent("knowledge-post", {
      title,
      content,
      hashtags: seedHashtags,
    });

    if (!moderation.allowed) {
      setIsModerating(false);
      setFeedMessage({
        tone: "warning",
        title: "Post blocked",
        body: [moderation.message, ...moderation.suggestions]
          .slice(0, 2)
          .join(" "),
      });
      return;
    }

    setIsModerating(false);
    setIsPosting(true);

    try {
      const hashtags = seedHashtags;
      const mentions = resolveMentions(`${title}\n${content}`, profiles);
      const createdAt = Date.now();
      const reference = doc(collection(db, "knowledge"));
      const preparedImages = selectedImages.map(({ fileName: _fileName, ...image }) => image);
      const primaryImage = preparedImages[0] || null;
      const entryPayload = {
        author: currentIdentity.displayName,
        authorId: currentIdentity.authorId,
        authorEmail: "",
        title,
        content,
        visibility: draftVisibility,
        hashtags,
        comments: [],
        likes: [],
        mentions,
        images: preparedImages,
        imageLayout: preparedImages.length > 0 ? selectedImageLayout : null,
        imageDataUrl: primaryImage?.dataUrl || null,
        imageMimeType: primaryImage?.mimeType || null,
        imageWidth: primaryImage?.width || null,
        imageHeight: primaryImage?.height || null,
        imageOptimizedAt: primaryImage?.optimizedAt || null,
        createdAt,
        updatedAt: createdAt,
        excerpt: createExcerpt(content, 180),
        readingMinutes: estimateReadMinutes(content),
        qualityScore: moderation.knowledgeScore,
      };

      await setDoc(reference, entryPayload);
      const createdEntry = normalizeKnowledgeEntry(reference.id, entryPayload);

      const { notifyTaggedUsers } = await import("../utils/notifications");
      await notifyTaggedUsers(
        {
          id: reference.id,
          title,
          authorId: currentIdentity.authorId,
        },
        {
          authorId: currentIdentity.authorId,
          username: currentIdentity.displayName,
        },
        mentions,
      );

      entriesRef.current = [
        createdEntry,
        ...entriesRef.current.filter((entry) => entry.id !== createdEntry.id),
      ];
      setEntries(entriesRef.current);
      setFeedEntryOrder((currentOrder) => [
        reference.id,
        ...currentOrder.filter((entryId) => entryId !== reference.id),
      ]);
      resetComposer();
      setShowComposer(false);
      onOpenEntry(reference.id);
    } catch (error) {
      console.error("Failed to publish knowledge:", error);
      setFeedMessage({
        tone: "warning",
        title: "Publish failed",
        body: "Could not publish this post. Please try again.",
      });
    } finally {
      setIsPosting(false);
    }
  };

  const handlePublish = () => {
    if (!draftTitle.trim() || !draftContent.trim()) return;

    if (!identity) {
      setPublishAfterAccess(true);
      setShowIdentityPrompt(true);
      return;
    }

    void publishKnowledge(identity);
  };

  const handleGoogleSignInForPublish = async () => {
    const nextIdentity = await signInWithGoogleAccount();
    onIdentityChange(nextIdentity);
    setShowIdentityPrompt(false);

    if (publishAfterAccess && draftTitle.trim() && draftContent.trim()) {
      setPublishAfterAccess(false);
      void publishKnowledge(nextIdentity);
      return;
    }

    setPublishAfterAccess(false);
  };

  const handleImageSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length !== files.length) {
      alert("Please choose image files only.");
    }

    const remainingSlots =
      selectedImageLayoutSettings.maxImages - selectedImages.length;
    if (remainingSlots <= 0) {
      setFeedMessage({
        tone: "warning",
        title: "Image limit reached",
        body: `This layout supports up to ${selectedImageLayoutSettings.maxImages} images.`,
      });
      event.target.value = "";
      return;
    }

    const filesToProcess = imageFiles.slice(0, remainingSlots);
    if (filesToProcess.length === 0) {
      event.target.value = "";
      return;
    }

    setFeedMessage(null);
    setIsPreparingImage(true);

    try {
      const { optimizeKnowledgeImageFile } = await import(
        "../utils/knowledgeImageOptimizer"
      );
      const optimizedImages: SelectedImage[] = [];

      for (const file of filesToProcess) {
        const optimizedImage = await optimizeKnowledgeImageFile(file, {
          targetRatio: selectedImageLayoutSettings.targetRatio,
          maxInlineChars: selectedImageLayoutSettings.maxInlineChars,
          maxDimension: selectedImageLayoutSettings.maxDimension,
        });

        optimizedImages.push({
          fileName: file.name,
          ...optimizedImage,
        });
      }

      const nextSelectedImages = [...selectedImages, ...optimizedImages];
      const combinedSize = nextSelectedImages.reduce(
        (total, image) => total + image.dataUrl.length,
        0,
      );

      if (combinedSize > MAX_TOTAL_INLINE_IMAGE_CHARS) {
        throw new Error(
          "These images are still too large together. Try fewer images or simpler images.",
        );
      }

      setSelectedImages(nextSelectedImages);

      if (imageFiles.length > remainingSlots) {
        setFeedMessage({
          tone: "warning",
          title: "Some images were skipped",
          body: `Only ${selectedImageLayoutSettings.maxImages} images fit in this ${selectedImageLayoutSettings.label} layout.`,
        });
      }
    } catch (error) {
      console.error("Image preparation failed:", error);
      alert(
        error instanceof Error ? error.message : "Could not prepare the image.",
      );
    } finally {
      setIsPreparingImage(false);
      event.target.value = "";
    }
  };

  const handleImageLayoutChange = (nextLayout: KnowledgeImageLayout) => {
    if (nextLayout === selectedImageLayout) return;

    setSelectedImageLayout(nextLayout);

    if (selectedImages.length > 0) {
      setSelectedImages([]);
      setFeedMessage({
        tone: "warning",
        title: "Image layout changed",
        body: "Add images again so they match the new ratio and layout.",
      });
    }
  };

  const handleRemoveSelectedImage = (indexToRemove: number) => {
    setSelectedImages((current) =>
      current.filter((_, index) => index !== indexToRemove),
    );
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
      }),
    );
    setPendingAction(null);
  };

  const handleMentionInsert = (profile: UserProfile) => {
    if (!activeMention || !contentRef.current) return;

    const textarea = contentRef.current;
    const cursor = textarea.selectionStart;
    const before = draftContent.slice(0, activeMention.start);
    const after = draftContent.slice(cursor);
    const inserted = `@${profile.username} `;
    const nextValue = `${before}${inserted}${after}`;

    setDraftContent(nextValue);
    setActiveMention(null);

    requestAnimationFrame(() => {
      textarea.focus();
      const nextCursor = before.length + inserted.length;
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleContentKeyUp = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    updateMentionState(
      event.currentTarget.value,
      event.currentTarget.selectionStart,
    );
  };

  const handleSelectHashtag = useCallback((tag: string) => {
    const normalizedTag = tag.trim().toLowerCase();
    if (!normalizedTag) return;

    navigateToRoute("knowledge", { selectedHashtag: normalizedTag });
  }, []);

  const handleSelectFeedTopic = useCallback(
    (topicId: FeedTopicId) => {
      if (topicId === selectedFeedTopic) return;

      setSelectedFeedTopic(topicId);
      window.requestAnimationFrame(() => scrollKnowledgeFeedToTop("smooth"));
    },
    [selectedFeedTopic],
  );

  const clearSelectedHashtag = useCallback(() => {
    navigateToRoute("knowledge");
  }, []);

  const handleIdentityRequired = useCallback(
    (action: NonNullable<PendingAction>) => setPendingAction(action),
    [],
  );

  const handleLikeChange = useCallback(
    (entryId: string, likes: string[]) => {
      const likedByCurrentUser = Boolean(
        currentAuthorId && likes.includes(currentAuthorId),
      );
      setVisibleLikedEntryIds((currentIds) => {
        const nextIds = likedByCurrentUser
          ? [...new Set([...currentIds, entryId])]
          : currentIds.filter((id) => id !== entryId);

        visibleLikedEntryIdsRef.current = nextIds;
        return nextIds;
      });

      entriesRef.current = entriesRef.current.map((entry) =>
        entry.id === entryId ? { ...entry, likes } : entry,
      );
      setTopicFeedStates((current) => {
        let didUpdate = false;
        const nextStates = Object.fromEntries(
          Object.entries(current).map(([key, state]) => {
            let didUpdateState = false;
            const nextEntries = state.entries.map((entry) => {
              if (entry.id !== entryId) return entry;

              didUpdate = true;
              didUpdateState = true;
              return { ...entry, likes };
            });

            return [
              key,
              didUpdateState ? { ...state, entries: nextEntries } : state,
            ];
          }),
        );

        return didUpdate ? nextStates : current;
      });
    },
    [currentAuthorId],
  );

  const pageTitle = focusedEntry
    ? `${focusedEntry.title} | Readative`
    : selectedHashtag
      ? `#${selectedHashtag} posts | Readative`
      : "Home Feed | Readative";
  const pageDescription = focusedEntry
    ? createExcerpt(focusedEntry.content)
    : selectedHashtag
      ? `Explore Readative knowledge posts tagged #${selectedHashtag}.`
      : "Readative is a knowledge feed for discovering and publishing practical posts, visual explainers, study notes, AI tools, SmartTalk Q&A, and creator profiles.";
  const pageUrl = focusedEntry
    ? buildAbsoluteRouteUrl("knowledge", { focusedEntryId: focusedEntry.id })
    : selectedHashtag
      ? buildAbsoluteRouteUrl("knowledge", { selectedHashtag })
      : buildAbsoluteRouteUrl("knowledge");
  const isPaginationBusy = shouldUseIndependentFeed
    ? activeTopicFeedState.isLoading || activeTopicFeedState.isLoadingMore
    : isLoadingMoreEntries || isBackgroundLoadingEntries;

  return (
    <div className="pb-20">
      <SEO
        title={pageTitle}
        description={pageDescription}
        keywords={[
          "homepage",
          "knowledge posts",
          "learning feed",
          "readative",
          ...(selectedHashtag ? [selectedHashtag] : []),
        ]}
        type={focusedEntry ? "article" : "website"}
        url={pageUrl}
        schema={buildKnowledgeSchemas(focusedEntry)}
        image={
          focusedEntryPrimaryImage?.dataUrl &&
          !focusedEntryPrimaryImage.dataUrl.startsWith("data:")
            ? focusedEntryPrimaryImage.dataUrl
            : undefined
        }
      />

      {isLoading ? (
        <div className="flex flex-col items-center gap-3 py-20">
          <ReadativeLoader size="md" label="Loading posts..." />
        </div>
      ) : (
        <div className="space-y-6">
          {feedLoadError && !shouldUseIndependentFeed && (
            <FeedNotice title="Feed loading issue" body={feedLoadError} />
          )}

          {shouldUseIndependentFeed && activeTopicFeedState.error && (
            <FeedNotice
              title="Category loading issue"
              body={activeTopicFeedState.error}
            />
          )}

          {profilesLoadError && (
            <FeedNotice
              title="Profile directory issue"
              body={profilesLoadError}
            />
          )}

          <div className="space-y-3">
            <DiscoverySearch
              theme="emerald"
              placeholder="Search"
              value={feedSearchQuery}
              onChange={setFeedSearchQuery}
              onClear={() => setFeedSearchQuery("")}
              ariaLabel="Search home feed"
            />

            <div
              className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-label="Post categories"
            >
              <div className="flex min-w-max items-center gap-2 pb-1">
                {FEED_TOPIC_FILTERS.map((topic) => {
                  const TopicIcon = topic.icon;
                  const isActive = topic.id === activeFeedTopic.id;

                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => handleSelectFeedTopic(topic.id)}
                      aria-pressed={isActive}
                      aria-label={
                        topic.id === "all"
                          ? "Show all posts"
                          : `Show ${topic.label} posts`
                      }
                      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors ${
                        isActive
                          ? "border-emerald-500 bg-emerald-600 text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                      }`}
                    >
                      <TopicIcon className="h-3.5 w-3.5" />
                      <span>{topic.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {showRefreshFeedback && (
            <p className="text-center text-xs font-medium text-emerald-700">
              Posts refreshed and reshuffled
            </p>
          )}

          {selectedHashtag && (
            <div className="rounded-[28px] border border-emerald-200 bg-emerald-50/80 px-5 py-4 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">
                    Hashtag View
                  </p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                    Showing posts for #{selectedHashtag}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {visibleEntries.length} related post
                    {visibleEntries.length === 1 ? "" : "s"} found.
                  </p>
                </div>
                <button
                  onClick={clearSelectedHashtag}
                  className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                  Clear filter
                </button>
              </div>
            </div>
          )}

          {filteredEntries.length === 0 ? (
            shouldKeepLoadingEmptyFeed ? (
              <div className="rounded-[30px] border border-dashed border-slate-300 bg-white px-6 py-20 text-center shadow-sm">
                <ReadativeLoader
                  size="md"
                  label={
                    shouldUseIndependentFeed
                      ? `Loading ${activeFeedTopic.label.toLowerCase()} posts...`
                      : "Loading posts..."
                  }
                />
              </div>
            ) : (
              <div className="rounded-[30px] border border-dashed border-slate-300 bg-white px-6 py-20 text-center shadow-sm">
                <BookOpenText className="mx-auto h-10 w-10 text-slate-300" />
                <h3 className="mt-4 text-xl font-black text-slate-900">
                  {hasActiveSearch
                    ? `No posts matched "${feedSearchQuery.trim()}"`
                    : hasActiveTopic && selectedHashtag
                      ? `No ${activeFeedTopic.label} posts for #${selectedHashtag}`
                      : hasActiveTopic
                        ? `No ${activeFeedTopic.label} posts found`
                        : selectedHashtag
                          ? `No posts for #${selectedHashtag}`
                          : "No posts yet"}
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  {hasActiveSearch
                    ? "Try a broader keyword, another hashtag, or search by @username."
                    : hasActiveTopic
                      ? "Try another category or search by a more specific hashtag."
                      : selectedHashtag
                        ? "Try another hashtag or clear this filter to explore the full feed."
                        : "Tap the `+` button at the top to upload the first knowledge post."}
                </p>
                {hasMoreEntries && (
                  <button
                    type="button"
                    onClick={() => void loadMoreActiveEntries()}
                    disabled={isPaginationBusy}
                    className="mt-5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500 transition-colors hover:border-emerald-200 hover:text-emerald-700 disabled:opacity-50"
                  >
                    {isActiveFeedLoadingMore ? "Loading posts..." : "Load more posts"}
                  </button>
                )}
              </div>
            )
          ) : (
            <div className="space-y-4">
              <KnowledgeCardList
                entries={filteredEntries}
                currentIdentity={identity}
                profiles={profiles}
                onVisible={markKnowledgeEntrySeen}
                onIdentityRequired={handleIdentityRequired}
                onOpenProfile={onOpenProfile}
                onOpenEntry={onOpenEntry}
                onSelectHashtag={handleSelectHashtag}
                onLikeChange={handleLikeChange}
                highlightedEntryId={focusedEntryId}
              />
              {hasMoreEntries && (
                <div
                  ref={loadMoreSentinelRef}
                  className="py-4 text-center"
                >
                  <button
                    type="button"
                    onClick={() => void loadMoreActiveEntries()}
                    disabled={isPaginationBusy}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500 transition-colors hover:border-emerald-200 hover:text-emerald-700 disabled:opacity-50"
                  >
                    {isActiveFeedLoadingMore ? "Loading posts..." : "Load more posts"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showComposer && (
        <ComposerModal
          identity={identity}
          onOpenProfile={onOpenProfile}
          onClose={() => {
            if (isPosting || isModerating || isPreparingImage) return;
            setShowComposer(false);
            setFeedMessage(null);
          }}
          draftTitle={draftTitle}
          setDraftTitle={setDraftTitle}
          draftContent={draftContent}
          setDraftContent={setDraftContent}
          draftVisibility={draftVisibility}
          setDraftVisibility={setDraftVisibility}
          hashtagInput={hashtagInput}
          setHashtagInput={setHashtagInput}
          selectedImages={selectedImages}
          selectedImageLayout={selectedImageLayout}
          onImageLayoutChange={handleImageLayoutChange}
          onRemoveSelectedImage={handleRemoveSelectedImage}
          isPosting={isPosting}
          isModerating={isModerating}
          isPreparingImage={isPreparingImage}
          feedMessage={feedMessage}
          handlePublish={handlePublish}
          handleImageSelected={handleImageSelected}
          contentRef={contentRef}
          activeMention={activeMention}
          filteredMentionProfiles={filteredMentionProfiles}
          handleMentionInsert={handleMentionInsert}
          handleContentKeyUp={handleContentKeyUp}
          updateMentionState={updateMentionState}
        />
      )}

      {showIdentityPrompt && (
        <GoogleSignInPrompt
          title="Sign in to publish"
          description="Use your Google account to publish. Everyone can still read posts without signing in, and your content stays saved to your profile."
          submitLabel="Continue with Google"
          onConfirm={handleGoogleSignInForPublish}
          onClose={() => {
            setPublishAfterAccess(false);
            setShowIdentityPrompt(false);
          }}
        />
      )}

      {pendingAction && (
        <GoogleSignInPrompt
          title={
            pendingAction.type === "like"
              ? "Sign in to like"
              : "Sign in to comment"
          }
          description="Use your Google account so this activity is saved to your Readative profile on every browser and device."
          submitLabel="Continue with Google"
          onConfirm={handleGoogleSignInForPendingAction}
          onClose={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}

function ComposerModal({
  identity,
  onOpenProfile,
  onClose,
  draftTitle,
  setDraftTitle,
  draftContent,
  setDraftContent,
  draftVisibility,
  setDraftVisibility,
  hashtagInput,
  setHashtagInput,
  selectedImages,
  selectedImageLayout,
  onImageLayoutChange,
  onRemoveSelectedImage,
  isPosting,
  isModerating,
  isPreparingImage,
  feedMessage,
  handlePublish,
  handleImageSelected,
  contentRef,
  activeMention,
  filteredMentionProfiles,
  handleMentionInsert,
  handleContentKeyUp,
  updateMentionState,
}: {
  identity: KnowledgeIdentity | null;
  onOpenProfile: (authorId: string) => void;
  onClose: () => void;
  draftTitle: string;
  setDraftTitle: (value: string) => void;
  draftContent: string;
  setDraftContent: (value: string) => void;
  draftVisibility: KnowledgeVisibility;
  setDraftVisibility: (value: KnowledgeVisibility) => void;
  hashtagInput: string;
  setHashtagInput: (value: string) => void;
  selectedImages: SelectedImage[];
  selectedImageLayout: KnowledgeImageLayout;
  onImageLayoutChange: (layout: KnowledgeImageLayout) => void;
  onRemoveSelectedImage: (index: number) => void;
  isPosting: boolean;
  isModerating: boolean;
  isPreparingImage: boolean;
  feedMessage: FeedMessage | null;
  handlePublish: () => void;
  handleImageSelected: (event: ChangeEvent<HTMLInputElement>) => void;
  contentRef: RefObject<HTMLTextAreaElement | null>;
  activeMention: MentionState | null;
  filteredMentionProfiles: UserProfile[];
  handleMentionInsert: (profile: UserProfile) => void;
  handleContentKeyUp: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  updateMentionState: (value: string, cursorPosition: number) => void;
}) {
  const selectedImageLayoutSettings =
    getKnowledgeImageLayoutSettings(selectedImageLayout);

  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center overflow-y-auto bg-slate-950/35 p-3 pt-16 backdrop-blur-sm sm:p-4 sm:pt-20">
      <div className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.2)] md:max-h-[calc(100vh-6rem)]">
        <div className="shrink-0 border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close composer"
          >
            <X className="h-4 w-4" />
          </button>

          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
            New Post
          </p>
          <h2 className="mt-1 pr-10 text-2xl font-black tracking-tight text-slate-950">
            Create knowledge
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-4 p-5 sm:p-6">
            {identity ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-800 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    Posting as @{identity.displayName}
                  </p>
                </div>
                <button
                  onClick={() => onOpenProfile(identity.authorId)}
                  className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700"
                >
                  Profile
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Sign in to publish.
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
              {(
                [
                  ["public", "Public", Globe2],
                  ["private", "Private", Lock],
                ] as const
              ).map(([visibility, label, Icon]) => (
                <button
                  key={visibility}
                  type="button"
                  onClick={() => setDraftVisibility(visibility)}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                    draftVisibility === visibility
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            <div className="grid gap-4">
              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder="Post title"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-bold text-slate-900 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />

              <div className="relative">
                <textarea
                  ref={contentRef}
                  value={draftContent}
                  onChange={(event) => {
                    setDraftContent(event.target.value);
                    updateMentionState(
                      event.target.value,
                      event.target.selectionStart,
                    );
                  }}
                  onKeyUp={handleContentKeyUp}
                  onClick={(event) =>
                    updateMentionState(
                      event.currentTarget.value,
                      event.currentTarget.selectionStart,
                    )
                  }
                  placeholder="Write your post. Tag people with @username."
                  className="min-h-[180px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-4 text-[15px] leading-7 text-slate-700 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />

                {activeMention && filteredMentionProfiles.length > 0 && (
                  <div className="absolute left-4 right-4 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                    {filteredMentionProfiles.map((profile) => (
                      <button
                        key={profile.id}
                        onClick={() => handleMentionInsert(profile)}
                        className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left text-sm last:border-b-0 hover:bg-emerald-50"
                      >
                        <span className="font-semibold text-slate-800">
                          @{profile.username}
                        </span>
                        <span className="text-xs text-slate-400">User</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-[1.2fr,1fr]">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    <Tag className="h-4 w-4" />
                    Hashtags
                  </div>
                  <input
                    value={hashtagInput}
                    onChange={(event) => setHashtagInput(event.target.value)}
                    placeholder="#science #history #productivity"
                    className="w-full bg-transparent text-sm text-slate-700 outline-none"
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                        Images
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {selectedImages.length}/{selectedImageLayoutSettings.maxImages} selected
                      </p>
                    </div>

                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700 transition-colors hover:bg-emerald-100">
                      <ImagePlus className="h-4 w-4" />
                      Add
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageSelected}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(
                      [
                        ["wide", "Wide"],
                        ["portrait", "Portrait"],
                      ] as const
                    ).map(([layout, label]) => (
                      <button
                        key={layout}
                        onClick={() => onImageLayoutChange(layout)}
                        className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
                          selectedImageLayout === layout
                            ? "bg-emerald-600 text-white"
                            : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-emerald-50 hover:text-emerald-700"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                </div>
              </div>

              {selectedImages.length > 0 && (
                <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
                  <KnowledgeImageCarousel
                    images={selectedImages}
                    layout={selectedImageLayout}
                    altBase="Selected post image"
                    mode="composer"
                    renderOverlayAction={(_, index) => (
                      <button
                        onClick={() => onRemoveSelectedImage(index)}
                        className="rounded-full bg-slate-950/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-md transition-colors hover:bg-rose-500"
                      >
                        Remove
                      </button>
                    )}
                  />
                  <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                      {selectedImages.length} ready
                    </span>
                  </div>
                </div>
              )}

              {feedMessage && (
                <div
                  className={`rounded-3xl border px-4 py-4 text-sm ${
                    feedMessage.tone === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  <p className="font-bold">{feedMessage.title}</p>
                  <p className="mt-1 leading-6">{feedMessage.body}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div className="flex justify-end">
            <button
              onClick={handlePublish}
              disabled={
                isPosting ||
                isModerating ||
                isPreparingImage ||
                !draftTitle.trim() ||
                !draftContent.trim()
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-700 disabled:opacity-50 sm:w-auto"
            >
              {isPosting || isModerating || isPreparingImage ? (
                <ReadativeLoader size="xs" tone="light" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isModerating ? "Checking..." : "Publish post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeedNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 shadow-sm">
      <p className="font-bold">{title}</p>
      <p className="mt-1 leading-6">{body}</p>
    </div>
  );
}
