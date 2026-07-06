import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import {
  type KnowledgeComment,
  type KnowledgeEntry,
} from "../../types";
import {
  buildAbsoluteRouteUrl,
  parseRouteFromLocation,
} from "../../utils/routes";
import {
  getKnowledgeFeedSnapshot,
  reconcileKnowledgeFeedOrder,
  rankKnowledgeEntries,
} from "../../utils/feedPersonalization";
import { getGuestId } from "../../utils/guestIdentity";
import {
  getKnowledgeEntryImageLayout,
  getKnowledgeEntryImages,
} from "../../utils/knowledgeImages";
import {
  normalizeKnowledgeVisibility,
} from "../../utils/knowledgePrivacy";
import { createExcerpt } from "../../utils/knowledgeEntryHelpers";
import {
  mergeTrustIds,
  normalizeTrustCount,
  normalizeTrustIdArray,
} from "../../utils/trustSystem";
import { getSaveMetrics } from "../../utils/bookmarks";
import {
  buildArticleSchema,
  buildBreadcrumbSchema,
  buildCollectionPageSchema,
  buildItemListSchema,
  buildOrganizationSchema,
  buildWebSiteSchema,
} from "../../utils/seoSchemas";
import {
  type CachedKnowledgeFeed,
  type IndependentKnowledgeFeedPage,
  type BrowserIdleCallbacks,
  type PendingFeedStorageWrite,
  type FeedTopicFilter,
  type FeedTopicId,
} from "./feedTypes";
import {
  normalizeFeedTopicId,
} from "./feedFilters";
export { tokenizeSearch } from "../../utils/searchHelpers";

export const MAX_TOTAL_INLINE_IMAGE_CHARS = 760_000;
export const FEED_INITIAL_PAGE_SIZE = 10;
export const FEED_NEXT_PAGE_SIZE = 5;
export const FEED_LOAD_MORE_REMAINING_THRESHOLD = 5;
export const FEED_LOAD_TIMEOUT_MS = 7000;
export const FEED_BACKGROUND_PAGE_DELAY_MS = 1200;
export const FEED_BACKGROUND_PREFETCH_PAGE_LIMIT = 0;
export const FEED_CACHE_STORAGE_WRITE_TIMEOUT_MS = 1800;
export const FEED_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
export const FEED_CACHE_MEMORY_ENTRY_LIMIT = 120;
export const FEED_CACHE_STORAGE_ENTRY_LIMIT = 32;
export const FEED_CACHE_STORAGE_IMAGE_CHAR_BUDGET = 900_000;
export const FEED_CACHE_KEY_PREFIX = "readativeKnowledgeFeedCache:v2";
export const FEED_CACHE_LEGACY_KEY_PREFIXES = ["readativeKnowledgeFeedCache:v1"];
export const FEED_SCROLL_STORAGE_KEY_PREFIX = "readativeKnowledgeFeedScroll:v1";
export const PROFILE_DIRECTORY_IDLE_TIMEOUT_MS = 2600;
export const PROFILE_DIRECTORY_LIMIT = 80;
export const TRENDING_FEED_LIMIT = FEED_INITIAL_PAGE_SIZE;
export const TRENDING_CANDIDATE_PAGE_MULTIPLIER = 8;
export const CATEGORY_FALLBACK_PAGE_MULTIPLIER = 8;
export const FIRESTORE_ARRAY_CONTAINS_ANY_LIMIT = 30;

const knowledgeFeedMemoryCache = new Map<string, CachedKnowledgeFeed>();
const knowledgeFeedScrollPositions = new Map<string, number>();
const pendingFeedStorageWrites = new Map<string, PendingFeedStorageWrite>();

