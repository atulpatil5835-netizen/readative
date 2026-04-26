import {
  type ChangeEvent,
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AtSign,
  Bell,
  BookOpenText,
  Heart,
  ImagePlus,
  MessageCircle,
  Send,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { KnowledgeEntry, TaggedUser, UserNotification, UserProfile } from "../types";
import { SEO } from "./SEO";
import { IdentityPrompt, UsernamePrompt } from "./Auth";
import { KnowledgeCard } from "./KnowledgeCard";
import {
  type KnowledgeIdentity,
} from "../utils/knowledgeIdentity";
import { getGuestName } from "../utils/guestIdentity";
import {
  markNotificationAsRead,
  markNotificationsAsRead,
  notifyTaggedUsers,
} from "../utils/notifications";
import { moderateContent } from "../utils/contentModeration";
import { ensureGuestProfile } from "../utils/userProfiles";

type PendingAction =
  | { type: "like" | "comment"; entryId: string }
  | null;

interface SelectedImage {
  dataUrl: string;
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
    match[1].toLowerCase()
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
        match[1].toLowerCase()
      )
    ),
  ];
}

function resolveMentions(text: string, profiles: UserProfile[]): TaggedUser[] {
  const profileMap = new Map(
    profiles.map((profile) => [profile.usernameLower, profile] as const)
  );

  return extractMentionKeys(text)
    .map((usernameLower) => profileMap.get(usernameLower))
    .filter((profile): profile is UserProfile => Boolean(profile))
    .map((profile) => ({
      authorId: profile.id,
      username: profile.username,
    }));
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load selected image."));
    image.src = source;
  });
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

async function optimizeImage(file: File): Promise<string> {
  const rawDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(rawDataUrl);

  const maxDimension = 1400;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare the image canvas.");

  context.drawImage(image, 0, 0, width, height);

  let dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  if (dataUrl.length > 850000) {
    dataUrl = canvas.toDataURL("image/jpeg", 0.68);
  }

  if (dataUrl.length > 950000) {
    throw new Error("Image is too large. Please choose a smaller image.");
  }

  return dataUrl;
}

function buildKnowledgeSchemas(entry: KnowledgeEntry | null) {
  const origin =
    typeof window === "undefined" ? "https://readative.com" : window.location.origin;
  const pathname = typeof window === "undefined" ? "/" : window.location.pathname;
  const baseUrl = `${origin}/#knowledge`;

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
      mainEntityOfPage: `${origin}${pathname}#knowledge/${entry.id}`,
      image:
        entry.imageDataUrl && !entry.imageDataUrl.startsWith("data:")
          ? [entry.imageDataUrl]
          : undefined,
    },
  ];
}

