import type { KnowledgeEntry } from "../types";
import { getGuestId } from "./guestIdentity";
import { getKnowledgeIdentity } from "./knowledgeIdentity";

const HOUR_MS = 60 * 60 * 1000;
const KNOWLEDGE_SEEN_ENTRY_LIMIT = 1500;
const KNOWLEDGE_ACTIVITY_LIMIT = 260;
const KNOWLEDGE_SEEN_ENTRY_KEY_PREFIX = "readativeKnowledgeSeenEntries:v3";
const LEGACY_KNOWLEDGE_SEEN_ENTRY_KEY_PREFIX = "readativeKnowledgeSeenEntries:v2";
const KNOWLEDGE_ACTIVITY_KEY_PREFIX = "readativeKnowledgeFeedActivity:v2";
const KNOWLEDGE_REPEAT_COOLDOWN_HOURS = 18;
const KNOWLEDGE_LIKED_ENTRY_COOLDOWN_HOURS = 72;
const KNOWLEDGE_REFRESH_WINDOW_SIZE = 10;
const DUPLICATE_ACTIVITY_WINDOWS_MS = {
  view: 6 * HOUR_MS,
  open: 30 * 60 * 1000,
  like: 12 * HOUR_MS,
  comment: 12 * HOUR_MS,
  share: 30 * 60 * 1000,
  author: 20 * 60 * 1000,
  hashtag: 20 * 60 * 1000,
} as const;
const ACTIVITY_WEIGHTS = {
  view: 0.9,
  open: 2.6,
  like: 6.8,
  comment: 5.4,
  share: 4.8,
  author: 2.1,
  hashtag: 3.3,
} as const;

type KnowledgeActivityType =
  | "view"
  | "open"
  | "like"
  | "comment"
  | "share"
  | "author"
  | "hashtag";

type KnowledgeEntrySignal = Pick<
  KnowledgeEntry,
  | "id"
  | "authorId"
  | "hashtags"
  | "likes"
  | "likeCount"
  | "comments"
  | "mentions"
  | "createdAt"
  | "title"
  | "content"
> &
  Partial<Pick<KnowledgeEntry, "images" | "qualityScore" | "readingMinutes">>;

interface KnowledgeActivityRecord {
  type: KnowledgeActivityType;
  entryId?: string;
  authorId?: string;
  hashtags?: string[];
  createdAt: number;
}

interface SeenKnowledgeEntryRecord {
  entryId: string;
  seenAt: number;
}

export interface KnowledgeFeedSnapshot {
  isReturningUser: boolean;
  currentUserId: string | null;
  seenEntryIds: Set<string>;
  seenEntryTimestamps: Map<string, number>;
  authorAffinity: Map<string, number>;
  hashtagAffinity: Map<string, number>;
  likedHashtagAffinity: Map<string, number>;
  entryAffinity: Map<string, number>;
  lastActiveAt: number | null;
}

interface KnowledgeActivityInput {
  type: KnowledgeActivityType;
  entry?: Pick<KnowledgeEntry, "id" | "authorId" | "hashtags">;
  authorId?: string;
  hashtags?: string[];
}

interface ScoredKnowledgeEntry {
  entry: KnowledgeEntry;
  score: number;
  ageHours: number;
  seen: boolean;
  likedByCurrentUser: boolean;
  hoursSinceSeen: number | null;
  primaryHashtag: string | null;
}

interface KnowledgeRankOptions {
  refreshSeed?: number;
  shuffleOnRefresh?: boolean;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getStableRefreshNoise(value: string, refreshSeed = 0) {
  let hash = 2166136261;
  const input = `${refreshSeed}:${value}`;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

function getKnowledgeSeenEntryKey() {
  return `${KNOWLEDGE_SEEN_ENTRY_KEY_PREFIX}:${getKnowledgePersonalizationId()}`;
}

function getGuestKnowledgeSeenEntryKey() {
  return `${KNOWLEDGE_SEEN_ENTRY_KEY_PREFIX}:${getGuestId()}`;
}

function getLegacyKnowledgeSeenEntryKey() {
  return `${LEGACY_KNOWLEDGE_SEEN_ENTRY_KEY_PREFIX}:${getGuestId()}`;
}

function getKnowledgeActivityKey() {
  return `${KNOWLEDGE_ACTIVITY_KEY_PREFIX}:${getKnowledgePersonalizationId()}`;
}

function getGuestKnowledgeActivityKey() {
  return `${KNOWLEDGE_ACTIVITY_KEY_PREFIX}:${getGuestId()}`;
}

function getKnowledgePersonalizationId() {
  if (typeof window === "undefined") {
    return "server";
  }

  return getKnowledgeIdentity()?.authorId || getGuestId();
}

function getCurrentKnowledgeUserId() {
  if (typeof window === "undefined") {
    return null;
  }

  return getKnowledgePersonalizationId();
}

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase();
}

function normalizeSeenEntryIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return [...new Set(value)]
    .filter((entryId): entryId is string => typeof entryId === "string")
    .map((entryId) => entryId.trim())
    .filter(Boolean)
    .slice(-KNOWLEDGE_SEEN_ENTRY_LIMIT);
}

