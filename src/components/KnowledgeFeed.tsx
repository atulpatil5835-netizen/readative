import {
  type ChangeEvent,
  useDeferredValue,
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AtSign,
  BookOpenText,
  ImagePlus,
  Send,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import {
  KnowledgeComment,
  KnowledgeEntry,
  KnowledgeImageAsset,
  KnowledgeImageLayout,
  TaggedUser,
  UserProfile,
} from "../types";
import { SEO } from "./SEO";
import { IdentityPrompt, UsernamePrompt } from "./Auth";
import { KnowledgeCard } from "./KnowledgeCard";
import { KnowledgeImageCarousel } from "./KnowledgeImageCarousel";
import { DiscoverySearch } from "./DiscoverySearch";
import { type KnowledgeIdentity } from "../utils/knowledgeIdentity";
import { getGuestName } from "../utils/guestIdentity";
import {
  buildAbsoluteRouteUrl,
  navigateToRoute,
  parseRouteFromLocation,
  ROUTE_CHANGE_EVENT,
} from "../utils/routes";
import {
  getKnowledgeFeedSnapshot,
  markKnowledgeEntrySeen,
  reconcileKnowledgeFeedOrder,
  rankKnowledgeEntries,
} from "../utils/feedPersonalization";
import {
  getKnowledgeEntryImages,
  getKnowledgeImageLayoutSettings,
} from "../utils/knowledgeImages";

type PendingAction = { type: "like" | "comment"; entryId: string } | null;

const DEFAULT_IMAGE_LAYOUT: KnowledgeImageLayout = "wide";
const MAX_TOTAL_INLINE_IMAGE_CHARS = 760_000;

interface SelectedImage extends KnowledgeImageAsset {
  fileName: string;
}

interface MentionState {
  query: string;
  start: number;
}

interface FeedMessage {
  tone: "success" | "warning";
  title: string;
  body: string;
}

interface KnowledgeFeedProps {
  identity: KnowledgeIdentity | null;
  onIdentityChange: (identity: KnowledgeIdentity | null) => void;
  onOpenProfile: (authorId: string) => void;
  focusedEntryId: string | null;
  onOpenEntry: (entryId: string) => void;
  composerOpenSignal: number;
  refreshSignal: number;
}

function parseManualHashtags(input: string): string[] {
  return input
    .split(/[\s,\n]+/)
    .map((token) => token.replace(/^#/, "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}

function extractInlineHashtags(text: string): string[] {
  return [...text.matchAll(/#([a-z0-9][a-z0-9_-]*)/gi)].map((match) =>
    match[1].toLowerCase(),
  );
}

function mergeHashtags(...sources: string[][]): string[] {
  const unique = new Set<string>();
  sources.flat().forEach((tag) => {
    if (!tag) return;
    unique.add(tag.toLowerCase());
  });
  return [...unique].slice(0, 8);
}

function extractMentionKeys(text: string): string[] {
  return [
    ...new Set(
      [...text.matchAll(/(?:^|\s)@([a-z0-9_]{1,20})/gi)].map((match) =>
        match[1].toLowerCase(),
      ),
    ),
  ];
}

function resolveMentions(text: string, profiles: UserProfile[]): TaggedUser[] {
  const profileMap = new Map(
    profiles.map((profile) => [profile.usernameLower, profile] as const),
  );

  return extractMentionKeys(text)
    .map((usernameLower) => profileMap.get(usernameLower))
    .filter((profile): profile is UserProfile => Boolean(profile))
    .map((profile) => ({
      authorId: profile.id,
      username: profile.username,
    }));
}

function createExcerpt(text: string, maxLength = 155) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trim()}...`;
}

function estimateReadMinutes(text: string) {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(wordCount / 180) || 1);
}

function readSelectedHashtagFromLocation() {
  if (typeof window === "undefined") return null;

  return parseRouteFromLocation().selectedHashtag;
}

function tokenizeSearch(input: string) {
  return input.trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 10);
}

function matchesKnowledgeSearch(entry: KnowledgeEntry, terms: string[]) {
  if (terms.length === 0) return true;

  const hashtags = entry.hashtags.map((tag) => tag.toLowerCase());
  const people = [
    entry.author,
    ...(entry.mentions || []).map((mention) => mention.username),
    ...(entry.comments || []).map((comment) => comment.author || ""),
  ].map((value) => value.toLowerCase());
  const searchableText = [
    entry.title,
    entry.content,
    entry.author,
    ...entry.hashtags,
    ...(entry.mentions || []).map((mention) => mention.username),
    ...(entry.comments || []).map((comment) => comment.text),
    ...(entry.comments || []).map((comment) => comment.author || ""),
  ]
    .join(" ")
    .toLowerCase();

  return terms.every((term) => {
    if (term.startsWith("#")) {
      const normalized = term.slice(1);
      return (
        Boolean(normalized) && hashtags.some((tag) => tag.includes(normalized))
      );
    }

    if (term.startsWith("@")) {
      const normalized = term.slice(1);
      return (
        Boolean(normalized) &&
        people.some((person) => person.includes(normalized))
      );
    }

    return searchableText.includes(term);
  });
}

function buildKnowledgeSchemas(entry: KnowledgeEntry | null) {
  const baseUrl = buildAbsoluteRouteUrl("knowledge");
  const primaryImage = entry ? getKnowledgeEntryImages(entry)[0] : null;

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Readative Knowledge Feed",
    url: baseUrl,
    description:
      "A clean homepage showing knowledge posts shared by the Readative community.",
  };

  if (!entry) {
    return collectionSchema;
  }

  return [
    collectionSchema,
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: entry.title,
      description: createExcerpt(entry.content),
      author: {
        "@type": "Person",
        name: `@${entry.author}`,
      },
      datePublished: new Date(entry.createdAt).toISOString(),
      keywords: entry.hashtags.join(", "),
      mainEntityOfPage: buildAbsoluteRouteUrl("knowledge", {
        focusedEntryId: entry.id,
      }),
      image:
        primaryImage?.dataUrl && !primaryImage.dataUrl.startsWith("data:")
          ? [primaryImage.dataUrl]
          : undefined,
    },
  ];
}

function normalizeKnowledgeComments(comments: KnowledgeComment[] = []) {
  return comments.map((comment) => ({
    ...comment,
    createdAt:
      (comment.createdAt as { toMillis?: () => number })?.toMillis?.() ||
      comment.createdAt ||
      Date.now(),
  }));
}

function normalizeKnowledgeEntry(
  id: string,
  data: Partial<KnowledgeEntry> & {
    comments?: KnowledgeComment[];
    createdAt?: number | { toMillis?: () => number };
  },
): KnowledgeEntry {
  const { comments, createdAt, likes, mentions, images, imageLayout, ...restData } = data;
  const rawCreatedAt = createdAt as
    | number
    | { toMillis?: () => number }
    | undefined;

  return {
    author: "",
    authorId: "",
    authorEmail: "",
    title: "",
    content: "",
    hashtags: [],
    ...restData,
    id,
    likes: likes || [],
    mentions: mentions || [],
    images: Array.isArray(images) ? images : [],
    imageLayout:
      imageLayout === "wide" || imageLayout === "portrait" ? imageLayout : null,
    comments: normalizeKnowledgeComments(comments || []),
    createdAt:
      rawCreatedAt &&
      typeof rawCreatedAt === "object" &&
      typeof rawCreatedAt.toMillis === "function"
        ? rawCreatedAt.toMillis()
        : typeof rawCreatedAt === "number"
          ? rawCreatedAt
          : Date.now(),
  };
}

export function KnowledgeFeed({
  identity,
  onIdentityChange,
  onOpenProfile,
  focusedEntryId,
  onOpenEntry,
  composerOpenSignal,
  refreshSignal,
}: KnowledgeFeedProps) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedLoadError, setFeedLoadError] = useState<string | null>(null);
  const [profilesLoadError, setProfilesLoadError] = useState<string | null>(
    null,
  );
  const [isPosting, setIsPosting] = useState(false);
  const [isModerating, setIsModerating] = useState(false);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [showIdentityPrompt, setShowIdentityPrompt] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [publishAfterAccess, setPublishAfterAccess] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [hashtagInput, setHashtagInput] = useState("");
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [selectedImageLayout, setSelectedImageLayout] =
    useState<KnowledgeImageLayout>(DEFAULT_IMAGE_LAYOUT);
  const [activeMention, setActiveMention] = useState<MentionState | null>(null);
  const [feedMessage, setFeedMessage] = useState<FeedMessage | null>(null);
  const [selectedHashtag, setSelectedHashtag] = useState<string | null>(() =>
    readSelectedHashtagFromLocation(),
  );
  const [feedSearchQuery, setFeedSearchQuery] = useState("");
  const [showRefreshFeedback, setShowRefreshFeedback] = useState(false);
  const [feedEntryOrder, setFeedEntryOrder] = useState<string[]>([]);

  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const entriesRef = useRef<KnowledgeEntry[]>([]);
  const guestName = getGuestName();
  const deferredFeedSearchQuery = useDeferredValue(feedSearchQuery);
  const selectedImageLayoutSettings =
    getKnowledgeImageLayoutSettings(selectedImageLayout);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

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
    setFeedEntryOrder(
      rankKnowledgeEntries(
        entriesRef.current,
        getKnowledgeFeedSnapshot(),
      ).map((entry) => entry.id),
    );
    setShowRefreshFeedback(true);
    window.scrollTo({ top: 0, behavior: "smooth" });

    const timeoutId = window.setTimeout(() => {
      setShowRefreshFeedback(false);
    }, 2400);

    return () => window.clearTimeout(timeoutId);
  }, [refreshSignal]);

  useEffect(() => {
    const knowledgeQuery = query(
      collection(db, "knowledge"),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      knowledgeQuery,
      (snapshot) => {
        const data = snapshot.docs.map((item) =>
          normalizeKnowledgeEntry(
            item.id,
            item.data() as Partial<KnowledgeEntry> & {
              comments?: KnowledgeComment[];
              createdAt?: number | { toMillis?: () => number };
            },
          ),
        );

        setEntries(data);
        entriesRef.current = data;
        setFeedEntryOrder((currentOrder) =>
          reconcileKnowledgeFeedOrder(data, currentOrder, getKnowledgeFeedSnapshot()),
        );

        setIsLoading(false);
        setFeedLoadError(null);
      },
      (error) => {
        console.error("Knowledge feed error:", error);
        setIsLoading(false);
        setFeedLoadError(
          "Could not load the latest posts right now. Please refresh in a moment.",
        );
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const profilesQuery = query(
      collection(db, "userProfiles"),
      orderBy("usernameLower", "asc"),
    );

    const unsubscribe = onSnapshot(
      profilesQuery,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          ...(item.data() as UserProfile),
          id: item.id,
        }));

        setProfiles(data);
        setProfilesLoadError(null);
      },
      (error) => {
        console.error("Profile directory error:", error);
        setProfiles([]);
        setProfilesLoadError(
          "User mentions and profile previews may be incomplete for a moment.",
        );
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!focusedEntryId || entries.length === 0) return;

    const target = document.getElementById(`knowledge-${focusedEntryId}`);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [entries.length, focusedEntryId]);

  useEffect(() => {
    const syncSelectedHashtag = () => {
      setSelectedHashtag(readSelectedHashtagFromLocation());
    };

    syncSelectedHashtag();
    window.addEventListener("hashchange", syncSelectedHashtag);
    window.addEventListener("popstate", syncSelectedHashtag);
    window.addEventListener(ROUTE_CHANGE_EVENT, syncSelectedHashtag);

    return () => {
      window.removeEventListener("hashchange", syncSelectedHashtag);
      window.removeEventListener("popstate", syncSelectedHashtag);
      window.removeEventListener(ROUTE_CHANGE_EVENT, syncSelectedHashtag);
    };
  }, []);

  const focusedEntry = useMemo(
    () => entries.find((entry) => entry.id === focusedEntryId) || null,
    [entries, focusedEntryId],
  );
  const focusedEntryPrimaryImage = useMemo(
    () => (focusedEntry ? getKnowledgeEntryImages(focusedEntry)[0] || null : null),
    [focusedEntry],
  );
  const orderedEntries = useMemo(() => {
    const entryMap = new Map(entries.map((entry) => [entry.id, entry] as const));
    const frozenEntries =
      feedEntryOrder.length > 0
        ? feedEntryOrder
            .map((entryId) => entryMap.get(entryId))
            .filter((entry): entry is KnowledgeEntry => Boolean(entry))
        : entries;
    const rankedEntryIds = new Set(frozenEntries.map((entry) => entry.id));
    const missingEntries = entries.filter((entry) => !rankedEntryIds.has(entry.id));
    const baseEntries = [...frozenEntries, ...missingEntries];

    if (
      focusedEntryId &&
      focusedEntry &&
      !rankedEntryIds.has(focusedEntryId)
    ) {
      return [
        focusedEntry,
        ...baseEntries.filter((entry) => entry.id !== focusedEntryId),
      ];
    }

    return baseEntries;
  }, [entries, feedEntryOrder, focusedEntry, focusedEntryId]);
  const visibleEntries = useMemo(() => {
    if (!selectedHashtag) return orderedEntries;

    return orderedEntries.filter((entry) =>
      entry.hashtags.some((tag) => tag.toLowerCase() === selectedHashtag),
    );
  }, [orderedEntries, selectedHashtag]);
  const filteredEntries = useMemo(() => {
    const searchTerms = tokenizeSearch(deferredFeedSearchQuery);
    if (searchTerms.length === 0) return visibleEntries;

    return visibleEntries.filter((entry) =>
      matchesKnowledgeSearch(entry, searchTerms),
    );
  }, [deferredFeedSearchQuery, visibleEntries]);

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

  const resetComposer = () => {
    setDraftTitle("");
    setDraftContent("");
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
      extractInlineHashtags(`${title}\n${content}`),
    );

    setFeedMessage(null);
    setIsModerating(true);

    const { moderateContent } = await import("../utils/contentModeration");
    const moderation = await moderateContent("knowledge-post", {
      title,
      content,
      hashtags: seedHashtags,
    });

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
        hashtags,
        comments: [],
        likes: [],
        mentions,
        images: preparedImages,
        imageLayout: preparedImages.length > 0 ? selectedImageLayout : null,
        imageDataUrl: primaryImage?.dataUrl || null,
        imageMimeType: primaryImage?.mimeType || null,
        imageWidth: primaryImage?.width || null,
        imageHeight: primaryImage?.height || null,
        imageOptimizedAt: primaryImage?.optimizedAt || null,
        createdAt,
        excerpt: createExcerpt(content, 180),
        readingMinutes: estimateReadMinutes(content),
        qualityScore: moderation.knowledgeScore,
      };

      await setDoc(reference, entryPayload);

      const { notifyTaggedUsers } = await import("../utils/notifications");
      await notifyTaggedUsers(
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
      );

      resetComposer();
      setShowComposer(false);
      onOpenEntry(reference.id);
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

  const handleIdentityConfirm = async (username: string) => {
    const { ensureGuestProfile } = await import("../utils/userProfiles");
    const profile = await ensureGuestProfile(username);
    const nextIdentity: KnowledgeIdentity = {
      displayName: profile.username,
      authorId: profile.id,
    };

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
        "../utils/knowledgeImageOptimizer"
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

  const handleImageLayoutChange = (nextLayout: KnowledgeImageLayout) => {
    if (nextLayout === selectedImageLayout) return;

    setSelectedImageLayout(nextLayout);

    if (selectedImages.length > 0) {
      setSelectedImages([]);
      setFeedMessage({
        tone: "warning",
        title: "Image layout changed",
        body: "Add images again so they match the new ratio and layout.",
      });
    }
  };

  const handleRemoveSelectedImage = (indexToRemove: number) => {
    setSelectedImages((current) =>
      current.filter((_, index) => index !== indexToRemove),
    );
  };

  const handleNameConfirm = async (username: string) => {
    if (!pendingAction) return;

    const { ensureGuestProfile } = await import("../utils/userProfiles");
    const profile = await ensureGuestProfile(username);
    onIdentityChange({
      displayName: profile.username,
      authorId: profile.id,
    });

    window.dispatchEvent(
      new CustomEvent("knowledge-action", {
        detail: {
          ...pendingAction,
          username: profile.username,
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

  const handleSelectHashtag = (tag: string) => {
    const normalizedTag = tag.trim().toLowerCase();
    if (!normalizedTag) return;

    navigateToRoute("knowledge", { selectedHashtag: normalizedTag });
  };

  const clearSelectedHashtag = () => {
    navigateToRoute("knowledge");
  };

  const pageTitle = focusedEntry
    ? `${focusedEntry.title} | Readative`
    : selectedHashtag
      ? `#${selectedHashtag} posts | Readative`
      : "Home Feed | Readative";
  const pageDescription = focusedEntry
    ? createExcerpt(focusedEntry.content)
    : selectedHashtag
      ? `Explore Readative knowledge posts tagged #${selectedHashtag}.`
      : "Readative homepage showing only knowledge posts from the community.";
  const pageUrl = focusedEntry
    ? buildAbsoluteRouteUrl("knowledge", { focusedEntryId: focusedEntry.id })
    : selectedHashtag
      ? buildAbsoluteRouteUrl("knowledge", { selectedHashtag })
      : buildAbsoluteRouteUrl("knowledge");
  const hasActiveSearch = feedSearchQuery.trim().length > 0;

  return (
    <div className="pb-20">
      <SEO
        title={pageTitle}
        description={pageDescription}
        keywords={[
          "homepage",
          "knowledge posts",
          "learning feed",
          "readative",
          ...(selectedHashtag ? [selectedHashtag] : []),
        ]}
        type={focusedEntry ? "article" : "website"}
        url={pageUrl}
        schema={buildKnowledgeSchemas(focusedEntry)}
        image={
          focusedEntryPrimaryImage?.dataUrl &&
          !focusedEntryPrimaryImage.dataUrl.startsWith("data:")
            ? focusedEntryPrimaryImage.dataUrl
            : undefined
        }
      />

      {isLoading ? (
        <div className="flex flex-col items-center gap-3 py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="text-sm text-slate-400">Loading posts...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {feedLoadError && (
            <FeedNotice title="Feed loading issue" body={feedLoadError} />
          )}

          {profilesLoadError && (
            <FeedNotice
              title="Profile directory issue"
              body={profilesLoadError}
            />
          )}

          <DiscoverySearch
            theme="emerald"
            placeholder="Search"
            value={feedSearchQuery}
            onChange={setFeedSearchQuery}
            onClear={() => setFeedSearchQuery("")}
            ariaLabel="Search home feed"
          />

          {showRefreshFeedback && (
            <p className="text-center text-xs font-medium text-emerald-700">
              Latest posts refreshed
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
                  onClick={clearSelectedHashtag}
                  className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                  Clear filter
                </button>
              </div>
            </div>
          )}

          {filteredEntries.length === 0 ? (
            <div className="rounded-[30px] border border-dashed border-slate-300 bg-white px-6 py-20 text-center shadow-sm">
              <BookOpenText className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-4 text-xl font-black text-slate-900">
                {hasActiveSearch
                  ? `No posts matched "${feedSearchQuery.trim()}"`
                  : selectedHashtag
                    ? `No posts for #${selectedHashtag}`
                    : "No posts yet"}
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                {hasActiveSearch
                  ? "Try a broader keyword, another hashtag, or search by @username."
                  : selectedHashtag
                    ? "Try another hashtag or clear this filter to explore the full feed."
                    : "Tap the `+` button at the top to upload the first knowledge post."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEntries.map((entry) => (
                <KnowledgeCard
                  key={entry.id}
                  entry={entry}
                  profiles={profiles}
                  onVisible={markKnowledgeEntrySeen}
                  onIdentityRequired={(action) => setPendingAction(action)}
                  onOpenProfile={onOpenProfile}
                  onOpenEntry={onOpenEntry}
                  onSelectHashtag={handleSelectHashtag}
                  highlighted={entry.id === focusedEntryId}
                />
              ))}
            </div>
          )}
        </div>
      )}

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
          hashtagInput={hashtagInput}
          setHashtagInput={setHashtagInput}
          selectedImages={selectedImages}
          selectedImageLayout={selectedImageLayout}
          onImageLayoutChange={handleImageLayoutChange}
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
        <IdentityPrompt
          title="Choose your posting username"
          description="Set your username once and Readative will remember it on this browser for posts, likes, comments, mentions, and notifications."
          submitLabel="Continue"
          initialValue={identity?.displayName || guestName || ""}
          onConfirm={handleIdentityConfirm}
          onClose={() => {
            setPublishAfterAccess(false);
            setShowIdentityPrompt(false);
          }}
        />
      )}

      {pendingAction && (
        <UsernamePrompt
          action={pendingAction.type}
          initialValue={identity?.displayName || guestName || ""}
          onConfirm={handleNameConfirm}
          onClose={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}

function ComposerModal({
  identity,
  onOpenProfile,
  onClose,
  draftTitle,
  setDraftTitle,
  draftContent,
  setDraftContent,
  hashtagInput,
  setHashtagInput,
  selectedImages,
  selectedImageLayout,
  onImageLayoutChange,
  onRemoveSelectedImage,
  isPosting,
  isModerating,
  isPreparingImage,
  feedMessage,
  handlePublish,
  handleImageSelected,
  contentRef,
  activeMention,
  filteredMentionProfiles,
  handleMentionInsert,
  handleContentKeyUp,
  updateMentionState,
}: {
  identity: KnowledgeIdentity | null;
  onOpenProfile: (authorId: string) => void;
  onClose: () => void;
  draftTitle: string;
  setDraftTitle: (value: string) => void;
  draftContent: string;
  setDraftContent: (value: string) => void;
  hashtagInput: string;
  setHashtagInput: (value: string) => void;
  selectedImages: SelectedImage[];
  selectedImageLayout: KnowledgeImageLayout;
  onImageLayoutChange: (layout: KnowledgeImageLayout) => void;
  onRemoveSelectedImage: (index: number) => void;
  isPosting: boolean;
  isModerating: boolean;
  isPreparingImage: boolean;
  feedMessage: FeedMessage | null;
  handlePublish: () => void;
  handleImageSelected: (event: ChangeEvent<HTMLInputElement>) => void;
  contentRef: RefObject<HTMLTextAreaElement | null>;
  activeMention: MentionState | null;
  filteredMentionProfiles: UserProfile[];
  handleMentionInsert: (profile: UserProfile) => void;
  handleContentKeyUp: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  updateMentionState: (value: string, cursorPosition: number) => void;
}) {
  const selectedImageLayoutSettings =
    getKnowledgeImageLayoutSettings(selectedImageLayout);

  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 pt-20 backdrop-blur-sm">
      <div className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-[32px] border border-white/60 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.22)] md:max-h-[calc(100vh-6rem)]">
        <div className="shrink-0 bg-gradient-to-r from-slate-950 via-emerald-900 to-teal-700 px-6 py-6 text-white">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>

          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-200">
            Upload Post
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight">
            Create a knowledge post
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-emerald-50">
            Add your full post details here. Homepage stays clean and shows only
            posts, while the `+` button opens everything needed to publish.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-5 p-6">
            {identity ? (
              <div className="flex flex-col gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">
                    Posting as @{identity.displayName}
                  </p>
                  <p className="text-xs text-emerald-700">
                    Remembered on this device for all your activity.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-xs font-bold uppercase tracking-[0.18em]">
                  <button
                    onClick={() => onOpenProfile(identity.authorId)}
                    className="underline underline-offset-2"
                  >
                    View profile
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                Choose your username once when you publish. We will remember it
                after that.
              </div>
            )}

            <div className="grid gap-4">
              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder="Post title"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-lg font-bold text-slate-900 outline-none transition-all focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-200"
              />

              <div className="relative">
                <textarea
                  ref={contentRef}
                  value={draftContent}
                  onChange={(event) => {
                    setDraftContent(event.target.value);
                    updateMentionState(
                      event.target.value,
                      event.target.selectionStart,
                    );
                  }}
                  onKeyUp={handleContentKeyUp}
                  onClick={(event) =>
                    updateMentionState(
                      event.currentTarget.value,
                      event.currentTarget.selectionStart,
                    )
                  }
                  placeholder="Write the full post here. Share useful knowledge only, and tag users with @username."
                  className="min-h-[220px] w-full resize-none rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-[15px] leading-7 text-slate-700 outline-none transition-all focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-200"
                />

                {activeMention && filteredMentionProfiles.length > 0 && (
                  <div className="absolute left-4 right-4 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                    {filteredMentionProfiles.map((profile) => (
                      <button
                        key={profile.id}
                        onClick={() => handleMentionInsert(profile)}
                        className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left text-sm last:border-b-0 hover:bg-emerald-50"
                      >
                        <span className="font-semibold text-slate-800">
                          @{profile.username}
                        </span>
                        <span className="text-xs text-slate-400">User</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-[1.2fr,1fr]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                    <Tag className="h-4 w-4" />
                    Hashtags
                  </div>
                  <input
                    value={hashtagInput}
                    onChange={(event) => setHashtagInput(event.target.value)}
                    placeholder="#science #history #productivity"
                    className="w-full bg-transparent text-sm text-slate-700 outline-none"
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                        Images
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {selectedImages.length}/{selectedImageLayoutSettings.maxImages} selected
                      </p>
                    </div>

                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-emerald-300 bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 transition-colors hover:bg-emerald-50">
                      <ImagePlus className="h-4 w-4" />
                      Add
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageSelected}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(
                      [
                        ["wide", "2 x 16:9"],
                        ["portrait", "4 x 8:9"],
                      ] as const
                    ).map(([layout, label]) => (
                      <button
                        key={layout}
                        onClick={() => onImageLayoutChange(layout)}
                        className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] transition-colors ${
                          selectedImageLayout === layout
                            ? "bg-emerald-600 text-white"
                            : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-emerald-50 hover:text-emerald-700"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    {selectedImageLayoutSettings.description}. Images are auto-cropped to this ratio.
                  </p>
                </div>
              </div>

              {selectedImages.length > 0 && (
                <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
                  <KnowledgeImageCarousel
                    images={selectedImages}
                    layout={selectedImageLayout}
                    altBase="Selected post image"
                    mode="composer"
                    renderOverlayAction={(_, index) => (
                      <button
                        onClick={() => onRemoveSelectedImage(index)}
                        className="rounded-full bg-slate-950/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-md transition-colors hover:bg-rose-500"
                      >
                        Remove
                      </button>
                    )}
                  />
                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
                    <p className="text-sm text-slate-500">
                      Swipe to preview. Add up to {selectedImageLayoutSettings.maxImages} images in this layout.
                    </p>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                      {selectedImages.length} ready
                    </span>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  Knowledge only
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  No sexual content
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  <AtSign className="mr-1 inline h-3 w-3" />
                  Mention with @username
                </span>
              </div>

              {feedMessage && (
                <div
                  className={`rounded-3xl border px-4 py-4 text-sm ${
                    feedMessage.tone === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  <p className="font-bold">{feedMessage.title}</p>
                  <p className="mt-1 leading-6">{feedMessage.body}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Scroll inside this window to see image upload and all post
              details.
            </p>

            <button
              onClick={handlePublish}
              disabled={
                isPosting ||
                isModerating ||
                isPreparingImage ||
                !draftTitle.trim() ||
                !draftContent.trim()
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-700 disabled:opacity-50 sm:w-auto"
            >
              {isPosting || isModerating || isPreparingImage ? (
                <Sparkles className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isModerating ? "Checking..." : "Publish post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeedNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 shadow-sm">
      <p className="font-bold">{title}</p>
      <p className="mt-1 leading-6">{body}</p>
    </div>
  );
}
