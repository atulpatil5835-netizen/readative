import { useCallback, useMemo, type ReactNode, type RefObject } from "react";
import {
  ArrowUp,
  BookOpenText,
  RefreshCw,
} from "lucide-react";
import { KnowledgeEntry, UserProfile } from "../../types";
import { KnowledgeCardList } from "../KnowledgeCardList";
import { DiscoverySearch } from "../DiscoverySearch";
import {
  FeedPaginationSkeleton,
  KnowledgeFeedSkeleton,
} from "../Skeletons";
import { SEO } from "../SEO";
import { type SeoCategoryDefinition, type SeoTopicDefinition } from "../../utils/seoTaxonomy";
import { buildPublicPath, navigateToRoute } from "../../utils/routes";
import { type KnowledgeIdentity } from "../../utils/knowledgeIdentity";
import { type FeedTopicFilter, type FeedTopicId } from "./feedTypes";
import { FEED_TOPIC_FILTERS } from "./feedFilters";
import { buildKnowledgeSchemas } from "./feedHelpers";
import {
  getKnowledgeJourneyActions,
  getKnowledgeJourneyEstimatedHeight,
  KnowledgeJourney,
  type KnowledgeJourneyQuestion,
} from "./KnowledgeJourney";

// ─── Sub-components ───────────────────────────────────────────────────────────

export function FeedNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 shadow-sm">
      <p className="font-bold">{title}</p>
      <p className="mt-1 leading-6">{body}</p>
    </div>
  );
}

function BriefText({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 leading-5 text-slate-600">{value}</p>
    </div>
  );
}