function normalizeSeenEntryRecord(value: unknown): SeenKnowledgeEntryRecord | null {
  if (typeof value === "string") {
    const entryId = value.trim();
    if (!entryId) {
      return null;
    }

    return {
      entryId,
      seenAt: 0,
    };
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<SeenKnowledgeEntryRecord>;
  const entryId = typeof candidate.entryId === "string" ? candidate.entryId.trim() : "";
  if (!entryId) {
    return null;
  }

  return {
    entryId,
    seenAt:
      typeof candidate.seenAt === "number" && Number.isFinite(candidate.seenAt)
        ? candidate.seenAt
        : 0,
  };
}

function normalizeSeenEntryRecords(value: unknown): SeenKnowledgeEntryRecord[] {
  if (!Array.isArray(value)) return [];

  const dedupedEntries = new Map<string, number>();
  value.forEach((candidate) => {
    const record = normalizeSeenEntryRecord(candidate);
    if (!record) {
      return;
    }

    dedupedEntries.set(
      record.entryId,
      Math.max(record.seenAt, dedupedEntries.get(record.entryId) || 0),
    );
  });

  return [...dedupedEntries.entries()]
    .map(([entryId, seenAt]) => ({ entryId, seenAt }))
    .sort((left, right) => left.seenAt - right.seenAt)
    .slice(-KNOWLEDGE_SEEN_ENTRY_LIMIT);
}

function normalizeActivityRecord(value: unknown): KnowledgeActivityRecord | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<KnowledgeActivityRecord>;
  if (
    candidate.type !== "view" &&
    candidate.type !== "open" &&
    candidate.type !== "like" &&
    candidate.type !== "comment" &&
    candidate.type !== "share" &&
    candidate.type !== "author" &&
    candidate.type !== "hashtag"
  ) {
    return null;
  }

  const hashtags = Array.isArray(candidate.hashtags)
    ? candidate.hashtags
        .filter((tag): tag is string => typeof tag === "string")
        .map(normalizeTag)
        .filter(Boolean)
        .slice(0, 8)
    : [];

  return {
    type: candidate.type,
    entryId:
      typeof candidate.entryId === "string" ? candidate.entryId.trim() : undefined,
    authorId:
      typeof candidate.authorId === "string" ? candidate.authorId.trim() : undefined,
    hashtags,
    createdAt:
      typeof candidate.createdAt === "number" && Number.isFinite(candidate.createdAt)
        ? candidate.createdAt
        : Date.now(),
  };
}

function normalizeActivityRecords(value: unknown): KnowledgeActivityRecord[] {
  if (!Array.isArray(value)) return [];

  return value
    .map(normalizeActivityRecord)
    .filter((record): record is KnowledgeActivityRecord => Boolean(record))
    .slice(-KNOWLEDGE_ACTIVITY_LIMIT);
}

function readKnowledgeActivities() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getKnowledgeActivityKey());
    if (raw) {
      return normalizeActivityRecords(JSON.parse(raw));
    }

    const guestKey = getGuestKnowledgeActivityKey();
    const primaryKey = getKnowledgeActivityKey();
    if (guestKey !== primaryKey) {
      const guestRaw = window.localStorage.getItem(guestKey);
      if (guestRaw) {
        return normalizeActivityRecords(JSON.parse(guestRaw));
      }
    }

    return [];
  } catch {
    return [];
  }
}

function writeKnowledgeActivities(activities: KnowledgeActivityRecord[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      getKnowledgeActivityKey(),
      JSON.stringify(activities.slice(-KNOWLEDGE_ACTIVITY_LIMIT)),
    );
  } catch {
    // Ignore local storage failures and gracefully fall back to a simpler feed.
  }
}

function readKnowledgeSeenEntries() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getKnowledgeSeenEntryKey());
    if (raw) {
      return normalizeSeenEntryRecords(JSON.parse(raw));
    }

    const guestKey = getGuestKnowledgeSeenEntryKey();
    const primaryKey = getKnowledgeSeenEntryKey();
    if (guestKey !== primaryKey) {
      const guestRaw = window.localStorage.getItem(guestKey);
      if (guestRaw) {
        return normalizeSeenEntryRecords(JSON.parse(guestRaw));
      }
    }

    const legacyRaw = window.localStorage.getItem(getLegacyKnowledgeSeenEntryKey());
    if (!legacyRaw) {
      return [];
    }

    return normalizeSeenEntryIds(JSON.parse(legacyRaw)).map((entryId) => ({
      entryId,
      seenAt: 0,
    }));
  } catch {
    return [];
  }
}

function writeKnowledgeSeenEntries(records: SeenKnowledgeEntryRecord[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      getKnowledgeSeenEntryKey(),
      JSON.stringify(records.slice(-KNOWLEDGE_SEEN_ENTRY_LIMIT)),
    );
    window.localStorage.removeItem(getLegacyKnowledgeSeenEntryKey());
  } catch {
    // Ignore local storage failures and gracefully fall back to a simpler feed.
  }
}

function buildActivityRecord(input: KnowledgeActivityInput): KnowledgeActivityRecord {
  const entryHashtags = input.entry?.hashtags || [];
  const directHashtags = input.hashtags || [];
  const hashtags = [...new Set([...entryHashtags, ...directHashtags].map(normalizeTag))]
    .filter(Boolean)
    .slice(0, 8);

  return {
    type: input.type,
    entryId: input.entry?.id?.trim() || undefined,
    authorId: input.authorId?.trim() || input.entry?.authorId?.trim() || undefined,
    hashtags,
    createdAt: Date.now(),
  };
}

