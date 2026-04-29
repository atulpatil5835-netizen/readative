import type { KnowledgeComment, KnowledgeEntry } from "../types";

export const CHATGPT_MODEL = "gpt-5.3-chat-latest";
export const CHATGPT_VERSION_LABEL = "GPT-5.3";
export const CHATGPT_AUTHOR_NAME = `ChatGPT (${CHATGPT_VERSION_LABEL})`;
export const CHATGPT_AUTHOR_ID = "chatgpt-gpt-5-3";
export const AI_FALLBACK_DELAY_HOURS = 6;

const LOW_INTERACTION_LIKE_LIMIT = 2;
const NO_COMMENT_BUCKET_LIMIT = 32;
const ONE_COMMENT_BUCKET_LIMIT = 16;

function getStableBucket(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 1000;
  }

  return hash % 100;
}

export function getHumanKnowledgeComments(comments: KnowledgeComment[] = []) {
  return comments.filter((comment) => !comment.isAI);
}

export function hasChatGPTKnowledgeComment(comments: KnowledgeComment[] = []) {
  return comments.some(
    (comment) => comment.isAI || comment.authorId === CHATGPT_AUTHOR_ID
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

export function shouldPostRareChatGPTComment(
  entry: Pick<KnowledgeEntry, "id" | "createdAt" | "comments" | "likes">
) {
  if (hasChatGPTKnowledgeComment(entry.comments)) return false;

  const humanComments = getHumanKnowledgeComments(entry.comments);
  if (humanComments.length > 1) return false;
  if (getKnowledgeQuietHours(entry) < AI_FALLBACK_DELAY_HOURS) return false;

  const likeCount = entry.likes?.length || 0;
  if (likeCount > LOW_INTERACTION_LIKE_LIMIT) return false;

  const bucket = getStableBucket(entry.id);
  return humanComments.length === 0
    ? bucket < NO_COMMENT_BUCKET_LIMIT
    : bucket < ONE_COMMENT_BUCKET_LIMIT;
}
