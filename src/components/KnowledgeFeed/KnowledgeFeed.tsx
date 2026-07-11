import {
  type ChangeEvent,
  useDeferredValue,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  collection,
  doc,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
  where,
} from "firebase/firestore";
import { db } from "../../firebase/firebaseDb";
import {
  KnowledgeComment,
  KnowledgeEntry,
  KnowledgeImageLayout,
  KnowledgeVisibility,
  UserProfile,
} from "../../types";
import { GoogleSignInPrompt } from "../Auth";
import { type KnowledgeIdentity } from "../../utils/knowledgeIdentity";
import { trackPostCreated } from "../../utils/analytics";
import { hydrateUserProfile } from "../../utils/profileData";
import { signInWithGoogleAccount } from "../../utils/googleAuth";
import {
  buildAbsoluteRouteUrl,
  buildPublicPath,
  navigateToNotFound,
  navigateToRoute,
  ROUTE_CHANGE_EVENT,
} from "../../utils/routes";
import {
  getKnowledgeFeedSnapshot,
  markKnowledgeEntrySeen,
  reconcileKnowledgeFeedOrder,
  rankKnowledgeEntries,
} from "../../utils/feedPersonalization";
import {
  getKnowledgeEntryImages,
  getKnowledgeImageLayoutSettings,
} from "../../utils/knowledgeImages";
import { canViewKnowledgeEntry } from "../../utils/knowledgePrivacy";
import {
  createExcerpt,
  estimateReadMinutes,
  extractInlineHashtags,
  mergeHashtags,
  parseManualHashtags,
  resolveMentions,
} from "../../utils/knowledgeEntryHelpers";
import { getRelatedTopicsForCategory } from "../../utils/seoTaxonomy";

import {
  type PendingAction,
  type SelectedImage,
  type MentionState,
  type FeedMessage,
  type FeedPageLoadResult,
  type LoadNextEntriesPageOptions,
  type TopicFeedState,
  type FeedTopicId,
  type BrowserIdleCallbacks,
} from "./feedTypes";
import { FEED_TOPIC_FILTERS } from "./feedFilters";
import {
  FEED_INITIAL_PAGE_SIZE,
  FEED_NEXT_PAGE_SIZE,
  FEED_LOAD_MORE_REMAINING_THRESHOLD,
  FEED_LOAD_TIMEOUT_MS,
  FEED_BACKGROUND_PAGE_DELAY_MS,
  FEED_BACKGROUND_PREFETCH_PAGE_LIMIT,
  PROFILE_DIRECTORY_IDLE_TIMEOUT_MS,
  PROFILE_DIRECTORY_LIMIT,
  MAX_TOTAL_INLINE_IMAGE_CHARS,
  readKnowledgeFeedCache,
  writeKnowledgeFeedCache,
  normalizeKnowledgeEntry,
  normalizeStoredHashtagValue,
  getHelpfulAwareVisibleEntries,
  mergeKnowledgeEntryPages,
  loadIndependentKnowledgeFeedEntries,
  mergeIndependentKnowledgeFeedEntries,
  orderIndependentKnowledgeFeedEntries,
  getIndependentFeedKey,
  scrollKnowledgeFeedToTop,
  createKnowledgeFeedRefreshSeed,
  readSelectedHashtagFromLocation,
  readSelectedFeedTopicFromLocation,
  getCurrentKnowledgeAttemptedLocation,
  resolveFocusedKnowledgeEntrySnapshot,
  readKnowledgeFeedScrollPosition,
  writeKnowledgeFeedScrollPosition,
  matchesKnowledgeTopic,
  matchesKnowledgeSearch,
  tokenizeSearch,
} from "./feedHelpers";
import { ComposerModal } from "./FeedComposer";
import { FeedRenderer } from "./FeedRenderer";
import { type KnowledgeJourneyQuestion } from "./KnowledgeJourney";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_IMAGE_LAYOUT: KnowledgeImageLayout = "wide";
const JOURNEY_SMARTTALK_LIMIT = 12;
const JOURNEY_SMARTTALK_CACHE_KEY = "readativeJourneySmartTalkPreview:v1";
const JOURNEY_SMARTTALK_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const USER_PROFILE_UPDATED_EVENT = "readative:user-profile-updated";

interface CachedJourneySmartTalkPreview {
  questions: KnowledgeJourneyQuestion[];
  cachedAt: number;
}

let journeySmartTalkMemoryCache: CachedJourneySmartTalkPreview | null = null;

const EMPTY_TOPIC_FEED_STATE: TopicFeedState = {
  entries: [],
  isLoading: false,
  isLoadingMore: false,
  hasLoaded: false,
  hasMore: false,
  cursor: null,
  error: null,
};
const PROFILE_AUTHOR_LOOKUP_LIMIT = 30;

function mergeUserProfileList(
  currentProfiles: UserProfile[],
  nextProfiles: UserProfile[],
) {
  if (nextProfiles.length === 0) return currentProfiles;

  const profileMap = new Map(
    currentProfiles.map((profile) => [profile.id, profile] as const),
  );
  let didChange = false;

  nextProfiles.forEach((profile) => {
    const existing = profileMap.get(profile.id);
    if (existing && existing.updatedAt === profile.updatedAt) {
      return;
    }

    profileMap.set(profile.id, profile);
    didChange = true;
  });

  if (!didChange) return currentProfiles;

  return [...profileMap.values()].sort((left, right) =>
    (left.usernameLower || left.username || left.id).localeCompare(
      right.usernameLower || right.username || right.id,
    ),
  );
}

function replaceKnowledgeEntry(
  entries: KnowledgeEntry[],
  updatedEntry: KnowledgeEntry,
) {
  let didUpdate = false;
  const nextEntries = entries.map((entry) => {
    if (entry.id !== updatedEntry.id) return entry;

    didUpdate = true;
    return updatedEntry;
  });

  return didUpdate ? nextEntries : entries;
}

function collectFeedProfileIds(entries: KnowledgeEntry[]) {
  const profileIds = new Set<string>();
  const addProfileId = (value: string | null | undefined) => {
    const profileId = value?.trim();
    if (profileId) {
      profileIds.add(profileId);
    }
  };

  entries.forEach((entry) => {
    addProfileId(entry.authorId);
    entry.comments?.forEach((comment) => addProfileId(comment.authorId));
    entry.mentions?.forEach((mention) => addProfileId(mention.authorId));
  });

  return [...profileIds];
}

function chunkProfileIds(profileIds: string[]) {
  const chunks: string[][] = [];
  for (let index = 0; index < profileIds.length; index += PROFILE_AUTHOR_LOOKUP_LIMIT) {
    chunks.push(profileIds.slice(index, index + PROFILE_AUTHOR_LOOKUP_LIMIT));
  }

  return chunks;
}

function normalizeJourneyTimestamp(value: unknown, fallback = Date.now()) {
  if (
    value &&
    typeof value === "object" &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function normalizeJourneySmartTalkQuestion(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): KnowledgeJourneyQuestion {
  const data = snapshot.data();
  const rawAnswers = Array.isArray(data.answers) ? data.answers : [];

  return {
    id: snapshot.id,
    author:
      typeof data.author === "string" && data.author ? data.author : "Unknown",
    authorId: typeof data.authorId === "string" ? data.authorId : "",
    content: typeof data.content === "string" ? data.content : "",
    category: typeof data.category === "string" ? data.category : null,
    createdAt: normalizeJourneyTimestamp(data.createdAt),
    answerCount: rawAnswers.length,
    answerText: rawAnswers
      .map((answer) =>
        answer &&
        typeof answer === "object" &&
        typeof (answer as { content?: unknown }).content === "string"
          ? (answer as { content: string }).content
          : "",
      )
      .filter(Boolean),
  };
}

function normalizeCachedJourneySmartTalkPreview(
  value: unknown,
): CachedJourneySmartTalkPreview | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<CachedJourneySmartTalkPreview>;
  const cachedAt =
    typeof candidate.cachedAt === "number" && Number.isFinite(candidate.cachedAt)
      ? candidate.cachedAt
      : 0;

  if (!cachedAt || Date.now() - cachedAt > JOURNEY_SMARTTALK_CACHE_TTL_MS) {
    return null;
  }

  const questions = Array.isArray(candidate.questions)
    ? candidate.questions
        .map((question) => {
          const data = question as Partial<KnowledgeJourneyQuestion>;
          const id = typeof data.id === "string" ? data.id.trim() : "";
          const content =
            typeof data.content === "string" ? data.content.trim() : "";
          if (!id || !content) return null;

          return {
            id,
            author:
              typeof data.author === "string" && data.author
                ? data.author
                : "Unknown",
            authorId: typeof data.authorId === "string" ? data.authorId : "",
            content,
            category: typeof data.category === "string" ? data.category : null,
            createdAt:
              typeof data.createdAt === "number" && Number.isFinite(data.createdAt)
                ? data.createdAt
                : Date.now(),
            answerCount:
              typeof data.answerCount === "number" && Number.isFinite(data.answerCount)
                ? data.answerCount
                : 0,
            answerText: Array.isArray(data.answerText)
              ? data.answerText.filter(
                  (item): item is string => typeof item === "string",
                )
              : [],
          };
        })
        .filter((question): question is KnowledgeJourneyQuestion => Boolean(question))
    : [];

  return questions.length > 0 ? { questions, cachedAt } : null;
}

function readJourneySmartTalkPreviewCache() {
  const memoryCache = normalizeCachedJourneySmartTalkPreview(
    journeySmartTalkMemoryCache,
  );
  if (memoryCache) {
    journeySmartTalkMemoryCache = memoryCache;
    return memoryCache.questions;
  }

  journeySmartTalkMemoryCache = null;
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(JOURNEY_SMARTTALK_CACHE_KEY);
    if (!raw) return null;

    const storageCache = normalizeCachedJourneySmartTalkPreview(JSON.parse(raw));
    if (!storageCache) {
      window.localStorage.removeItem(JOURNEY_SMARTTALK_CACHE_KEY);
      return null;
    }

    journeySmartTalkMemoryCache = storageCache;
    return storageCache.questions;
  } catch {
    return null;
  }
}