export function KnowledgeFeed({
  identity,
  onIdentityChange,
  onOpenProfile,
  focusedEntryId,
  onOpenEntry,
  composerOpenSignal,
}: KnowledgeFeedProps) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [activeMention, setActiveMention] = useState<MentionState | null>(null);
  const [feedMessage, setFeedMessage] = useState<FeedMessage | null>(null);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);

  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const guestName = getGuestName();

  useEffect(() => {
    if (composerOpenSignal > 0) {
      setShowComposer(true);
      setFeedMessage(null);
    }
  }, [composerOpenSignal]);

  useEffect(() => {
    const knowledgeQuery = query(
      collection(db, "knowledge"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      knowledgeQuery,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
          createdAt:
            item.data().createdAt?.toMillis?.() ||
            item.data().createdAt ||
            Date.now(),
        })) as KnowledgeEntry[];

        setEntries(data);
        setIsLoading(false);
      },
      (error) => {
        console.error("Knowledge feed error:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const profilesQuery = query(
      collection(db, "userProfiles"),
      orderBy("usernameLower", "asc")
    );

    const unsubscribe = onSnapshot(profilesQuery, (snapshot) => {
      const data = snapshot.docs.map((item) => ({
        ...(item.data() as UserProfile),
        id: item.id,
      }));

      setProfiles(data);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!focusedEntryId || entries.length === 0) return;

    const target = document.getElementById(`knowledge-${focusedEntryId}`);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [entries.length, focusedEntryId]);

  useEffect(() => {
    if (!identity?.authorId) {
      setNotifications([]);
      return;
    }

    const notificationsQuery = query(
      collection(db, "notifications"),
      where("targetAuthorId", "==", identity.authorId)
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const data = snapshot.docs
        .map((item) => ({
          id: item.id,
          ...(item.data() as UserNotification),
          createdAt:
            (item.data() as UserNotification).createdAt || Date.now(),
        }))
        .sort((left, right) => right.createdAt - left.createdAt);

      setNotifications(data);
    });

    return () => unsubscribe();
  }, [identity?.authorId]);

  const focusedEntry = useMemo(
    () => entries.find((entry) => entry.id === focusedEntryId) || null,
    [entries, focusedEntryId]
  );

  const orderedEntries = useMemo(
    () => [...entries].sort((left, right) => right.createdAt - left.createdAt),
    [entries]
  );
  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.read),
    [notifications]
  );

  const filteredMentionProfiles = useMemo(() => {
    if (!activeMention) return [];

    return profiles
      .filter((profile) =>
        profile.usernameLower.startsWith(activeMention.query.toLowerCase())
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
    setSelectedImage(null);
    setActiveMention(null);
    setFeedMessage(null);
  };

  const publishKnowledge = async (currentIdentity: KnowledgeIdentity) => {
    const title = draftTitle.trim();
    const content = draftContent.trim();
    if (!title || !content) return;

    const seedHashtags = mergeHashtags(
      parseManualHashtags(hashtagInput),
      extractInlineHashtags(`${title}\n${content}`)
    );

    setFeedMessage(null);
    setIsModerating(true);

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
        body: [moderation.message, ...moderation.suggestions].slice(0, 2).join(" "),
      });
      return;
    }

    setIsModerating(false);
    setIsPosting(true);

    try {
      let hashtags = seedHashtags;

      if (hashtags.length === 0) {
        const { geminiService } = await import("../services/gemini");
        hashtags = await geminiService.generateHashtags(`${title}\n${content}`);
      }

      const mentions = resolveMentions(`${title}\n${content}`, profiles);
      const createdAt = Date.now();
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
        imageDataUrl: selectedImage?.dataUrl || null,
        createdAt,
        excerpt: createExcerpt(content, 180),
        readingMinutes: estimateReadMinutes(content),
        qualityScore: moderation.knowledgeScore,
      };

      const reference = await addDoc(collection(db, "knowledge"), entryPayload);

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
        mentions
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
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      return;
    }

    setFeedMessage(null);
    setIsPreparingImage(true);

    try {
      const dataUrl = await optimizeImage(file);
      setSelectedImage({
        dataUrl,
        fileName: file.name,
      });
    } catch (error) {
      console.error("Image preparation failed:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Could not prepare the image."
      );
    } finally {
      setIsPreparingImage(false);
      event.target.value = "";
    }
  };

  const handleNameConfirm = async (username: string) => {
    if (!pendingAction) return;

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
      })
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
    updateMentionState(event.currentTarget.value, event.currentTarget.selectionStart);
  };

  const pageTitle = focusedEntry
    ? `${focusedEntry.title} | Readative`
    : "Home Feed | Readative";
  const pageDescription = focusedEntry
    ? createExcerpt(focusedEntry.content)
    : "Readative homepage showing only knowledge posts from the community.";
  const pageUrl =
    typeof window === "undefined"
      ? "https://readative.com/#knowledge"
      : `${window.location.origin}${window.location.pathname}${
          focusedEntry ? `#knowledge/${focusedEntry.id}` : "#knowledge"
        }`;

  return (
    <div className="pb-20">
      <SEO
        title={pageTitle}
        description={pageDescription}
        keywords={["homepage", "knowledge posts", "learning feed", "readative"]}
        type={focusedEntry ? "article" : "website"}
        url={pageUrl}
        schema={buildKnowledgeSchemas(focusedEntry)}
        image={
          focusedEntry?.imageDataUrl &&
          !focusedEntry.imageDataUrl.startsWith("data:")
            ? focusedEntry.imageDataUrl
            : undefined
        }
      />

      {identity && (
        <HomeActivityPanel
          identity={identity}
          notifications={notifications}
          unreadCount={unreadNotifications.length}
          onOpenProfile={onOpenProfile}
          onOpenEntry={onOpenEntry}
        />
      )}

      {isLoading ? (
        <div className="flex flex-col items-center gap-3 py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="text-sm text-slate-400">Loading posts...</p>
        </div>
      ) : orderedEntries.length === 0 ? (
        <div className="rounded-[30px] border border-dashed border-slate-300 bg-white px-6 py-20 text-center shadow-sm">
          <BookOpenText className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-4 text-xl font-black text-slate-900">
            No posts yet
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Tap the `+` button at the top to upload the first knowledge post.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {orderedEntries.map((entry) => (
              <KnowledgeCard
                key={entry.id}
                entry={entry}
                onIdentityRequired={(action) => setPendingAction(action)}
                onOpenProfile={onOpenProfile}
                onOpenEntry={onOpenEntry}
                highlighted={entry.id === focusedEntryId}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
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
            selectedImage={selectedImage}
            setSelectedImage={setSelectedImage}
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
      </AnimatePresence>
    </div>
  );
}

function HomeActivityPanel({
  identity,
  notifications,
  unreadCount,
  onOpenProfile,
  onOpenEntry,
}: {
  identity: KnowledgeIdentity;
  notifications: UserNotification[];
  unreadCount: number;
  onOpenProfile: (authorId: string) => void;
  onOpenEntry: (entryId: string) => void;
}) {
  const recentNotifications = notifications.slice(0, 4);

  const openNotification = async (notification: UserNotification) => {
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
    }

    onOpenEntry(notification.entryId);
  };

  return (
    <section className="mb-6 overflow-hidden rounded-[30px] border border-emerald-200/70 bg-gradient-to-br from-white via-emerald-50/70 to-teal-50 shadow-[0_20px_60px_rgba(16,185,129,0.08)]">
      <div className="flex flex-col gap-4 border-b border-emerald-100 px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">
            Live Activity
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            @{identity.displayName}, everything happening around you is here.
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            <Bell className="h-4 w-4 text-emerald-600" />
            {unreadCount === 0 ? "All caught up" : `${unreadCount} unread`}
          </div>
          <button
            onClick={() => void markNotificationsAsRead(notifications.map((item) => item.id))}
            disabled={notifications.length === 0 || unreadCount === 0}
            className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-40"
          >
            Mark all read
          </button>
        </div>
      </div>

      {recentNotifications.length === 0 ? (
        <div className="px-6 py-8 text-sm text-slate-500">
          Likes, comments, and tags on your knowledge will appear here in realtime.
        </div>
      ) : (
        <div className="divide-y divide-emerald-100/80">
          {recentNotifications.map((notification) => (
            <div
              key={notification.id}
              className="flex items-start justify-between gap-4 px-6 py-4 transition-colors hover:bg-white/70"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-1 rounded-2xl p-2 ${
                    notification.type === "like"
                      ? "bg-rose-100 text-rose-600"
                      : notification.type === "comment"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-cyan-100 text-cyan-700"
                  }`}
                >
                  {notification.type === "like" ? (
                    <Heart className="h-4 w-4" />
                  ) : notification.type === "comment" ? (
                    <MessageCircle className="h-4 w-4" />
                  ) : (
                    <AtSign className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenProfile(notification.actorAuthorId);
                      }}
                      className="text-sm font-bold text-slate-900 transition-colors hover:text-emerald-700"
                    >
                      @{notification.actorUsername}
                    </button>
                    {!notification.read && (
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                        New
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {notification.preview}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <button
                onClick={() => void openNotification(notification)}
                className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 transition-colors hover:bg-emerald-50"
              >
                Open
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
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
  selectedImage,
  setSelectedImage,
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
  selectedImage: SelectedImage | null;
  setSelectedImage: (value: SelectedImage | null) => void;
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
  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 pt-20 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-[32px] border border-white/60 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.22)] md:max-h-[calc(100vh-6rem)]"
      >
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
                  <p className="font-semibold">Posting as @{identity.displayName}</p>
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
                Choose your username once when you publish. We will remember it after that.
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
                      event.target.selectionStart
                    );
                  }}
                  onKeyUp={handleContentKeyUp}
                  onClick={(event) =>
                    updateMentionState(
                      event.currentTarget.value,
                      event.currentTarget.selectionStart
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

                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 transition-colors hover:border-emerald-300 hover:bg-emerald-50/40">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                      Image
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {selectedImage?.fileName || "Upload post image"}
                    </p>
                  </div>
                  <ImagePlus className="h-5 w-5 text-emerald-600" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelected}
                    className="hidden"
                  />
                </label>
              </div>

              {selectedImage && (
                <div className="overflow-hidden rounded-[28px] border border-slate-200">
                  <img
                    src={selectedImage.dataUrl}
                    alt={selectedImage.fileName}
                    decoding="async"
                    className="h-64 w-full object-cover"
                  />
                  <div className="flex items-center justify-between bg-white px-4 py-3">
                    <p className="text-sm text-slate-500">{selectedImage.fileName}</p>
                    <button
                      onClick={() => setSelectedImage(null)}
                      className="text-xs font-bold uppercase tracking-[0.18em] text-rose-500"
                    >
                      Remove
                    </button>
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
              Scroll inside this window to see image upload and all post details.
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
      </motion.div>
    </div>
  );
}
