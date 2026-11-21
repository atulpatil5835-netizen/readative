import type { KnowledgeEntry } from "../../types";

export const FEED_MIN_NEXT_PAGE_SIZE = 3;
export const FEED_MAX_NEXT_PAGE_SIZE = 9;
export const FEED_MAX_INDEPENDENT_PAGE_SIZE = 6;

export interface FeedConnectionProfile {
  effectiveType?: string;
  downlink?: number;
  saveData?: boolean;
}

function getFeedConnectionProfile(): FeedConnectionProfile {
  if (typeof navigator === "undefined") return {};

  const connection = (
    navigator as Navigator & { connection?: FeedConnectionProfile }
  ).connection;
  return {
    effectiveType: connection?.effectiveType,
    downlink: connection?.downlink,
    saveData: connection?.saveData,
  };
}

function isConstrainedFeedConnection(connection: FeedConnectionProfile) {
  return (
    connection.saveData === true ||
    connection.effectiveType === "slow-2g" ||
    connection.effectiveType === "2g"
  );
}

export function getInitialAdaptiveFeedPageSize(
  connection = getFeedConnectionProfile(),
) {
  if (isConstrainedFeedConnection(connection)) return FEED_MIN_NEXT_PAGE_SIZE;
  if (
    connection.effectiveType === "4g" &&
    (connection.downlink === undefined || connection.downlink >= 5)
  ) {
    return 5;
  }
  return FEED_MIN_NEXT_PAGE_SIZE;
}

export function shouldPrefetchKnowledgeFeed(
  connection = getFeedConnectionProfile(),
) {
  return !isConstrainedFeedConnection(connection);
}

export function adaptKnowledgeFeedPageSize({
  currentPageSize,
  durationMs,
  payloadChars,
  maxPageSize = FEED_MAX_NEXT_PAGE_SIZE,
  connection = getFeedConnectionProfile(),
}: {
  currentPageSize: number;
  durationMs: number;
  payloadChars: number;
  maxPageSize?: number;
  connection?: FeedConnectionProfile;
}) {
  const cap = Math.max(FEED_MIN_NEXT_PAGE_SIZE, maxPageSize);
  if (isConstrainedFeedConnection(connection)) return FEED_MIN_NEXT_PAGE_SIZE;

  if (durationMs >= 1800 || payloadChars >= 800_000) {
    return Math.max(FEED_MIN_NEXT_PAGE_SIZE, currentPageSize - 2);
  }
  if (durationMs <= 450 && payloadChars <= 360_000) {
    return Math.min(cap, currentPageSize + 2);
  }
  if (durationMs <= 850 && payloadChars <= 600_000) {
    return Math.min(cap, currentPageSize + 1);
  }
  if (durationMs >= 1200 || payloadChars >= 550_000) {
    return Math.max(FEED_MIN_NEXT_PAGE_SIZE, currentPageSize - 1);
  }

  return Math.min(
    cap,
    Math.max(FEED_MIN_NEXT_PAGE_SIZE, currentPageSize),
  );
}

export function estimateKnowledgeFeedPayloadChars(entries: KnowledgeEntry[]) {
  return entries.reduce((total, entry) => {
    const imageChars = (entry.images || []).reduce(
      (imageTotal, image) => imageTotal + (image.dataUrl?.length || 0),
      0,
    );
    const commentChars = (entry.comments || []).reduce(
      (commentTotal, comment) => commentTotal + (comment.text?.length || 0),
      0,
    );

    return (
      total +
      entry.title.length +
      entry.content.length +
      (entry.excerpt?.length || 0) +
      (entry.imageDataUrl?.length || 0) +
      imageChars +
      commentChars
    );
  }, 0);
}

export async function withFeedLoadTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`Feed request timed out after ${timeoutMs} ms.`)),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }
}
