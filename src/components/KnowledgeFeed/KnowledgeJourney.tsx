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
import { tokenizeSearch } from "../../utils/searchHelpers";

const MAX_JOURNEY_ACTIONS = 5;

const TERM_STOP_WORDS = new Set([
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

function normalizeJourneyToken(value: string | null | undefined) {
  const normalized = value
    ?.replace(/^#/, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9+#-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || null;
}

function getEntryCategoryId(entry: Pick<KnowledgeEntry, "category">) {
  const category = getCategoryBySlug(entry.category);
  return category?.id || normalizeJourneyToken(entry.category);
}

function getEntryTagSet(entry: Pick<KnowledgeEntry, "hashtags">) {
  return new Set(
    entry.hashtags
      .map((tag) => normalizeJourneyToken(tag))
      .filter((tag): tag is string => Boolean(tag)),
  );
}

function sanitizeSearchTerm(term: string) {
  return term
    .replace(/^#/, "")
    .toLowerCase()
    .replace(/[^a-z0-9+#-]+/g, "")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textIncludesJourneyTerm(text: string, term: string) {
  const normalizedTerm = term.replace(/-/g, " ").trim().toLowerCase();
  if (!normalizedTerm) return false;

  if (/^[a-z0-9+#]{1,3}$/.test(normalizedTerm)) {
    return new RegExp(
      `(^|[^a-z0-9])${escapeRegExp(normalizedTerm)}([^a-z0-9]|$)`,
    ).test(text);
  }

  return text.includes(normalizedTerm);
}

function getMeaningfulTerms(value: string, maxTerms = 18) {
  return tokenizeSearch(value, maxTerms)
    .map(sanitizeSearchTerm)
    .filter(
      (term): term is string =>
        Boolean(term) &&
        (term.length > 3 || term === "ai") &&
        !TERM_STOP_WORDS.has(term),
    );
}

function getRelatedEntryScore(entry: KnowledgeEntry, candidate: KnowledgeEntry) {
  let score = 0;
  const entryCategory = getEntryCategoryId(entry);
  const candidateCategory = getEntryCategoryId(candidate);

  if (entryCategory && candidateCategory && entryCategory === candidateCategory) {
    score += 8;
  }

  const entryTags = getEntryTagSet(entry);
  candidate.hashtags.forEach((tag) => {
    const normalizedTag = normalizeJourneyToken(tag);
    if (normalizedTag && entryTags.has(normalizedTag)) {
      score += 4;
    }
  });

  return score;
}

function getQuestionRelationScore(
  entry: KnowledgeEntry,
  question: KnowledgeJourneyQuestion,
) {
  let score = 0;
  const entryCategory = getEntryCategoryId(entry);
  const questionCategory = getCategoryBySlug(question.category)?.id ||
    normalizeJourneyToken(question.category);

  if (entryCategory && questionCategory && entryCategory === questionCategory) {
    score += 10;
  }

  const questionText = [
    question.content,
    question.author,
    question.category || "",
    ...question.answerText,
  ]
    .join(" ")
    .toLowerCase();
  const entryTags = getEntryTagSet(entry);

  entryTags.forEach((tag) => {
    if (textIncludesJourneyTerm(questionText, tag)) {
      score += 3;
    }
  });

  getMeaningfulTerms(`${entry.title} ${entry.content}`, 14).forEach((term) => {
    if (textIncludesJourneyTerm(questionText, term)) {
      score += 1;
    }
  });

  return score;
}

function getBestRelatedEntry(
  entry: KnowledgeEntry,
  entries: KnowledgeEntry[],
  excludedEntryIds: Set<string>,
) {
  return entries
    .filter(
      (candidate) =>
        candidate.id !== entry.id && !excludedEntryIds.has(candidate.id),
    )
    .map((candidate) => ({
      entry: candidate,
      score: getRelatedEntryScore(entry, candidate),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        (right.entry.updatedAt || right.entry.createdAt) -
          (left.entry.updatedAt || left.entry.createdAt),
    )[0]?.entry || null;
}

function getContinueEntry(entry: KnowledgeEntry, entries: KnowledgeEntry[]) {
  const entryIndex = entries.findIndex((candidate) => candidate.id === entry.id);
  if (entryIndex >= 0) {
    const nextEntry = entries
      .slice(entryIndex + 1)
      .find((candidate) => candidate.id !== entry.id);
    if (nextEntry) return nextEntry;
  }

  return entries.find((candidate) => candidate.id !== entry.id) || null;
}

function getAuthorEntry(
  entry: KnowledgeEntry,
  entries: KnowledgeEntry[],
  excludedEntryIds: Set<string>,
) {
  if (!entry.authorId) return null;

  return entries
    .filter(
      (candidate) =>
        candidate.id !== entry.id &&
        !excludedEntryIds.has(candidate.id) &&
        candidate.authorId === entry.authorId,
    )
    .sort(
      (left, right) =>
        (right.updatedAt || right.createdAt) - (left.updatedAt || left.createdAt),
    )[0] || null;
}

function getRelatedQuestion(
  entry: KnowledgeEntry,
  questions: KnowledgeJourneyQuestion[],
) {
  return questions
    .map((question) => ({
      question,
      score: getQuestionRelationScore(entry, question),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.question.answerCount - left.question.answerCount ||
        right.question.createdAt - left.question.createdAt,
    )[0]?.question || null;
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
  const usedEntryIds = new Set<string>();

  const addAction = (action: KnowledgeJourneyAction | null) => {
    if (!action || actions.length >= MAX_JOURNEY_ACTIONS) return;
    actions.push(action);
    if (action.entryId) usedEntryIds.add(action.entryId);
  };

  const continueEntry = getContinueEntry(entry, entries);
  if (continueEntry) {
    addAction(
      createPostAction(
        "continue",
        "Continue Reading",
        continueEntry,
        BookOpenText,
        "Next in your feed",
      ),
    );
  }

  const relatedEntry = getBestRelatedEntry(entry, entries, usedEntryIds);
  if (relatedEntry) {
    addAction(
      createPostAction(
        "related-post",
        "Related Posts",
        relatedEntry,
        Hash,
        "Same category or tags",
      ),
    );
  }

  const relatedQuestion = getRelatedQuestion(entry, questions);
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

  const authorEntry = getAuthorEntry(entry, entries, usedEntryIds);
  if (authorEntry) {
    addAction(
      createPostAction(
        "author",
        "More from this Author",
        authorEntry,
        UserRound,
        entry.author || "Same author",
      ),
    );
  }

  const category = getCategoryBySlug(entry.category);
  if (category) {
    const route = {
      tab: "knowledge" as const,
      options: { selectedTopic: category.id },
    };

    addAction({
      id: "category",
      label: "Browse Category",
      title: category.label,
      description: "More posts in this pillar",
      href: buildPublicPath(route.tab, route.options),
      icon: Compass,
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
