export type KnowledgeContentKind =
  | "insight"
  | "tutorial"
  | "tool"
  | "news"
  | "opinion"
  | "guide";

export type SmartTalkDifficulty = "beginner" | "intermediate" | "advanced";

export interface KnowledgeCategorySuggestion {
  id: string;
  label: string;
  keywords: string[];
}

export interface ContentQualityFeedback {
  label: "Excellent" | "Good" | "Needs More Detail" | "Needs Better Title";
  tone: "strong" | "positive" | "caution";
  hint: string;
}

export const CONTENT_KIND_OPTIONS: Array<{
  id: KnowledgeContentKind;
  label: string;
  helper: string;
}> = [
  { id: "insight", label: "Insight", helper: "A sharp observation or lesson." },
  { id: "tutorial", label: "Tutorial", helper: "Step-by-step learning." },
  { id: "tool", label: "Tool", helper: "A useful product, app, or workflow." },
  { id: "news", label: "News", helper: "A timely technology update." },
  { id: "opinion", label: "Opinion", helper: "A clear point of view." },
  { id: "guide", label: "Guide", helper: "A practical reference." },
];

export const KNOWLEDGE_CATEGORY_SUGGESTIONS: KnowledgeCategorySuggestion[] = [
  {
    id: "ai",
    label: "AI",
    keywords: ["ai", "openai", "chatgpt", "claude", "gemini", "llm", "prompt", "machine learning"],
  },
  {
    id: "programming",
    label: "Programming",
    keywords: ["react", "next.js", "javascript", "typescript", "python", "api", "code", "developer"],
  },
  {
    id: "cybersecurity",
    label: "Cybersecurity",
    keywords: ["security", "privacy", "auth", "password", "risk", "encryption", "cybersecurity"],
  },
  {
    id: "startups",
    label: "Startups",
    keywords: ["startup", "founder", "mvp", "launch", "fundraising", "customer"],
  },
  {
    id: "marketing",
    label: "Marketing",
    keywords: ["marketing", "growth", "seo", "brand", "campaign", "content", "ads"],
  },
  {
    id: "productivity",
    label: "Productivity",
    keywords: ["productivity", "workflow", "automation", "focus", "template", "shortcut"],
  },
];

export function normalizeContentKind(value: unknown): KnowledgeContentKind {
  return CONTENT_KIND_OPTIONS.some((option) => option.id === value)
    ? (value as KnowledgeContentKind)
    : "insight";
}

export function normalizeSmartTalkDifficulty(
  value: unknown,
): SmartTalkDifficulty | null {
  return value === "beginner" || value === "intermediate" || value === "advanced"
    ? value
    : null;
}

export function getKnowledgeText(title: string, content: string) {
  return `${title} ${content}`.toLowerCase();
}

export function suggestKnowledgeCategory(title: string, content: string) {
  const text = getKnowledgeText(title, content);

  return (
    KNOWLEDGE_CATEGORY_SUGGESTIONS.map((category) => ({
      category,
      score: category.keywords.reduce(
        (total, keyword) => total + (text.includes(keyword) ? 1 : 0),
        0,
      ),
    }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || left.category.label.localeCompare(right.category.label))[0]
      ?.category || null
  );
}

export function suggestKnowledgeTags(title: string, content: string) {
  const text = getKnowledgeText(title, content);
  const categoryTags = KNOWLEDGE_CATEGORY_SUGGESTIONS.filter((category) =>
    category.keywords.some((keyword) => text.includes(keyword)),
  ).map((category) => category.id);
  const explicitKeywords = [
    "openai",
    "claude",
    "gemini",
    "react",
    "nextjs",
    "typescript",
    "python",
    "seo",
    "automation",
    "privacy",
    "saas",
    "design",
  ].filter((keyword) => text.includes(keyword.replace("nextjs", "next")));

  return [...new Set([...categoryTags, ...explicitKeywords])]
    .map((tag) => tag.replace(/\W+/g, "").toLowerCase())
    .filter(Boolean)
    .slice(0, 6);
}

export function getContentQualityFeedback(
  title: string,
  content: string,
): ContentQualityFeedback {
  const cleanTitle = title.trim();
  const cleanContent = content.trim();
  const wordCount = cleanContent.split(/\s+/).filter(Boolean).length;
  const hasStructure = /(^|\n)(\d+\.|-|\*)\s+/.test(cleanContent) || cleanContent.includes(":");

  if (cleanTitle.length > 18 && wordCount >= 120 && hasStructure) {
    return {
      label: "Excellent",
      tone: "strong",
      hint: "Clear title, enough depth, and useful structure.",
    };
  }

  if (cleanTitle.length < 10) {
    return {
      label: "Needs Better Title",
      tone: "caution",
      hint: "Make the title specific so people know why it matters.",
    };
  }

  if (wordCount < 45) {
    return {
      label: "Needs More Detail",
      tone: "caution",
      hint: "Add context, steps, examples, or a takeaway before publishing.",
    };
  }

  return {
    label: "Good",
    tone: "positive",
    hint: hasStructure
      ? "Solid post. A concrete example could make it stronger."
      : "Solid post. A short list or takeaway would make it easier to scan.",
  };
}

export function formatReadingMinutes(minutes: number | null | undefined) {
  const safeMinutes =
    typeof minutes === "number" && Number.isFinite(minutes)
      ? Math.max(1, Math.round(minutes))
      : 1;

  return `${safeMinutes} min read`;
}
