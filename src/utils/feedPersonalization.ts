import type { KnowledgeEntry } from "../types";
import { getGuestId } from "./guestIdentity";

const KNOWLEDGE_SEEN_ENTRY_LIMIT = 1500;
const KNOWLEDGE_SEEN_ENTRY_KEY_PREFIX = "readativeKnowledgeSeenEntries:v1";

export interface KnowledgeFeedSnapshot {
  isReturningUser: boolean;
  seenEntryIds: Set<string>;
}

function getKnowledgeSeenEntryKey() {
  return `${KNOWLEDGE_SEEN_ENTRY_KEY_PREFIX}:${getGuestId()}`;
}

function normalizeSeenEntryIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return [...new Set(value)]
    .filter((entryId): entryId is string => typeof entryId === "string")
    .map((entryId) => entryId.trim())
    .filter(Boolean)
    .slice(-KNOWLEDGE_SEEN_ENTRY_LIMIT);
}

export function getKnowledgeFeedSnapshot(): KnowledgeFeedSnapshot {
  if (typeof window === "undefined") {
    return {
      isReturningUser: false,
      seenEntryIds: new Set<string>(),
    };
  }

  try {
    const raw = window.localStorage.getItem(getKnowledgeSeenEntryKey());
    const seenEntryIds = normalizeSeenEntryIds(raw ? JSON.parse(raw) : []);

    return {
      isReturningUser: seenEntryIds.length > 0,
      seenEntryIds: new Set(seenEntryIds),
    };
  } catch {
    return {
      isReturningUser: false,
      seenEntryIds: new Set<string>(),
    };
  }
}

export function markKnowledgeEntrySeen(entryId: string) {
  const normalizedEntryId = entryId.trim();
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
  } catch {
    // If local storage is unavailable, ranking simply falls back to default ordering.
  }
}

function sortByLikesThenRecency(left: KnowledgeEntry, right: KnowledgeEntry) {
  const likeDelta = right.likes.length - left.likes.length;
  if (likeDelta !== 0) return likeDelta;

  return right.createdAt - left.createdAt;
}

function sortByRecencyThenLikes(left: KnowledgeEntry, right: KnowledgeEntry) {
  const createdAtDelta = right.createdAt - left.createdAt;
  if (createdAtDelta !== 0) return createdAtDelta;

  return right.likes.length - left.likes.length;
}

function splitNewestEntries(entries: KnowledgeEntry[]) {
  if (entries.length === 0) {
    return {
      newestEntries: [] as KnowledgeEntry[],
      remainingEntries: [] as KnowledgeEntry[],
    };
  }

  const newestCreatedAt = entries.reduce(
    (latestCreatedAt, entry) => Math.max(latestCreatedAt, entry.createdAt),
    entries[0].createdAt,
  );

  return {
    newestEntries: entries
      .filter((entry) => entry.createdAt === newestCreatedAt)
      .sort(sortByRecencyThenLikes),
    remainingEntries: entries.filter(
      (entry) => entry.createdAt !== newestCreatedAt,
    ),
  };
}

export function rankKnowledgeEntries(
  entries: KnowledgeEntry[],
  snapshot: KnowledgeFeedSnapshot,
) {
  const nextEntries = [...entries];

  if (!snapshot.isReturningUser) {
    const { newestEntries, remainingEntries } = splitNewestEntries(nextEntries);

    return [...newestEntries, ...remainingEntries.sort(sortByLikesThenRecency)];
  }

  return nextEntries.sort((left, right) => {
    const leftSeen = snapshot.seenEntryIds.has(left.id);
    const rightSeen = snapshot.seenEntryIds.has(right.id);

    if (leftSeen !== rightSeen) {
      return leftSeen ? 1 : -1;
    }

    if (!leftSeen) {
      return sortByRecencyThenLikes(left, right);
    }

    return sortByLikesThenRecency(left, right);
  });
}
