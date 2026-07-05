import { useMemo, type MouseEvent } from "react";
import {
  ArrowRight,
  BookOpenText,
  Compass,
  Hash,
  MessageSquareMore,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { type KnowledgeEntry } from "../../types";
import {
  buildPublicPath,
  navigateToRoute,
  type AppTab,
  type RouteOptions,
} from "../../utils/routes";
import { getCategoryBySlug } from "../../utils/seoTaxonomy";
import {
  getRelatedPosts,
  getRelatedQuestions,
  normalizeContentGraphTags,
} from "../../utils/contentGraph";

const MAX_JOURNEY_ACTIONS = 5;

export interface KnowledgeJourneyQuestion {
  id: string;
  author: string;
  authorId: string;
  content: string;
  category: string | null;
  createdAt: number;
  answerCount: number;
  answerText: string[];
}

interface JourneyRoute {
  tab: AppTab;
  options?: RouteOptions;
}

interface KnowledgeJourneyAction {
  id: string;
  label: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  route: JourneyRoute;
  entryId?: string;
}

interface KnowledgeJourneyInput {
  entry: KnowledgeEntry;
  entries: KnowledgeEntry[];
  questions: KnowledgeJourneyQuestion[];
}

interface KnowledgeJourneyProps extends KnowledgeJourneyInput {
  className?: string;
  variant?: "inline" | "rail";
}

function createPostAction(
  id: string,
  label: string,
  entry: KnowledgeEntry,
  icon: LucideIcon,
  description: string,
): KnowledgeJourneyAction {
  const route = {
    tab: "knowledge" as const,
    options: { focusedEntryId: entry.id },
  };

  return {
    id,
    label,
    title: entry.title,
    description,
    href: buildPublicPath(route.tab, route.options),
    icon,
    route,
    entryId: entry.id,
  };
}

export function getKnowledgeJourneyActions({
  entry,
  entries,
  questions,
}: KnowledgeJourneyInput) {
  const actions: KnowledgeJourneyAction[] = [];
  const addAction = (action: KnowledgeJourneyAction | null) => {
    if (!action || actions.length >= MAX_JOURNEY_ACTIONS) return;
    actions.push(action);
  };

  const relatedEntry =
    getRelatedPosts(entry, entries, 1)[0] ||
    entries.find((candidate) => candidate.id !== entry.id);
  if (relatedEntry) {
    addAction(
      createPostAction(
        "related-post",
        "Related Posts",
        relatedEntry,
        BookOpenText,
        "Matched from loaded posts",
      ),
    );
  }

  const relatedQuestion = getRelatedQuestions(entry, questions, 1)[0];
  if (relatedQuestion) {
    const route = {
      tab: "smarttalk" as const,
      options: {
        selectedTopic: relatedQuestion.category || entry.category,
        focusedEntryId: relatedQuestion.id,
      },
    };
    const answerLabel =
      relatedQuestion.answerCount === 1
        ? "1 answer"
        : `${relatedQuestion.answerCount} answers`;

    addAction({
      id: "related-smarttalk",
      label: "Related SmartTalk",
      title: relatedQuestion.content,
      description: answerLabel,
      href: buildPublicPath(route.tab, route.options),
      icon: MessageSquareMore,
      route,
    });
  }

  const category = getCategoryBySlug(entry.category);
  if (category) {
    const route = {
      tab: "knowledge" as const,
      options: { selectedTopic: category.id },
    };

    addAction({
      id: "same-category",
      label: "Same Category",
      title: category.label,
      description: "More posts in this pillar",
      href: buildPublicPath(route.tab, route.options),
      icon: Compass,
      route,
    });
  }

  if (entry.authorId) {
    const route = {
      tab: "profile" as const,
      options: { profileAuthorId: entry.authorId },
    };
    addAction({
      id: "same-author",
      label: "Same Author",
      title: entry.author || "Readative contributor",
      description: "Latest from this contributor",
      href: buildPublicPath(route.tab, route.options),
      icon: UserRound,
      route,
    });
  }

  const similarTopic = normalizeContentGraphTags(entry.hashtags)[0];
  if (similarTopic) {
    const route = {
      tab: "knowledge" as const,
      options: { selectedHashtag: similarTopic },
    };
    addAction({
      id: "similar-topic",
      label: "Similar Topics",
      title: `#${similarTopic.replace(/-/g, " ")}`,
      description: "Explore this topic",
      href: buildPublicPath(route.tab, route.options),
      icon: Hash,
      route,
    });
  }

  return actions.slice(0, MAX_JOURNEY_ACTIONS);
}

export function getKnowledgeJourneyEstimatedHeight(input: KnowledgeJourneyInput) {
  const actionCount = getKnowledgeJourneyActions(input).length;
  if (actionCount === 0) return 0;

  const isTwoColumn = typeof window !== "undefined" && window.innerWidth >= 640;
  const rowCount = isTwoColumn ? Math.ceil(actionCount / 2) : actionCount;

  return 54 + rowCount * 66;
}

export function KnowledgeJourney({
  entry,
  entries,
  questions,
  className = "",
  variant = "inline",
}: KnowledgeJourneyProps) {
  const actions = useMemo(
    () => getKnowledgeJourneyActions({ entry, entries, questions }),
    [entry, entries, questions],
  );

  if (actions.length === 0) return null;

  const handleNavigate = (
    event: MouseEvent<HTMLAnchorElement>,
    action: KnowledgeJourneyAction,
  ) => {
    event.preventDefault();
    navigateToRoute(action.route.tab, action.route.options);
  };

  return (
    <section
      className={`mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-3.5 py-3.5 shadow-none ${className}`}
      aria-label={`Knowledge journey after ${entry.title}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Continue learning
        </p>
      </div>

      <div
        className={
          variant === "rail" ? "mt-2 grid gap-2" : "mt-2 grid gap-2 sm:grid-cols-2"
        }
      >
        {actions.map((action) => {
          const ActionIcon = action.icon;

          return (
            <a
              key={action.id}
              href={action.href}
              onClick={(event) => handleNavigate(event, action)}
              className="group flex min-h-[58px] items-center gap-2 rounded-xl border border-slate-100 bg-white/80 px-3 py-2 text-left transition-colors hover:border-emerald-200 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 transition-colors group-hover:text-emerald-700">
                <ActionIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  {action.label}
                </span>
                <span className="mt-0.5 line-clamp-1 text-xs font-semibold leading-5 text-slate-800 group-hover:text-emerald-700">
                  {action.title}
                </span>
                <span className="block truncate text-[11px] font-semibold text-slate-400">
                  {action.description}
                </span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition-colors group-hover:text-emerald-600" />
            </a>
          );
        })}
      </div>
    </section>
  );
}
