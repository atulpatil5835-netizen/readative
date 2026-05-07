export type ModerationMode =
  | "knowledge-post"
  | "knowledge-comment"
  | "smarttalk-question"
  | "smarttalk-answer";

export interface ModerationInput {
  title?: string;
  content: string;
  hashtags?: string[];
}

export interface ModerationDecision {
  allowed: boolean;
  category: "knowledge" | "sexual" | "promo" | "chat" | "abuse" | "unclear";
  message: string;
  suggestions: string[];
  knowledgeScore: number;
  safetyScore: number;
  source: "local";
}

interface PatternRule {
  label: string;
  pattern: RegExp;
}

interface LocalEvaluation {
  allowed: boolean;
  hardBlocked: boolean;
  category: ModerationDecision["category"];
  reasons: string[];
  suggestions: string[];
  knowledgeScore: number;
  safetyScore: number;
}

const EXPLICIT_RULES: PatternRule[] = [
  { label: "sexual content", pattern: /\bsex(ual)?\b/i },
  { label: "adult content", pattern: /\badult\b/i },
  { label: "pornography", pattern: /\bporn|pornography\b/i },
  { label: "nude content", pattern: /\bnude|nudity\b/i },
  { label: "nsfw content", pattern: /\bnsfw\b/i },
  { label: "explicit roleplay", pattern: /\broleplay\b/i },
  { label: "fetish content", pattern: /\bfetish\b/i },
  { label: "sexting", pattern: /\bsext(ing)?\b/i },
  {
    label: "explicit body language",
    pattern: /\bboobs?|breasts?|penis|vagina|nipple|tits?\b/i,
  },
  { label: "seductive language", pattern: /\bhorny|turn me on|dirty talk\b/i },
];

const PROMO_RULES: PatternRule[] = [
  { label: "contact bait", pattern: /\bdm me|message me|text me\b/i },
  { label: "external contact", pattern: /\btelegram|whatsapp|snapchat\b/i },
  { label: "adult promotion", pattern: /\bonlyfans\b/i },
  { label: "follower bait", pattern: /\bfollow me|subscribe\b/i },
  { label: "sales pitch", pattern: /\bbuy now|limited offer|discount\b/i },
  { label: "money bait", pattern: /\bearn money fast|get rich\b/i },
];

const CHAT_RULES: PatternRule[] = [
  {
    label: "casual greeting",
    pattern: /\bgood morning|good night|hello everyone|hi friends\b/i,
  },
  {
    label: "attention bait",
    pattern: /\banyone online|who is awake|reply fast\b/i,
  },
  { label: "flirting", pattern: /\blove you|miss you|date me|be mine\b/i },
  { label: "status update", pattern: /\bi am bored|feeling lonely|rate me\b/i },
];

const ABUSE_RULES: PatternRule[] = [
  { label: "harassment", pattern: /\bfuck you|idiot|stupid\b/i },
  { label: "hate language", pattern: /\bhate you|kill yourself\b/i },
];

const KNOWLEDGE_RULES: PatternRule[] = [
  { label: "explainer", pattern: /\bhow to|why|explained?|definition\b/i },
  { label: "teaching", pattern: /\blearn|lesson|tutorial|guide\b/i },
  {
    label: "framework",
    pattern: /\bframework|strategy|method|process|workflow\b/i,
  },
  {
    label: "detail",
    pattern: /\bexample|examples|case study|compare|summary\b/i,
  },
  { label: "improvement", pattern: /\btips?|mistakes?|benefits?|checklist\b/i },
  { label: "evidence", pattern: /\bresearch|data|result|insight\b/i },
  { label: "structured list", pattern: /(^|\n)([-*]|\d+\.)\s/m },
];

const QUESTION_HINT = /^(how|why|what|when|where|which|can|does|is|should)\b/i;

const MODE_SETTINGS: Record<
  ModerationMode,
  { minWords: number; passScore: number; minSentences: number }
> = {
  "knowledge-post": { minWords: 20, passScore: 6, minSentences: 2 },
  "knowledge-comment": { minWords: 3, passScore: 1, minSentences: 1 },
  "smarttalk-question": { minWords: 5, passScore: 2, minSentences: 1 },
  "smarttalk-answer": { minWords: 10, passScore: 3, minSentences: 1 },
};

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countSentences(text: string) {
  return text
    .split(/[.!?]+/)
    .map((segment) => segment.trim())
    .filter(Boolean).length;
}

function findMatches(text: string, rules: PatternRule[]) {
  return rules
    .filter((rule) => rule.pattern.test(text))
    .map((rule) => rule.label);
}

function createSuggestions(mode: ModerationMode) {
  if (mode === "knowledge-post") {
    return [
      "Add a concrete lesson, steps, examples, or a clear takeaway.",
      "Keep it educational and remove flirting, adult language, or casual status updates.",
      "Use hashtags only for real topics, not for attention bait.",
    ];
  }

  if (mode === "smarttalk-question") {
    return [
      "Ask a real learning question that others can answer helpfully.",
      "Mention the problem, context, or what you want to understand better.",
    ];
  }

  if (mode === "smarttalk-answer") {
    return [
      "Give a useful explanation instead of a one-line reaction.",
      "Add reasoning, examples, or a clear next step.",
    ];
  }

  return [
    "Keep comments respectful, useful, and relevant to the knowledge being shared.",
  ];
}

