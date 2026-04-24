import {
  type ChangeEvent,
  type KeyboardEvent,
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
  Sparkles,
  Tag,
} from "lucide-react";
import { addDoc, collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { KnowledgeEntry, TaggedUser, UserProfile } from "../types";
import { SEO } from "./SEO";
import { EmailAccessPrompt, UsernamePrompt } from "./Auth";
import { KnowledgeCard } from "./KnowledgeCard";
import { geminiService } from "../services/gemini";
import {
  clearKnowledgeIdentity,
  type KnowledgeIdentity,
} from "../utils/knowledgeIdentity";
import { getGuestName } from "../utils/guestIdentity";
import { ensureSignedInProfile } from "../utils/userProfiles";
import { notifyTaggedUsers } from "../utils/notifications";

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

interface KnowledgeFeedProps {
  identity: KnowledgeIdentity | null;
  onIdentityChange: (identity: KnowledgeIdentity | null) => void;
  onOpenProfile: (authorId: string) => void;
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

export function KnowledgeFeed({
  identity,
  onIdentityChange,
  onOpenProfile,
}: KnowledgeFeedProps) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
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

  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const guestName = getGuestName();

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

  const filteredEntries = entries
    .filter((entry) => {
      if (!searchTerm.trim()) return true;

      const haystack = [
        entry.title,
        entry.content,
        entry.author,
        ...entry.hashtags,
        ...(entry.mentions || []).map((mention) => mention.username),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(searchTerm.trim().toLowerCase());
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

  const filteredMentionProfiles = useMemo(() => {
    if (!activeMention) return [];

    return profiles
      .filter((profile) =>
        profile.usernameLower.startsWith(activeMention.query.toLowerCase())
      )
      .slice(0, 6);
  }, [activeMention, profiles]);

  const totalLikes = entries.reduce(
    (sum, entry) => sum + (entry.likes?.length || 0),
    0
  );
  const topHashtags = [
    ...new Set(entries.flatMap((entry) => entry.hashtags || [])),
  ].slice(0, 4);

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

    setIsPosting(true);

    try {
      let hashtags = mergeHashtags(
        parseManualHashtags(hashtagInput),
        extractInlineHashtags(`${title}\n${content}`)
      );

      if (hashtags.length === 0) {
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
    } catch (error) {
      console.error("Failed to publish knowledge:", error);
      alert("Could not publish this knowledge entry. Please try again.");
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

  return (
    <div className="space-y-6 pb-20">
      <SEO
        title="Knowledge Hub | Readative"
        description="Share practical knowledge, visuals, and ideas with the Readative community."
        keywords={["knowledge", "learning", "insights", "community"]}
      />

      <section className="overflow-hidden rounded-[32px] bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.3),_transparent_35%),linear-gradient(135deg,#0f172a_0%,#134e4a_45%,#0f766e_100%)] p-7 text-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-50">
              <Sparkles className="h-3.5 w-3.5" />
              Knowledge Hub
            </div>
            <h1 className="max-w-lg text-4xl font-black leading-tight tracking-tight text-white">
              Turn the home feed into a smarter place to teach what you know.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/90">
              Publish insights with a title, text, hashtags, images, and
              `@username` mentions. Profiles and notifications update live.
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
              Share something worth learning
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Use a strong title, explain the idea clearly, tag topics with
              hashtags, and mention people directly with `@username`.
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

        <div className="mt-6 grid gap-4">
          <input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            placeholder="Title your knowledge drop"
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
                onChange={(event) => setHashtagInput(event.target.value)}
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
                isPreparingImage ||
                !draftTitle.trim() ||
                !draftContent.trim()
              }
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
            >
              {isPosting || isPreparingImage ? (
                <Sparkles className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Publish Knowledge
            </button>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_48px_rgba(15,23,42,0.05)] md:flex-row md:items-center md:justify-between">
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
      </section>

      {isLoading ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="h-8 w-8 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-400">Loading knowledge...</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="rounded-[30px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
          <BookOpenText className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-4 text-xl font-black text-slate-900">
            No knowledge shared yet
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Publish the first insight or adjust your search to discover more.
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
