import type { KnowledgeEntry } from "../types";
import { getGuestId } from "./guestIdentity";

const HOUR_MS = 60 * 60 * 1000;
const KNOWLEDGE_SEEN_ENTRY_LIMIT = 1500;
const KNOWLEDGE_ACTIVITY_LIMIT = 260;
const KNOWLEDGE_SEEN_ENTRY_KEY_PREFIX = "readativeKnowledgeSeenEntries:v2";
const KNOWLEDGE_ACTIVITY_KEY_PREFIX = "readativeKnowledgeFeedActivity:v2";
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
  like: 4.2,
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
  "id" | "authorId" | "hashtags" | "likes" | "comments" | "mentions" | "createdAt" | "title" | "content"
> &
  Partial<Pick<KnowledgeEntry, "images" | "qualityScore" | "readingMinutes">>;

interface KnowledgeActivityRecord {
  type: KnowledgeActivityType;
  entryId?: string;
  authorId?: string;
  hashtags?: string[];
  createdAt: number;
}

export interface KnowledgeFeedSnapshot {
  isReturningUser: boolean;
  seenEntryIds: Set<string>;
  authorAffinity: Map<string, number>;
  hashtagAffinity: Map<string, number>;
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
  primaryHashtag: string | null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getKnowledgeSeenEntryKey() {
  return `${KNOWLEDGE_SEEN_ENTRY_KEY_PREFIX}:${getGuestId()}`;
}

function getKnowledgeActivityKey() {
  return `${KNOWLEDGE_ACTIVITY_KEY_PREFIX}:${getGuestId()}`;
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
    return normalizeActivityRecords(raw ? JSON.parse(raw) : []);
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

function getMomentumScore(entry: KnowledgeEntry, ageHours: number) {
  const imageCount = entry.images?.length || 0;
  const rawMomentum =
    entry.likes.length * 1.35 +
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
  const entryInterest = snapshot.entryAffinity.get(entry.id) || 0;

  return Math.min(24, authorInterest + hashtagInterest * 1.15 + entryInterest * 1.4);
}

function getNoveltyScore(
  entry: KnowledgeEntry,
  snapshot: KnowledgeFeedSnapshot,
  ageHours: number,
) {
  const hasSeenEntry = snapshot.seenEntryIds.has(entry.id);
  if (!hasSeenEntry) {
    return snapshot.isReturningUser ? 8.5 : 4;
  }

  const revisitMomentum = Math.min(
    5,
    Math.log1p(entry.comments.length * 2 + entry.likes.length),
  );
  const staleRevisitPenalty = ageHours > 48 ? 1.8 : 0;
  const weakInterestPenalty = (snapshot.entryAffinity.get(entry.id) || 0) < 1 ? 1.5 : 0;

  return revisitMomentum - 7.5 - staleRevisitPenalty - weakInterestPenalty;
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

function scoreKnowledgeEntry(
  entry: KnowledgeEntry,
  snapshot: KnowledgeFeedSnapshot,
  now: number,
) {
  const ageHours = Math.max(0, (now - entry.createdAt) / HOUR_MS);
  const freshnessScore = getFreshnessScore(ageHours, snapshot.isReturningUser);
  const momentumScore = getMomentumScore(entry, ageHours);
  const qualityScore = getQualityScore(entry);
  const personalizationScore = getPersonalizationScore(entry, snapshot);
  const noveltyScore = getNoveltyScore(entry, snapshot, ageHours);
  const explorationScore = getExplorationScore(entry, snapshot);
  const stalePenalty = getStalePenalty(ageHours, momentumScore, qualityScore);

  return {
    entry,
    ageHours,
    seen: snapshot.seenEntryIds.has(entry.id),
    primaryHashtag: getPrimaryHashtag(entry),
    score:
      freshnessScore +
      momentumScore +
      qualityScore +
      personalizationScore +
      noveltyScore +
      explorationScore -
      stalePenalty,
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
      const earlySeenPenalty = candidate.seen && rankedEntries.length < 6 ? 2.5 : 0;
      const earlyFreshBoost = !candidate.seen && rankedEntries.length < 4 ? 1.2 : 0;
      const adjustedScore =
        candidate.score - authorPenalty - topicPenalty - earlySeenPenalty + earlyFreshBoost;

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

export function getKnowledgeFeedSnapshot(): KnowledgeFeedSnapshot {
  if (typeof window === "undefined") {
    return {
      isReturningUser: false,
      seenEntryIds: new Set<string>(),
      authorAffinity: new Map<string, number>(),
      hashtagAffinity: new Map<string, number>(),
      entryAffinity: new Map<string, number>(),
      lastActiveAt: null,
    };
  }

  try {
    const rawSeenEntries = window.localStorage.getItem(getKnowledgeSeenEntryKey());
    const seenEntryIds = normalizeSeenEntryIds(
      rawSeenEntries ? JSON.parse(rawSeenEntries) : [],
    );
    const activities = readKnowledgeActivities();
    const now = Date.now();
    const authorAffinity = new Map<string, number>();
    const hashtagAffinity = new Map<string, number>();
    const entryAffinity = new Map<string, number>();
    let lastActiveAt: number | null = null;

    activities.forEach((activity) => {
      const ageHours = Math.max(0, (now - activity.createdAt) / HOUR_MS);
      const decay = Math.exp(-ageHours / 96);
      const weight = ACTIVITY_WEIGHTS[activity.type] * decay;

      addWeightedScore(authorAffinity, activity.authorId, weight);
      addWeightedScore(entryAffinity, activity.entryId, weight * 0.7);

      if ((activity.hashtags || []).length > 0) {
        const perTagWeight = weight / Math.max(1, activity.hashtags!.length * 0.85);
        activity.hashtags?.forEach((tag) => {
          addWeightedScore(hashtagAffinity, normalizeTag(tag), perTagWeight);
        });
      }

      lastActiveAt = Math.max(lastActiveAt || 0, activity.createdAt);
    });

    return {
      isReturningUser: seenEntryIds.length > 0 || activities.length > 0,
      seenEntryIds: new Set(seenEntryIds),
      authorAffinity,
      hashtagAffinity,
      entryAffinity,
      lastActiveAt,
    };
  } catch {
    return {
      isReturningUser: false,
      seenEntryIds: new Set<string>(),
      authorAffinity: new Map<string, number>(),
      hashtagAffinity: new Map<string, number>(),
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
    const storageKey = getKnowledgeSeenEntryKey();
    const raw = window.localStorage.getItem(storageKey);
    const seenEntryIds = normalizeSeenEntryIds(raw ? JSON.parse(raw) : []);

    if (seenEntryIds.includes(normalizedEntryId)) {
      return;
    }

    const nextSeenEntryIds = [...seenEntryIds, normalizedEntryId].slice(
      -KNOWLEDGE_SEEN_ENTRY_LIMIT,
    );
    window.localStorage.setItem(storageKey, JSON.stringify(nextSeenEntryIds));

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
) {
  const now = Date.now();
  const scoredEntries = [...entries]
    .map((entry) => scoreKnowledgeEntry(entry, snapshot, now))
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

  return diversifyRankedEntries(scoredEntries);
}