function isDuplicateActivity(
  candidate: KnowledgeActivityRecord,
  activities: KnowledgeActivityRecord[],
) {
  const duplicateWindow = DUPLICATE_ACTIVITY_WINDOWS_MS[candidate.type];

  return activities
    .slice(-20)
    .reverse()
    .some((activity) => {
      if (activity.type !== candidate.type) return false;
      if (candidate.createdAt - activity.createdAt > duplicateWindow) return false;

      return (
        activity.entryId === candidate.entryId &&
        activity.authorId === candidate.authorId &&
        JSON.stringify(activity.hashtags || []) === JSON.stringify(candidate.hashtags || [])
      );
    });
}

function addWeightedScore(
  map: Map<string, number>,
  key: string | undefined,
  value: number,
) {
  if (!key || value <= 0) return;
  map.set(key, (map.get(key) || 0) + value);
}

function getWordCount(entry: Pick<KnowledgeEntry, "title" | "content">) {
  return `${entry.title} ${entry.content}`.trim().split(/\s+/).filter(Boolean).length;
}

function getPrimaryHashtag(entry: Pick<KnowledgeEntry, "hashtags">) {
  const topTag = entry.hashtags[0];
  return topTag ? normalizeTag(topTag) : null;
}

function getFreshnessScore(ageHours: number, isReturningUser: boolean) {
  const decayBase = isReturningUser ? 38 : 28;
  const freshness = 18 * Math.exp(-ageHours / decayBase);
  const sparkBoost = ageHours <= 6 ? 4 : ageHours <= 18 ? 2 : 0;
  return freshness + sparkBoost;
}

function getWeightedHashtagMatchScore(
  entry: KnowledgeEntry,
  snapshot: KnowledgeFeedSnapshot,
) {
  return [...new Set(entry.hashtags.map(normalizeTag))].reduce((sum, tag) => {
    const affinity = snapshot.hashtagAffinity.get(tag) || 0;
    const likedAffinity = snapshot.likedHashtagAffinity.get(tag) || 0;
    return sum + Math.min(2.4, affinity / 2.4 + likedAffinity / 1.8);
  }, 0);
}

function getLikedHashtagSimilarityScore(
  entry: KnowledgeEntry,
  snapshot: KnowledgeFeedSnapshot,
) {
  return [...new Set(entry.hashtags.map(normalizeTag))].reduce((sum, tag) => {
    const likedAffinity = snapshot.likedHashtagAffinity.get(tag) || 0;
    return sum + Math.min(9.5, likedAffinity * 2.1);
  }, 0);
}

function getRepeatedLikedTopicBoost(
  entry: KnowledgeEntry,
  snapshot: KnowledgeFeedSnapshot,
) {
  const matchedLikedTags = [...new Set(entry.hashtags.map(normalizeTag))]
    .map((tag) => snapshot.likedHashtagAffinity.get(tag) || 0)
    .filter((affinity) => affinity >= 2.4)
    .sort((left, right) => right - left);

  if (matchedLikedTags.length === 0) {
    return 0;
  }

  const topAffinity = matchedLikedTags[0];
  const secondAffinity = matchedLikedTags[1] || 0;

  return clamp(topAffinity * 2.8 + secondAffinity * 1.2, 0, 22);
}

function getWeightedRecencyScore(ageHours: number) {
  if (ageHours <= 2) return 1.35;
  if (ageHours <= 12) return 1.05;
  return clamp(Math.exp(-ageHours / 72), 0, 1);
}

function getWeightedLikesScore(entry: KnowledgeEntry) {
  const likeCount =
    typeof entry.likeCount === "number" && Number.isFinite(entry.likeCount)
      ? Math.max(entry.likes.length, entry.likeCount)
      : entry.likes.length;
  const engagement = likeCount + entry.comments.length * 1.4;
  return clamp(Math.log1p(engagement), 0, 3);
}

function getWeightedRankingScore(
  entry: KnowledgeEntry,
  snapshot: KnowledgeFeedSnapshot,
  ageHours: number,
) {
  const hashtagMatch = getWeightedHashtagMatchScore(entry, snapshot);
  const recency = getWeightedRecencyScore(ageHours);
  const likes = getWeightedLikesScore(entry);

  return hashtagMatch * 5 + recency * 3 + likes * 2;
}

function getMomentumScore(entry: KnowledgeEntry, ageHours: number) {
  const imageCount = entry.images?.length || 0;
  const likeCount =
    typeof entry.likeCount === "number" && Number.isFinite(entry.likeCount)
      ? Math.max(entry.likes.length, entry.likeCount)
      : entry.likes.length;
  const rawMomentum =
    likeCount * 1.35 +
    entry.comments.length * 3.2 +
    entry.mentions.length * 0.7 +
    imageCount * 0.9;

  const ageDivisor = Math.pow(ageHours + 2, 0.38);
  return clamp((Math.log1p(rawMomentum * 2.4) * 7.2) / ageDivisor, 0, 18);
}

