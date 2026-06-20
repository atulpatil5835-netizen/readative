import { ComponentType } from "react";
import {
  Bot,
  Cpu,
  Briefcase,
  Megaphone,
  Rocket,
  Zap,
  Code2,
  ShieldCheck,
  Flame,
} from "lucide-react";
import { ReadativeRMark } from "../ReadativeLoader";
import {
  SEO_CATEGORIES,
  getCategoryBySlug,
  getRelatedTopicsForCategory,
  getTopicMatchValues,
  normalizeSeoSlug,
  type SeoCategoryId,
} from "../../utils/seoTaxonomy";
import { type FeedTopicId, type FeedTopicFilter } from "./feedTypes";

export function ReadativeTopicIcon({ className = "" }: { className?: string }) {
  return (
    <ReadativeRMark
      className={`${className} text-[11px] tracking-tight text-current`}
    />
  );
}

export const CATEGORY_ICON_BY_ID: Record<SeoCategoryId, ComponentType<{ className?: string }>> = {
  ai: Bot,
  technology: Cpu,
  business: Briefcase,
  marketing: Megaphone,
  startup: Rocket,
  productivity: Zap,
  development: Code2,
  cybersecurity: ShieldCheck,
};

export const LEGACY_FEED_TOPIC_ALIASES: Record<string, SeoCategoryId> = {
  apps: "technology",
  tools: "technology",
  design: "technology",
  learning: "productivity",
  programming: "development",
  software: "development",
  startups: "startup",
};

export const FEED_TOPIC_FILTERS: FeedTopicFilter[] = [
  {
    id: "all",
    label: "All",
    icon: ReadativeTopicIcon,
    keywords: [],
  },
  {
    id: "trending",
    label: "Trending",
    icon: Flame,
    keywords: [],
  },
  ...SEO_CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    icon: CATEGORY_ICON_BY_ID[category.id],
    keywords: [
      ...category.keywords,
      ...category.aliases,
      ...category.examples,
      ...category.topicSlugs,
      ...getRelatedTopicsForCategory(category.id, 12).flatMap(getTopicMatchValues),
    ],
    category,
  })),
];

export function normalizeFeedTopicId(value: string | null | undefined): FeedTopicId {
  const normalized = normalizeSeoSlug(value);
  if (!normalized) return "all";
  if (normalized === "all" || normalized === "trending") return normalized;

  const category = getCategoryBySlug(normalized);
  if (category) return category.id;

  return LEGACY_FEED_TOPIC_ALIASES[normalized] || "all";
}
