import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpenText,
  Check,
  Clock3,
  Heart,
  ImagePlus,
  Instagram,
  Linkedin,
  Pencil,
  Save,
  User,
  X,
  Youtube,
} from "lucide-react";
import {
  collection,
  documentId,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import {
  KnowledgeEntry,
  KnowledgeImageAsset,
  UserProfile,
  UserSocialLinks,
} from "../types";
import { SEO } from "./SEO";
import { GoogleSignInPrompt } from "./Auth";
import { KnowledgeCardList } from "./KnowledgeCardList";
import { ProfileAvatar } from "./ProfileAvatar";
import { ProfileAvatarPicker } from "./ProfileAvatarPicker";
import { ReadativeRMark } from "./ReadativeLoader";
import {
  changeProfileBanner,
  changeProfilePhoto,
  changeProfileUsername,
  getUsernameChangeRemaining,
  updateProfileDetails,
} from "../utils/userProfiles";
import { type KnowledgeIdentity } from "../utils/knowledgeIdentity";
import { buildAbsoluteRouteUrl } from "../utils/routes";
import { hydrateUserProfile } from "../utils/profileData";
import { signInWithGoogleAccount } from "../utils/googleAuth";
import {
  canViewKnowledgeEntry,
  normalizeKnowledgeVisibility,
} from "../utils/knowledgePrivacy";
import { ProfileSocialLinks } from "./ProfileSocialLinks";
import { KnowledgeCardSkeleton, ProfileSkeleton } from "./Skeletons";

type ProfileSection = "shared" | "liked";

const PROFILE_POST_LIMIT = 10;
const PROFILE_POST_FALLBACK_LIMIT = 40;
const PROFILE_TRACKED_LIKE_LOOKUP_LIMIT = 120;
const FIRESTORE_IN_QUERY_LIMIT = 30;
const PROFILE_DIRECTORY_LIMIT = 80;

interface ProfileProps {
  currentIdentity: KnowledgeIdentity | null;
  viewedAuthorId: string | null;
  onIdentityChange: (identity: KnowledgeIdentity | null) => void;
  onOpenProfile: (authorId: string) => void;
  onOpenEntry: (entryId: string) => void;
}

function sortKnowledge(entries: KnowledgeEntry[]) {
  return [...entries].sort((left, right) => right.createdAt - left.createdAt);
}

function formatCooldown(remainingMs: number) {
  if (remainingMs <= 0) return "You can change your username now.";

  const days = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  return `Username can be changed again in about ${days} day${days === 1 ? "" : "s"}.`;
}

function getProfileDisplayName(profile: UserProfile) {
  return profile.displayName?.trim() || profile.username;
}

function hydrateKnowledgeFromSnapshot(id: string, data: Partial<KnowledgeEntry>) {
  const createdAt = data.createdAt as
    | number
    | { toMillis?: () => number }
    | undefined;
  const updatedAt = data.updatedAt as
    | number
    | { toMillis?: () => number }
    | undefined;

  return {
    ...data,
    id,
    visibility: normalizeKnowledgeVisibility(data.visibility),
    comments: data.comments || [],
    likes: data.likes || [],
    hashtags: data.hashtags || [],
    mentions: data.mentions || [],
    createdAt:
      createdAt &&
      typeof createdAt === "object" &&
      typeof createdAt.toMillis === "function"
        ? createdAt.toMillis()
        : typeof createdAt === "number"
          ? createdAt
          : Date.now(),
    updatedAt:
      updatedAt &&
      typeof updatedAt === "object" &&
      typeof updatedAt.toMillis === "function"
        ? updatedAt.toMillis()
        : typeof updatedAt === "number"
          ? updatedAt
          : null,
  } as KnowledgeEntry;
}

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function sortProfileLikedEntries(
  entries: KnowledgeEntry[],
  trackedLikedEntryIds: string[],
) {
  if (trackedLikedEntryIds.length === 0) {
    return sortKnowledge(entries);
  }

  const likedOrder = new Map(
    trackedLikedEntryIds.map((entryId, index) => [entryId, index] as const),
  );

  return [...entries].sort((left, right) => {
    const leftOrder = likedOrder.get(left.id);
    const rightOrder = likedOrder.get(right.id);

    if (leftOrder !== undefined && rightOrder !== undefined) {
      return rightOrder - leftOrder;
    }

    if (leftOrder !== undefined) return -1;
    if (rightOrder !== undefined) return 1;

    return right.createdAt - left.createdAt;
  });
}

function isMissingFirestoreIndexError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code).toLowerCase()
      : "";

  return (
    code === "failed-precondition" ||
    message.includes("index") ||
    message.includes("requires an index")
  );
}

