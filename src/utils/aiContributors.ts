import type { KnowledgeComment, KnowledgeEntry } from "../types";

export type AIProvider = "gemini" | "grok";

interface AIContributor {
  provider: AIProvider;
  authorId: string;
  authorName: string;
  model: string;
  modelLabel: string;
}

export const GEMINI_MODEL = "gemini-2.0-flash";
export const GROK_MODEL = "grok-4.20-reasoning";

export const SMARTTALK_AI_FALLBACK_DELAY_HOURS = 1;
export const KNOWLEDGE_AI_FALLBACK_DELAY_HOURS = 6;
export const AI_RESPONSE_NOTE =
  "AI answers can be wrong. Verify important or professional advice.";

const LOW_INTERACTION_LIKE_LIMIT = 2;
const NO_COMMENT_BUCKET_LIMIT = 28;
const ONE_COMMENT_BUCKET_LIMIT = 12;

const AI_CONTRIBUTORS: Record<AIProvider, AIContributor> = {
  gemini: {
    provider: "gemini",
    authorId: "google-gemini-official",
    authorName: "Gemini AI",
    model: GEMINI_MODEL,
    modelLabel: "Gemini 2.0 Flash",
  },
  grok: {
    provider: "grok",
    authorId: "xai-grok-official",
    authorName: "Grok",
    model: GROK_MODEL,
    modelLabel: "Grok 4.20 Reasoning",
  },
};

function getStableBucket(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 1000;
  }

  return hash % 100;
}

export function getAIContributor(provider: AIProvider) {
  return AI_CONTRIBUTORS[provider];
}

export function getAIContributorByAuthorId(authorId?: string | null) {
  if (!authorId) return null;

  return (
    Object.values(AI_CONTRIBUTORS).find(
      (contributor) => contributor.authorId === authorId
    ) || null
  );
}

export function isOfficialAIAuthorId(authorId?: string | null) {
  return Boolean(getAIContributorByAuthorId(authorId));
}

export function getAvailableAIProviders({
  hasGemini,
  hasGrok,
}: {
  hasGemini: boolean;
  hasGrok: boolean;
}) {
  if (hasGrok) {
    return ["grok"] as AIProvider[];
  }

  if (hasGemini) {
    return ["gemini"] as AIProvider[];
  }

  return [];
}

export function pickAIProvider(
  availableProviders: AIProvider[] = ["grok", "gemini"]
) {
  if (availableProviders.length === 0) {
    return null;
  }

  if (availableProviders.includes("grok")) {
    return "grok";
  }

  return availableProviders[0];
}

export function getHumanKnowledgeComments(comments: KnowledgeComment[] = []) {
  return comments.filter(
    (comment) => !comment.isAI && !isOfficialAIAuthorId(comment.authorId)
  );
}

export function hasOfficialAIKnowledgeComment(comments: KnowledgeComment[] = []) {
  return comments.some(
    (comment) => comment.isAI || isOfficialAIAuthorId(comment.authorId)
  );
}

export function getKnowledgeQuietHours(
  entry: Pick<KnowledgeEntry, "createdAt" | "comments">
) {
  const lastHumanCommentAt = getHumanKnowledgeComments(entry.comments).reduce(
    (latest, comment) => Math.max(latest, comment.createdAt || 0),
    0
  );
  const lastActivityAt = Math.max(entry.createdAt || 0, lastHumanCommentAt);

  return (Date.now() - lastActivityAt) / (1000 * 60 * 60);
}

export function shouldPostRareAIKnowledgeComment(
  entry: Pick<KnowledgeEntry, "id" | "createdAt" | "comments" | "likes">
) {
  if (hasOfficialAIKnowledgeComment(entry.comments)) return false;

  const humanComments = getHumanKnowledgeComments(entry.comments);
  if (humanComments.length > 1) return false;
  if (getKnowledgeQuietHours(entry) < KNOWLEDGE_AI_FALLBACK_DELAY_HOURS) {
    return false;
  }

  const likeCount = entry.likes?.length || 0;
  if (likeCount > LOW_INTERACTION_LIKE_LIMIT) return false;

  const bucket = getStableBucket(entry.id);
  return humanComments.length === 0
    ? bucket < NO_COMMENT_BUCKET_LIMIT
    : bucket < ONE_COMMENT_BUCKET_LIMIT;
}

export function getHumanSmartTalkAnswers<
  TAnswer extends { isAI?: boolean; authorId?: string | null }
>(answers: TAnswer[] = []) {
  return answers.filter(
    (answer) => !answer.isAI && !isOfficialAIAuthorId(answer.authorId)
  );
}

export function hasOfficialAISmartTalkAnswer<
  TAnswer extends { isAI?: boolean; authorId?: string | null }
>(answers: TAnswer[] = []) {
  return answers.some(
    (answer) => answer.isAI || isOfficialAIAuthorId(answer.authorId)
  );
}

export function shouldPostSmartTalkAIAnswer<
  TAnswer extends { isAI?: boolean; authorId?: string | null },
  TQuestion extends {
    createdAt: number;
    answers?: TAnswer[];
    aiAnswered?: boolean;
  }
>(question: TQuestion) {
  if (question.aiAnswered) return false;
  if (hasOfficialAISmartTalkAnswer(question.answers || [])) return false;
  if (getHumanSmartTalkAnswers(question.answers || []).length > 0) return false;

  const ageHours = (Date.now() - question.createdAt) / (1000 * 60 * 60);
  return ageHours >= SMARTTALK_AI_FALLBACK_DELAY_HOURS;
}