function getQualityScore(entry: KnowledgeEntrySignal) {
  const wordCount = getWordCount(entry);
  const imageCount = entry.images?.length || 0;

  let depthScore = 0;
  if (wordCount >= 25) depthScore += 1.8;
  if (wordCount >= 60) depthScore += 1.4;
  if (wordCount >= 140) depthScore += 0.9;
  if (wordCount > 320) {
    depthScore -= Math.min(1.4, (wordCount - 320) / 240);
  }

  const structureScore = Math.min(
    2.2,
    entry.hashtags.length * 0.3 +
      imageCount * 0.9 +
      entry.mentions.length * 0.2 +
      Math.min(1, entry.comments.length * 0.15),
  );
  const storedQualityBoost =
    typeof entry.qualityScore === "number"
      ? clamp(entry.qualityScore / 25, 0, 4)
      : 0;

  return clamp(depthScore + structureScore + storedQualityBoost, 0.5, 8);
}

function getPersonalizationScore(
  entry: KnowledgeEntry,
  snapshot: KnowledgeFeedSnapshot,
) {
  const authorInterest = (snapshot.authorAffinity.get(entry.authorId) || 0) * 1.7;
  const hashtagInterest = [...new Set(entry.hashtags.map(normalizeTag))].reduce(
    (sum, tag) => sum + Math.min(4.8, snapshot.hashtagAffinity.get(tag) || 0),
    0,
  );
  const likedHashtagInterest = getLikedHashtagSimilarityScore(entry, snapshot);
  const repeatedLikedTopicBoost = getRepeatedLikedTopicBoost(entry, snapshot);
  const entryInterest = snapshot.entryAffinity.get(entry.id) || 0;

  return Math.min(
    42,
    authorInterest +
      hashtagInterest * 1.05 +
      likedHashtagInterest * 1.6 +
      repeatedLikedTopicBoost +
      entryInterest * 1.15,
  );
}

function getNewUnseenPostBoost(
  ageHours: number,
  seen: boolean,
  likedByCurrentUser: boolean,
) {
  if (seen || likedByCurrentUser) {
    return 0;
  }

  if (ageHours <= 0.5) return 10;
  if (ageHours <= 2) return 7;
  if (ageHours <= 6) return 3.5;
  return 0;
}

function getNoveltyScore(
  entry: KnowledgeEntry,
  snapshot: KnowledgeFeedSnapshot,
  ageHours: number,
  hoursSinceSeen: number | null,
) {
  if (hoursSinceSeen === null) {
    return snapshot.isReturningUser ? 8.5 : 4;
  }

  const revisitMomentum = Math.min(
    5,
    Math.log1p(
      entry.comments.length * 2 +
        (typeof entry.likeCount === "number" && Number.isFinite(entry.likeCount)
          ? Math.max(entry.likes.length, entry.likeCount)
          : entry.likes.length),
    ),
  );
  const cooledDownRevisitBoost = hoursSinceSeen >= 48 ? 2 : hoursSinceSeen >= 24 ? 1 : 0;
  const staleRevisitPenalty = ageHours > 48 ? 1.8 : 0;
  const weakInterestPenalty = (snapshot.entryAffinity.get(entry.id) || 0) < 1 ? 1.5 : 0;

  return revisitMomentum + cooledDownRevisitBoost - 7.5 - staleRevisitPenalty - weakInterestPenalty;
}

function getExplorationScore(
  entry: KnowledgeEntry,
  snapshot: KnowledgeFeedSnapshot,
) {
  const knowsAuthor = (snapshot.authorAffinity.get(entry.authorId) || 0) > 0.75;
  const knowsTopic = entry.hashtags.some(
    (tag) => (snapshot.hashtagAffinity.get(normalizeTag(tag)) || 0) > 0.75,
  );

  if (!knowsAuthor && !knowsTopic) {
    return snapshot.isReturningUser ? 1.8 : 2.5;
  }

  return 0;
}

function getRefreshDiscoveryScore(
  entry: KnowledgeEntry,
  snapshot: KnowledgeFeedSnapshot,
  ageHours: number,
  hoursSinceSeen: number | null,
  refreshSeed?: number,
) {
  if (typeof refreshSeed !== "number" || !Number.isFinite(refreshSeed)) {
    return 0;
  }

  const noise = getStableRefreshNoise(entry.id, refreshSeed);
  const hasLikedTopicHistory = snapshot.likedHashtagAffinity.size > 0;
  const freshUnseenWeight =
    hoursSinceSeen === null
      ? ageHours <= 12
        ? hasLikedTopicHistory
          ? 14
          : 70
        : ageHours <= 48
          ? hasLikedTopicHistory
            ? 11
            : 58
          : ageHours <= 120
            ? hasLikedTopicHistory
              ? 7
              : 42
            : hasLikedTopicHistory
              ? 4
              : 18
      : hoursSinceSeen >= KNOWLEDGE_REPEAT_COOLDOWN_HOURS
        ? hasLikedTopicHistory
          ? 4
          : 20
        : hasLikedTopicHistory
          ? 1.5
          : 10;
  const likedTopicBoost = getRepeatedLikedTopicBoost(entry, snapshot);
  const relatedDiscoveryBoost =
    likedTopicBoost > 0 && hoursSinceSeen === null
      ? clamp(likedTopicBoost / 2.6, 3, 10)
      : 0;

  return noise * freshUnseenWeight + relatedDiscoveryBoost;
}