function writeJourneySmartTalkPreviewCache(questions: KnowledgeJourneyQuestion[]) {
  if (questions.length === 0) return;

  const cache: CachedJourneySmartTalkPreview = {
    questions,
    cachedAt: Date.now(),
  };
  journeySmartTalkMemoryCache = cache;

  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      JOURNEY_SMARTTALK_CACHE_KEY,
      JSON.stringify(cache),
    );
  } catch {
    // Preview cache is best-effort and should never block the feed.
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface KnowledgeFeedProps {
  identity: KnowledgeIdentity | null;
  onIdentityChange: (identity: KnowledgeIdentity | null) => void;
  onOpenProfile: (authorId: string, username?: string) => void;
  focusedEntryId: string | null;
  onOpenEntry: (entryId: string) => void;
  composerOpenSignal: number;
  refreshSignal: number;
  isActive: boolean;
}

type KnowledgeFeedPaginationCursor = QueryDocumentSnapshot<DocumentData> | number;

// ─── Component ────────────────────────────────────────────────────────────────

export function KnowledgeFeed({
  identity,
  onIdentityChange,
  onOpenProfile,
  focusedEntryId,
  onOpenEntry,
  composerOpenSignal,
  refreshSignal,
  isActive,
}: KnowledgeFeedProps) {
  const initialRefreshSeed = useMemo(createKnowledgeFeedRefreshSeed, [
    identity?.authorId,
  ]);
  const initialFeedCache = useMemo(
    () => readKnowledgeFeedCache(identity?.authorId),
    [identity?.authorId],
  );
  const initialFeedOrder = useMemo(
    () =>
      initialFeedCache
        ? rankKnowledgeEntries(
            initialFeedCache.entries,
            getKnowledgeFeedSnapshot(),
          ).map((entry) => entry.id)
        : [],
    [initialFeedCache],
  );

  // ── Feed data state ──
  const [entries, setEntries] = useState<KnowledgeEntry[]>(
    () => initialFeedCache?.entries || [],
  );
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [journeyQuestions, setJourneyQuestions] = useState<
    KnowledgeJourneyQuestion[]
  >([]);
  const [isLoading, setIsLoading] = useState(
    () => !initialFeedCache?.entries.length,
  );
  const [feedLoadError, setFeedLoadError] = useState<string | null>(null);
  const [feedRetrySignal, setFeedRetrySignal] = useState(0);
  const [profilesLoadError, setProfilesLoadError] = useState<string | null>(null);

  // ── Composer state ──
  const [isPosting, setIsPosting] = useState(false);
  const [isModerating, setIsModerating] = useState(false);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [showIdentityPrompt, setShowIdentityPrompt] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [publishAfterAccess, setPublishAfterAccess] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftContentKind, setDraftContentKind] =
    useState<import("../../utils/contentIntelligence").KnowledgeContentKind>("insight");
  const [draftCategory, setDraftCategory] = useState("");
  const [draftVisibility, setDraftVisibility] =
    useState<KnowledgeVisibility>("public");
  const [hashtagInput, setHashtagInput] = useState("");
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [selectedImageLayout, setSelectedImageLayout] =
    useState<KnowledgeImageLayout>(DEFAULT_IMAGE_LAYOUT);
  const [activeMention, setActiveMention] = useState<MentionState | null>(null);
  const [feedMessage, setFeedMessage] = useState<FeedMessage | null>(null);

  // ── Routing / filter state ──
  const [selectedHashtag, setSelectedHashtag] = useState<string | null>(() =>
    readSelectedHashtagFromLocation(),
  );
  const [feedSearchQuery, setFeedSearchQuery] = useState("");
  const [selectedFeedTopic, setSelectedFeedTopic] =
    useState<FeedTopicId>(() => readSelectedFeedTopicFromLocation());
  const [showRefreshFeedback, setShowRefreshFeedback] = useState(false);
  const [showBackToTopRefresh, setShowBackToTopRefresh] = useState(false);
  const [feedEntryOrder, setFeedEntryOrder] =
    useState<string[]>(initialFeedOrder);
  const [visibleLikedEntryIds, setVisibleLikedEntryIds] = useState<string[]>([]);
  const [desktopContextEntryId, setDesktopContextEntryId] =
    useState<string | null>(null);
  const [hasMoreServerEntries, setHasMoreServerEntries] = useState(
    () => initialFeedCache?.hasMoreServerEntries ?? true,
  );
  const [isLoadingMoreEntries, setIsLoadingMoreEntries] = useState(false);
  const [isBackgroundLoadingEntries, setIsBackgroundLoadingEntries] =
    useState(false);
  const [topicFeedStates, setTopicFeedStates] = useState<
    Record<string, TopicFeedState>
  >({});

  // ── Refs ──
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const entriesRef = useRef<KnowledgeEntry[]>(entries);
  const visibleLikedEntryIdsRef = useRef<string[]>(visibleLikedEntryIds);
  const feedRefreshSeedRef = useRef(initialRefreshSeed);
  const refreshFeedbackTimeoutRef = useRef<number | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const paginationCursorRef =
    useRef<KnowledgeFeedPaginationCursor | null>(null);
  const hasMoreServerEntriesRef = useRef(hasMoreServerEntries);
  const hasPaginatedPastFirstPageRef = useRef(false);
  const isLoadingMoreEntriesRef = useRef(false);
  const independentLoadingKeysRef = useRef(new Set<string>());
  const loadedProfileIdsRef = useRef(new Set<string>());
  const loadingProfileIdsRef = useRef(new Set<string>());
  const hasLoadedProfilesDirectoryRef = useRef(false);
  const hasLoadedJourneySmartTalkRef = useRef(false);
  const isLoadingJourneySmartTalkRef = useRef(false);
  const lastAutoLoadEntryCountRef = useRef(0);
  const isMountedRef = useRef(false);
  const restoredScrollKeyRef = useRef<string | null>(null);
  const deferredFeedSearchQuery = useDeferredValue(feedSearchQuery);
  const selectedImageLayoutSettings =
    getKnowledgeImageLayoutSettings(selectedImageLayout);

  // ── Callbacks ──

  const showRefreshFeedbackTemporarily = useCallback(() => {
    if (typeof window === "undefined") return;

    setShowRefreshFeedback(true);

    if (refreshFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(refreshFeedbackTimeoutRef.current);
    }

    refreshFeedbackTimeoutRef.current = window.setTimeout(() => {
      setShowRefreshFeedback(false);
      refreshFeedbackTimeoutRef.current = null;
    }, 2400);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleBackToTopRefresh = useCallback(() => {
    const nextRefreshSeed = createKnowledgeFeedRefreshSeed();
    const normalizedRefreshHashtag = selectedHashtag
      ? normalizeStoredHashtagValue(selectedHashtag)
      : null;
    const refreshTopic =
      FEED_TOPIC_FILTERS.find((topic) => topic.id === selectedFeedTopic) ||
      FEED_TOPIC_FILTERS[0];
    const shouldRefreshIndependentFeed =
      !focusedEntryId &&
      (Boolean(normalizedRefreshHashtag) || refreshTopic.id !== "all");

    setFeedSearchQuery("");
    setFeedMessage(null);
    visibleLikedEntryIdsRef.current = [];
    setVisibleLikedEntryIds([]);
    feedRefreshSeedRef.current = nextRefreshSeed;

    if (shouldRefreshIndependentFeed) {
      const refreshFeedKey = getIndependentFeedKey(
        refreshTopic.id,
        normalizedRefreshHashtag,
      );

      setTopicFeedStates((current) => {
        const existing = current[refreshFeedKey];
        if (!existing || existing.entries.length <= 1) return current;

        return {
          ...current,
          [refreshFeedKey]: {
            ...existing,
            entries: orderIndependentKnowledgeFeedEntries(
              existing.entries,
              refreshTopic,
              {
                refreshSeed: nextRefreshSeed,
                shuffleOnRefresh: true,
              },
            ),
          },
        };
      });
    } else {
      setFeedEntryOrder(
        rankKnowledgeEntries(entriesRef.current, getKnowledgeFeedSnapshot(), {
          refreshSeed: nextRefreshSeed,
          shuffleOnRefresh: true,
        }).map((entry) => entry.id),
      );
    }

    setShowBackToTopRefresh(false);
    scrollKnowledgeFeedToTop();
    showRefreshFeedbackTemporarily();
  }, [
    focusedEntryId,
    selectedFeedTopic,
    selectedHashtag,
    showRefreshFeedbackTemporarily,
  ]);

  const updateHasMoreServerEntries = useCallback((hasMoreEntries: boolean) => {
    hasMoreServerEntriesRef.current = hasMoreEntries;
    setHasMoreServerEntries(hasMoreEntries);
  }, []);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  useEffect(() => {
    if (
      !isActive ||
      hasLoadedJourneySmartTalkRef.current ||
      isLoadingJourneySmartTalkRef.current
    ) {
      return;
    }

    let cancelled = false;
    isLoadingJourneySmartTalkRef.current = true;

    const loadJourneySmartTalkPreview = async () => {
      const cachedQuestions = readJourneySmartTalkPreviewCache();
      if (cachedQuestions) {
        if (!cancelled) {
          setJourneyQuestions(cachedQuestions);
          hasLoadedJourneySmartTalkRef.current = true;
        }
        isLoadingJourneySmartTalkRef.current = false;
        return;
      }

      try {
        const snapshot = await getDocs(
          query(
            collection(db, "smarttalk"),
            orderBy("createdAt", "desc"),
            limit(JOURNEY_SMARTTALK_LIMIT),
          ),
        );

        if (cancelled) return;

        const questions = snapshot.docs.map((item) =>
          normalizeJourneySmartTalkQuestion(item),
        );
        setJourneyQuestions(questions);
        writeJourneySmartTalkPreviewCache(questions);
        hasLoadedJourneySmartTalkRef.current = true;
      } catch (error) {
        console.warn("SmartTalk journey preview failed:", error);
        if (!cancelled) {
          setJourneyQuestions([]);
        }
      } finally {
        isLoadingJourneySmartTalkRef.current = false;
      }
    };

    void loadJourneySmartTalkPreview();

    return () => {
      cancelled = true;
    };
  }, [isActive]);

  useEffect(() => {
    visibleLikedEntryIdsRef.current = visibleLikedEntryIds;
  }, [visibleLikedEntryIds]);

  useEffect(() => {
    const handleProfileUpdated = (event: Event) => {
      const profile = (event as CustomEvent<UserProfile>).detail;
      if (!profile?.id) return;

      loadedProfileIdsRef.current.add(profile.id);
      setProfiles((currentProfiles) =>
        mergeUserProfileList(currentProfiles, [profile]),
      );
    };

    window.addEventListener(USER_PROFILE_UPDATED_EVENT, handleProfileUpdated);
    return () =>
      window.removeEventListener(USER_PROFILE_UPDATED_EVENT, handleProfileUpdated);
  }, []);

  useEffect(() => {
    return () => {
      if (
        typeof window !== "undefined" &&
        refreshFeedbackTimeoutRef.current !== null
      ) {
        window.clearTimeout(refreshFeedbackTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isActive || typeof window === "undefined") {
      setShowBackToTopRefresh(false);
      return;
    }

    const updateBackToTopVisibility = () => {
      const shouldShow = window.scrollY > 420;
      setShowBackToTopRefresh((current) =>
        current === shouldShow ? current : shouldShow,
      );
    };

    updateBackToTopVisibility();
    window.addEventListener("scroll", updateBackToTopVisibility, {
      passive: true,
    });
    window.addEventListener("resize", updateBackToTopVisibility);

    return () => {
      window.removeEventListener("scroll", updateBackToTopVisibility);
      window.removeEventListener("resize", updateBackToTopVisibility);
    };
  }, [isActive]);

  useEffect(() => {
    if (entries.length === 0) return;

    writeKnowledgeFeedCache(identity?.authorId, {
      entries,
      visibleLikedEntryIds,
      hasMoreServerEntries,
    });
  }, [
    entries,
    hasMoreServerEntries,
    identity?.authorId,
    visibleLikedEntryIds,
  ]);

  useEffect(() => {
    const nextRefreshSeed = createKnowledgeFeedRefreshSeed();
    feedRefreshSeedRef.current = nextRefreshSeed;

    const cachedFeed = readKnowledgeFeedCache(identity?.authorId);
    visibleLikedEntryIdsRef.current = [];
    setVisibleLikedEntryIds([]);

    if (cachedFeed && entriesRef.current.length === 0) {
      entriesRef.current = cachedFeed.entries;
      setEntries(cachedFeed.entries);
      setFeedEntryOrder(
        rankKnowledgeEntries(
          cachedFeed.entries,
          getKnowledgeFeedSnapshot(),
        ).map((entry) => entry.id),
      );
      updateHasMoreServerEntries(cachedFeed.hasMoreServerEntries);
      setIsLoading(false);
      return;
    }

    setFeedEntryOrder(
      rankKnowledgeEntries(
        entriesRef.current,
        getKnowledgeFeedSnapshot(),
      ).map((entry) => entry.id),
    );
  }, [identity?.authorId, updateHasMoreServerEntries]);

  useEffect(() => {
    if (composerOpenSignal > 0) {
      setShowComposer(true);
      setFeedMessage(null);
    }
  }, [composerOpenSignal]);

  useEffect(() => {
    if (refreshSignal === 0) return;

    setFeedSearchQuery("");
    setFeedMessage(null);
    visibleLikedEntryIdsRef.current = [];
    setVisibleLikedEntryIds([]);
    feedRefreshSeedRef.current = createKnowledgeFeedRefreshSeed();
    const normalizedRefreshHashtag = selectedHashtag
      ? normalizeStoredHashtagValue(selectedHashtag)
      : null;
    const refreshTopic =
      FEED_TOPIC_FILTERS.find((topic) => topic.id === selectedFeedTopic) ||
      FEED_TOPIC_FILTERS[0];
    const shouldShuffleIndependentFeed =
      !focusedEntryId &&
      (Boolean(normalizedRefreshHashtag) || refreshTopic.id !== "all");

    if (shouldShuffleIndependentFeed) {
      const refreshFeedKey = getIndependentFeedKey(
        refreshTopic.id,
        normalizedRefreshHashtag,
      );

      setTopicFeedStates((current) => {
        const existing = current[refreshFeedKey];
        if (!existing || existing.entries.length <= 1) return current;

        return {
          ...current,
          [refreshFeedKey]: {
            ...existing,
            entries: orderIndependentKnowledgeFeedEntries(
              existing.entries,
              refreshTopic,
              {
                refreshSeed: feedRefreshSeedRef.current,
                shuffleOnRefresh: true,
              },
            ),
          },
        };
      });
    } else {
      setFeedEntryOrder(
        rankKnowledgeEntries(entriesRef.current, getKnowledgeFeedSnapshot(), {
          refreshSeed: feedRefreshSeedRef.current,
          shuffleOnRefresh: true,
        }).map((entry) => entry.id),
      );
    }

    scrollKnowledgeFeedToTop();
    setShowRefreshFeedback(true);
    const animationFrameId = window.requestAnimationFrame(() =>
      scrollKnowledgeFeedToTop(),
    );

    const timeoutId = window.setTimeout(() => {
      setShowRefreshFeedback(false);
    }, 2400);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.clearTimeout(timeoutId);
    };
  }, [focusedEntryId, refreshSignal, selectedFeedTopic, selectedHashtag]);

  useEffect(() => {
    const normalizedRouteHashtag = selectedHashtag
      ? normalizeStoredHashtagValue(selectedHashtag)
      : null;
    const isIndependentRoute =
      !focusedEntryId &&
      (Boolean(normalizedRouteHashtag) || selectedFeedTopic !== "all");

    if (!isActive || isIndependentRoute) {
      if (isIndependentRoute) {
        setIsLoading(false);
      }
      return;
    }

    const cachedFeed =
      feedRetrySignal === 0 ? readKnowledgeFeedCache(identity?.authorId) : null;
    if (cachedFeed && entriesRef.current.length > 0) {
      const cursorEntry =
        cachedFeed.entries[Math.min(cachedFeed.entries.length, FEED_INITIAL_PAGE_SIZE) - 1] ||
        cachedFeed.entries[cachedFeed.entries.length - 1] ||
        null;

      paginationCursorRef.current =
        cursorEntry && Number.isFinite(cursorEntry.createdAt)
          ? cursorEntry.createdAt
          : null;
      updateHasMoreServerEntries(cachedFeed.hasMoreServerEntries);
      setIsLoading(false);
      setFeedLoadError(null);
      return;
    }

    if (entriesRef.current.length === 0) {
      setIsLoading(true);
    }

    const knowledgeQuery = query(
      collection(db, "knowledge"),
      orderBy("createdAt", "desc"),
      limit(FEED_INITIAL_PAGE_SIZE),
    );
    let cancelled = false;
    let didReceiveFeedResponse = false;
    const timeoutId =
      entriesRef.current.length === 0
        ? window.setTimeout(() => {
            if (didReceiveFeedResponse) return;

            setIsLoading(false);
            setFeedLoadError(
              "Posts are taking longer than expected to load. Please refresh, or try again in a moment.",
            );
          }, FEED_LOAD_TIMEOUT_MS)
        : null;

    const loadInitialFeedPage = async () => {
      try {
        const snapshot = await getDocs(knowledgeQuery);
        if (cancelled) return;
        didReceiveFeedResponse = true;
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }

        const data = snapshot.docs.map((item) =>
          normalizeKnowledgeEntry(
            item.id,
            item.data() as Partial<KnowledgeEntry> & {
              comments?: KnowledgeComment[];
              createdAt?: number | { toMillis?: () => number };
            },
          ),
        );
        if (!hasPaginatedPastFirstPageRef.current) {
          paginationCursorRef.current =
            snapshot.docs[snapshot.docs.length - 1] || null;
          updateHasMoreServerEntries(
            snapshot.docs.length === FEED_INITIAL_PAGE_SIZE,
          );
        }

        const nextFeedEntries = mergeKnowledgeEntryPages(
          entriesRef.current,
          data,
        );
        entriesRef.current = nextFeedEntries;
        setEntries(nextFeedEntries);
        setFeedEntryOrder((currentOrder) => {
          const personalizationSnapshot = getKnowledgeFeedSnapshot();
          if (currentOrder.length === 0) {
            return rankKnowledgeEntries(
              nextFeedEntries,
              personalizationSnapshot,
            ).map((entry) => entry.id);
          }

          return reconcileKnowledgeFeedOrder(
            nextFeedEntries,
            currentOrder,
            personalizationSnapshot,
          );
        });

        setIsLoading(false);
        setFeedLoadError(null);
      } catch (error) {
        if (cancelled) return;
        didReceiveFeedResponse = true;
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
        console.error("Knowledge feed error:", error);
        setIsLoading(false);
        setFeedLoadError(
          "Could not load the latest posts right now. Please refresh in a moment.",
        );
      }
    };

    void loadInitialFeedPage();

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    feedRetrySignal,
    focusedEntryId,
    identity?.authorId,
    isActive,
    selectedFeedTopic,
    selectedHashtag,
    updateHasMoreServerEntries,
  ]);

  const loadNextEntriesPage = useCallback(
    async ({
      showLoadingState = true,
      surfaceErrors = true,
    }: LoadNextEntriesPageOptions = {}): Promise<FeedPageLoadResult> => {
      if (
        isLoadingMoreEntriesRef.current ||
        !hasMoreServerEntriesRef.current ||
        !paginationCursorRef.current
      ) {
        return isLoadingMoreEntriesRef.current ? "blocked" : "done";
      }

      isLoadingMoreEntriesRef.current = true;
      if (showLoadingState) {
        setIsLoadingMoreEntries(true);
      }
      if (surfaceErrors) {
        setFeedLoadError(null);
      }

      try {
        const paginationCursor = paginationCursorRef.current;
        if (paginationCursor === null) {
          return "done";
        }

        const nextPageQuery =
          typeof paginationCursor === "number"
            ? query(
                collection(db, "knowledge"),
                orderBy("createdAt", "desc"),
                startAfter(paginationCursor),
                limit(FEED_NEXT_PAGE_SIZE),
              )
            : query(
                collection(db, "knowledge"),
                orderBy("createdAt", "desc"),
                startAfter(paginationCursor),
                limit(FEED_NEXT_PAGE_SIZE),
              );
        const snapshot = await getDocs(nextPageQuery);
        const data = snapshot.docs.map((item) =>
          normalizeKnowledgeEntry(
            item.id,
            item.data() as Partial<KnowledgeEntry> & {
              comments?: KnowledgeComment[];
              createdAt?: number | { toMillis?: () => number };
            },
          ),
        );

        if (!isMountedRef.current) {
          return "blocked";
        }

        hasPaginatedPastFirstPageRef.current = true;

        if (snapshot.docs.length > 0) {
          paginationCursorRef.current =
            snapshot.docs[snapshot.docs.length - 1] ||
            paginationCursorRef.current;
        }

        const hasAnotherPage = snapshot.docs.length === FEED_NEXT_PAGE_SIZE;
        updateHasMoreServerEntries(hasAnotherPage);

        if (data.length > 0) {
          const nextFeedEntries = mergeKnowledgeEntryPages(
            entriesRef.current,
            data,
          );
          entriesRef.current = nextFeedEntries;
          setEntries(nextFeedEntries);
          setFeedEntryOrder((currentOrder) =>
            reconcileKnowledgeFeedOrder(
              nextFeedEntries,
              currentOrder,
              getKnowledgeFeedSnapshot(),
            ),
          );
        }

        return hasAnotherPage ? "loaded" : "done";
      } catch (error) {
        console.error("Knowledge pagination error:", error);
        if (surfaceErrors) {
          setFeedLoadError(
            "Could not load more posts right now. Please try again in a moment.",
          );
        }
        return "error";
      } finally {
        isLoadingMoreEntriesRef.current = false;
        if (showLoadingState && isMountedRef.current) {
          setIsLoadingMoreEntries(false);
        }
      }
    },
    [updateHasMoreServerEntries],
  );

  useEffect(() => {
    if (
      !isActive ||
      isLoading ||
      FEED_BACKGROUND_PREFETCH_PAGE_LIMIT <= 0 ||
      focusedEntryId ||
      selectedFeedTopic !== "all" ||
      Boolean(selectedHashtag) ||
      !hasMoreServerEntries ||
      !paginationCursorRef.current ||
      typeof window === "undefined"
    ) {
      setIsBackgroundLoadingEntries(false);
      return;
    }

    let cancelled = false;
    const timeoutIds = new Set<number>();

    const waitForNextBackgroundPage = () =>
      new Promise<void>((resolve) => {
        const timeoutId = window.setTimeout(() => {
          timeoutIds.delete(timeoutId);
          resolve();
        }, FEED_BACKGROUND_PAGE_DELAY_MS);
        timeoutIds.add(timeoutId);
      });

    const preloadRemainingPages = async () => {
      setIsBackgroundLoadingEntries(true);

      try {
        await waitForNextBackgroundPage();

        let prefetchedPageCount = 0;
        while (
          !cancelled &&
          hasMoreServerEntriesRef.current &&
          paginationCursorRef.current &&
          prefetchedPageCount < FEED_BACKGROUND_PREFETCH_PAGE_LIMIT
        ) {
          const result = await loadNextEntriesPage({
            showLoadingState: false,
            surfaceErrors: false,
          });
          prefetchedPageCount += result === "loaded" ? 1 : 0;

          if (cancelled || result === "done" || result === "error") {
            break;
          }

          await waitForNextBackgroundPage();
        }
      } finally {
        if (!cancelled) {
          setIsBackgroundLoadingEntries(false);
        }
      }
    };

    void preloadRemainingPages();

    return () => {
      cancelled = true;
      timeoutIds.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      timeoutIds.clear();
    };
  }, [
    focusedEntryId,
    hasMoreServerEntries,
    isActive,
    isLoading,
    loadNextEntriesPage,
    selectedFeedTopic,
    selectedHashtag,
  ]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !isActive ||
      !showComposer ||
      hasLoadedProfilesDirectoryRef.current
    ) {
      return;
    }

    let didStartLoad = false;
    let timeoutId: number | null = null;
    let idleCallbackId: number | null = null;
    const browserIdle = window as unknown as BrowserIdleCallbacks;

    const loadProfilesDirectory = async () => {
      didStartLoad = true;
      const profilesQuery = query(
        collection(db, "userProfiles"),
        orderBy("usernameLower", "asc"),
        limit(PROFILE_DIRECTORY_LIMIT),
      );

      try {
        const snapshot = await getDocs(profilesQuery);

        const data = snapshot.docs.map((item) =>
          hydrateUserProfile(item.data() as Partial<UserProfile>, item.id),
        );

        data.forEach((profile) => loadedProfileIdsRef.current.add(profile.id));
        hasLoadedProfilesDirectoryRef.current = true;
        setProfiles((currentProfiles) =>
          mergeUserProfileList(currentProfiles, data),
        );
        setProfilesLoadError(null);
      } catch (error) {
        console.error("Profile directory error:", error);
        setProfiles([]);
        setProfilesLoadError(
          "User mentions and profile previews may be incomplete for a moment.",
        );
      }
    };

    if (browserIdle.requestIdleCallback) {
      idleCallbackId = browserIdle.requestIdleCallback(() => {
        void loadProfilesDirectory();
      }, {
        timeout: PROFILE_DIRECTORY_IDLE_TIMEOUT_MS,
      });
    } else {
      timeoutId = window.setTimeout(() => {
        void loadProfilesDirectory();
      }, 1200);
    }

    return () => {
      if (didStartLoad) return;

      if (idleCallbackId !== null && browserIdle.cancelIdleCallback) {
        browserIdle.cancelIdleCallback(idleCallbackId);
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isActive, showComposer]);

  useEffect(() => {
    if (!focusedEntryId) return;

    const replaceWithCanonicalEntryPath = (entry: KnowledgeEntry) => {
      const canonicalPath = buildPublicPath("knowledge", {
        focusedEntryId: entry.id,
        seoTitle: entry.title,
      });
      if (window.location.pathname !== canonicalPath) {
        navigateToRoute(
          "knowledge",
          { focusedEntryId: entry.id, seoTitle: entry.title },
          "replace",
        );
      }
    };

    const existingEntry = entriesRef.current.find(
      (entry) => entry.id === focusedEntryId,
    );
    if (existingEntry) {
      replaceWithCanonicalEntryPath(existingEntry);
      return;
    }

    let cancelled = false;

    const loadFocusedEntry = async () => {
      try {
        const snapshot = await resolveFocusedKnowledgeEntrySnapshot(focusedEntryId);
        if (cancelled) return;

        if (!snapshot) {
          navigateToNotFound(getCurrentKnowledgeAttemptedLocation(focusedEntryId));
          return;
        }

        const focusedEntry = normalizeKnowledgeEntry(
          snapshot.id,
          snapshot.data() as Partial<KnowledgeEntry> & {
            comments?: KnowledgeComment[];
            createdAt?: number | { toMillis?: () => number };
          },
        );

        if (entriesRef.current.some((entry) => entry.id === focusedEntry.id)) {
          replaceWithCanonicalEntryPath(focusedEntry);
          return;
        }

        const nextEntries = mergeKnowledgeEntryPages(entriesRef.current, [
          focusedEntry,
        ]);
        entriesRef.current = nextEntries;
        setEntries(nextEntries);
        setFeedEntryOrder((currentOrder) => [
          focusedEntry.id,
          ...currentOrder.filter((entryId) => entryId !== focusedEntry.id),
        ]);

        if (snapshot.id !== focusedEntryId) {
          navigateToRoute(
            "knowledge",
            { focusedEntryId: snapshot.id, seoTitle: focusedEntry.title },
            "replace",
          );
        } else {
          replaceWithCanonicalEntryPath(focusedEntry);
        }
      } catch (error) {
        if (cancelled) return;

        console.error("Focused knowledge entry error:", error);
        navigateToNotFound(getCurrentKnowledgeAttemptedLocation(focusedEntryId));
      }
    };

    void loadFocusedEntry();

    return () => {
      cancelled = true;
    };
  }, [focusedEntryId]);

  useEffect(() => {
    if (!focusedEntryId || entries.length === 0) return;

    const target = document.getElementById(`knowledge-${focusedEntryId}`);
    if (!target) return;

    target.scrollIntoView({
      behavior: "auto",
      block: "start",
      inline: "nearest",
    });
  }, [entries.length, focusedEntryId]);

  useEffect(() => {
    const syncRouteFeedState = () => {
      setSelectedHashtag(readSelectedHashtagFromLocation());
      setSelectedFeedTopic(readSelectedFeedTopicFromLocation());
    };

    syncRouteFeedState();
    window.addEventListener("hashchange", syncRouteFeedState);
    window.addEventListener("popstate", syncRouteFeedState);
    window.addEventListener(ROUTE_CHANGE_EVENT, syncRouteFeedState);

    return () => {
      window.removeEventListener("hashchange", syncRouteFeedState);
      window.removeEventListener("popstate", syncRouteFeedState);
      window.removeEventListener(ROUTE_CHANGE_EVENT, syncRouteFeedState);
    };
  }, []);

  useEffect(() => {
    if (!isActive) return;

    document.documentElement.classList.add("readative-knowledge-feed");
    document.body.classList.add("readative-knowledge-feed");

    return () => {
      document.documentElement.classList.remove("readative-knowledge-feed");
      document.body.classList.remove("readative-knowledge-feed");
    };
  }, [isActive]);

  // ── Derived state ──

  const currentAuthorId = identity?.authorId || null;
  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile] as const)),
    [profiles],
  );
  const activeFeedTopic =
    FEED_TOPIC_FILTERS.find((topic) => topic.id === selectedFeedTopic) ||
    FEED_TOPIC_FILTERS[0];
  const activeCategory = activeFeedTopic.category || null;
  const activeCategoryTopics = useMemo(
    () => (activeCategory ? getRelatedTopicsForCategory(activeCategory.id) : []),
    [activeCategory],
  );
  const normalizedSelectedHashtag = selectedHashtag
    ? normalizeStoredHashtagValue(selectedHashtag)
    : null;
  const shouldUseIndependentFeed =
    !focusedEntryId &&
    (Boolean(normalizedSelectedHashtag) || activeFeedTopic.id !== "all");
  const independentFeedKey = getIndependentFeedKey(
    activeFeedTopic.id,
    normalizedSelectedHashtag,
  );
  const activeTopicFeedState =
    topicFeedStates[independentFeedKey] || EMPTY_TOPIC_FEED_STATE;
  const visibleLikedEntryIdSet = useMemo(
    () => new Set(visibleLikedEntryIds),
    [visibleLikedEntryIds],
  );
  const viewableEntries = useMemo(
    () =>
      getHelpfulAwareVisibleEntries({
        entries: entries.filter((entry) =>
          canViewKnowledgeEntry(entry, currentAuthorId),
        ),
        currentAuthorId,
        focusedEntryId,
        visibleLikedEntryIds: visibleLikedEntryIdSet,
        canLoadMore: hasMoreServerEntries,
      }),
    [
      currentAuthorId,
      entries,
      focusedEntryId,
      hasMoreServerEntries,
      visibleLikedEntryIdSet,
    ],
  );
  const focusedEntry = useMemo(
    () => viewableEntries.find((entry) => entry.id === focusedEntryId) || null,
    [viewableEntries, focusedEntryId],
  );
  const focusedEntryPrimaryImage = useMemo(
    () => (focusedEntry ? getKnowledgeEntryImages(focusedEntry)[0] || null : null),
    [focusedEntry],
  );
  const orderedEntries = useMemo(() => {
    const entryMap = new Map(
      viewableEntries.map((entry) => [entry.id, entry] as const),
    );
    const frozenEntries =
      feedEntryOrder.length > 0
        ? feedEntryOrder
            .map((entryId) => entryMap.get(entryId))
            .filter((entry): entry is KnowledgeEntry => Boolean(entry))
        : viewableEntries;
    const rankedEntryIds = new Set(frozenEntries.map((entry) => entry.id));
    const missingEntries = viewableEntries.filter(
      (entry) => !rankedEntryIds.has(entry.id),
    );
    const baseEntries = [...frozenEntries, ...missingEntries];

    if (focusedEntryId && focusedEntry) {
      return [
        focusedEntry,
        ...baseEntries.filter((entry) => entry.id !== focusedEntryId),
      ];
    }

    return baseEntries;
  }, [viewableEntries, feedEntryOrder, focusedEntry, focusedEntryId]);
  const independentFeedEntries = useMemo(() => {
    if (!shouldUseIndependentFeed) return null;

    return getHelpfulAwareVisibleEntries({
      entries: activeTopicFeedState.entries.filter((entry) =>
        canViewKnowledgeEntry(entry, currentAuthorId),
      ),
      currentAuthorId,
      focusedEntryId,
      visibleLikedEntryIds: visibleLikedEntryIdSet,
      canLoadMore: activeTopicFeedState.hasMore,
    })
      .filter((entry) => {
        if (!normalizedSelectedHashtag) return true;

        return entry.hashtags.some(
          (tag) => normalizeStoredHashtagValue(tag) === normalizedSelectedHashtag,
        );
      })
      .filter((entry) => {
        if (
          activeFeedTopic.id === "all" ||
          activeFeedTopic.id === "trending"
        ) {
          return true;
        }

        return matchesKnowledgeTopic(entry, activeFeedTopic);
      });
  }, [
    activeFeedTopic,
    activeTopicFeedState.entries,
    activeTopicFeedState.hasMore,
    currentAuthorId,
    focusedEntryId,
    normalizedSelectedHashtag,
    shouldUseIndependentFeed,
    visibleLikedEntryIdSet,
  ]);
  const visibleEntries = independentFeedEntries || orderedEntries;
  const activeFeedPersistenceKey = shouldUseIndependentFeed
    ? independentFeedKey
    : "home";
  const filteredEntries = useMemo(() => {
    const searchTerms = tokenizeSearch(deferredFeedSearchQuery);
    if (searchTerms.length === 0) return visibleEntries;

    return visibleEntries.filter((entry) => {
      const authorProfile = profileById.get(entry.authorId);
      const identityText = [
        authorProfile?.username,
        authorProfile?.usernameLower,
        authorProfile?.displayName,
        authorProfile?.email,
      ]
        .filter(Boolean)
        .join(" ");

      return matchesKnowledgeSearch(entry, searchTerms, identityText);
    });
  }, [deferredFeedSearchQuery, profileById, visibleEntries]);
  const feedProfileIds = useMemo(
    () => collectFeedProfileIds(filteredEntries),
    [filteredEntries],
  );
  const hasActiveSearch = feedSearchQuery.trim().length > 0;
  const hasActiveTopic = activeFeedTopic.id !== "all";
  const isIndependentFeedLoading =
    shouldUseIndependentFeed &&
    (activeTopicFeedState.isLoading ||
      (!activeTopicFeedState.hasLoaded && !activeTopicFeedState.error));
  const hasMoreIndependentEntries =
    shouldUseIndependentFeed &&
    !focusedEntryId &&
    activeTopicFeedState.hasLoaded &&
    activeTopicFeedState.hasMore &&
    Boolean(activeTopicFeedState.cursor);
  const hasMoreEntries =
    shouldUseIndependentFeed
      ? hasMoreIndependentEntries
      : !focusedEntryId &&
        hasMoreServerEntries &&
        Boolean(paginationCursorRef.current);
  const isActiveFeedLoadingMore = shouldUseIndependentFeed
    ? activeTopicFeedState.isLoadingMore
    : isLoadingMoreEntries;
  const isPaginationBusy = shouldUseIndependentFeed
    ? activeTopicFeedState.isLoading || activeTopicFeedState.isLoadingMore
    : isLoadingMoreEntries || isBackgroundLoadingEntries;
  const activeFeedLoadError = shouldUseIndependentFeed
    ? activeTopicFeedState.error
    : feedLoadError;
  const shouldShowInitialFeedSkeleton =
    filteredEntries.length === 0 &&
    !activeFeedLoadError &&
    (shouldUseIndependentFeed ? isIndependentFeedLoading : isLoading);
  const shouldShowFeedErrorState =
    filteredEntries.length === 0 &&
    Boolean(activeFeedLoadError) &&
    !shouldShowInitialFeedSkeleton;
  const shouldKeepLoadingEmptyFeed =
    (isIndependentFeedLoading && filteredEntries.length === 0 && !hasActiveSearch) ||
    (!focusedEntryId &&
      filteredEntries.length === 0 &&
      hasMoreEntries &&
      !hasActiveSearch &&
      !isActiveFeedLoadingMore &&
      (shouldUseIndependentFeed ? !activeTopicFeedState.error : !feedLoadError));
  const shouldFillInitialVisibleBatch =
    !focusedEntryId &&
    !hasActiveSearch &&
    filteredEntries.length > 0 &&
    filteredEntries.length < FEED_INITIAL_PAGE_SIZE &&
    hasMoreEntries &&
    !isPaginationBusy &&
    (shouldUseIndependentFeed ? !activeTopicFeedState.error : !feedLoadError);
  const shouldContinueLoadingVisibleFeed =
    shouldKeepLoadingEmptyFeed || shouldFillInitialVisibleBatch;
  const shouldHoldEmptyFeedState = shouldKeepLoadingEmptyFeed;

  useEffect(() => {
    if (!isActive || feedProfileIds.length === 0) return;

    const profileIdsToLoad = feedProfileIds.filter(
      (profileId) =>
        !loadedProfileIdsRef.current.has(profileId) &&
        !loadingProfileIdsRef.current.has(profileId),
    );
    if (profileIdsToLoad.length === 0) return;

    profileIdsToLoad.forEach((profileId) =>
      loadingProfileIdsRef.current.add(profileId),
    );

    const loadFeedProfiles = async () => {
      try {
        const snapshots = await Promise.all(
          chunkProfileIds(profileIdsToLoad).map((profileIdChunk) =>
            getDocs(
              query(
                collection(db, "userProfiles"),
                where(documentId(), "in", profileIdChunk),
              ),
            ),
          ),
        );

        profileIdsToLoad.forEach((profileId) =>
          loadedProfileIdsRef.current.add(profileId),
        );

        if (!isMountedRef.current) return;

        const loadedProfiles = snapshots.flatMap((snapshot) =>
          snapshot.docs.map((item) =>
            hydrateUserProfile(item.data() as Partial<UserProfile>, item.id),
          ),
        );

        loadedProfiles.forEach((profile) =>
          loadedProfileIdsRef.current.add(profile.id),
        );
        setProfiles((currentProfiles) =>
          mergeUserProfileList(currentProfiles, loadedProfiles),
        );
        setProfilesLoadError(null);
      } catch (error) {
        console.error("Feed author profile load error:", error);
        if (isMountedRef.current) {
          setProfilesLoadError(
            "Some profile pictures may be incomplete for a moment.",
          );
        }
      } finally {
        profileIdsToLoad.forEach((profileId) =>
          loadingProfileIdsRef.current.delete(profileId),
        );
      }
    };

    void loadFeedProfiles();
  }, [feedProfileIds, isActive]);

  // ── Scroll persistence ──

  useEffect(() => {
    if (!isActive || focusedEntryId || typeof window === "undefined") return;

    let frameId: number | null = null;
    const persistScroll = () => {
      frameId = null;
      writeKnowledgeFeedScrollPosition(activeFeedPersistenceKey, window.scrollY);
    };
    const schedulePersistScroll = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(persistScroll);
    };

    schedulePersistScroll();
    window.addEventListener("scroll", schedulePersistScroll, { passive: true });
    window.addEventListener("pagehide", persistScroll);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      persistScroll();
      window.removeEventListener("scroll", schedulePersistScroll);
      window.removeEventListener("pagehide", persistScroll);
    };
  }, [activeFeedPersistenceKey, focusedEntryId, isActive]);

  useEffect(() => {
    if (!isActive) {
      restoredScrollKeyRef.current = null;
      return;
    }
    if (focusedEntryId || typeof window === "undefined") return;
    if (restoredScrollKeyRef.current === activeFeedPersistenceKey) return;
    if (filteredEntries.length === 0 || shouldHoldEmptyFeedState) return;

    restoredScrollKeyRef.current = activeFeedPersistenceKey;
    const savedScrollY = readKnowledgeFeedScrollPosition(activeFeedPersistenceKey);
    if (savedScrollY <= 0) return;

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: savedScrollY, left: 0, behavior: "auto" });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [
    activeFeedPersistenceKey,
    filteredEntries.length,
    focusedEntryId,
    isActive,
    shouldHoldEmptyFeedState,
  ]);

  // ── Independent feed pagination ──

  const loadNextIndependentFeedPage = useCallback(
    async ({
      showLoadingState = true,
      surfaceErrors = true,
    }: LoadNextEntriesPageOptions = {}): Promise<FeedPageLoadResult> => {
      if (
        !shouldUseIndependentFeed ||
        activeTopicFeedState.isLoading ||
        activeTopicFeedState.isLoadingMore ||
        independentLoadingKeysRef.current.has(independentFeedKey) ||
        !activeTopicFeedState.hasMore ||
        !activeTopicFeedState.cursor
      ) {
        return activeTopicFeedState.isLoadingMore ||
          independentLoadingKeysRef.current.has(independentFeedKey)
          ? "blocked"
          : "done";
      }

      independentLoadingKeysRef.current.add(independentFeedKey);

      if (showLoadingState) {
        setTopicFeedStates((current) => {
          const existing = current[independentFeedKey];
          if (!existing || existing.isLoading || existing.isLoadingMore) {
            return current;
          }

          return {
            ...current,
            [independentFeedKey]: {
              ...existing,
              isLoadingMore: true,
              error: surfaceErrors ? null : existing.error,
            },
          };
        });
      }

      try {
        const page = await loadIndependentKnowledgeFeedEntries({
          topic: activeFeedTopic,
          selectedHashtag: normalizedSelectedHashtag,
          cursor: activeTopicFeedState.cursor,
        });

        if (!isMountedRef.current) {
          return "blocked";
        }

        setTopicFeedStates((current) => {
          const existing = current[independentFeedKey] || activeTopicFeedState;
          const nextEntries = mergeIndependentKnowledgeFeedEntries(
            existing.entries,
            page.entries,
            activeFeedTopic,
          );

          return {
            ...current,
            [independentFeedKey]: {
              ...existing,
              entries: nextEntries,
              isLoading: false,
              isLoadingMore: false,
              hasLoaded: true,
              hasMore: page.hasMore,
              cursor: page.cursor,
              error: null,
            },
          };
        });

        return page.hasMore ? "loaded" : "done";
      } catch (error) {
        console.error("Independent knowledge pagination error:", error);

        setTopicFeedStates((current) => {
          const existing = current[independentFeedKey] || activeTopicFeedState;

          return {
            ...current,
            [independentFeedKey]: {
              ...existing,
              isLoadingMore: false,
              hasLoaded: true,
              error: surfaceErrors
                ? activeFeedTopic.id === "trending"
                  ? "Could not load more trending posts right now. Please try again in a moment."
                  : normalizedSelectedHashtag
                    ? `Could not load more posts for #${normalizedSelectedHashtag} right now.`
                    : `Could not load more ${activeFeedTopic.label.toLowerCase()} posts right now.`
                : existing.error,
            },
          };
        });

        return "error";
      } finally {
        independentLoadingKeysRef.current.delete(independentFeedKey);
      }
    },
    [
      activeFeedTopic,
      activeTopicFeedState,
      independentFeedKey,
      normalizedSelectedHashtag,
      shouldUseIndependentFeed,
    ],
  );

  const loadMoreActiveEntries = useCallback(
    (options?: LoadNextEntriesPageOptions) =>
      shouldUseIndependentFeed
        ? loadNextIndependentFeedPage(options)
        : loadNextEntriesPage(options),
    [loadNextEntriesPage, loadNextIndependentFeedPage, shouldUseIndependentFeed],
  );

  const handleRetryFeedLoad = useCallback(() => {
    setFeedLoadError(null);

    if (shouldUseIndependentFeed) {
      independentLoadingKeysRef.current.delete(independentFeedKey);
      setTopicFeedStates((current) => {
        const existing = current[independentFeedKey] || EMPTY_TOPIC_FEED_STATE;

        return {
          ...current,
          [independentFeedKey]: {
            ...existing,
            isLoading: false,
            isLoadingMore: false,
            hasLoaded: false,
            error: null,
          },
        };
      });
    } else {
      setIsLoading(true);
    }

    setFeedRetrySignal((current) => current + 1);
  }, [independentFeedKey, shouldUseIndependentFeed]);

  useEffect(() => {
    lastAutoLoadEntryCountRef.current = 0;
    setDesktopContextEntryId(null);
  }, [deferredFeedSearchQuery, focusedEntryId, independentFeedKey]);

  const handleVisibleEntry = useCallback(
    (entry: KnowledgeEntry) => {
      markKnowledgeEntrySeen(entry);

      if (typeof window !== "undefined" && window.innerWidth >= 1280) {
        setDesktopContextEntryId((current) =>
          current === entry.id ? current : entry.id,
        );
      }

      if (
        !isActive ||
        focusedEntryId ||
        hasActiveSearch ||
        !hasMoreEntries ||
        isPaginationBusy
      ) {
        return;
      }

      const visibleEntryIndex = filteredEntries.findIndex(
        (visibleEntry) => visibleEntry.id === entry.id,
      );
      if (visibleEntryIndex < 0) {
        return;
      }

      const remainingEntryCount = filteredEntries.length - visibleEntryIndex - 1;
      if (
        filteredEntries.length <= FEED_LOAD_MORE_REMAINING_THRESHOLD ||
        remainingEntryCount > FEED_LOAD_MORE_REMAINING_THRESHOLD ||
        lastAutoLoadEntryCountRef.current === filteredEntries.length
      ) {
        return;
      }

      const entryCountAtRequest = filteredEntries.length;
      lastAutoLoadEntryCountRef.current = entryCountAtRequest;
      void loadMoreActiveEntries().then((result) => {
        if (result === "error") {
          lastAutoLoadEntryCountRef.current = 0;
        }
      });
    },
    [
      filteredEntries,
      focusedEntryId,
      hasActiveSearch,
      hasMoreEntries,
      isActive,
      isPaginationBusy,
      loadMoreActiveEntries,
    ],
  );

  useEffect(() => {
    if (!isActive || !shouldUseIndependentFeed) return;
    if (activeTopicFeedState.isLoading || activeTopicFeedState.hasLoaded) return;
    if (independentLoadingKeysRef.current.has(independentFeedKey)) return;

    let cancelled = false;
    independentLoadingKeysRef.current.add(independentFeedKey);

    setTopicFeedStates((current) => {
      const existing = current[independentFeedKey];
      if (existing?.isLoading || existing?.hasLoaded) return current;

      return {
        ...current,
        [independentFeedKey]: {
          entries: existing?.entries || [],
          isLoading: true,
          isLoadingMore: false,
          hasLoaded: false,
          hasMore: existing?.hasMore || false,
          cursor: existing?.cursor || null,
          error: null,
        },
      };
    });

    const loadFeed = async () => {
      try {
        const page = await loadIndependentKnowledgeFeedEntries({
          topic: activeFeedTopic,
          selectedHashtag: normalizedSelectedHashtag,
        });

        if (cancelled) return;

        setTopicFeedStates((current) => ({
          ...current,
          [independentFeedKey]: {
            entries: mergeIndependentKnowledgeFeedEntries(
              current[independentFeedKey]?.entries || [],
              page.entries,
              activeFeedTopic,
            ),
            isLoading: false,
            isLoadingMore: false,
            hasLoaded: true,
            hasMore: page.hasMore,
            cursor: page.cursor,
            error: null,
          },
        }));
      } catch (error) {
        if (cancelled) return;

        console.error("Independent knowledge feed error:", error);
        setTopicFeedStates((current) => ({
          ...current,
          [independentFeedKey]: {
            entries: current[independentFeedKey]?.entries || [],
            isLoading: false,
            isLoadingMore: false,
            hasLoaded: true,
            hasMore: current[independentFeedKey]?.hasMore || false,
            cursor: current[independentFeedKey]?.cursor || null,
            error:
              activeFeedTopic.id === "trending"
                ? "Could not load trending posts right now. Please try again in a moment."
                : normalizedSelectedHashtag
                  ? `Could not load posts for #${normalizedSelectedHashtag} right now.`
                  : `Could not load ${activeFeedTopic.label} posts right now.`,
          },
        }));
      } finally {
        independentLoadingKeysRef.current.delete(independentFeedKey);
      }
    };

    void loadFeed();

    return () => {
      cancelled = true;
      independentLoadingKeysRef.current.delete(independentFeedKey);
    };
  }, [
    activeFeedTopic,
    feedRetrySignal,
    independentFeedKey,
    isActive,
    normalizedSelectedHashtag,
    shouldUseIndependentFeed,
  ]);

  useEffect(() => {
    if (!isActive || !hasMoreEntries || typeof window === "undefined") return;

    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;

    if (typeof window.IntersectionObserver !== "function") {
      return;
    }

    const observer = new window.IntersectionObserver(
      (observedEntries) => {
        if (!observedEntries.some((entry) => entry.isIntersecting)) {
          return;
        }

        void loadMoreActiveEntries();
      },
      {
        rootMargin: "600px 0px",
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreEntries, isActive, loadMoreActiveEntries]);

  useEffect(() => {
    if (
      !isActive ||
      !shouldContinueLoadingVisibleFeed ||
      isLoading ||
      isActiveFeedLoadingMore ||
      (!shouldUseIndependentFeed && isBackgroundLoadingEntries)
    ) {
      return;
    }

    void loadMoreActiveEntries({
      showLoadingState: true,
      surfaceErrors: true,
    });
  }, [
    isActive,
    isBackgroundLoadingEntries,
    isActiveFeedLoadingMore,
    isLoading,
    loadMoreActiveEntries,
    shouldContinueLoadingVisibleFeed,
    shouldUseIndependentFeed,
  ]);

  // ── Mention handling ──

  const filteredMentionProfiles = useMemo(() => {
    if (!activeMention) return [];

    return profiles
      .filter((profile) =>
        profile.usernameLower.startsWith(activeMention.query.toLowerCase()),
      )
      .slice(0, 6);
  }, [activeMention, profiles]);

  const updateMentionState = (value: string, cursorPosition: number) => {
    const beforeCursor = value.slice(0, cursorPosition);
    const match = beforeCursor.match(/(?:^|\s)@([a-z0-9_]*)$/i);

    if (!match) {
      setActiveMention(null);
      return;
    }

    const atIndex = beforeCursor.lastIndexOf("@");
    setActiveMention({
      query: match[1].toLowerCase(),
      start: atIndex,
    });
  };

  // ── Composer logic ──

  const resetComposer = () => {
    setDraftTitle("");
    setDraftContent("");
    setDraftContentKind("insight");
    setDraftCategory("");
    setDraftVisibility("public");
    setHashtagInput("");
    setSelectedImages([]);
    setSelectedImageLayout(DEFAULT_IMAGE_LAYOUT);
    setActiveMention(null);
    setFeedMessage(null);
  };

  const publishKnowledge = async (currentIdentity: KnowledgeIdentity) => {
    const title = draftTitle.trim();
    const content = draftContent.trim();
    if (!title || !content) return;

    const seedHashtags = mergeHashtags(
      parseManualHashtags(hashtagInput),
      draftCategory ? [draftCategory] : [],
      extractInlineHashtags(`${title}\n${content}`),
    );

    setFeedMessage(null);
    setIsModerating(true);

    let moderation;
    try {
      const { moderateContent } = await import("../../utils/contentModeration");
      moderation = await moderateContent("knowledge-post", {
        title,
        content,
        hashtags: seedHashtags,
      });
    } catch (error) {
      console.error("Failed to validate knowledge post:", error);
      setIsModerating(false);
      setFeedMessage({
        tone: "warning",
        title: "Validation failed",
        body: "Could not validate this post right now. Please try again.",
      });
      return;
    }

    if (!moderation.allowed) {
      setIsModerating(false);
      setFeedMessage({
        tone: "warning",
        title: "Post blocked",
        body: [moderation.message, ...moderation.suggestions]
          .slice(0, 2)
          .join(" "),
      });
      return;
    }

    setIsModerating(false);
    setIsPosting(true);

    try {
      const hashtags = seedHashtags;
      const category = draftCategory || null;
      const mentions = resolveMentions(`${title}\n${content}`, profiles);
      const createdAt = Date.now();
      const reference = doc(collection(db, "knowledge"));
      const preparedImages = selectedImages.map(({ fileName: _fileName, ...image }) => image);
      const primaryImage = preparedImages[0] || null;
      const entryPayload = {
        author: currentIdentity.displayName,
        authorId: currentIdentity.authorId,
        authorEmail: "",
        title,
        content,
        contentKind: draftContentKind,
        category,
        visibility: draftVisibility,
        hashtags,
        comments: [],
        likes: [],
        likeCount: 0,
        helpfulIds: [],
        helpfulCount: 0,
        dislikes: [],
        dislikeCount: 0,
        misleadingIds: [],
        misleadingCount: 0,
        savedBy: [],
        saveCount: 0,
        mentions,
        images: preparedImages,
        imageLayout: preparedImages.length > 0 ? selectedImageLayout : null,
        imageDataUrl: primaryImage?.dataUrl || null,
        imageMimeType: primaryImage?.mimeType || null,
        imageWidth: primaryImage?.width || null,
        imageHeight: primaryImage?.height || null,
        imageOptimizedAt: primaryImage?.optimizedAt || null,
        createdAt,
        updatedAt: createdAt,
        excerpt: createExcerpt(content, 180),
        readingMinutes: estimateReadMinutes(content),
        qualityScore: moderation.knowledgeScore,
      };

      await setDoc(reference, entryPayload);
      trackPostCreated(reference.id, category || undefined);
      const createdEntry = normalizeKnowledgeEntry(reference.id, entryPayload);

      entriesRef.current = [
        createdEntry,
        ...entriesRef.current.filter((entry) => entry.id !== createdEntry.id),
      ];
      setEntries(entriesRef.current);
      setFeedEntryOrder((currentOrder) => [
        reference.id,
        ...currentOrder.filter((entryId) => entryId !== reference.id),
      ]);
      resetComposer();
      setShowComposer(false);
      onOpenEntry(reference.id);

      void import("../../utils/notifications")
        .then(({ notifyTaggedUsers }) =>
          notifyTaggedUsers(
            {
              id: reference.id,
              title,
              authorId: currentIdentity.authorId,
            },
            {
              authorId: currentIdentity.authorId,
              username: currentIdentity.displayName,
            },
            mentions,
          ),
        )
        .catch((error) => {
          console.warn("Post tag notifications failed; post was published.", error);
        });
    } catch (error) {
      console.error("Failed to publish knowledge:", error);
      setFeedMessage({
        tone: "warning",
        title: "Publish failed",
        body: "Could not publish this post. Please try again.",
      });
    } finally {
      setIsPosting(false);
    }
  };

  const handlePublish = () => {
    if (!draftTitle.trim() || !draftContent.trim()) return;

    if (!identity) {
      setPublishAfterAccess(true);
      setShowIdentityPrompt(true);
      return;
    }

    void publishKnowledge(identity);
  };

  const handleGoogleSignInForPublish = async () => {
    const nextIdentity = await signInWithGoogleAccount();
    onIdentityChange(nextIdentity);
    setShowIdentityPrompt(false);

    if (publishAfterAccess && draftTitle.trim() && draftContent.trim()) {
      setPublishAfterAccess(false);
      void publishKnowledge(nextIdentity);
      return;
    }

    setPublishAfterAccess(false);
  };

  const handleImageSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length !== files.length) {
      alert("Please choose image files only.");
    }

    const remainingSlots =
      selectedImageLayoutSettings.maxImages - selectedImages.length;
    if (remainingSlots <= 0) {
      setFeedMessage({
        tone: "warning",
        title: "Image limit reached",
        body: `This layout supports up to ${selectedImageLayoutSettings.maxImages} images.`,
      });
      event.target.value = "";
      return;
    }

    const filesToProcess = imageFiles.slice(0, remainingSlots);
    if (filesToProcess.length === 0) {
      event.target.value = "";
      return;
    }

    setFeedMessage(null);
    setIsPreparingImage(true);

    try {
      const { optimizeKnowledgeImageFile } = await import(
        "../../utils/knowledgeImageOptimizer"
      );
      const optimizedImages: SelectedImage[] = [];

      for (const file of filesToProcess) {
        const optimizedImage = await optimizeKnowledgeImageFile(file, {
          targetRatio: selectedImageLayoutSettings.targetRatio,
          maxInlineChars: selectedImageLayoutSettings.maxInlineChars,
          maxDimension: selectedImageLayoutSettings.maxDimension,
        });

        optimizedImages.push({
          fileName: file.name,
          ...optimizedImage,
        });
      }

      const nextSelectedImages = [...selectedImages, ...optimizedImages];
      const combinedSize = nextSelectedImages.reduce(
        (total, image) => total + image.dataUrl.length,
        0,
      );

      if (combinedSize > MAX_TOTAL_INLINE_IMAGE_CHARS) {
        throw new Error(
          "These images are still too large together. Try fewer images or simpler images.",
        );
      }

      setSelectedImages(nextSelectedImages);

      if (imageFiles.length > remainingSlots) {
        setFeedMessage({
          tone: "warning",
          title: "Some images were skipped",
          body: `Only ${selectedImageLayoutSettings.maxImages} images fit in this ${selectedImageLayoutSettings.label} layout.`,
        });
      }
    } catch (error) {
      console.error("Image preparation failed:", error);
      alert(
        error instanceof Error ? error.message : "Could not prepare the image.",
      );
    } finally {
      setIsPreparingImage(false);
      event.target.value = "";
    }
  };

  const handleRemoveSelectedImage = (indexToRemove: number) => {
    setSelectedImages((current) =>
      current.filter((_, index) => index !== indexToRemove),
    );
  };

  const handleGoogleSignInForPendingAction = async () => {
    if (!pendingAction) return;

    const nextIdentity = await signInWithGoogleAccount();
    onIdentityChange(nextIdentity);

    window.dispatchEvent(
      new CustomEvent("knowledge-action", {
        detail: {
          ...pendingAction,
          username: nextIdentity.displayName,
          authorId: nextIdentity.authorId,
        },
      }),
    );
    setPendingAction(null);
  };

  const handleMentionInsert = (profile: UserProfile) => {
    if (!activeMention || !contentRef.current) return;

    const textarea = contentRef.current;
    const cursor = textarea.selectionStart;
    const before = draftContent.slice(0, activeMention.start);
    const after = draftContent.slice(cursor);
    const inserted = `@${profile.username} `;
    const nextValue = `${before}${inserted}${after}`;

    setDraftContent(nextValue);
    setActiveMention(null);

    requestAnimationFrame(() => {
      textarea.focus();
      const nextCursor = before.length + inserted.length;
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleContentKeyUp = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    updateMentionState(
      event.currentTarget.value,
      event.currentTarget.selectionStart,
    );
  };

  const handleSelectHashtag = useCallback((tag: string) => {
    const normalizedTag = tag.trim().toLowerCase();
    if (!normalizedTag) return;

    navigateToRoute("knowledge", {
      selectedHashtag: normalizedTag,
      selectedTopic: selectedFeedTopic === "all" ? null : selectedFeedTopic,
    });
  }, [selectedFeedTopic]);

  const handleSelectFeedTopic = useCallback(
    (topicId: FeedTopicId) => {
      if (topicId === selectedFeedTopic) return;

      const normalizedRefreshHashtag = selectedHashtag
        ? normalizeStoredHashtagValue(selectedHashtag)
        : null;

      setFeedSearchQuery("");
      visibleLikedEntryIdsRef.current = [];
      setVisibleLikedEntryIds([]);
      setSelectedFeedTopic(topicId);
      navigateToRoute("knowledge", {
        selectedHashtag: normalizedRefreshHashtag,
        selectedTopic: topicId === "all" ? null : topicId,
      });

      window.requestAnimationFrame(() => scrollKnowledgeFeedToTop("smooth"));
    },
    [selectedFeedTopic, selectedHashtag],
  );

  const clearSelectedHashtag = useCallback(() => {
    navigateToRoute("knowledge", {
      selectedTopic: selectedFeedTopic === "all" ? null : selectedFeedTopic,
    });
  }, [selectedFeedTopic]);

  const handleIdentityRequired = useCallback(
    (action: NonNullable<PendingAction>) => setPendingAction(action),
    [],
  );

  const handleLikeChange = useCallback(
    (entryId: string, likes: string[], misleadingIds: string[] = []) => {
      const likedByCurrentUser = Boolean(
        currentAuthorId && likes.includes(currentAuthorId),
      );

      setVisibleLikedEntryIds((currentIds) => {
        if (likedByCurrentUser) {
          if (currentIds.includes(entryId)) {
            visibleLikedEntryIdsRef.current = currentIds;
            return currentIds;
          }

          const nextIds = [...currentIds, entryId];
          visibleLikedEntryIdsRef.current = nextIds;
          return nextIds;
        }

        if (!currentIds.includes(entryId)) {
          visibleLikedEntryIdsRef.current = currentIds;
          return currentIds;
        }

        const nextIds = currentIds.filter((id) => id !== entryId);
        visibleLikedEntryIdsRef.current = nextIds;
        return nextIds;
      });

      setEntries((currentEntries) => {
        let didUpdateEntries = false;
        const nextEntries = currentEntries.map((entry) => {
          if (entry.id !== entryId) return entry;

          didUpdateEntries = true;
          return {
            ...entry,
            likes,
            likeCount: likes.length,
            helpfulIds: likes,
            helpfulCount: likes.length,
            dislikes: misleadingIds,
            dislikeCount: misleadingIds.length,
            misleadingIds,
            misleadingCount: misleadingIds.length,
          };
        });
        if (!didUpdateEntries) return currentEntries;

        entriesRef.current = nextEntries;
        return nextEntries;
      });

      setTopicFeedStates((current) => {
        let nextStates: typeof current | null = null;

        Object.entries(current).forEach(([key, state]) => {
          let didUpdateState = false;
          const nextEntries = state.entries.map((entry) => {
            if (entry.id !== entryId) return entry;

            didUpdateState = true;
            return {
              ...entry,
              likes,
              likeCount: likes.length,
              helpfulIds: likes,
              helpfulCount: likes.length,
              dislikes: misleadingIds,
              dislikeCount: misleadingIds.length,
              misleadingIds,
              misleadingCount: misleadingIds.length,
            };
          });

          if (!didUpdateState) return;

          nextStates = nextStates || { ...current };
          nextStates[key] = { ...state, entries: nextEntries };
        });

        return nextStates || current;
      });
    },
    [currentAuthorId],
  );

  const handleEntryUpdated = useCallback((updatedEntry: KnowledgeEntry) => {
    setEntries((currentEntries) => {
      const nextEntries = replaceKnowledgeEntry(currentEntries, updatedEntry);
      if (nextEntries === currentEntries) return currentEntries;

      entriesRef.current = nextEntries;
      return nextEntries;
    });

    setTopicFeedStates((currentStates) => {
      let nextStates: typeof currentStates | null = null;

      Object.entries(currentStates).forEach(([key, state]) => {
        const nextEntries = replaceKnowledgeEntry(state.entries, updatedEntry);
        if (nextEntries === state.entries) return;

        nextStates = nextStates || { ...currentStates };
        nextStates[key] = {
          ...state,
          entries: nextEntries,
        };
      });

      return nextStates || currentStates;
    });
  }, []);

  // ── SEO derived values ──

  const pageTitle = focusedEntry
    ? `${focusedEntry.title} | Readative`
    : selectedHashtag
      ? `#${selectedHashtag} posts | Readative`
      : activeCategory
        ? `${activeCategory.label} Knowledge Posts | Readative`
        : activeFeedTopic.id !== "all"
          ? `${activeFeedTopic.label} posts | Readative`
        : "Home Feed | Readative";
  const pageDescription = focusedEntry
    ? createExcerpt(focusedEntry.content)
    : selectedHashtag
      ? `Explore Readative knowledge posts tagged #${selectedHashtag}.`
      : activeCategory
        ? activeCategory.description
        : activeFeedTopic.id !== "all"
          ? `Explore ${activeFeedTopic.label.toLowerCase()} knowledge posts on Readative.`
        : "Readative is a knowledge feed for discovering and publishing practical posts, visual explainers, study notes, AI tools, SmartTalk Q&A, and creator profiles.";
  const pageUrl = focusedEntry
    ? buildAbsoluteRouteUrl("knowledge", {
        focusedEntryId: focusedEntry.id,
        seoTitle: focusedEntry.title,
      })
    : selectedHashtag
      ? buildAbsoluteRouteUrl("knowledge", {
          selectedHashtag,
          selectedTopic:
            activeFeedTopic.id === "all" ? null : activeFeedTopic.id,
        })
      : buildAbsoluteRouteUrl("knowledge", {
          selectedTopic:
            activeFeedTopic.id === "all" ? null : activeFeedTopic.id,
        });
  const shouldShowBackToTopRefresh =
    isActive && !showComposer && showBackToTopRefresh;
  const shouldNoIndexKnowledgePage =
    Boolean(selectedHashtag) ||
    !shouldShowInitialFeedSkeleton &&
    !shouldShowFeedErrorState &&
    !shouldHoldEmptyFeedState &&
    !hasActiveSearch &&
    filteredEntries.length === 0;

  // ── Render ──

  return (
    <>
      <FeedRenderer
        identity={identity}
        currentAuthorId={currentAuthorId}
        isActive={isActive}
        focusedEntryId={focusedEntryId}
        focusedEntry={focusedEntry}
        focusedEntryPrimaryImage={focusedEntryPrimaryImage}
        selectedHashtag={selectedHashtag}
        selectedFeedTopic={selectedFeedTopic}
        activeFeedTopic={activeFeedTopic}
        activeCategory={activeCategory}
        activeCategoryTopics={activeCategoryTopics}
        normalizedSelectedHashtag={normalizedSelectedHashtag}
        filteredEntries={filteredEntries}
        visibleEntries={visibleEntries}
        desktopContextEntryId={desktopContextEntryId}
        profiles={profiles}
        journeyQuestions={journeyQuestions}
        feedSearchQuery={feedSearchQuery}
        isLoading={isLoading}
        shouldShowInitialFeedSkeleton={shouldShowInitialFeedSkeleton}
        shouldShowFeedErrorState={shouldShowFeedErrorState}
        shouldHoldEmptyFeedState={shouldHoldEmptyFeedState}
        hasActiveSearch={hasActiveSearch}
        hasActiveTopic={hasActiveTopic}
        hasMoreEntries={hasMoreEntries}
        isActiveFeedLoadingMore={isActiveFeedLoadingMore}
        isPaginationBusy={isPaginationBusy}
        feedLoadError={feedLoadError}
        profilesLoadError={profilesLoadError}
        showRefreshFeedback={showRefreshFeedback}
        shouldShowBackToTopRefresh={shouldShowBackToTopRefresh}
        shouldUseIndependentFeed={shouldUseIndependentFeed}
        activeTopicFeedError={activeTopicFeedState.error}
        pageTitle={pageTitle}
        pageDescription={pageDescription}
        pageUrl={pageUrl}
        shouldNoIndexKnowledgePage={shouldNoIndexKnowledgePage}
        loadMoreSentinelRef={loadMoreSentinelRef}
        onSetFeedSearchQuery={setFeedSearchQuery}
        onSelectFeedTopic={handleSelectFeedTopic}
        onClearSelectedHashtag={clearSelectedHashtag}
        onRetryFeedLoad={handleRetryFeedLoad}
        onLoadMoreActiveEntries={() => void loadMoreActiveEntries()}
        onVisibleEntry={handleVisibleEntry}
        onIdentityRequired={handleIdentityRequired}
        onOpenProfile={onOpenProfile}
        onOpenEntry={onOpenEntry}
        onSelectHashtag={handleSelectHashtag}
        onLikeChange={handleLikeChange}
        onEntryUpdated={handleEntryUpdated}
        onBackToTopRefresh={handleBackToTopRefresh}
      />

      {showComposer && (
        <ComposerModal
          identity={identity}
          onOpenProfile={onOpenProfile}
          onClose={() => {
            if (isPosting || isModerating || isPreparingImage) return;
            setShowComposer(false);
            setFeedMessage(null);
          }}
          draftTitle={draftTitle}
          setDraftTitle={setDraftTitle}
          draftContent={draftContent}
          setDraftContent={setDraftContent}
          draftContentKind={draftContentKind}
          setDraftContentKind={setDraftContentKind}
          draftCategory={draftCategory}
          setDraftCategory={setDraftCategory}
          draftVisibility={draftVisibility}
          setDraftVisibility={setDraftVisibility}
          hashtagInput={hashtagInput}
          setHashtagInput={setHashtagInput}
          selectedImages={selectedImages}
          selectedImageLayout={selectedImageLayout}
          onRemoveSelectedImage={handleRemoveSelectedImage}
          isPosting={isPosting}
          isModerating={isModerating}
          isPreparingImage={isPreparingImage}
          feedMessage={feedMessage}
          handlePublish={handlePublish}
          handleImageSelected={handleImageSelected}
          contentRef={contentRef}
          activeMention={activeMention}
          filteredMentionProfiles={filteredMentionProfiles}
          handleMentionInsert={handleMentionInsert}
          handleContentKeyUp={handleContentKeyUp}
          updateMentionState={updateMentionState}
        />
      )}

      {showIdentityPrompt && (
        <GoogleSignInPrompt
          title="Sign in to publish"
          description="Use your Google account to publish. Everyone can still read posts without signing in, and your content stays saved to your profile."
          submitLabel="Continue with Google"
          onConfirm={handleGoogleSignInForPublish}
          onClose={() => {
            setPublishAfterAccess(false);
            setShowIdentityPrompt(false);
          }}
        />
      )}

      {pendingAction && (
        <GoogleSignInPrompt
          title={
            pendingAction.type === "helpful"
              ? "Sign in to mark helpful"
              : pendingAction.type === "misleading"
                ? "Sign in to mark misleading"
                : pendingAction.type === "save"
                  ? "Sign in to save"
                  : pendingAction.type === "ink"
                    ? "Sign in to use Notebook Highlight"
                    : "Sign in to comment"
          }
          description="Use your Google account so this activity is saved to your Readative profile on every browser and device."
          submitLabel="Continue with Google"
          onConfirm={handleGoogleSignInForPendingAction}
          onClose={() => setPendingAction(null)}
        />
      )}
    </>
  );
}