export function matchesKnowledgeSearch(entry: KnowledgeEntry, terms: string[]) {
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

export function normalizeKnowledgeTopicValue(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9+#\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeStoredHashtagValue(value: string) {
  return value.replace(/^#/, "").trim().toLowerCase();
}

export function getStrictHashtagValues(value: string) {
  const values = new Set<string>();
  const normalizedValue = normalizeKnowledgeTopicValue(value.replace(/^#/, ""));
  if (!normalizedValue) return [];

  const valueTokens = normalizedValue.split(/\s+/).filter(Boolean);
  const compactValue = valueTokens.join("");
  const dashedValue = valueTokens.join("-");
  const underscoredValue = valueTokens.join("_");

  [normalizedValue, compactValue, dashedValue, underscoredValue]
    .map(normalizeStoredHashtagValue)
    .filter((tagValue) => tagValue && !tagValue.includes(" "))
    .forEach((tagValue) => values.add(tagValue));

  if (valueTokens.length === 1) {
    const [token] = valueTokens;
    if (token.length > 2 && !token.endsWith("s") && !token.endsWith("ing")) {
      values.add(`${token}s`);
    }

    if (
      token.length > 3 &&
      token.endsWith("s") &&
      !token.endsWith("ss") &&
      !token.endsWith("news")
    ) {
      values.add(token.slice(0, -1));
    }
  }

  return [...values];
}

export function getTopicHashtagQueryValues(topic: FeedTopicFilter) {
  if (topic.id === "all" || topic.id === "trending") return [];

  const values = new Set<string>();
  topic.keywords.forEach((keyword) => {
    getStrictHashtagValues(keyword).forEach((value) => values.add(value));
  });

  return [...values].slice(0, FIRESTORE_ARRAY_CONTAINS_ANY_LIMIT);
}

export function getEntryHashtagValues(entry: Pick<KnowledgeEntry, "hashtags">) {
  return new Set(
    entry.hashtags.flatMap((tag) => getStrictHashtagValues(tag)),
  );
}

export function matchesKnowledgeTopic(entry: KnowledgeEntry, topic: FeedTopicFilter) {
  if (topic.id === "all" || topic.id === "trending") return true;

  const topicHashtagValues = getTopicHashtagQueryValues(topic);
  if (topicHashtagValues.length === 0) return false;

  const entryHashtagValues = getEntryHashtagValues(entry);
  return topicHashtagValues.some((value) => entryHashtagValues.has(value));
}

export function getKnowledgeTrendingScore(entry: KnowledgeEntry) {
  const now = Date.now();
  const ageHours = Math.max(1, (now - entry.createdAt) / 3_600_000);
  const recencyBoost = Math.max(0, 6 - ageHours / 18);
  const qualityBoost = Math.max(0, (entry.qualityScore || 0) / 25);
  const likeCount = getKnowledgeEntryLikeCount(entry);
  const commentCount = (entry.comments || []).length;

  return (
    likeCount * 8 +
    commentCount * 4 +
    qualityBoost +
    recencyBoost
  );
}

export function getTrendingKnowledgeEntries(
  entries: KnowledgeEntry[],
  maxEntries = TRENDING_FEED_LIMIT,
) {
  if (entries.length <= 1) {
    return entries.filter((entry) => getKnowledgeEntryLikeCount(entry) > 0);
  }

  const rankedEntries = [...entries].sort((left, right) => {
    const likeDifference =
      getKnowledgeEntryLikeCount(right) - getKnowledgeEntryLikeCount(left);
    if (likeDifference !== 0) return likeDifference;

    const scoreDifference =
      getKnowledgeTrendingScore(right) - getKnowledgeTrendingScore(left);

    if (scoreDifference !== 0) return scoreDifference;
    return right.createdAt - left.createdAt;
  });
  const engagedEntries = rankedEntries.filter(
    (entry) => getKnowledgeEntryLikeCount(entry) > 0,
  );

  return engagedEntries.slice(0, Math.min(maxEntries, engagedEntries.length));
}

export function getKnowledgeEntriesForTopic(
  entries: KnowledgeEntry[],
  topic: FeedTopicFilter,
) {
  if (topic.id === "all") return entries;
  if (topic.id === "trending") return getTrendingKnowledgeEntries(entries);

  return entries.filter((entry) => matchesKnowledgeTopic(entry, topic));
}

export function getKnowledgeEntryLikeCount(
  entry: Pick<KnowledgeEntry, "likes"> & Partial<Pick<KnowledgeEntry, "likeCount">>,
) {
  const storedLikeCount =
    typeof entry.likeCount === "number" && Number.isFinite(entry.likeCount)
      ? entry.likeCount
      : 0;

  return Math.max((entry.likes || []).length, storedLikeCount);
}

export function buildKnowledgeSchemas({
  entry,
  activeTopic,
  selectedHashtag,
  entries,
  pageUrl,
}: {
  entry: KnowledgeEntry | null;
  activeTopic: FeedTopicFilter;
  selectedHashtag: string | null;
  entries: KnowledgeEntry[];
  pageUrl: string;
}) {
  const category = activeTopic.category;
  const collectionName = entry
    ? "Readative Knowledge Feed"
    : selectedHashtag
      ? `#${selectedHashtag} Posts`
      : category
        ? `${category.label} Knowledge Posts`
        : activeTopic.id === "trending"
          ? "Trending Knowledge Posts"
          : "Readative Knowledge Feed";
  const collectionDescription = category
    ? category.description
    : selectedHashtag
      ? `Readative posts tagged #${selectedHashtag}.`
      : "Readative's knowledge feed helps people discover practical insights, visual explainers, AI tools, study notes, SmartTalk ideas, and creator expertise.";
  const itemList = buildItemListSchema({
    name: `${collectionName} List`,
    url: pageUrl,
    items: entries.slice(0, 10).map((listEntry) => ({
      name: listEntry.title,
      url: buildAbsoluteRouteUrl("knowledge", {
        focusedEntryId: listEntry.id,
      }),
      description: createExcerpt(listEntry.content),
    })),
  });
  const collectionSchema = buildCollectionPageSchema({
    name: collectionName,
    url: pageUrl,
    description: collectionDescription,
    about: category ? [category.label, ...category.examples] : selectedHashtag || "Knowledge",
    itemList,
  });
  const breadcrumbItems = [
    { name: "Home", url: "/" },
    ...(category ? [{ name: category.label, url: category.path }] : []),
    ...(selectedHashtag && !entry
      ? [{ name: `#${selectedHashtag}`, url: `/tag/${selectedHashtag}` }]
      : []),
    ...(entry
      ? [
          {
            name: entry.title,
            url: buildAbsoluteRouteUrl("knowledge", {
              focusedEntryId: entry.id,
            }),
          },
        ]
      : []),
  ];
  const baseSchemas = [
    buildOrganizationSchema(),
    buildWebSiteSchema(),
    collectionSchema,
    buildBreadcrumbSchema(breadcrumbItems),
  ];

  if (!entry) {
    return baseSchemas;
  }

  const primaryImage = getKnowledgeEntryImages(entry)[0] || null;

  return [
    ...baseSchemas,
    buildArticleSchema({
      headline: entry.title,
      description: createExcerpt(entry.content),
      authorName: `@${entry.author}`,
      authorUrl: entry.authorId
        ? buildAbsoluteRouteUrl("profile", { profileAuthorId: entry.authorId })
        : undefined,
      datePublished: new Date(entry.createdAt).toISOString(),
      dateModified: entry.updatedAt ? new Date(entry.updatedAt).toISOString() : undefined,
      keywords: entry.hashtags,
      section: category?.label || entry.category || undefined,
      url: buildAbsoluteRouteUrl("knowledge", {
        focusedEntryId: entry.id,
      }),
      image:
        primaryImage?.dataUrl && !primaryImage.dataUrl.startsWith("data:")
          ? primaryImage.dataUrl
          : undefined,
    }),
  ];
}

export function normalizeKnowledgeTimestamp(value: unknown, fallback = Date.now()) {
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

export function normalizeKnowledgeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return [...new Set(value)]
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/^#/, "").trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeKnowledgeComments(comments: unknown): KnowledgeComment[] {
  if (!Array.isArray(comments)) return [];

  return comments
    .filter((comment): comment is Partial<KnowledgeComment> =>
      Boolean(comment && typeof comment === "object"),
    )
    .map((comment) => ({
      id:
        typeof comment.id === "string" && comment.id.trim()
          ? comment.id
          : Math.random().toString(36).slice(2, 11),
      author: typeof comment.author === "string" ? comment.author : "Unknown",
      ...(typeof comment.authorId === "string" && comment.authorId
        ? { authorId: comment.authorId }
        : {}),
      text: typeof comment.text === "string" ? comment.text : "",
      mentions: Array.isArray(comment.mentions) ? comment.mentions : [],
      createdAt: normalizeKnowledgeTimestamp(comment.createdAt),
    }));
}

export function readLegacyKnowledgeAuthorId(
  data: Partial<KnowledgeEntry> & Record<string, unknown>,
) {
  const candidates = [
    data.authorId,
    data.userId,
    data.uid,
    data.authorUid,
    data.userUid,
    data.creatorId,
    data.ownerId,
    data.createdBy,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
}

export function normalizeKnowledgeEntry(
  id: string,
  data: Partial<KnowledgeEntry> & {
    createdAt?: unknown;
    updatedAt?: unknown;
  },
): KnowledgeEntry {
  const {
    author,
    authorId,
    authorEmail,
    title,
    content,
    hashtags,
    comments,
    createdAt,
    updatedAt,
    likes,
    likeCount,
    helpfulIds,
    helpfulCount,
    dislikes,
    dislikeCount,
    misleadingIds,
    misleadingCount,
    savedBy,
    saveCount,
    mentions,
    images,
    imageLayout,
    visibility,
    ...restData
  } = data;
  const normalizedHelpfulIds = mergeTrustIds(
    normalizeTrustIdArray(likes),
    normalizeTrustIdArray(helpfulIds),
  );
  const normalizedMisleadingIds = mergeTrustIds(
    normalizeTrustIdArray(dislikes),
    normalizeTrustIdArray(misleadingIds),
  );
  const normalizedHelpfulCount = Math.max(
    normalizedHelpfulIds.length,
    normalizeTrustCount(likeCount),
    normalizeTrustCount(helpfulCount),
  );
  const normalizedMisleadingCount = Math.max(
    normalizedMisleadingIds.length,
    normalizeTrustCount(dislikeCount),
    normalizeTrustCount(misleadingCount),
  );
  const normalizedCreatedAt = normalizeKnowledgeTimestamp(createdAt);
  const normalizedUpdatedAt =
    updatedAt === null || updatedAt === undefined
      ? null
      : normalizeKnowledgeTimestamp(updatedAt, normalizedCreatedAt);
  const saveMetrics = getSaveMetrics({ savedBy, saveCount });
  const normalizedAuthorId = readLegacyKnowledgeAuthorId(
    data as Partial<KnowledgeEntry> & Record<string, unknown>,
  );

  return {
    author: typeof author === "string" ? author : "",
    authorId: normalizedAuthorId,
    authorEmail: typeof authorEmail === "string" ? authorEmail : "",
    title: typeof title === "string" ? title : "",
    content: typeof content === "string" ? content : "",
    visibility: normalizeKnowledgeVisibility(visibility),
    ...restData,
    id,
    hashtags: normalizeKnowledgeStringArray(hashtags),
    likes: normalizedHelpfulIds,
    likeCount: normalizedHelpfulCount,
    helpfulIds: normalizedHelpfulIds,
    helpfulCount: normalizedHelpfulCount,
    dislikes: normalizedMisleadingIds,
    dislikeCount: normalizedMisleadingCount,
    misleadingIds: normalizedMisleadingIds,
    misleadingCount: normalizedMisleadingCount,
    savedBy: saveMetrics.savedBy,
    saveCount: saveMetrics.saveCount,
    mentions: Array.isArray(mentions) ? mentions : [],
    images: Array.isArray(images) ? images : [],
    imageLayout:
      imageLayout === "wide" || imageLayout === "portrait" ? imageLayout : null,
    comments: normalizeKnowledgeComments(comments),
    createdAt: normalizedCreatedAt,
    updatedAt: normalizedUpdatedAt,
  };
}

export function getKnowledgeFeedCacheKey(authorId?: string | null) {
  const ownerId =
    authorId?.trim() || (typeof window === "undefined" ? "server" : getGuestId());
  return `${FEED_CACHE_KEY_PREFIX}:${ownerId}`;
}

export function getKnowledgeFeedScrollKey(feedKey: string) {
  return `${FEED_SCROLL_STORAGE_KEY_PREFIX}:${feedKey}`;
}

export function readKnowledgeFeedScrollPosition(feedKey: string) {
  return knowledgeFeedScrollPositions.get(getKnowledgeFeedScrollKey(feedKey)) || 0;
}

export function writeKnowledgeFeedScrollPosition(feedKey: string, scrollY: number) {
  if (typeof window === "undefined") return;

  knowledgeFeedScrollPositions.set(
    getKnowledgeFeedScrollKey(feedKey),
    Math.max(0, Math.round(scrollY)),
  );
}

export function normalizeCacheStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeCachedKnowledgeFeed(value: unknown): CachedKnowledgeFeed | null {
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

  return {
    entries,
    visibleLikedEntryIds: normalizeCacheStringArray(candidate.visibleLikedEntryIds),
    hasMoreServerEntries: candidate.hasMoreServerEntries !== false,
    cachedAt,
  };
}

export function readKnowledgeFeedCache(authorId?: string | null): CachedKnowledgeFeed | null {
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

export function stripEntryImagesForStorage(entry: KnowledgeEntry): KnowledgeEntry {
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

export function keepEntryImagesForStorage(entry: KnowledgeEntry): KnowledgeEntry {
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

export function prepareEntriesForStorageCache(entries: KnowledgeEntry[]) {
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

export function removeLegacyKnowledgeFeedStorageCaches() {
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

export function writeKnowledgeFeedStorageCache(
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

export function scheduleKnowledgeFeedStorageCacheWrite(
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

export function writeKnowledgeFeedCache(
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

export function isEntryLikedByAuthor(entry: KnowledgeEntry, authorId?: string | null) {
  return Boolean(authorId && (entry.likes || []).includes(authorId));
}

export function getHelpfulAwareVisibleEntries({
  entries,
  currentAuthorId,
  focusedEntryId,
  visibleLikedEntryIds,
  canLoadMore,
}: {
  entries: KnowledgeEntry[];
  currentAuthorId: string | null;
  focusedEntryId: string | null;
  visibleLikedEntryIds: Set<string>;
  canLoadMore: boolean;
}) {
  if (!currentAuthorId) {
    return entries;
  }

  const freshEntries = entries.filter(
    (entry) =>
      entry.id === focusedEntryId ||
      visibleLikedEntryIds.has(entry.id) ||
      !isEntryLikedByAuthor(entry, currentAuthorId),
  );

  if (freshEntries.length > 0 || canLoadMore) {
    return freshEntries;
  }

  return entries;
}

export function reconcileRealtimeKnowledgeFeedOrder({
  entries,
  currentOrder,
  snapshot,
  newEntryIds,
}: {
  entries: KnowledgeEntry[];
  currentOrder: string[];
  snapshot: ReturnType<typeof getKnowledgeFeedSnapshot>;
  newEntryIds: Set<string>;
}) {
  const reconciledOrder = reconcileKnowledgeFeedOrder(
    entries,
    currentOrder,
    snapshot,
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

  const leadEntryIds = rankKnowledgeEntries(newEntries, snapshot).map(
    (entry) => entry.id,
  );
  const leadEntryIdSet = new Set(leadEntryIds);

  return [
    ...leadEntryIds,
    ...reconciledOrder.filter((entryId) => !leadEntryIdSet.has(entryId)),
  ];
}

export function sortKnowledgeEntries(entries: KnowledgeEntry[]) {
  return [...entries].sort((left, right) => {
    const createdAtDiff = right.createdAt - left.createdAt;
    if (createdAtDiff !== 0) return createdAtDiff;
    return right.id.localeCompare(left.id);
  });
}

export function mergeKnowledgeEntryPages(
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

export function mergeRealtimeKnowledgePage(
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

export function getCurrentKnowledgeAttemptedLocation(focusedEntryId: string) {
  if (typeof window === "undefined") {
    return `/knowledge/${encodeURIComponent(focusedEntryId)}`;
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function safeDecodeRouteValue(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function getFocusedEntryIdCandidates(focusedEntryId: string) {
  const candidates = new Set<string>();
  const addCandidate = (value: string | null | undefined) => {
    const normalized = value?.trim();
    if (!normalized) return;

    candidates.add(normalized);
  };

  addCandidate(focusedEntryId);

  let decodedValue = focusedEntryId;
  for (let index = 0; index < 2; index += 1) {
    const nextDecodedValue = safeDecodeRouteValue(decodedValue);
    if (nextDecodedValue === decodedValue) break;

    decodedValue = nextDecodedValue;
    addCandidate(decodedValue);
  }

  [...candidates].forEach((candidate) => {
    const withoutRoutePrefix = candidate.replace(/^#?\/?knowledge\//i, "");
    addCandidate(withoutRoutePrefix);
    addCandidate(withoutRoutePrefix.split(/[?#]/)[0]);

    const pathParts = withoutRoutePrefix.split("/").filter(Boolean);
    addCandidate(pathParts[0]);
    addCandidate(pathParts[pathParts.length - 1]);
  });

  return [...candidates].filter(Boolean);
}

export function isValidKnowledgeDocumentId(candidate: string) {
  return (
    candidate.length > 0 &&
    candidate.length <= 1500 &&
    !candidate.includes("/")
  );
}

export async function getKnowledgeEntrySnapshotByCandidate(candidate: string) {
  if (isValidKnowledgeDocumentId(candidate)) {
    const snapshot = await getDoc(doc(db, "knowledge", candidate));
    if (snapshot.exists()) {
      return snapshot;
    }
  }

  const legacyIdSnapshot = await getDocs(
    query(
      collection(db, "knowledge"),
      where("id", "==", candidate),
      limit(1),
    ),
  );

  return legacyIdSnapshot.docs[0] || null;
}

export async function resolveFocusedKnowledgeEntrySnapshot(focusedEntryId: string) {
  const candidates = getFocusedEntryIdCandidates(focusedEntryId);

  for (const candidate of candidates) {
    try {
      const snapshot = await getKnowledgeEntrySnapshotByCandidate(candidate);
      if (snapshot) {
        return snapshot;
      }
    } catch (error) {
      console.warn("Focused knowledge entry candidate failed:", candidate, error);
    }
  }

  return null;
}

export function normalizeKnowledgeQueryDocs(
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

export function isFirestoreIndexError(error: unknown) {
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

export async function getDocsWithIndexFallback(
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

export function getIndependentFeedPageSize(
  cursor: QueryDocumentSnapshot<DocumentData> | null,
) {
  return cursor ? FEED_NEXT_PAGE_SIZE : FEED_INITIAL_PAGE_SIZE;
}

export function buildIndependentKnowledgeFeedPage(
  docs: QueryDocumentSnapshot<DocumentData>[],
  entries: KnowledgeEntry[],
  pageSize: number,
  previousCursor: QueryDocumentSnapshot<DocumentData> | null,
  hasMoreOverride?: boolean,
): IndependentKnowledgeFeedPage {
  return {
    entries,
    cursor: docs[docs.length - 1] || previousCursor,
    hasMore: hasMoreOverride ?? docs.length === pageSize,
  };
}

export function getKnowledgeQueryDocCreatedAt(
  snapshot: QueryDocumentSnapshot<DocumentData>,
) {
  const rawCreatedAt = snapshot.data().createdAt as
    | number
    | { toMillis?: () => number }
    | undefined;

  if (
    rawCreatedAt &&
    typeof rawCreatedAt === "object" &&
    typeof rawCreatedAt.toMillis === "function"
  ) {
    return rawCreatedAt.toMillis();
  }

  return typeof rawCreatedAt === "number" ? rawCreatedAt : 0;
}

export function sortKnowledgeQueryDocs(
  docs: QueryDocumentSnapshot<DocumentData>[],
) {
  return [...docs].sort((left, right) => {
    const createdAtDiff =
      getKnowledgeQueryDocCreatedAt(right) - getKnowledgeQueryDocCreatedAt(left);
    if (createdAtDiff !== 0) return createdAtDiff;
    return right.id.localeCompare(left.id);
  });
}

export function mergeKnowledgeQueryDocs(
  docs: QueryDocumentSnapshot<DocumentData>[],
) {
  return sortKnowledgeQueryDocs(
    [...new Map(docs.map((item) => [item.id, item] as const)).values()],
  );
}

export async function loadRecentKnowledgeDocs(
  cursor: QueryDocumentSnapshot<DocumentData> | null,
  pageSize: number,
) {
  const knowledgeCollection = collection(db, "knowledge");
  const snapshot = await getDocs(
    cursor
      ? query(
          knowledgeCollection,
          orderBy("createdAt", "desc"),
          startAfter(cursor),
          limit(pageSize),
        )
      : query(
          knowledgeCollection,
          orderBy("createdAt", "desc"),
          limit(pageSize),
        ),
  );

  return snapshot.docs;
}

export async function loadTopicFallbackKnowledgeDocs(
  topic: FeedTopicFilter,
  cursor: QueryDocumentSnapshot<DocumentData> | null,
  pageSize: number,
) {
  if (topic.id === "all" || topic.id === "trending") {
    return { matchingDocs: [], sourceDocs: [], hasMore: false };
  }

  const fallbackPageSize = pageSize * CATEGORY_FALLBACK_PAGE_MULTIPLIER;
  const sourceDocs = await loadRecentKnowledgeDocs(cursor, fallbackPageSize);
  const matchingDocIds = new Set(
    normalizeKnowledgeQueryDocs(sourceDocs)
      .filter((entry) => matchesKnowledgeTopic(entry, topic))
      .map((entry) => entry.id),
  );

  return {
    matchingDocs: sourceDocs.filter((item) => matchingDocIds.has(item.id)),
    sourceDocs,
    hasMore: sourceDocs.length === fallbackPageSize,
  };
}

export async function loadHashtagKnowledgeEntries(
  selectedHashtag: string,
  topic: FeedTopicFilter,
  cursor: QueryDocumentSnapshot<DocumentData> | null = null,
): Promise<IndependentKnowledgeFeedPage> {
  const normalizedHashtag = normalizeStoredHashtagValue(selectedHashtag);
  if (!normalizedHashtag) {
    return { entries: [], cursor: null, hasMore: false };
  }

  const knowledgeCollection = collection(db, "knowledge");
  const pageSize = getIndependentFeedPageSize(cursor);
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

export async function loadTrendingKnowledgeEntries(
  cursor: QueryDocumentSnapshot<DocumentData> | null = null,
): Promise<IndependentKnowledgeFeedPage> {
  const knowledgeCollection = collection(db, "knowledge");
  const pageSize = getIndependentFeedPageSize(cursor);
  const candidatePageSize = pageSize * TRENDING_CANDIDATE_PAGE_MULTIPLIER;
  const recentDocs = await loadRecentKnowledgeDocs(cursor, candidatePageSize);
  const likeCountDocs =
    cursor === null
      ? await getDocsWithIndexFallback(
          query(
            knowledgeCollection,
            orderBy("likeCount", "desc"),
            orderBy("createdAt", "desc"),
            limit(candidatePageSize),
          ),
          query(
            knowledgeCollection,
            orderBy("createdAt", "desc"),
            limit(candidatePageSize),
          ),
          "Trending feed",
        ).then((snapshot) => snapshot.docs)
      : [];
  const sourceDocs = sortKnowledgeQueryDocs(recentDocs);
  const candidateDocs = mergeKnowledgeQueryDocs([...likeCountDocs, ...recentDocs]);
  const entries = getTrendingKnowledgeEntries(
    normalizeKnowledgeQueryDocs(candidateDocs),
    pageSize,
  );

  return buildIndependentKnowledgeFeedPage(
    sourceDocs,
    entries,
    candidatePageSize,
    cursor,
    sourceDocs.length === candidatePageSize,
  );
}

export async function loadTopicKnowledgeEntries(
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
  const pageSize = getIndependentFeedPageSize(cursor);
  const orderedTopicQuery = cursor
    ? query(
        knowledgeCollection,
        where("hashtags", "array-contains-any", hashtagValues),
        orderBy("createdAt", "desc"),
        startAfter(cursor),
        limit(pageSize),
      )
    : query(
        knowledgeCollection,
        where("hashtags", "array-contains-any", hashtagValues),
        orderBy("createdAt", "desc"),
        limit(pageSize),
      );
  const fallbackTopicQuery = cursor
    ? query(
        knowledgeCollection,
        where("hashtags", "array-contains-any", hashtagValues),
        startAfter(cursor),
        limit(pageSize),
      )
    : query(
        knowledgeCollection,
        where("hashtags", "array-contains-any", hashtagValues),
        limit(pageSize),
      );
  const snapshot = await getDocsWithIndexFallback(
    orderedTopicQuery,
    fallbackTopicQuery,
    `${topic.label} category feed`,
  );

  const exactDocs = sortKnowledgeQueryDocs(snapshot.docs);
  let sourceDocs = exactDocs;
  let hasMoreTopicEntries = exactDocs.length === pageSize;
  let entries = getKnowledgeEntriesForTopic(
    sortKnowledgeEntries(normalizeKnowledgeQueryDocs(exactDocs)),
    topic,
  );

  if (entries.length === 0) {
    const fallback = await loadTopicFallbackKnowledgeDocs(topic, cursor, pageSize);
    sourceDocs = fallback.sourceDocs.length > 0 ? fallback.sourceDocs : exactDocs;
    hasMoreTopicEntries = hasMoreTopicEntries || fallback.hasMore;
    entries = getKnowledgeEntriesForTopic(
      sortKnowledgeEntries(
        normalizeKnowledgeQueryDocs(
          mergeKnowledgeQueryDocs([...exactDocs, ...fallback.matchingDocs]),
        ),
      ),
      topic,
    );
  }

  return buildIndependentKnowledgeFeedPage(
    sourceDocs,
    entries,
    pageSize,
    cursor,
    hasMoreTopicEntries,
  );
}

export async function loadIndependentKnowledgeFeedEntries({
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

export interface IndependentFeedOrderOptions {
  refreshSeed?: number;
  shuffleOnRefresh?: boolean;
}

export function orderIndependentKnowledgeFeedEntries(
  entries: KnowledgeEntry[],
  topic: FeedTopicFilter,
  options: IndependentFeedOrderOptions = {},
) {
  if (topic.id === "trending") {
    return getTrendingKnowledgeEntries(entries, entries.length);
  }

  return rankKnowledgeEntries(
    getKnowledgeEntriesForTopic(entries, topic),
    getKnowledgeFeedSnapshot(),
    options,
  );
}

export function mergeIndependentKnowledgeFeedEntries(
  currentEntries: KnowledgeEntry[],
  nextEntries: KnowledgeEntry[],
  topic: FeedTopicFilter,
  options: IndependentFeedOrderOptions = {},
) {
  const mergedEntries = mergeKnowledgeEntryPages(currentEntries, nextEntries);
  return orderIndependentKnowledgeFeedEntries(mergedEntries, topic, options);
}

export function getIndependentFeedKey(
  topicId: FeedTopicId,
  selectedHashtag: string | null,
) {
  return selectedHashtag
    ? `hashtag:${normalizeStoredHashtagValue(selectedHashtag)}:topic:${topicId}`
    : `topic:${topicId}`;
}

export function scrollKnowledgeFeedToTop(behavior: ScrollBehavior = "auto") {
  if (typeof window === "undefined") return;

  window.scrollTo({ top: 0, left: 0, behavior });

  if (behavior === "auto") {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }
}

export function createKnowledgeFeedRefreshSeed() {
  return Date.now() + Math.floor(Math.random() * 1_000_000);
}

export function readSelectedHashtagFromLocation() {
  if (typeof window === "undefined") return null;

  return parseRouteFromLocation().selectedHashtag;
}

export function readSelectedFeedTopicFromLocation() {
  if (typeof window === "undefined") return "all";

  return normalizeFeedTopicId(parseRouteFromLocation().selectedTopic);
}