function getStalePenalty(
  ageHours: number,
  momentumScore: number,
  qualityScore: number,
) {
  if (ageHours > 120 && momentumScore < 4.5) {
    return Math.min(10, (ageHours - 120) / 72 + 4);
  }

  if (ageHours > 240 && qualityScore < 3.5) {
    return 5;
  }

  return 0;
}

function getHoursSinceSeen(
  entryId: string,
  snapshot: KnowledgeFeedSnapshot,
  now: number,
) {
  const seenAt = snapshot.seenEntryTimestamps.get(entryId);
  if (typeof seenAt !== "number" || seenAt <= 0) {
    return null;
  }

  return Math.max(0, (now - seenAt) / HOUR_MS);
}

function getRepeatPenalty(hoursSinceSeen: number | null, ageHours: number) {
  if (hoursSinceSeen === null) {
    return 0;
  }

  const cooldownHours =
    ageHours <= 12 ? 6 : ageHours <= 48 ? 12 : KNOWLEDGE_REPEAT_COOLDOWN_HOURS;
  if (hoursSinceSeen >= cooldownHours) {
    return 0;
  }

  const penaltyScale = 1 - hoursSinceSeen / cooldownHours;
  return 10 + penaltyScale * 16;
}

function getLikedEntryPenalty(
  likedByCurrentUser: boolean,
  hoursSinceSeen: number | null,
) {
  if (!likedByCurrentUser) {
    return 0;
  }

  if (hoursSinceSeen === null) {
    return 38;
  }

  if (hoursSinceSeen >= KNOWLEDGE_LIKED_ENTRY_COOLDOWN_HOURS) {
    return 18;
  }

  const cooldownProgress = hoursSinceSeen / KNOWLEDGE_LIKED_ENTRY_COOLDOWN_HOURS;
  return 54 - cooldownProgress * 26;
}

function scoreKnowledgeEntry(
  entry: KnowledgeEntry,
  snapshot: KnowledgeFeedSnapshot,
  now: number,
  options: KnowledgeRankOptions = {},
) {
  const ageHours = Math.max(0, (now - entry.createdAt) / HOUR_MS);
  const hoursSinceSeen = getHoursSinceSeen(entry.id, snapshot, now);
  const likedByCurrentUser = Boolean(
    snapshot.currentUserId && entry.likes.includes(snapshot.currentUserId),
  );
  const seen = snapshot.seenEntryIds.has(entry.id);
  const freshnessScore = getFreshnessScore(ageHours, snapshot.isReturningUser);
  const weightedRankingScore = getWeightedRankingScore(entry, snapshot, ageHours);
  const momentumScore = getMomentumScore(entry, ageHours);
  const qualityScore = getQualityScore(entry);
  const personalizationScore = getPersonalizationScore(entry, snapshot);
  const noveltyScore = getNoveltyScore(entry, snapshot, ageHours, hoursSinceSeen);
  const explorationScore = getExplorationScore(entry, snapshot);
  const refreshDiscoveryScore = getRefreshDiscoveryScore(
    entry,
    snapshot,
    ageHours,
    hoursSinceSeen,
    options.refreshSeed,
  );
  const newUnseenPostBoost = getNewUnseenPostBoost(ageHours, seen, likedByCurrentUser);
  const stalePenalty = getStalePenalty(ageHours, momentumScore, qualityScore);
  const repeatPenalty = getRepeatPenalty(hoursSinceSeen, ageHours);
  const likedEntryPenalty = getLikedEntryPenalty(likedByCurrentUser, hoursSinceSeen);

  return {
    entry,
    ageHours,
    seen,
    likedByCurrentUser,
    hoursSinceSeen,
    primaryHashtag: getPrimaryHashtag(entry),
    score:
      weightedRankingScore +
      freshnessScore +
      momentumScore +
      qualityScore +
      personalizationScore +
      noveltyScore +
      explorationScore +
      refreshDiscoveryScore +
      newUnseenPostBoost -
      stalePenalty -
      repeatPenalty -
      likedEntryPenalty,
  };
}

function diversifyRankedEntries(scoredEntries: ScoredKnowledgeEntry[]) {
  const remaining = [...scoredEntries];
  const rankedEntries: KnowledgeEntry[] = [];
  const authorUsage = new Map<string, number>();
  const topicUsage = new Map<string, number>();

  while (remaining.length > 0) {
    const windowSize = Math.min(7, remaining.length);
    let bestIndex = 0;
    let bestAdjustedScore = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < windowSize; index += 1) {
      const candidate = remaining[index];
      const recentEntries = rankedEntries.slice(-2);
      const recentAuthorStreak = recentEntries.filter(
        (entry) => entry.authorId === candidate.entry.authorId,
      ).length;
      const recentTopicStreak = candidate.primaryHashtag
        ? recentEntries.filter(
            (entry) => getPrimaryHashtag(entry) === candidate.primaryHashtag,
          ).length
        : 0;

      const authorPenalty =
        recentAuthorStreak * 4.2 + (authorUsage.get(candidate.entry.authorId) || 0) * 0.9;
      const topicPenalty = candidate.primaryHashtag
        ? recentTopicStreak * 2.4 + (topicUsage.get(candidate.primaryHashtag) || 0) * 0.35
        : 0;
      const earlySeenPenalty = candidate.seen && rankedEntries.length < 6 ? 4.5 : 0;
      const earlyLikedPenalty =
        candidate.likedByCurrentUser && rankedEntries.length < 8 ? 8 : 0;
      const earlyFreshBoost = !candidate.seen && rankedEntries.length < 4 ? 2.6 : 0;
      const adjustedScore =
        candidate.score -
        authorPenalty -
        topicPenalty -
        earlySeenPenalty -
        earlyLikedPenalty +
        earlyFreshBoost;

      if (adjustedScore > bestAdjustedScore) {
        bestAdjustedScore = adjustedScore;
        bestIndex = index;
      }
    }

    const [selected] = remaining.splice(bestIndex, 1);
    rankedEntries.push(selected.entry);
    authorUsage.set(
      selected.entry.authorId,
      (authorUsage.get(selected.entry.authorId) || 0) + 1,
    );

    if (selected.primaryHashtag) {
      topicUsage.set(
        selected.primaryHashtag,
        (topicUsage.get(selected.primaryHashtag) || 0) + 1,
      );
    }
  }

  return rankedEntries;
}

