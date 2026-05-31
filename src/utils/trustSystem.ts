import type { KnowledgeEntry, SmartAnswer, UserProfile } from "../types";

export type ContributorLevel =
  | "New Contributor"
  | "Trusted Contributor"
  | "Expert Contributor"
  | "Community Leader";

export type TrustTone = "caution" | "neutral" | "positive" | "strong";

interface TrustSource {
  likes?: unknown;
  likeCount?: unknown;
  helpfulIds?: unknown;
  helpfulCount?: unknown;
  dislikes?: unknown;
  dislikeCount?: unknown;
  misleadingIds?: unknown;
  misleadingCount?: unknown;
}

export interface TrustMetrics {
  helpfulIds: string[];
  misleadingIds: string[];
  helpfulCount: number;
  misleadingCount: number;
  totalSignals: number;
  communityTrustPercent: number;
  tone: TrustTone;
}

export interface ContributorReputation {
  score: number;
  level: ContributorLevel;
  helpfulCount: number;
  misleadingCount: number;
  postCount: number;
}

export function normalizeTrustIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value)]
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function mergeTrustIds(...sources: string[][]): string[] {
  return [...new Set(sources.flat().filter(Boolean))];
}

export function normalizeTrustCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

export function getHelpfulIds(source: TrustSource): string[] {
  return mergeTrustIds(
    normalizeTrustIdArray(source.helpfulIds),
    normalizeTrustIdArray(source.likes),
  );
}

export function getMisleadingIds(source: TrustSource): string[] {
  return mergeTrustIds(
    normalizeTrustIdArray(source.misleadingIds),
    normalizeTrustIdArray(source.dislikes),
  );
}

export function getTrustMetrics(source: TrustSource): TrustMetrics {
  const helpfulIds = getHelpfulIds(source);
  const misleadingIds = getMisleadingIds(source);
  const helpfulCount = Math.max(
    helpfulIds.length,
    normalizeTrustCount(source.helpfulCount),
    normalizeTrustCount(source.likeCount),
  );
  const misleadingCount = Math.max(
    misleadingIds.length,
    normalizeTrustCount(source.misleadingCount),
    normalizeTrustCount(source.dislikeCount),
  );
  const totalSignals = helpfulCount + misleadingCount;
  const communityTrustPercent =
    totalSignals > 0
      ? Math.round((helpfulCount / totalSignals) * 100)
      : 75;

  return {
    helpfulIds,
    misleadingIds,
    helpfulCount,
    misleadingCount,
    totalSignals,
    communityTrustPercent,
    tone:
      communityTrustPercent >= 88
        ? "strong"
        : communityTrustPercent >= 72
          ? "positive"
          : communityTrustPercent >= 55
            ? "neutral"
            : "caution",
  };
}

export function getContributorLevel(score: number): ContributorLevel {
  if (score >= 160) return "Community Leader";
  if (score >= 78) return "Expert Contributor";
  if (score >= 26) return "Trusted Contributor";
  return "New Contributor";
}

function getProfileReputationSeed(profile?: UserProfile | null) {
  return Math.max(
    normalizeTrustCount(profile?.reputationScore),
    normalizeTrustCount(profile?.helpfulCount) * 4 +
      normalizeTrustCount(profile?.bestAnswerCount) * 12 -
      normalizeTrustCount(profile?.misleadingCount) * 6,
  );
}

export function getContributorReputationFromEntries(
  entries: KnowledgeEntry[],
  authorId: string,
  profile?: UserProfile | null,
): ContributorReputation {
  const authorEntries = entries.filter((entry) => entry.authorId === authorId);
  const postCount = authorEntries.length;
  const helpfulCount = authorEntries.reduce(
    (total, entry) => total + getTrustMetrics(entry).helpfulCount,
    normalizeTrustCount(profile?.helpfulCount),
  );
  const misleadingCount = authorEntries.reduce(
    (total, entry) => total + getTrustMetrics(entry).misleadingCount,
    normalizeTrustCount(profile?.misleadingCount),
  );
  const commentCount = authorEntries.reduce(
    (total, entry) => total + (entry.comments || []).length,
    0,
  );
  const qualityScore = authorEntries.reduce(
    (total, entry) =>
      total + (typeof entry.qualityScore === "number" ? entry.qualityScore : 0),
    0,
  );
  const score = Math.max(
    0,
    Math.round(
      getProfileReputationSeed(profile) +
        postCount * 5 +
        helpfulCount * 6 +
        commentCount * 2 +
        qualityScore / 12 -
        misleadingCount * 8,
    ),
  );

  return {
    score,
    level: getContributorLevel(score),
    helpfulCount,
    misleadingCount,
    postCount,
  };
}

export function getAnswerHelpfulScore(answer: SmartAnswer) {
  const metrics = getTrustMetrics(answer);
  return metrics.helpfulCount - metrics.misleadingCount;
}