export function CategoryKnowledgeBrief({
  category,
  topics,
  onOpenTopic,
}: {
  category: SeoCategoryDefinition;
  topics: SeoTopicDefinition[];
  onOpenTopic: (topicId: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600">
            Category
          </p>
          <h1 className="mt-1 text-xl font-black tracking-tight text-slate-950">
            {category.label}
          </h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
            {category.description}
          </p>
        </div>
        <span className="w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">
          Permanent pillar
        </span>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <BriefText label="What" value={category.what} />
        <BriefText label="Why" value={category.why} />
        <BriefText label="Who" value={category.who} />
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
            Benefits
          </p>
          <ul className="mt-1 space-y-1.5 text-slate-600">
            {category.benefits.map((benefit) => (
              <li key={benefit} className="leading-5">
                {benefit}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
            Examples
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {category.examples.map((example) => (
              <span
                key={example}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600"
              >
                {example}
              </span>
            ))}
          </div>
        </div>

        {topics.length > 0 && (
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
              Related Topics
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {topics.map((topicDefinition) => (
                <a
                  key={topicDefinition.id}
                  href={`/topic/${topicDefinition.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenTopic(topicDefinition.id);
                  }}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black text-slate-600 transition-colors hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                >
                  {topicDefinition.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

interface DesktopRailLink {
  id: string;
  label?: string;
  title: string;
  description?: string;
  href?: string;
  onClick?: () => void;
}

function getNextDesktopEntries(
  entry: KnowledgeEntry | null,
  entries: KnowledgeEntry[],
  excludedEntryIds = new Set<string>(),
  limit = 3,
) {
  if (entries.length === 0) return [];

  const currentIndex = entry
    ? entries.findIndex((candidate) => candidate.id === entry.id)
    : -1;
  const ordered =
    currentIndex >= 0
      ? [
          ...entries.slice(currentIndex + 1),
          ...entries.slice(0, currentIndex),
        ]
      : entries;

  return ordered
    .filter(
      (candidate) =>
        candidate.id !== entry?.id && !excludedEntryIds.has(candidate.id),
    )
    .slice(0, limit);
}

function createDesktopPostItem(
  entry: KnowledgeEntry,
  label: string,
  onOpenEntry: (entryId: string) => void,
): DesktopRailLink {
  return {
    id: entry.id,
    label,
    title: entry.title,
    description: entry.author,
    href: buildPublicPath("knowledge", {
      focusedEntryId: entry.id,
      seoTitle: entry.title,
    }),
    onClick: () => onOpenEntry(entry.id),
  };
}

function DesktopRailSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/55 bg-white/75 px-4 py-4 shadow-none transition-opacity duration-150">
      {eyebrow && (
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-1 text-sm font-semibold tracking-tight text-slate-800">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DesktopRailList({ items }: { items: DesktopRailLink[] }) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const content = (
          <>
            {item.label && (
              <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-600/80">
                {item.label}
              </span>
            )}
            <span className="mt-0.5 block line-clamp-2 text-xs font-semibold leading-5 text-slate-700">
              {item.title}
            </span>
            {item.description && (
              <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-400">
                {item.description}
              </span>
            )}
          </>
        );
        const className =
          "block w-full rounded-xl border border-transparent bg-slate-50/60 px-3 py-2 text-left transition-colors hover:border-emerald-100 hover:bg-emerald-50/70 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2";

        if (item.href) {
          return (
            <a
              key={item.id}
              href={item.href}
              onClick={(event) => {
                if (!item.onClick) return;
                event.preventDefault();
                item.onClick();
              }}
              className={className}
            >
              {content}
            </a>
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className={className}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

function DesktopLeftRail({
  activeFeedLabel,
  contextEntry,
  entries,
  progressLabel,
  todayCount,
  onOpenEntry,
}: {
  activeFeedLabel: string;
  contextEntry: KnowledgeEntry | null;
  entries: KnowledgeEntry[];
  progressLabel: string;
  todayCount: number;
  onOpenEntry: (entryId: string) => void;
}) {
  const continueItems = getNextDesktopEntries(
    contextEntry,
    entries,
    new Set(),
    2,
  ).map((entry, index) =>
      createDesktopPostItem(entry, index === 0 ? "Next" : "Then", onOpenEntry),
    );

  return (
    <aside
      aria-label="Desktop reading workspace"
      className="hidden min-[1280px]:block min-[1280px]:self-stretch"
    >
      <div className="sticky top-24 space-y-5">
        {(entries.length > 0 || contextEntry) && (
          <DesktopRailSection eyebrow={activeFeedLabel} title="Reading Progress">
            <div className="space-y-2 text-xs font-semibold leading-5 text-slate-500">
              <p>{progressLabel}</p>
              <p>{todayCount} loaded today</p>
              {contextEntry && (
                <p className="line-clamp-2 text-slate-700">
                  Current: {contextEntry.title}
                </p>
              )}
            </div>
          </DesktopRailSection>
        )}

        {continueItems.length > 0 && (
          <DesktopRailSection eyebrow="Next in feed" title="Continue Reading">
            <DesktopRailList items={continueItems} />
          </DesktopRailSection>
        )}
      </div>
    </aside>
  );
}

function DesktopRightRail({
  contextEntry,
  journeyEntries,
  journeyQuestions,
  onOpenEntry,
}: {
  contextEntry: KnowledgeEntry | null;
  journeyEntries: KnowledgeEntry[];
  journeyQuestions: KnowledgeJourneyQuestion[];
  onOpenEntry: (entryId: string) => void;
}) {
  const hasJourneyActions = contextEntry
    ? getKnowledgeJourneyActions({
        entry: contextEntry,
        entries: journeyEntries,
        questions: journeyQuestions,
      }).length > 0
    : false;
  const nextItems = getNextDesktopEntries(
    contextEntry,
    journeyEntries,
    new Set(),
    2,
  ).map((entry, index) =>
    createDesktopPostItem(
      entry,
      index === 0 ? "What's next" : "Continue",
      onOpenEntry,
    ),
  );

  return (
    <aside
      aria-label="Desktop learning context"
      className="hidden min-[1280px]:block min-[1280px]:self-stretch"
    >
      <div className="sticky top-24 space-y-5">
        {contextEntry && hasJourneyActions ? (
          <DesktopRailSection eyebrow="Context" title="Knowledge Journey">
            <p className="mb-3 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">
              {contextEntry.title}
            </p>
            <KnowledgeJourney
              entry={contextEntry}
              entries={journeyEntries}
              questions={journeyQuestions}
              className="mt-0 border-0 bg-transparent px-0 py-0 shadow-none"
              variant="rail"
            />
          </DesktopRailSection>
        ) : nextItems.length > 0 ? (
          <DesktopRailSection eyebrow="After this" title="What's Next">
            <DesktopRailList items={nextItems} />
          </DesktopRailSection>
        ) : null}
      </div>
    </aside>
  );
}

// ─── FeedRenderer ─────────────────────────────────────────────────────────────

export interface FeedRendererProps {
  // Identity & auth
  identity: KnowledgeIdentity | null;
  currentAuthorId: string | null;

  // Active routing state
  isActive: boolean;
  focusedEntryId: string | null;
  focusedEntry: KnowledgeEntry | null;
  focusedEntryPrimaryImage: { dataUrl: string; mimeType: string } | null;
  selectedHashtag: string | null;
  selectedFeedTopic: FeedTopicId;
  activeFeedTopic: FeedTopicFilter;
  activeCategory: SeoCategoryDefinition | null;
  activeCategoryTopics: SeoTopicDefinition[];
  normalizedSelectedHashtag: string | null;

  // Feed entries
  filteredEntries: KnowledgeEntry[];
  visibleEntries: KnowledgeEntry[];
  desktopContextEntryId: string | null;
  profiles: UserProfile[];
  journeyQuestions: KnowledgeJourneyQuestion[];

  // UI states
  feedSearchQuery: string;
  isLoading: boolean;
  shouldShowInitialFeedSkeleton: boolean;
  shouldShowFeedErrorState: boolean;
  shouldHoldEmptyFeedState: boolean;
  hasActiveSearch: boolean;
  hasActiveTopic: boolean;
  hasMoreEntries: boolean;
  isActiveFeedLoadingMore: boolean;
  isPaginationBusy: boolean;
  feedLoadError: string | null;
  profilesLoadError: string | null;
  showRefreshFeedback: boolean;
  shouldShowBackToTopRefresh: boolean;

  // Topic feed state (for error notices)
  shouldUseIndependentFeed: boolean;
  activeTopicFeedError: string | null;

  // SEO
  pageTitle: string;
  pageDescription: string;
  pageUrl: string;
  shouldNoIndexKnowledgePage: boolean;

  // Sentinel
  loadMoreSentinelRef: RefObject<HTMLDivElement | null>;

  // Callbacks
  onSetFeedSearchQuery: (q: string) => void;
  onSelectFeedTopic: (topicId: FeedTopicId) => void;
  onClearSelectedHashtag: () => void;
  onRetryFeedLoad: () => void;
  onLoadMoreActiveEntries: () => void;
  onVisibleEntry: (entry: KnowledgeEntry) => void;
  onIdentityRequired: (action: { type: "helpful" | "misleading" | "comment" | "save" | "ink"; entryId: string }) => void;
  onOpenProfile: (authorId: string, username?: string) => void;
  onOpenEntry: (entryId: string) => void;
  onSelectHashtag: (tag: string) => void;
  onLikeChange: (entryId: string, likes: string[], misleadingIds?: string[]) => void;
  onEntryUpdated: (entry: KnowledgeEntry) => void;
  onBackToTopRefresh: () => void;
}

export function FeedRenderer({
  isActive,
  focusedEntryId,
  focusedEntry,
  focusedEntryPrimaryImage,
  selectedHashtag,
  activeFeedTopic,
  activeCategory,
  activeCategoryTopics,
  normalizedSelectedHashtag,
  filteredEntries,
  visibleEntries,
  desktopContextEntryId,
  profiles,
  journeyQuestions,
  feedSearchQuery,
  shouldShowInitialFeedSkeleton,
  shouldShowFeedErrorState,
  shouldHoldEmptyFeedState,
  hasActiveSearch,
  hasActiveTopic,
  hasMoreEntries,
  isActiveFeedLoadingMore,
  isPaginationBusy,
  feedLoadError,
  profilesLoadError,
  showRefreshFeedback,
  shouldShowBackToTopRefresh,
  shouldUseIndependentFeed,
  activeTopicFeedError,
  pageTitle,
  pageDescription,
  pageUrl,
  shouldNoIndexKnowledgePage,
  loadMoreSentinelRef,
  onSetFeedSearchQuery,
  onSelectFeedTopic,
  onClearSelectedHashtag,
  onRetryFeedLoad,
  onLoadMoreActiveEntries,
  onVisibleEntry,
  onIdentityRequired,
  onOpenProfile,
  onOpenEntry,
  onSelectHashtag,
  onLikeChange,
  onEntryUpdated,
  onBackToTopRefresh,
  identity,
}: FeedRendererProps) {
  const journeyEntries = visibleEntries.length > 0 ? visibleEntries : filteredEntries;
  const renderKnowledgeJourney = useCallback(
    (entry: KnowledgeEntry) => (
      <KnowledgeJourney
        entry={entry}
        entries={journeyEntries}
        questions={journeyQuestions}
      />
    ),
    [journeyEntries, journeyQuestions],
  );
  const estimateKnowledgeJourneyHeight = useCallback(
    (entry: KnowledgeEntry) =>
      getKnowledgeJourneyEstimatedHeight({
        entry,
        entries: journeyEntries,
        questions: journeyQuestions,
      }),
    [journeyEntries, journeyQuestions],
  );
  const desktopEntries = useMemo(
    () => (filteredEntries.length > 0 ? filteredEntries : visibleEntries),
    [filteredEntries, visibleEntries],
  );
  const desktopContextEntry = useMemo(
    () =>
      focusedEntry ||
      desktopEntries.find((entry) => entry.id === desktopContextEntryId) ||
      desktopEntries[0] ||
      null,
    [desktopContextEntryId, desktopEntries, focusedEntry],
  );
  const todayLoadedCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();

    return desktopEntries.filter((entry) => entry.createdAt >= todayStart).length;
  }, [desktopEntries]);
  const desktopContextIndex = desktopContextEntry
    ? desktopEntries.findIndex((entry) => entry.id === desktopContextEntry.id)
    : -1;
  const desktopProgressLabel =
    desktopContextIndex >= 0
      ? `Reading ${desktopContextIndex + 1} of ${desktopEntries.length}`
      : `${desktopEntries.length} loaded post${
          desktopEntries.length === 1 ? "" : "s"
        }`;
  const activeFeedLabel = selectedHashtag
    ? `#${selectedHashtag}`
    : activeFeedTopic.label;
  const feedContent = shouldShowInitialFeedSkeleton ? (
    <KnowledgeFeedSkeleton showControls={false} />
  ) : (
    <div className="space-y-6">
      {feedLoadError &&
        !shouldUseIndependentFeed &&
        filteredEntries.length > 0 && (
          <FeedNotice title="Feed loading issue" body={feedLoadError} />
        )}

      {shouldUseIndependentFeed &&
        activeTopicFeedError &&
        filteredEntries.length > 0 && (
          <FeedNotice
            title="Category loading issue"
            body={activeTopicFeedError}
          />
        )}

      {profilesLoadError && (
        <FeedNotice
          title="Profile directory issue"
          body={profilesLoadError}
        />
      )}

      <div className="space-y-3">
        <DiscoverySearch
          theme="emerald"
          placeholder="Search"
          value={feedSearchQuery}
          onChange={onSetFeedSearchQuery}
          onClear={() => onSetFeedSearchQuery("")}
          ariaLabel="Search home feed"
        />

        {activeCategory && !focusedEntry && !selectedHashtag && (
          <CategoryKnowledgeBrief
            category={activeCategory}
            topics={activeCategoryTopics}
            onOpenTopic={(topicId) =>
              navigateToRoute("explore", { selectedTopic: topicId })
            }
          />
        )}

        <div
          className="-mx-3 overflow-x-auto px-3 [scrollbar-width:none] sm:-mx-4 sm:px-4 [&::-webkit-scrollbar]:hidden"
          aria-label="Post categories"
        >
          <div className="flex min-w-max items-center gap-2 pb-1">
            {FEED_TOPIC_FILTERS.filter(
              (topic) => topic.id === "all" || topic.id === "trending",
            ).map((topic) => {
              const TopicIcon = topic.icon;
              const isTopicActive = topic.id === activeFeedTopic.id;

              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => onSelectFeedTopic(topic.id)}
                  aria-pressed={isTopicActive}
                  aria-label={
                    topic.id === "all"
                      ? "Show all posts"
                      : `Show ${topic.label} posts`
                  }
                  className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors ${
                    isTopicActive
                      ? "border-emerald-500 bg-emerald-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                  }`}
                >
                  <TopicIcon className="h-3.5 w-3.5" />
                  <span>{topic.label}</span>
                </button>
              );
            })}
            <label className="relative inline-flex h-9 shrink-0 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
              <span className="pointer-events-none mr-2">All Categories</span>
              <select
                value={
                  activeFeedTopic.id === "all" ||
                  activeFeedTopic.id === "trending"
                    ? ""
                    : activeFeedTopic.id
                }
                onChange={(event) =>
                  onSelectFeedTopic(
                    (event.target.value || "all") as FeedTopicId,
                  )
                }
                className="max-w-[8.5rem] bg-transparent text-xs font-bold outline-none"
                aria-label="All categories"
              >
                <option value="">Select</option>
                {FEED_TOPIC_FILTERS.filter(
                  (topic) => topic.id !== "all" && topic.id !== "trending",
                ).map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      {showRefreshFeedback && (
        <p className="text-center text-xs font-medium text-emerald-700">
          Feed refreshed
        </p>
      )}

      {selectedHashtag && (
        <div className="rounded-[28px] border border-emerald-200 bg-emerald-50/80 px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">
                Hashtag View
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                Showing posts for #{selectedHashtag}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {visibleEntries.length} related post
                {visibleEntries.length === 1 ? "" : "s"} found.
              </p>
            </div>
            <button
              onClick={onClearSelectedHashtag}
              className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              Clear filter
            </button>
          </div>
        </div>
      )}

      {shouldShowFeedErrorState ? (
        <div className="rounded-[30px] border border-dashed border-slate-300 bg-white px-6 py-20 text-center shadow-sm">
          <BookOpenText className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-4 text-xl font-black text-slate-900">
            Something went wrong. Try again.
          </h3>
          <button
            type="button"
            onClick={onRetryFeedLoad}
            className="mt-5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500 transition-colors hover:border-emerald-200 hover:text-emerald-700"
          >
            Try again
          </button>
        </div>
      ) : filteredEntries.length === 0 ? (
        shouldHoldEmptyFeedState ? (
          <KnowledgeFeedSkeleton count={3} showControls={false} />
        ) : (
          <div className="rounded-[30px] border border-dashed border-slate-300 bg-white px-6 py-20 text-center shadow-sm">
            <BookOpenText className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-4 text-xl font-black text-slate-900">
              {hasActiveSearch
                ? `No posts matched "${feedSearchQuery.trim()}"`
                : hasActiveTopic && selectedHashtag
                  ? `No ${activeFeedTopic.label} posts for #${selectedHashtag}`
                  : hasActiveTopic
                    ? `No ${activeFeedTopic.label} posts found`
                    : selectedHashtag
                      ? `No posts for #${selectedHashtag}`
                      : "No posts yet"}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {hasActiveSearch
                ? "Try a broader keyword, another hashtag, or search by @username."
                : hasActiveTopic
                  ? "Try another category or search by a more specific hashtag."
                  : selectedHashtag
                    ? "Try another hashtag or clear this filter to explore the full feed."
                    : "Tap the `+` button at the top to upload the first knowledge post."}
            </p>
            {hasMoreEntries && (
              isActiveFeedLoadingMore ? (
                <div className="mt-5">
                  <FeedPaginationSkeleton />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onLoadMoreActiveEntries}
                  disabled={isPaginationBusy}
                  className="mt-5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500 transition-colors hover:border-emerald-200 hover:text-emerald-700 disabled:opacity-50"
                >
                  Load more posts
                </button>
              )
            )}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <KnowledgeCardList
            entries={filteredEntries}
            currentIdentity={identity}
            profiles={profiles}
            onVisible={onVisibleEntry}
            onIdentityRequired={onIdentityRequired}
            onOpenProfile={onOpenProfile}
            onOpenEntry={onOpenEntry}
            onSelectHashtag={onSelectHashtag}
            onLikeChange={onLikeChange}
            onEntryUpdated={onEntryUpdated}
            focusedEntryId={focusedEntryId}
            renderAfterCard={renderKnowledgeJourney}
            estimateAfterCardHeight={estimateKnowledgeJourneyHeight}
          />
          {hasMoreEntries && (
            <div
              ref={loadMoreSentinelRef}
              className="py-4 text-center"
            >
              {isActiveFeedLoadingMore ? (
                <FeedPaginationSkeleton />
              ) : (
                <button
                  type="button"
                  onClick={onLoadMoreActiveEntries}
                  disabled={isPaginationBusy}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500 transition-colors hover:border-emerald-200 hover:text-emerald-700 disabled:opacity-50"
                >
                  Load more posts
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="pb-20">
      {isActive && (
        <SEO
          title={pageTitle}
          description={pageDescription}
          keywords={[
            "homepage",
            "knowledge posts",
            "learning feed",
            "readative",
            ...(selectedHashtag ? [selectedHashtag] : []),
            ...(activeCategory
              ? [activeCategory.label, ...activeCategory.examples, ...activeCategory.tagSlugs]
              : []),
          ]}
          type={focusedEntry ? "article" : "website"}
          url={pageUrl}
          ampUrl={
            !focusedEntry && !selectedHashtag && activeFeedTopic.id === "all"
              ? "/amp/"
              : undefined
          }
          schema={buildKnowledgeSchemas({
            entry: focusedEntry,
            activeTopic: activeFeedTopic,
            selectedHashtag: normalizedSelectedHashtag,
            entries: filteredEntries,
            pageUrl,
            profiles,
          })}
          robots={shouldNoIndexKnowledgePage ? "noindex" : "index"}
          image={
            focusedEntryPrimaryImage?.dataUrl &&
            !focusedEntryPrimaryImage.dataUrl.startsWith("data:")
              ? focusedEntryPrimaryImage.dataUrl
              : undefined
          }
        />
      )}

      <div className="min-[1280px]:grid min-[1280px]:grid-cols-[minmax(200px,220px)_minmax(0,1fr)_minmax(230px,260px)] min-[1280px]:items-start min-[1280px]:gap-5">
        <DesktopLeftRail
          activeFeedLabel={activeFeedLabel}
          contextEntry={desktopContextEntry}
          entries={desktopEntries}
          progressLabel={desktopProgressLabel}
          todayCount={todayLoadedCount}
          onOpenEntry={onOpenEntry}
        />

        <div className="min-[1280px]:min-w-0 min-[1280px]:w-full">
          {feedContent}
        </div>

        <DesktopRightRail
          contextEntry={desktopContextEntry}
          journeyEntries={journeyEntries}
          journeyQuestions={journeyQuestions}
          onOpenEntry={onOpenEntry}
        />
      </div>

      <button
        type="button"
        onClick={onBackToTopRefresh}
        aria-label="Back to top, refresh, and shuffle posts"
        aria-hidden={!shouldShowBackToTopRefresh}
        tabIndex={shouldShowBackToTopRefresh ? 0 : -1}
        title="Back to top, refresh, and shuffle posts"
        className={`fixed bottom-24 right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-700 shadow-[0_16px_40px_rgba(15,23,42,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 md:bottom-6 md:right-6 ${
          shouldShowBackToTopRefresh
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-2 opacity-0"
        }`}
      >
        <span className="relative flex h-6 w-6 items-center justify-center">
          <ArrowUp className="h-5 w-5" />
          <RefreshCw className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-white p-0.5 text-emerald-600" />
        </span>
      </button>
    </div>
  );
}