function isPrimaryFeedCandidate(candidate: ScoredKnowledgeEntry) {
  if (
    candidate.likedByCurrentUser &&
    (candidate.hoursSinceSeen === null ||
      candidate.hoursSinceSeen < KNOWLEDGE_LIKED_ENTRY_COOLDOWN_HOURS)
  ) {
    return false;
  }

  if (!candidate.seen || candidate.hoursSinceSeen === null) {
    return true;
  }

  if (candidate.hoursSinceSeen >= KNOWLEDGE_REPEAT_COOLDOWN_HOURS) {
    return true;
  }

  return candidate.ageHours <= 6 && candidate.score >= 28;
}

function buildLatestEntriesFallback(scoredEntries: ScoredKnowledgeEntry[]) {
  return [...scoredEntries]
    .sort((left, right) => {
      const createdAtDelta = right.entry.createdAt - left.entry.createdAt;
      if (createdAtDelta !== 0) {
        return createdAtDelta;
      }

      return right.entry.likes.length - left.entry.likes.length;
    })
    .map((candidate) => candidate.entry);
}

function isLikedByCurrentUser(
  entry: KnowledgeEntry,
  snapshot: KnowledgeFeedSnapshot,
) {
  return Boolean(snapshot.currentUserId && entry.likes.includes(snapshot.currentUserId));
}

function pushCurrentUserLikedEntriesDown(
  entries: KnowledgeEntry[],
  snapshot: KnowledgeFeedSnapshot,
) {
  if (!snapshot.currentUserId) {
    return entries;
  }

  const freshEntries: KnowledgeEntry[] = [];
  const likedEntries: KnowledgeEntry[] = [];

  entries.forEach((entry) => {
    if (isLikedByCurrentUser(entry, snapshot)) {
      likedEntries.push(entry);
      return;
    }

    freshEntries.push(entry);
  });

  return [...freshEntries, ...likedEntries];
}

function compareEntriesByNewestFirst(left: KnowledgeEntry, right: KnowledgeEntry) {
  const createdAtDelta = right.createdAt - left.createdAt;
  if (createdAtDelta !== 0) {
    return createdAtDelta;
  }

  const likeDelta = right.likes.length - left.likes.length;
  if (likeDelta !== 0) {
    return likeDelta;
  }

  return right.id.localeCompare(left.id);
}

function putNewUnseenEntriesFirst(
  entries: KnowledgeEntry[],
  snapshot: KnowledgeFeedSnapshot,
) {
  if (entries.length <= 1) {
    return entries;
  }

  const unseenEntries: KnowledgeEntry[] = [];
  const remainingEntries: KnowledgeEntry[] = [];

  entries.forEach((entry) => {
    if (
      !isLikedByCurrentUser(entry, snapshot) &&
      !snapshot.seenEntryIds.has(entry.id)
    ) {
      unseenEntries.push(entry);
      return;
    }

    remainingEntries.push(entry);
  });

  if (unseenEntries.length === 0) {
    return entries;
  }

  return [
    ...unseenEntries.sort(compareEntriesByNewestFirst),
    ...remainingEntries,
  ];
}

function putRefreshDiscoveryEntriesFirst(
  entries: KnowledgeEntry[],
  snapshot: KnowledgeFeedSnapshot,
  refreshSeed?: number,
) {
  if (
    typeof refreshSeed !== "number" ||
    !Number.isFinite(refreshSeed) ||
    entries.length < 3
  ) {
    return entries;
  }

  const now = Date.now();
  const unseenEntries: KnowledgeEntry[] = [];
  const cooledDownEntries: KnowledgeEntry[] = [];
  const remainingEntries: KnowledgeEntry[] = [];

  entries.forEach((entry) => {
    const likedByCurrentUser = isLikedByCurrentUser(entry, snapshot);
    const hoursSinceSeen = getHoursSinceSeen(entry.id, snapshot, now);

    if (!likedByCurrentUser && hoursSinceSeen === null) {
      unseenEntries.push(entry);
      return;
    }

    if (
      !likedByCurrentUser &&
      hoursSinceSeen >= KNOWLEDGE_REPEAT_COOLDOWN_HOURS
    ) {
      cooledDownEntries.push(entry);
      return;
    }

    remainingEntries.push(entry);
  });

  const discoveryEntries =
    unseenEntries.length > 0 ? unseenEntries : cooledDownEntries;
  if (discoveryEntries.length === 0) {
    return entries;
  }

  const refreshWindowSize = Math.min(
    KNOWLEDGE_REFRESH_WINDOW_SIZE,
    discoveryEntries.length,
  );
  const startIndex = Math.floor(
    getStableRefreshNoise("refresh-lead", refreshSeed) * refreshWindowSize,
  );
  const discoveryWindow = discoveryEntries.slice(0, refreshWindowSize);
  const discoveryTail = discoveryEntries.slice(refreshWindowSize);
  const rotatedDiscoveryWindow = [
    ...discoveryWindow.slice(startIndex),
    ...discoveryWindow.slice(0, startIndex),
  ];

  return [
    ...rotatedDiscoveryWindow,
    ...discoveryTail,
    ...cooledDownEntries.filter((entry) => !discoveryEntries.includes(entry)),
    ...remainingEntries,
  ];
}

