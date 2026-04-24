import {
  type ChangeEvent,
  type KeyboardEvent,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence } from "motion/react";
import {
  AtSign,
  BookOpenText,
  ImagePlus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  TrendingUp,
} from "lucide-react";
import { addDoc, collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { KnowledgeEntry, TaggedUser, UserProfile } from "../types";
import { SEO } from "./SEO";
import { EmailAccessPrompt, UsernamePrompt } from "./Auth";
import { KnowledgeCard } from "./KnowledgeCard";
import {
  clearKnowledgeIdentity,
  type KnowledgeIdentity,
} from "../utils/knowledgeIdentity";
import { getGuestName } from "../utils/guestIdentity";
import { ensureSignedInProfile } from "../utils/userProfiles";
import { notifyTaggedUsers } from "../utils/notifications";
import { moderateContent } from "../utils/contentModeration";

type PendingAction =
  | { type: "like" | "comment"; entryId: string }
  | null;

type SortMode = "latest" | "popular";

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
    name: "Readative Knowledge Hub",
    url: baseUrl,
    description:
      "A knowledge-first community where people publish practical insights, examples, visual explainers, and learning notes.",
    isPartOf: {
      "@type": "WebSite",
      name: "Readative",
      url: origin,
    },
    about: ["Knowledge sharing", "Learning", "Community publishing"],
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
}: KnowledgeFeedProps) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [isModerating, setIsModerating] = useState(false);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [publishAfterAccess, setPublishAfterAccess] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [searchTerm, setSearchTerm] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [hashtagInput, setHashtagInput] = useState("");
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [activeMention, setActiveMention] = useState<MentionState | null>(null);
  const [feedMessage, setFeedMessage] = useState<FeedMessage | null>(null);

  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const guestName = getGuestName();
  const deferredSearchTerm = useDeferredValue(searchTerm);

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

  const focusedEntry = useMemo(
    () => entries.find((entry) => entry.id === focusedEntryId) || null,
    [entries, focusedEntryId]
  );

  const filteredEntries = useMemo(() => {
    const normalizedSearch = deferredSearchTerm.trim().toLowerCase();

    return [...entries]
      .filter((entry) => {
        if (!normalizedSearch) return true;

        const haystack = [
          entry.title,
          entry.content,
          entry.author,
          ...entry.hashtags,
          ...(entry.mentions || []).map((mention) => mention.username),
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedSearch);
      })
      .sort((left, right) => {
        if (sortMode === "popular") {
          const rightScore =
            (right.likes?.length || 0) * 3 + (right.comments?.length || 0);
          const leftScore =
            (left.likes?.length || 0) * 3 + (left.comments?.length || 0);
          return rightScore - leftScore || right.createdAt - left.createdAt;
        }

        return right.createdAt - left.createdAt;
      });
  }, [deferredSearchTerm, entries, sortMode]);

  const filteredMentionProfiles = useMemo(() => {
    if (!activeMention) return [];

    return profiles
      .filter((profile) =>
        profile.usernameLower.startsWith(activeMention.query.toLowerCase())
      )
      .slice(0, 6);
  }, [activeMention, profiles]);

  const totalLikes = useMemo(
    () => entries.reduce((sum, entry) => sum + (entry.likes?.length || 0), 0),
    [entries]
  );

  const topHashtags = useMemo(() => {
    const counts = new Map<string, number>();

    entries.forEach((entry) => {
      (entry.hashtags || []).forEach((tag) => {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      });
    });

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 6)
      .map(([tag]) => tag);
  }, [entries]);

  useEffect(() => {
    if (!focusedEntryId || entries.length === 0) return;

    const target = document.getElementById(`knowledge-${focusedEntryId}`);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [entries.length, focusedEntryId]);

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
        title: "Not ready to publish",
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
        authorEmail: currentIdentity.email,
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

      setDraftTitle("");
      setDraftContent("");
      setHashtagInput("");
      setSelectedImage(null);
      setActiveMention(null);
      setSearchTerm("");
      setFeedMessage({
        tone: "success",
        title: "Knowledge published",
        body: "Your post is live, shareable, and now part of the knowledge feed.",
      });
      onOpenEntry(reference.id);
    } catch (error) {
      console.error("Failed to publish knowledge:", error);
      setFeedMessage({
        tone: "warning",
        title: "Publish failed",
        body: "Could not publish this knowledge entry. Please try again.",
      });
    } finally {
      setIsPosting(false);
    }
  };

  const handlePublish = () => {
    if (!draftTitle.trim() || !draftContent.trim()) return;

    if (!identity) {
      setPublishAfterAccess(true);
      setShowEmailPrompt(true);
      return;
    }

    void publishKnowledge(identity);
  };

  const handleEmailConfirm = async (email: string, username: string) => {
    try {
      const profile = await ensureSignedInProfile(email, username);
      const nextIdentity: KnowledgeIdentity = {
        email: profile.email,
        displayName: profile.username,
        authorId: profile.id,
      };

      onIdentityChange(nextIdentity);
      setShowEmailPrompt(false);

      if (publishAfterAccess && draftTitle.trim() && draftContent.trim()) {
        setPublishAfterAccess(false);
        void publishKnowledge(nextIdentity);
        return;
      }

      setPublishAfterAccess(false);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not sign you in right now."
      );
    }
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

  const handleNameConfirm = (username: string) => {
    if (!pendingAction) return;

    window.dispatchEvent(
      new CustomEvent("knowledge-action", {
        detail: {
          ...pendingAction,
          username,
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
    : "Knowledge Hub | Readative";
  const pageDescription = focusedEntry
    ? createExcerpt(focusedEntry.content)
    : "Readative is a knowledge-first publishing community for practical insights, visual explainers, and thoughtful learning notes.";
  const pageUrl =
    typeof window === "undefined"
      ? "https://readative.com/#knowledge"
      : `${window.location.origin}${window.location.pathname}${
          focusedEntry ? `#knowledge/${focusedEntry.id}` : "#knowledge"
        }`;

  return (
    <div className="space-y-6 pb-20">
      <SEO
        title={pageTitle}
        description={pageDescription}
        keywords={[
          "knowledge sharing",
          "learning community",
          "educational posts",
          "insights",
          "readative",
        ]}
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

      <section className="overflow-hidden rounded-[32px] bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.32),_transparent_35%),linear-gradient(135deg,#0f172a_0%,#134e4a_45%,#0f766e_100%)] p-7 text-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-50">
              <ShieldCheck className="h-3.5 w-3.5" />
              Knowledge-Only Network
            </div>
            <h1 className="max-w-lg text-4xl font-black leading-tight tracking-tight text-white">
              Publish knowledge that deserves to spread.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/90">
              Readative is now tuned for practical ideas, visual explainers,
              and useful learning notes. Off-topic, sexual, and low-value posts
              are filtered before they go live.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 md:min-w-[280px]">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
              <p className="text-2xl font-black">{entries.length}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-emerald-50/80">
                Insights
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
              <p className="text-2xl font-black">{totalLikes}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-emerald-50/80">
                Likes
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
              <p className="truncate text-sm font-black">
                {topHashtags[0] ? `#${topHashtags[0]}` : "Fresh"}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-emerald-50/80">
                Trending
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-500">
              Publish Knowledge
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              Share something people can actually learn from
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Use a strong title, explain the idea clearly, add topic hashtags,
              and mention people directly with `@username`.
            </p>
          </div>

          {identity ? (
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <p className="font-semibold">Sharing as @{identity.displayName}</p>
              <p className="text-xs text-emerald-600">{identity.email}</p>
              <div className="mt-2 flex gap-3 text-xs font-bold uppercase tracking-[0.18em]">
                <button
                  onClick={() => onOpenProfile(identity.authorId)}
                  className="underline underline-offset-2"
                >
                  View profile
                </button>
                <button
                  onClick={() => {
                    clearKnowledgeIdentity();
                    onIdentityChange(null);
                  }}
                  className="underline underline-offset-2"
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                setPublishAfterAccess(false);
                setShowEmailPrompt(true);
              }}
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 transition-colors hover:border-emerald-300"
            >
              Sign in / Sign up with email
            </button>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-slate-100 px-3 py-1">
            Knowledge only
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1">
            No sexual content
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1">
            No promos or follower bait
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1">
            Teach with examples or takeaways
          </span>
        </div>

        {feedMessage && (
          <div
            className={`mt-5 rounded-3xl border px-4 py-4 text-sm ${
              feedMessage.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            <p className="font-bold">{feedMessage.title}</p>
            <p className="mt-1 leading-6">{feedMessage.body}</p>
          </div>
        )}

        <div className="mt-6 grid gap-4">
          <input
            value={draftTitle}
            onChange={(event) => {
              setDraftTitle(event.target.value);
              if (feedMessage) setFeedMessage(null);
            }}
            placeholder="Title your knowledge drop"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-lg font-bold text-slate-900 outline-none transition-all focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-200"
          />

          <div className="relative">
            <textarea
              ref={contentRef}
              value={draftContent}
              onChange={(event) => {
                setDraftContent(event.target.value);
                if (feedMessage) setFeedMessage(null);
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
              placeholder="Explain what people should learn, why it matters, and how they can use it. Mention people with @username."
              className="min-h-[180px] w-full resize-none rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-[15px] leading-7 text-slate-700 outline-none transition-all focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-200"
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
                    <span className="text-xs text-slate-400">
                      {profile.id === identity?.authorId ? "You" : "User"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-[1.3fr,1fr]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                <Tag className="h-4 w-4" />
                Hashtags
              </div>
              <input
                value={hashtagInput}
                onChange={(event) => {
                  setHashtagInput(event.target.value);
                  if (feedMessage) setFeedMessage(null);
                }}
                placeholder="#productivity #history #science"
                className="w-full bg-transparent text-sm text-slate-700 outline-none"
              />
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 transition-colors hover:border-emerald-300 hover:bg-emerald-50/40">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                  Image
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedImage?.fileName || "Upload a supporting image"}
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

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2 text-xs text-slate-400">
              <span className="rounded-full bg-slate-100 px-3 py-1">
                Title + text required
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1">
                Image optional
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1">
                {guestName
                  ? `Guest reactions as @${guestName}`
                  : "Name prompt for likes/comments"}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1">
                <AtSign className="mr-1 inline h-3 w-3" />
                Tag with @username
              </span>
            </div>

            <button
              onClick={handlePublish}
              disabled={
                isPosting ||
                isModerating ||
                isPreparingImage ||
                !draftTitle.trim() ||
                !draftContent.trim()
              }
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
            >
              {isPosting || isModerating || isPreparingImage ? (
                <Sparkles className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isModerating ? "Checking quality..." : "Publish Knowledge"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_48px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search titles, authors, content, mentions, or hashtags"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition-all focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-200"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setSortMode("latest")}
              className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition-all ${
                sortMode === "latest"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              Latest
            </button>
            <button
              onClick={() => setSortMode("popular")}
              className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition-all ${
                sortMode === "popular"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              Most Loved
            </button>
          </div>
        </div>

        {topHashtags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              <TrendingUp className="h-3.5 w-3.5" />
              Trending
            </span>
            {topHashtags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSearchTerm(tag)}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100"
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </section>

      {focusedEntry && (
        <section className="rounded-[28px] border border-emerald-200 bg-emerald-50/80 p-5 text-sm text-emerald-800 shadow-sm">
          <p className="font-bold">Shared link opened</p>
          <p className="mt-1 leading-6">
            You are viewing a direct link to "{focusedEntry.title}". Use share on
            any card to send people straight to one knowledge post.
          </p>
        </section>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="text-sm text-slate-400">Loading knowledge...</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="rounded-[30px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
          <BookOpenText className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-4 text-xl font-black text-slate-900">
            {searchTerm.trim() ? "No matching knowledge found" : "No knowledge shared yet"}
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            {searchTerm.trim()
              ? "Try a different keyword or click a trending hashtag."
              : "Publish the first insight or adjust your search to discover more."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {filteredEntries.map((entry) => (
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
        {showEmailPrompt && (
          <EmailAccessPrompt
            initialEmail={identity?.email}
            initialDisplayName={identity?.displayName}
            onConfirm={(email, username) => {
              void handleEmailConfirm(email, username);
            }}
            onClose={() => {
              setPublishAfterAccess(false);
              setShowEmailPrompt(false);
            }}
          />
        )}

        {pendingAction && (
          <UsernamePrompt
            action={pendingAction.type}
            initialValue={guestName || ""}
            onConfirm={handleNameConfirm}
            onClose={() => setPendingAction(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