function evaluateLocally(
  mode: ModerationMode,
  input: ModerationInput,
): LocalEvaluation {
  const config = MODE_SETTINGS[mode];
  const title = input.title?.trim() || "";
  const content = input.content.trim();
  const hashtags = input.hashtags || [];
  const combinedText =
    `${title}\n${content}\n${hashtags.join(" ")}`.toLowerCase();
  const words = countWords(`${title} ${content}`);
  const sentences = countSentences(`${title}. ${content}`);

  const explicitMatches = findMatches(combinedText, EXPLICIT_RULES);
  const promoMatches = findMatches(combinedText, PROMO_RULES);
  const chatMatches = findMatches(combinedText, CHAT_RULES);
  const abuseMatches = findMatches(combinedText, ABUSE_RULES);
  const knowledgeMatches = findMatches(`${title}\n${content}`, KNOWLEDGE_RULES);

  let knowledgeScore = 0;
  let safetyScore = 100;

  if (words >= config.minWords) {
    knowledgeScore += 3;
  } else if (words >= Math.max(4, Math.floor(config.minWords * 0.6))) {
    knowledgeScore += 1;
  }

  if (sentences >= config.minSentences) {
    knowledgeScore += 1;
  }

  knowledgeScore += Math.min(4, knowledgeMatches.length);

  if (
    mode === "knowledge-post" &&
    title.split(/\s+/).filter(Boolean).length >= 3
  ) {
    knowledgeScore += 1;
  }

  if (mode === "knowledge-post" && hashtags.length > 0) {
    knowledgeScore += 1;
  }

  if (mode === "smarttalk-question" && QUESTION_HINT.test(content)) {
    knowledgeScore += 1;
  }

  knowledgeScore -= Math.min(3, chatMatches.length);

  if (explicitMatches.length > 0) safetyScore -= explicitMatches.length * 25;
  if (promoMatches.length > 0) safetyScore -= promoMatches.length * 18;
  if (abuseMatches.length > 0) safetyScore -= abuseMatches.length * 20;
  if (chatMatches.length > 0) safetyScore -= chatMatches.length * 10;

  const reasons: string[] = [];
  const suggestions = createSuggestions(mode);

  if (explicitMatches.length > 0) {
    reasons.push(
      "Readative accepts knowledge-only content, so sexual or adult material is blocked.",
    );
  }

  if (promoMatches.length > 0) {
    reasons.push(
      "Promotional or contact-bait posts are not allowed in the knowledge feed.",
    );
  }

  if (abuseMatches.length > 0) {
    reasons.push("Harassment or abusive language is not allowed.");
  }

  if (mode !== "knowledge-comment" && chatMatches.length > 0) {
    reasons.push(
      "Add a clearer learning takeaway before this can go live.",
    );
  }

  if (words < config.minWords) {
    reasons.push("Add more substance so people can actually learn from it.");
  }

  if (
    mode !== "knowledge-comment" &&
    knowledgeMatches.length === 0 &&
    words >= Math.max(4, Math.floor(config.minWords * 0.6))
  ) {
    reasons.push(
      "Make the post more educational with explanation, steps, examples, or a takeaway.",
    );
  }

  const hardBlocked =
    explicitMatches.length > 0 ||
    promoMatches.length > 0 ||
    abuseMatches.length > 0 ||
    (mode === "knowledge-post" && chatMatches.length > 1);

  let category: ModerationDecision["category"] = "knowledge";
  if (explicitMatches.length > 0) category = "sexual";
  else if (promoMatches.length > 0) category = "promo";
  else if (abuseMatches.length > 0) category = "abuse";
  else if (chatMatches.length > 0) category = "chat";
  else if (knowledgeScore < config.passScore) category = "unclear";

  return {
    allowed: !hardBlocked && knowledgeScore >= config.passScore,
    hardBlocked,
    category,
    reasons,
    suggestions,
    knowledgeScore: Math.max(0, Math.min(10, knowledgeScore)),
    safetyScore: Math.max(0, Math.min(100, safetyScore)),
  };
}

function finalizeLocal(
  evaluation: LocalEvaluation,
  fallbackMessage: string,
): ModerationDecision {
  return {
    allowed: evaluation.allowed,
    category: evaluation.category,
    message: evaluation.reasons[0] || fallbackMessage,
    suggestions: evaluation.suggestions,
    knowledgeScore: evaluation.knowledgeScore * 10,
    safetyScore: evaluation.safetyScore,
    source: "local",
  };
}

export async function moderateContent(
  mode: ModerationMode,
  input: ModerationInput,
): Promise<ModerationDecision> {
  const local = evaluateLocally(mode, input);
  const fallbackMessage =
    mode === "knowledge-post"
      ? "This post needs to be more educational before it can be published."
      : "This submission does not match Readative's knowledge-only rules yet.";

  return finalizeLocal(local, fallbackMessage);
}
