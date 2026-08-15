import type { KnowledgeEntry, Question } from "../types";

export const MIN_INDEXABLE_KNOWLEDGE_CONTENT_WORDS = 120;
export const MIN_SMARTTALK_DISCUSSION_WORDS = 80;

type KnowledgeLike = Pick<KnowledgeEntry, "content">;
type SmartTalkLike = {
  content?: string;
  description?: string;
  title?: string;
  answers?: Array<Partial<Pick<Question["answers"][number], "content">> & { text?: string }>;
  answerCount?: number;
};

export function countContentWords(value: string | null | undefined) {
  return (value || "").trim().split(/\s+/).filter(Boolean).length;
}

export function isIndexableKnowledgeContent(entry: KnowledgeLike) {
  return countContentWords(entry.content) >= MIN_INDEXABLE_KNOWLEDGE_CONTENT_WORDS;
}

export function isKnowledgeEntryAdEligible(entry: KnowledgeLike) {
  return isIndexableKnowledgeContent(entry);
}

export function isIndexableSmartTalkDiscussion(question: SmartTalkLike) {
  const questionText = question.content || question.description || question.title || "";
  const answerTexts = (question.answers || [])
    .map((answer) => answer.content || answer.text || "")
    .join(" ");
  const totalWords = countContentWords(`${questionText} ${answerTexts}`);
  const answerCount = question.answerCount ?? question.answers?.length ?? 0;

  return answerCount > 0 || totalWords >= MIN_SMARTTALK_DISCUSSION_WORDS;
}

export function isSmartTalkDiscussionAdEligible(question: SmartTalkLike) {
  return isIndexableSmartTalkDiscussion(question);
}
