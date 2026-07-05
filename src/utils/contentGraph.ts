export interface ContentGraphRecord {
  id: string;
  title?: string;
  description?: string;
  content?: string;
  author?: string;
  authorId?: string;
  category?: string | null;
  hashtags?: readonly string[];
  createdAt?: number;
  updatedAt?: number | null;
}

export interface ContentGraphQuestion extends ContentGraphRecord {
  answerCount?: number;
  answers?: readonly unknown[];
  answerText?: readonly string[];
}

const STOP_WORDS = new Set([
  "about",
  "after",
  "also",
  "because",
  "before",
  "from",
  "have",
  "into",
  "more",
  "that",
  "their",
  "there",
  "this",
  "with",
  "your",
]);

export function normalizeContentGraphSlug(value: string | null | undefined) {
  const normalized = value
    ?.replace(/^#/, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || null;
}

export function normalizeContentGraphTags(tags: readonly string[] | undefined) {
  return [
    ...new Set(
      (tags || [])
        .map((tag) => normalizeContentGraphSlug(tag))
        .filter((tag): tag is string => Boolean(tag)),
    ),
  ];
}

function getRecordText(record: ContentGraphRecord) {
  return [
    record.title,
    record.description,
    record.content,
    record.author,
    record.category,
    ...(record.hashtags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getTerms(record: ContentGraphRecord) {
  return new Set(
    getRecordText(record)
      .replace(/[^a-z0-9+#]+/g, " ")
      .split(/\s+/)
      .filter(
        (term) =>
          Boolean(term) &&
          (term.length > 3 || term === "ai") &&
          !STOP_WORDS.has(term),
      )
      .slice(0, 32),
  );
}

function getRelationScore(
  source: ContentGraphRecord,
  candidate: ContentGraphRecord,
) {
  let score = 0;
  const sourceCategory = normalizeContentGraphSlug(source.category);
  const candidateCategory = normalizeContentGraphSlug(candidate.category);

  if (sourceCategory && sourceCategory === candidateCategory) score += 12;
  if (source.authorId && source.authorId === candidate.authorId) score += 3;

  const sourceTags = new Set(normalizeContentGraphTags(source.hashtags));
  normalizeContentGraphTags(candidate.hashtags).forEach((tag) => {
    if (sourceTags.has(tag)) score += 6;
  });

  const sourceTerms = getTerms(source);
  const candidateTerms = getTerms(candidate);
  sourceTerms.forEach((term) => {
    if (candidateTerms.has(term)) score += 1;
  });

  return score;
}

function getActivity(record: ContentGraphRecord) {
  return record.updatedAt || record.createdAt || 0;
}

function rankRelated<T extends ContentGraphRecord>(
  source: ContentGraphRecord,
  candidates: readonly T[],
  limit: number,
) {
  const seen = new Set<string>([source.id]);

  return candidates
    .filter((candidate) => {
      if (!candidate.id || seen.has(candidate.id)) return false;
      seen.add(candidate.id);
      return true;
    })
    .map((candidate) => ({
      candidate,
      score: getRelationScore(source, candidate),
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        getActivity(right.candidate) - getActivity(left.candidate) ||
        left.candidate.id.localeCompare(right.candidate.id),
    )
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

export function getRelatedPosts<T extends ContentGraphRecord>(
  source: ContentGraphRecord,
  posts: readonly T[],
  limit = 4,
) {
  return rankRelated(source, posts, limit);
}

export function getRelatedQuestions<T extends ContentGraphQuestion>(
  source: ContentGraphRecord,
  questions: readonly T[],
  limit = 4,
) {
  return rankRelated(source, questions, limit);
}