export function Profile({
  currentIdentity,
  viewedAuthorId,
  onIdentityChange,
  onOpenProfile,
  onOpenEntry,
}: ProfileProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [sharedEntries, setSharedEntries] = useState<KnowledgeEntry[]>([]);
  const [likedEntries, setLikedEntries] = useState<KnowledgeEntry[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingSharedEntries, setIsLoadingSharedEntries] = useState(false);
  const [isLoadingLikedEntries, setIsLoadingLikedEntries] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const [directoryLoadError, setDirectoryLoadError] = useState<string | null>(null);
  const [showIdentityPrompt, setShowIdentityPrompt] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showBannerPicker, setShowBannerPicker] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [isSavingBanner, setIsSavingBanner] = useState(false);
  const [avatarSaveError, setAvatarSaveError] = useState<string | null>(null);
  const [bannerSaveError, setBannerSaveError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileEditError, setProfileEditError] = useState<string | null>(null);
  const [section, setSection] = useState<ProfileSection>("shared");
  const [pendingAction, setPendingAction] = useState<
    { type: "like" | "comment"; entryId: string } | null
  >(null);
  const handleIdentityRequired = useCallback(
    (action: { type: "like" | "comment"; entryId: string }) =>
      setPendingAction(action),
    [],
  );

  const activeAuthorId = viewedAuthorId || currentIdentity?.authorId || null;
  const isOwnProfile =
    Boolean(currentIdentity?.authorId) &&
    activeAuthorId === currentIdentity?.authorId;

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [activeAuthorId]);

  useEffect(() => {
    if (isOwnProfile || viewedAuthorId) {
      setSection("shared");
    }
  }, [isOwnProfile, viewedAuthorId]);

  useEffect(() => {
    if (!activeAuthorId) {
      setProfile(null);
      setSharedEntries([]);
      setLikedEntries([]);
      setIsLoadingProfile(false);
      setIsLoadingSharedEntries(false);
      setIsLoadingLikedEntries(false);
      return;
    }

    setIsLoadingProfile(true);
    setIsLoadingSharedEntries(true);
    setSharedEntries([]);
    setLikedEntries([]);

    const unsubscribers: Array<() => void> = [];
    const hydrateEntries = (snapshot: {
      docs: Array<{
        id: string;
        data: () => Partial<KnowledgeEntry>;
      }>;
    }) =>
      sortKnowledge(
        snapshot.docs
          .map((item) =>
            hydrateKnowledgeFromSnapshot(
              item.id,
              item.data() as Partial<KnowledgeEntry>,
            ),
          )
          .filter((entry) =>
            canViewKnowledgeEntry(entry, currentIdentity?.authorId),
          ),
      ).slice(0, PROFILE_POST_LIMIT);
    const startProfileEntriesListener = ({
      orderedQuery,
      fallbackQuery,
      label,
      onEntries,
      errorMessage,
    }: {
      orderedQuery: ReturnType<typeof query>;
      fallbackQuery: ReturnType<typeof query>;
      label: string;
      onEntries: (entries: KnowledgeEntry[]) => void;
      errorMessage: string;
    }) => {
      let activeUnsubscribe: (() => void) | null = null;

      const startFallbackListener = () => {
        activeUnsubscribe = onSnapshot(
          fallbackQuery,
          (snapshot) => {
            onEntries(hydrateEntries(snapshot));
            setIsLoadingSharedEntries(false);
            setProfileLoadError(null);
          },
          (error) => {
            console.error(`${label} fallback listener error:`, error);
            onEntries([]);
            setIsLoadingSharedEntries(false);
            setProfileLoadError(errorMessage);
          },
        );
      };

      activeUnsubscribe = onSnapshot(
        orderedQuery,
        (snapshot) => {
          onEntries(hydrateEntries(snapshot));
          setIsLoadingSharedEntries(false);
          setProfileLoadError(null);
        },
        (error) => {
          if (isMissingFirestoreIndexError(error)) {
            console.warn(
              `${label} ordered listener needs an index; using limited fallback listener.`,
              error,
            );
            activeUnsubscribe?.();
            startFallbackListener();
            return;
          }

          console.error(`${label} listener error:`, error);
          onEntries([]);
          setIsLoadingSharedEntries(false);
          setProfileLoadError(errorMessage);
        },
      );

      return () => activeUnsubscribe?.();
    };

    unsubscribers.push(
      onSnapshot(
        doc(db, "userProfiles", activeAuthorId),
        (snapshot) => {
          if (!snapshot.exists()) {
            setProfile(null);
            setIsLoadingProfile(false);
            setProfileLoadError(null);
            return;
          }

          setProfile(
            hydrateUserProfile(
              snapshot.data() as Partial<UserProfile>,
              snapshot.id,
            ),
          );
          setIsLoadingProfile(false);
          setProfileLoadError(null);
        },
        (error) => {
          console.error("Profile listener error:", error);
          setProfile(null);
          setIsLoadingProfile(false);
          setProfileLoadError(
            "Could not load this profile right now. Please refresh in a moment."
          );
        }
      )
    );

    unsubscribers.push(
      startProfileEntriesListener({
        orderedQuery: query(
          collection(db, "knowledge"),
          where("authorId", "==", activeAuthorId),
          orderBy("createdAt", "desc"),
          limit(PROFILE_POST_LIMIT),
        ),
        fallbackQuery: query(
          collection(db, "knowledge"),
          where("authorId", "==", activeAuthorId),
          limit(PROFILE_POST_FALLBACK_LIMIT),
        ),
        label: "Shared knowledge",
        onEntries: setSharedEntries,
        errorMessage: "Could not load shared posts for this profile right now.",
      })
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [activeAuthorId, currentIdentity?.authorId, isOwnProfile]);

  useEffect(() => {
    let cancelled = false;

    const loadProfilesDirectory = async () => {
      try {
        const snapshot = await getDocs(
          query(
            collection(db, "userProfiles"),
            orderBy("usernameLower", "asc"),
            limit(PROFILE_DIRECTORY_LIMIT),
          ),
        );

        if (cancelled) return;

        const data = snapshot.docs.map((item) =>
          hydrateUserProfile(item.data() as Partial<UserProfile>, item.id),
        );

        setProfiles(data);
        setDirectoryLoadError(null);
      } catch (error) {
        if (cancelled) return;

        console.error("User directory load error:", error);
        setProfiles([]);
        setDirectoryLoadError(
          "The profile directory is temporarily unavailable. Mentions and profile previews may be limited."
        );
      }
    };

    void loadProfilesDirectory();

    return () => {
      cancelled = true;
    };
  }, []);

  const usernameCooldown = profile ? getUsernameChangeRemaining(profile) : 0;
  const trackedLikedEntryIds =
    profile?.id === activeAuthorId ? profile.likedKnowledgeIds : [];
  const trackedLikedEntryIdsKey = trackedLikedEntryIds.join("\u001f");
  const likedEntryCount = Math.max(
    trackedLikedEntryIds.length,
    likedEntries.length,
  );
  const orderedLikedEntries = useMemo(
    () =>
      sortProfileLikedEntries(likedEntries, trackedLikedEntryIds).slice(
        0,
        PROFILE_POST_LIMIT,
      ),
    [likedEntries, trackedLikedEntryIdsKey],
  );
  const profileDisplayName = profile ? getProfileDisplayName(profile) : "";
  const profileUrl =
    profile
      ? buildAbsoluteRouteUrl("profile", { profileAuthorId: profile.id })
      : buildAbsoluteRouteUrl("profile");
  const profileSchema = profile
      ? {
        "@context": "https://schema.org",
        "@type": "Person",
        name: profileDisplayName,
        alternateName: `@${profile.username}`,
        description:
          profile.bio || "A Readative member publishing and curating knowledge.",
        url: profileUrl,
        sameAs: Object.values(profile.socialLinks || {}).filter(Boolean),
      }
    : undefined;

  useEffect(() => {
    if (!activeAuthorId || !profile) {
      setLikedEntries([]);
      setIsLoadingLikedEntries(false);
      return;
    }

    setIsLoadingLikedEntries(true);
    const targetAuthorId = activeAuthorId;
    const visibleAuthorId = currentIdentity?.authorId;
    const trackedEntryIds = [...new Set(trackedLikedEntryIds)]
      .slice(-PROFILE_TRACKED_LIKE_LOOKUP_LIMIT);

    if (trackedEntryIds.length > 0) {
      const chunkEntries = new Map<number, KnowledgeEntry[]>();
      const likedEntryChunks = chunkItems(trackedEntryIds, FIRESTORE_IN_QUERY_LIMIT);
      const unsubscribers = likedEntryChunks.map((entryIds, chunkIndex) =>
        onSnapshot(
          query(
            collection(db, "knowledge"),
            where(documentId(), "in", entryIds),
          ),
          (snapshot) => {
            chunkEntries.set(
              chunkIndex,
              snapshot.docs
                .map((item) =>
                  hydrateKnowledgeFromSnapshot(
                    item.id,
                    item.data() as Partial<KnowledgeEntry>,
                  ),
                )
                .filter(
                  (entry) =>
                    (entry.likes || []).includes(targetAuthorId) &&
                    canViewKnowledgeEntry(entry, visibleAuthorId),
                ),
            );

            setLikedEntries(
              sortProfileLikedEntries(
                [...chunkEntries.values()].flat(),
                trackedEntryIds,
              ).slice(0, PROFILE_TRACKED_LIKE_LOOKUP_LIMIT),
            );
            setIsLoadingLikedEntries(false);
            setProfileLoadError(null);
          },
          (error) => {
            console.error("Liked knowledge ID listener error:", error);
            setIsLoadingLikedEntries(false);
            setProfileLoadError(
              "Could not load liked posts for this profile right now.",
            );
          },
        ),
      );

      return () => {
        unsubscribers.forEach((unsubscribe) => unsubscribe());
      };
    }

    let activeUnsubscribe: (() => void) | null = null;
    const hydrateLikedEntries = (snapshot: {
      docs: Array<{
        id: string;
        data: () => Partial<KnowledgeEntry>;
      }>;
    }) =>
      sortKnowledge(
        snapshot.docs
          .map((item) =>
            hydrateKnowledgeFromSnapshot(
              item.id,
              item.data() as Partial<KnowledgeEntry>,
            ),
          )
          .filter(
            (entry) =>
              (entry.likes || []).includes(targetAuthorId) &&
              canViewKnowledgeEntry(entry, visibleAuthorId),
          ),
      ).slice(0, PROFILE_POST_LIMIT);

    const startFallbackLikedListener = () => {
      activeUnsubscribe = onSnapshot(
        query(
          collection(db, "knowledge"),
          where("likes", "array-contains", targetAuthorId),
          limit(PROFILE_POST_FALLBACK_LIMIT),
        ),
        (snapshot) => {
          setLikedEntries(hydrateLikedEntries(snapshot));
          setIsLoadingLikedEntries(false);
          setProfileLoadError(null);
        },
        (error) => {
          console.error("Liked knowledge fallback listener error:", error);
          setLikedEntries([]);
          setIsLoadingLikedEntries(false);
          setProfileLoadError("Could not load liked posts for this profile right now.");
        },
      );
    };

    activeUnsubscribe = onSnapshot(
      query(
        collection(db, "knowledge"),
        where("likes", "array-contains", targetAuthorId),
        orderBy("createdAt", "desc"),
        limit(PROFILE_POST_LIMIT),
      ),
      (snapshot) => {
        setLikedEntries(hydrateLikedEntries(snapshot));
        setIsLoadingLikedEntries(false);
        setProfileLoadError(null);
      },
      (error) => {
        if (isMissingFirestoreIndexError(error)) {
          console.warn(
            "Liked knowledge ordered listener needs an index; using limited fallback listener.",
            error,
          );
          activeUnsubscribe?.();
          startFallbackLikedListener();
          return;
        }

        console.error("Liked knowledge listener error:", error);
        setLikedEntries([]);
        setIsLoadingLikedEntries(false);
        setProfileLoadError("Could not load liked posts for this profile right now.");
      },
    );

    return () => {
      activeUnsubscribe?.();
    };
  }, [
    activeAuthorId,
    currentIdentity?.authorId,
    profile,
    trackedLikedEntryIdsKey,
  ]);

  const handleClaimIdentity = async () => {
    const nextIdentity = await signInWithGoogleAccount();
    onIdentityChange(nextIdentity);
    setShowIdentityPrompt(false);
  };

  const handleSaveProfileSettings = async ({
    displayName,
    username,
    jobTitle,
    bio,
    socialLinks,
    showSocialLinksOnPosts,
  }: {
    displayName: string;
    username: string;
    jobTitle: string;
    bio: string;
    socialLinks: UserSocialLinks;
    showSocialLinksOnPosts: boolean;
  }) => {
    if (!profile || !isOwnProfile) return;

    setIsSavingProfile(true);
    setProfileEditError(null);

    try {
      let updatedProfile = await updateProfileDetails(profile, {
        displayName,
        jobTitle,
        bio,
        socialLinks,
        showSocialLinksOnPosts,
      });

      if (username.trim().toLowerCase() !== profile.usernameLower) {
        updatedProfile = await changeProfileUsername(updatedProfile, username);
        onIdentityChange({
          displayName: updatedProfile.username,
          authorId: updatedProfile.id,
        });
      }

      setProfile(updatedProfile);
      setShowEditProfile(false);
    } catch (error) {
      setProfileEditError(
        error instanceof Error
          ? error.message
          : "Could not save profile changes right now.",
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangeAvatar = async (nextProfileImage: KnowledgeImageAsset) => {
    if (!profile || !isOwnProfile) return;

    setAvatarSaveError(null);
    setIsSavingAvatar(true);

    try {
      const updatedProfile = await changeProfilePhoto(profile, nextProfileImage);
      setProfile(updatedProfile);
      setShowAvatarPicker(false);
    } catch (error) {
      console.error("Failed to save avatar:", error);
      setAvatarSaveError(
        error instanceof Error
          ? error.message
          : "Could not save your profile picture right now."
      );
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleChangeBanner = async (nextBannerImage: KnowledgeImageAsset) => {
    if (!profile || !isOwnProfile) return;

    setBannerSaveError(null);
    setIsSavingBanner(true);

    try {
      const updatedProfile = await changeProfileBanner(profile, nextBannerImage);
      setProfile(updatedProfile);
      setShowBannerPicker(false);
    } catch (error) {
      console.error("Failed to save banner:", error);
      setBannerSaveError(
        error instanceof Error
          ? error.message
          : "Could not save your banner photo right now.",
      );
    } finally {
      setIsSavingBanner(false);
    }
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
      })
    );
    setPendingAction(null);
  };

  if (!currentIdentity && !viewedAuthorId) {
    return (
      <div className="space-y-6 pb-20">
        <SEO
          title="Profile | Readative"
          description="Sign in with Google to unlock your Readative profile, posts, and likes."
          robots="noindex"
        />

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <ReadativeRMark className="h-7 w-7 text-2xl tracking-tight" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">
            Sign in with Google
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
            Keep your profile, posts, likes, and comments synced.
          </p>
          <button
            onClick={() => setShowIdentityPrompt(true)}
            className="mt-5 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
          >
            Continue with Google
          </button>
        </div>

        {showIdentityPrompt && (
          <GoogleSignInPrompt
            title="Sign in to view your profile"
            submitLabel="Continue with Google"
            onConfirm={handleClaimIdentity}
            onClose={() => setShowIdentityPrompt(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <SEO
        title={profile ? `${profileDisplayName} | Readative` : "Profile | Readative"}
        description="Explore user profiles, shared knowledge, and liked posts on Readative."
        type="profile"
        url={profileUrl}
        schema={profileSchema}
        robots={!isLoadingProfile && !profile ? "noindex" : "index"}
      />

      {profileLoadError && (
        <ProfileNotice
          title="Profile loading issue"
          body={profileLoadError}
        />
      )}

      {directoryLoadError && (
        <ProfileNotice
          title="Profile directory issue"
          body={directoryLoadError}
        />
      )}

      {isLoadingProfile ? (
        <ProfileSkeleton />
      ) : !profile ? (
        <div className="rounded-[30px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
          <User className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-4 text-xl font-black text-slate-900">
            Profile not found
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            This user profile does not exist yet.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <div className="relative h-36 bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_48%,#2563eb_100%)] sm:h-44">
              {profile.bannerImage && (
                <img
                  src={profile.bannerImage.dataUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              )}
            </div>

            <div className="px-5 pb-5 sm:px-6 sm:pb-6">
              <div className="-mt-12 flex flex-wrap items-end justify-between gap-3 sm:-mt-14">
                <div className="relative">
                  <ProfileAvatar
                    authorId={profile.id}
                    image={profile.profileImage}
                    photoUrl={profile.photoUrl}
                    username={profileDisplayName}
                    size="xl"
                    className="border-slate-200 bg-white ring-4 ring-white"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                    {isOwnProfile ? "Your Profile" : "Community Profile"}
                  </span>
                  {isOwnProfile && (
                    <button
                      onClick={() => {
                        setProfileEditError(null);
                        setShowEditProfile(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="break-words text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                    {profileDisplayName}
                  </h2>
                  <ProfileSocialLinks
                    socialLinks={profile.socialLinks}
                    compact
                    className="pt-1"
                  />
                </div>

                <p className="mt-1 text-sm font-semibold text-slate-500">
                  @{profile.username}
                </p>

                {profile.jobTitle && (
                  <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-slate-800">
                    {profile.jobTitle}
                  </p>
                )}

                {profile.bio && (
                  <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {profile.bio}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400">
                  <span>Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
                  {isOwnProfile && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatCooldown(usernameCooldown)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
            <SectionButton
              active={section === "shared"}
              onClick={() => setSection("shared")}
              label="Shared"
              count={sharedEntries.length}
            />
            <SectionButton
              active={section === "liked"}
              onClick={() => setSection("liked")}
              label="Liked"
              count={likedEntryCount}
            />
          </div>

          {section === "shared" && (
            <KnowledgeSection
              title={
                isOwnProfile
                  ? "Your shared knowledge"
                  : `${profileDisplayName}'s shared knowledge`
              }
              emptyMessage="No shared knowledge yet."
              entries={sharedEntries}
              isLoading={isLoadingSharedEntries}
              currentIdentity={currentIdentity}
              profiles={profiles}
              onIdentityRequired={handleIdentityRequired}
              onOpenProfile={onOpenProfile}
              onOpenEntry={onOpenEntry}
            />
          )}

          {section === "liked" && (
            <KnowledgeSection
              title={
                isOwnProfile
                  ? "Posts you liked"
                  : `Knowledge liked by ${profileDisplayName}`
              }
              emptyMessage="No liked knowledge yet."
              entries={orderedLikedEntries}
              isLoading={isLoadingLikedEntries}
              currentIdentity={currentIdentity}
              profiles={profiles}
              onIdentityRequired={handleIdentityRequired}
              onOpenProfile={onOpenProfile}
              onOpenEntry={onOpenEntry}
            />
          )}
        </>
      )}

      {showIdentityPrompt && (
        <GoogleSignInPrompt
          title="Continue with Google"
          submitLabel="Continue with Google"
          onConfirm={handleClaimIdentity}
          onClose={() => setShowIdentityPrompt(false)}
        />
      )}

      {showEditProfile && profile && (
        <EditProfileModal
          profile={profile}
          usernameCooldown={usernameCooldown}
          isSaving={isSavingProfile}
          errorMessage={profileEditError}
          onChangePhoto={() => {
            setAvatarSaveError(null);
            setShowAvatarPicker(true);
          }}
          onChangeBanner={() => {
            setBannerSaveError(null);
            setShowBannerPicker(true);
          }}
          onSave={handleSaveProfileSettings}
          onClose={() => {
            if (isSavingProfile) return;
            setProfileEditError(null);
            setShowEditProfile(false);
          }}
        />
      )}

      {showAvatarPicker && profile && (
        <ProfileAvatarPicker
          currentImage={profile.profileImage}
          username={profileDisplayName || profile.username}
          isSaving={isSavingAvatar}
          errorMessage={avatarSaveError}
          onSave={handleChangeAvatar}
          onClose={() => {
            if (isSavingAvatar) return;
            setAvatarSaveError(null);
            setShowAvatarPicker(false);
          }}
        />
      )}

      {showBannerPicker && profile && (
        <ProfileAvatarPicker
          currentImage={profile.bannerImage}
          username={profileDisplayName || profile.username}
          variant="banner"
          isSaving={isSavingBanner}
          errorMessage={bannerSaveError}
          onSave={handleChangeBanner}
          onClose={() => {
            if (isSavingBanner) return;
            setBannerSaveError(null);
            setShowBannerPicker(false);
          }}
        />
      )}

      {pendingAction && (
        <GoogleSignInPrompt
          title={
            pendingAction.type === "like"
              ? "Sign in to like"
              : "Sign in to comment"
          }
          description="Use your Google account so this activity is saved to your profile on every browser and device."
          submitLabel="Continue with Google"
          onConfirm={handleGoogleSignInForPendingAction}
          onClose={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}

function EditProfileModal({
  profile,
  usernameCooldown,
  isSaving,
  errorMessage,
  onChangePhoto,
  onChangeBanner,
  onSave,
  onClose,
}: {
  profile: UserProfile;
  usernameCooldown: number;
  isSaving: boolean;
  errorMessage: string | null;
  onChangePhoto: () => void;
  onChangeBanner: () => void;
  onSave: (input: {
    displayName: string;
    username: string;
    jobTitle: string;
    bio: string;
    socialLinks: UserSocialLinks;
    showSocialLinksOnPosts: boolean;
  }) => void | Promise<void>;
  onClose: () => void;
}) {
  const [displayName, setDisplayName] = useState(getProfileDisplayName(profile));
  const [username, setUsername] = useState(profile.username);
  const [jobTitle, setJobTitle] = useState(profile.jobTitle || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [linkedin, setLinkedin] = useState(profile.socialLinks.linkedin || "");
  const [instagram, setInstagram] = useState(
    profile.socialLinks.instagram || "",
  );
  const [youtube, setYoutube] = useState(profile.socialLinks.youtube || "");
  const [showSocialLinksOnPosts, setShowSocialLinksOnPosts] = useState(
    profile.showSocialLinksOnPosts,
  );

  const handleSave = () => {
    void onSave({
      displayName,
      username,
      jobTitle,
      bio,
      socialLinks: {
        linkedin,
        instagram,
        youtube,
      },
      showSocialLinksOnPosts,
    });
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center overflow-y-auto bg-slate-950/35 p-3 pt-16 backdrop-blur-sm sm:p-4 sm:pt-20">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.2)]">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Close edit profile"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
            Edit Profile
          </p>
          <h2 className="mt-1 pr-10 text-2xl font-black tracking-tight text-slate-950">
            Profile settings
          </h2>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <div className="relative h-24 bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_48%,#2563eb_100%)]">
              {profile.bannerImage && (
                <img
                  src={profile.bannerImage.dataUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
              <button
                type="button"
                onClick={onChangeBanner}
                disabled={isSaving}
                className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-xs font-bold text-slate-800 shadow-sm transition-colors hover:bg-white disabled:opacity-50"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                Banner
              </button>
            </div>

            <div className="-mt-9 flex items-end gap-4 px-4 pb-4">
              <ProfileAvatar
                authorId={profile.id}
                image={profile.profileImage}
                photoUrl={profile.photoUrl}
                username={displayName}
                size="lg"
                className="border-slate-200 bg-white ring-4 ring-white"
              />
              <div className="min-w-0 flex-1 pb-1">
                <p className="truncate text-sm font-bold text-slate-900">
                  {displayName || profile.username}
                </p>
                <p className="text-xs font-semibold text-slate-500">
                  @{profile.username}
                </p>
              </div>
              <button
                type="button"
                onClick={onChangePhoto}
                disabled={isSaving}
                className="mb-1 inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                Photo
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
              label="Name"
              value={displayName}
              onChange={setDisplayName}
              placeholder="Your public name"
            />
            <div>
              <TextInput
                label="Username"
                value={username}
                onChange={setUsername}
                placeholder="username"
              />
              <p className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                <Clock3 className="h-4 w-4" />
                {formatCooldown(usernameCooldown)}
              </p>
            </div>
          </div>

          <TextInput
            label="Job title / headline"
            value={jobTitle}
            onChange={setJobTitle}
            placeholder="Founder, Product Designer, Student..."
          />

          <div>
            <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="A short intro for your profile"
              maxLength={220}
              className="mt-2 min-h-[92px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <p className="mt-1 text-right text-[11px] font-semibold text-slate-400">
              {bio.length}/220
            </p>
          </div>

          <div className="grid gap-3">
            <SocialInput
              icon={<Linkedin className="h-4 w-4" />}
              label="LinkedIn"
              value={linkedin}
              onChange={setLinkedin}
              placeholder="https://www.linkedin.com/in/username"
            />
            <SocialInput
              icon={<Instagram className="h-4 w-4" />}
              label="Instagram"
              value={instagram}
              onChange={setInstagram}
              placeholder="https://www.instagram.com/username"
            />
            <SocialInput
              icon={<Youtube className="h-4 w-4" />}
              label="YouTube"
              value={youtube}
              onChange={setYoutube}
              placeholder="https://www.youtube.com/@channel"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              type="checkbox"
              checked={showSocialLinksOnPosts}
              onChange={(event) => setShowSocialLinksOnPosts(event.target.checked)}
              className="sr-only"
            />
            <span
              className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                showSocialLinksOnPosts
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-slate-300 bg-white text-transparent"
              }`}
            >
              <Check className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-slate-900">
                Show social buttons on my posts
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                When checked, readers can open your added social links directly
                from your post cards on Home.
              </span>
            </span>
          </label>

          {errorMessage && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {errorMessage}
            </p>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={handleSave}
            disabled={
              isSaving ||
              username.trim().length < 3 ||
              displayName.trim().length < 2
            }
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 sm:w-auto"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function SocialInput({
  icon,
  label,
  value,
  onChange,
  placeholder,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
        {icon}
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-slate-700 outline-none"
      />
    </label>
  );
}

function SectionButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-2 text-xs font-bold transition-all ${
        active
          ? "bg-slate-900 text-white"
          : "text-slate-500 hover:bg-slate-100"
      }`}
    >
      {label} <span className={active ? "text-white/80" : "text-slate-400"}>({count})</span>
    </button>
  );
}

function KnowledgeSection({
  title,
  emptyMessage,
  entries,
  isLoading,
  currentIdentity,
  profiles,
  onIdentityRequired,
  onOpenProfile,
  onOpenEntry,
}: {
  title: string;
  emptyMessage: string;
  entries: KnowledgeEntry[];
  isLoading: boolean;
  currentIdentity: KnowledgeIdentity | null;
  profiles: UserProfile[];
  onIdentityRequired: (action: { type: "like" | "comment"; entryId: string }) => void;
  onOpenProfile: (authorId: string) => void;
  onOpenEntry: (entryId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
          <BookOpenText className="h-5 w-5 text-emerald-600" />
          {title}
        </h3>
      </div>

      {isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          <KnowledgeCardSkeleton compact />
          <KnowledgeCardSkeleton showImage={false} compact />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
          <Heart className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm text-slate-400">{emptyMessage}</p>
        </div>
      ) : (
        <KnowledgeCardList
          entries={entries}
          currentIdentity={currentIdentity}
          profiles={profiles}
          onIdentityRequired={onIdentityRequired}
          onOpenProfile={onOpenProfile}
          onOpenEntry={onOpenEntry}
        />
      )}
    </div>
  );
}

function ProfileNotice({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 shadow-sm">
      <p className="font-bold">{title}</p>
      <p className="mt-1 leading-6">{body}</p>
    </div>
  );
}