function areEntryOrdersEqualById(left: KnowledgeEntry[], right: KnowledgeEntry[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((entry, index) => entry.id === right[index]?.id);
}

function shuffleRefreshWindow(
  entries: KnowledgeEntry[],
  refreshSeed: number,
  windowIndex: number,
) {
  return [...entries].sort((left, right) => {
    const leftNoise = getStableRefreshNoise(
      `refresh-window:${windowIndex}:${left.id}`,
      refreshSeed,
    );
    const rightNoise = getStableRefreshNoise(
      `refresh-window:${windowIndex}:${right.id}`,
      refreshSeed,
    );

    if (leftNoise !== rightNoise) {
      return rightNoise - leftNoise;
    }

    return right.createdAt - left.createdAt;
  });
}

function shuffleRankedEntriesForManualRefresh(
  entries: KnowledgeEntry[],
  refreshSeed?: number,
) {
  if (
    typeof refreshSeed !== "number" ||
    !Number.isFinite(refreshSeed) ||
    entries.length < 3
  ) {
    return entries;
  }

  const windowSize = 5;
  const leadEntries = entries.slice(0, windowSize);
  const tailEntries = entries.slice(windowSize);
  const shuffledLeadEntries = shuffleRefreshWindow(leadEntries, refreshSeed, 0);
  const shuffledEntries = [...shuffledLeadEntries, ...tailEntries];

  if (!areEntryOrdersEqualById(entries, shuffledEntries)) {
    return shuffledEntries;
  }

  const leadWindowSize = Math.min(windowSize, entries.length);
  const rotation =
    1 +
    Math.floor(
      getStableRefreshNoise("refresh-fallback-rotation", refreshSeed) *
        Math.max(1, leadWindowSize - 1),
    );

  return [
    ...entries.slice(rotation, leadWindowSize),
    ...entries.slice(0, rotation),
    ...entries.slice(leadWindowSize),
  ];
}

export function getKnowledgeFeedSnapshot(): KnowledgeFeedSnapshot {
  if (typeof window === "undefined") {
    return {
      isReturningUser: false,
      currentUserId: null,
      seenEntryIds: new Set<string>(),
      seenEntryTimestamps: new Map<string, number>(),
      authorAffinity: new Map<string, number>(),
      hashtagAffinity: new Map<string, number>(),
      likedHashtagAffinity: new Map<string, number>(),
      entryAffinity: new Map<string, number>(),
      lastActiveAt: null,
    };
  }

  try {
    const seenEntries = readKnowledgeSeenEntries();
    const activities = readKnowledgeActivities();
    const now = Date.now();
    const currentUserId = getCurrentKnowledgeUserId();
    const authorAffinity = new Map<string, number>();
    const hashtagAffinity = new Map<string, number>();
    const likedHashtagAffinity = new Map<string, number>();
    const entryAffinity = new Map<string, number>();
    const seenEntryTimestamps = new Map(
      seenEntries.map((entry) => [entry.entryId, entry.seenAt] as const),
    );
    let lastActiveAt: number | null = null;

    activities.forEach((activity) => {
      const ageHours = Math.max(0, (now - activity.createdAt) / HOUR_MS);
      const decay = Math.exp(-ageHours / 96);
      const weight = ACTIVITY_WEIGHTS[activity.type] * decay;

      addWeightedScore(authorAffinity, activity.authorId, weight);
      addWeightedScore(entryAffinity, activity.entryId, weight * 0.7);

      if ((activity.hashtags || []).length > 0) {
        const perTagWeight = weight / Math.max(1, activity.hashtags.length * 0.85);
        activity.hashtags.forEach((tag) => {
          const normalizedTag = normalizeTag(tag);
          addWeightedScore(hashtagAffinity, normalizedTag, perTagWeight);
          if (activity.type === "like") {
            addWeightedScore(likedHashtagAffinity, normalizedTag, perTagWeight * 2.4);
          }
        });
      }

      lastActiveAt = Math.max(lastActiveAt || 0, activity.createdAt);
    });

    return {
      isReturningUser: seenEntries.length > 0 || activities.length > 0,
      currentUserId,
      seenEntryIds: new Set(seenEntries.map((entry) => entry.entryId)),
      seenEntryTimestamps,
      authorAffinity,
      hashtagAffinity,
      likedHashtagAffinity,
      entryAffinity,
      lastActiveAt,
    };
  } catch {
    return {
      isReturningUser: false,
      currentUserId: null,
      seenEntryIds: new Set<string>(),
      seenEntryTimestamps: new Map<string, number>(),
      authorAffinity: new Map<string, number>(),
      hashtagAffinity: new Map<string, number>(),
      likedHashtagAffinity: new Map<string, number>(),
      entryAffinity: new Map<string, number>(),
      lastActiveAt: null,
    };
  }
}

export function recordKnowledgeFeedActivity(input: KnowledgeActivityInput) {
  if (typeof window === "undefined") return;

  try {
    const activities = readKnowledgeActivities();
    const nextRecord = buildActivityRecord(input);

    if (
      !nextRecord.entryId &&
      !nextRecord.authorId &&
      (nextRecord.hashtags || []).length === 0
    ) {
      return;
    }

    if (isDuplicateActivity(nextRecord, activities)) {
      return;
    }

    writeKnowledgeActivities([...activities, nextRecord]);
  } catch {
    // Engagement tracking is best-effort only.
  }
}

export function markKnowledgeEntrySeen(
  entryOrEntryId: Pick<KnowledgeEntry, "id" | "authorId" | "hashtags"> | string,
) {
  const normalizedEntryId =
    typeof entryOrEntryId === "string"
      ? entryOrEntryId.trim()
      : entryOrEntryId.id.trim();
  if (!normalizedEntryId || typeof window === "undefined") return;

  try {
    const seenEntries = readKnowledgeSeenEntries();
    const seenEntriesById = new Map(
      seenEntries.map((entry) => [entry.entryId, entry] as const),
    );
    const existingEntry = seenEntriesById.get(normalizedEntryId);
    const nextSeenAt = Date.now();

    if (existingEntry && nextSeenAt - existingEntry.seenAt < 30 * 60 * 1000) {
      return;
    }

    seenEntriesById.set(normalizedEntryId, {
      entryId: normalizedEntryId,
      seenAt: nextSeenAt,
    });
    writeKnowledgeSeenEntries(
      [...seenEntriesById.values()].sort((left, right) => left.seenAt - right.seenAt),
    );

    if (typeof entryOrEntryId !== "string") {
      recordKnowledgeFeedActivity({
        type: "view",
        entry: entryOrEntryId,
      });
    }
  } catch {
    // If local storage is unavailable, ranking simply falls back to default ordering.
  }
}

export function rankKnowledgeEntries(
  entries: KnowledgeEntry[],
  snapshot: KnowledgeFeedSnapshot,
  options: KnowledgeRankOptions = {},
) {
  const now = Date.now();
  const scoredEntries = [...entries]
    .map((entry) => scoreKnowledgeEntry(entry, snapshot, now, options))
    .sort((left, right) => {
      const scoreDelta = right.score - left.score;
      if (Math.abs(scoreDelta) > 0.01) {
        return scoreDelta;
      }

      const createdAtDelta = right.entry.createdAt - left.entry.createdAt;
      if (createdAtDelta !== 0) {
        return createdAtDelta;
      }

      return right.entry.likes.length - left.entry.likes.length;
    });

  const primaryPool = scoredEntries.filter(isPrimaryFeedCandidate);
  const rankedEntries =
    primaryPool.length === 0
      ? buildLatestEntriesFallback(scoredEntries)
      : (() => {
          const primaryEntries = diversifyRankedEntries(primaryPool);
          const primaryEntryIds = new Set(primaryEntries.map((entry) => entry.id));
          const secondaryEntries = diversifyRankedEntries(
            scoredEntries.filter((candidate) => !primaryEntryIds.has(candidate.entry.id)),
          );

          return [...primaryEntries, ...secondaryEntries];
        })();

  const fallbackEntries =
    rankedEntries.length > 0 ? rankedEntries : buildLatestEntriesFallback(scoredEntries);
  const unlikedFirstEntries = pushCurrentUserLikedEntriesDown(
    fallbackEntries,
    snapshot,
  );
  const newestUnseenFirstEntries = putNewUnseenEntriesFirst(
    unlikedFirstEntries,
    snapshot,
  );
  const refreshedEntries = putRefreshDiscoveryEntriesFirst(
    newestUnseenFirstEntries,
    snapshot,
    options.refreshSeed,
  );

  return options.shuffleOnRefresh
    ? shuffleRankedEntriesForManualRefresh(refreshedEntries, options.refreshSeed)
    : refreshedEntries;
}

function areEntryOrdersEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((entryId, index) => entryId === right[index]);
}

export function reconcileKnowledgeFeedOrder(
  entries: KnowledgeEntry[],
  currentOrder: string[],
  snapshot: KnowledgeFeedSnapshot,
  options: KnowledgeRankOptions = {},
) {
  const rankedEntryIds = rankKnowledgeEntries(entries, snapshot, options).map(
    (entry) => entry.id,
  );
  if (currentOrder.length === 0) {
    return rankedEntryIds;
  }

  const availableEntryIds = new Set(entries.map((entry) => entry.id));
  const preservedOrder = currentOrder.filter((entryId) => availableEntryIds.has(entryId));
  const preservedEntryIds = new Set(preservedOrder);
  const appendedEntries = rankedEntryIds.filter(
    (entryId) => !preservedEntryIds.has(entryId),
  );
  const nextOrder = [...preservedOrder, ...appendedEntries];

  return areEntryOrdersEqual(currentOrder, nextOrder) ? currentOrder : nextOrder;
}
