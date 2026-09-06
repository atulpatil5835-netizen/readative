import type { KnowledgeEntry, Question } from "../types";

export const MIN_INDEXABLE_KNOWLEDGE_CONTENT_WORDS = 220;
export const MIN_AD_ELIGIBLE_KNOWLEDGE_CONTENT_WORDS = 450;
export const MIN_SMARTTALK_DISCUSSION_WORDS = 120;
export const MIN_AD_ELIGIBLE_SMARTTALK_DISCUSSION_WORDS = 250;

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
  return countContentWords(entry.content) >= MIN_AD_ELIGIBLE_KNOWLEDGE_CONTENT_WORDS;
}

function countSmartTalkDiscussionWords(question: SmartTalkLike) {
  const questionText = question.content || question.description || question.title || "";
  const answerTexts = (question.answers || [])
    .map((answer) => answer.content || answer.text || "")
    .join(" ");

  return countContentWords(`${questionText} ${answerTexts}`);
}

export function isIndexableSmartTalkDiscussion(question: SmartTalkLike) {
  return countSmartTalkDiscussionWords(question) >= MIN_SMARTTALK_DISCUSSION_WORDS;
}

export function isSmartTalkDiscussionAdEligible(question: SmartTalkLike) {
  return countSmartTalkDiscussionWords(question) >= MIN_AD_ELIGIBLE_SMARTTALK_DISCUSSION_WORDS;
}
