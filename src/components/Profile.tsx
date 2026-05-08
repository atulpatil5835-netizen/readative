import { type ReactNode, useCallback, useEffect, useState } from "react";
import {
  BookOpenText,
  Clock3,
  Heart,
  ImagePlus,
  Instagram,
  Linkedin,
  Pencil,
  Save,
  Sparkles,
  User,
  X,
  Youtube,
} from "lucide-react";
import {
  collection,
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
import {
  changeProfilePhoto,
  changeProfileUsername,
  getUsernameChangeRemaining,
  updateProfileSocialLinks,
} from "../utils/userProfiles";
import { type KnowledgeIdentity } from "../utils/knowledgeIdentity";
import { buildAbsoluteRouteUrl } from "../utils/routes";
import { hydrateUserProfile } from "../utils/profileData";
import { signInWithGoogleAccount } from "../utils/googleAuth";
import {
  canViewKnowledgeEntry,
  normalizeKnowledgeVisibility,
} from "../utils/knowledgePrivacy";

type ProfileSection = "shared" | "liked";

const PROFILE_POST_LIMIT = 10;
const PROFILE_POST_FALLBACK_LIMIT = 40;
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
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const [directoryLoadError, setDirectoryLoadError] = useState<string | null>(null);
  const [showIdentityPrompt, setShowIdentityPrompt] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [avatarSaveError, setAvatarSaveError] = useState<string | null>(null);
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
      return;
    }

    setIsLoadingProfile(true);

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
            setProfileLoadError(null);
          },
          (error) => {
            console.error(`${label} fallback listener error:`, error);
            onEntries([]);
            setProfileLoadError(errorMessage);
          },
        );
      };

      activeUnsubscribe = onSnapshot(
        orderedQuery,
        (snapshot) => {
          onEntries(hydrateEntries(snapshot));
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

    unsubscribers.push(
      startProfileEntriesListener({
        orderedQuery: query(
          collection(db, "knowledge"),
          where("likes", "array-contains", activeAuthorId),
          orderBy("createdAt", "desc"),
          limit(PROFILE_POST_LIMIT),
        ),
        fallbackQuery: query(
          collection(db, "knowledge"),
          where("likes", "array-contains", activeAuthorId),
          limit(PROFILE_POST_FALLBACK_LIMIT),
        ),
        label: "Liked knowledge",
        onEntries: setLikedEntries,
        errorMessage: "Could not load liked posts for this profile right now.",
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
  const engagementCount = sharedEntries.reduce(
    (sum, entry) =>
      sum + (entry.likes?.length || 0) + (entry.comments?.length || 0),
    0
  );
  const profileUrl =
    profile
      ? buildAbsoluteRouteUrl("profile", { profileAuthorId: profile.id })
      : buildAbsoluteRouteUrl("profile");
  const profileSchema = profile
    ? {
        "@context": "https://schema.org",
        "@type": "Person",
        name: `@${profile.username}`,
        description:
          profile.bio || "A Readative member publishing and curating knowledge.",
        url: profileUrl,
        sameAs: Object.values(profile.socialLinks || {}).filter(Boolean),
      }
    : undefined;

  const handleClaimIdentity = async () => {
    const nextIdentity = await signInWithGoogleAccount();
    onIdentityChange(nextIdentity);
    setShowIdentityPrompt(false);
  };

  const handleSaveProfileSettings = async ({
    username,
    socialLinks,
  }: {
    username: string;
    socialLinks: UserSocialLinks;
  }) => {
    if (!profile || !isOwnProfile) return;

    setIsSavingProfile(true);
    setProfileEditError(null);

    try {
      let updatedProfile = profile;
      if (username.trim().toLowerCase() !== profile.usernameLower) {
        updatedProfile = await changeProfileUsername(profile, username);
        onIdentityChange({
          displayName: updatedProfile.username,
          authorId: updatedProfile.id,
        });
      }

      updatedProfile = await updateProfileSocialLinks(
        updatedProfile,
        socialLinks,
      );
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
        />

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Sparkles className="h-7 w-7" />
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
        title={profile ? `@${profile.username} | Readative` : "Profile | Readative"}
        description="Explore user profiles, shared knowledge, and liked posts on Readative."
        type="profile"
        url={profileUrl}
        schema={profileSchema}
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
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        </div>
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
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div>
                <ProfileAvatar
                  authorId={profile.id}
                  image={profile.profileImage}
                  photoUrl={profile.photoUrl}
                  username={profile.username}
                  size="xl"
                  className="mb-4 border-slate-200 bg-white"
                />
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
                  {isOwnProfile ? "Your Profile" : "Community Profile"}
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                  @{profile.username}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
                  {profile.bio || "Building a strong knowledge trail on Readative."}
                </p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Joined {new Date(profile.createdAt).toLocaleDateString()}
                </p>
                <ProfileSocialLinks socialLinks={profile.socialLinks} />
              </div>

              <div className="grid grid-cols-3 gap-3 md:min-w-[320px]">
                <ProfileStat label="Shared" value={sharedEntries.length} />
                <ProfileStat label="Liked" value={likedEntries.length} />
                <ProfileStat label="Engagement" value={engagementCount} />
              </div>
            </div>

            {isOwnProfile && (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => {
                    setProfileEditError(null);
                    setShowEditProfile(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
                >
                  <Pencil className="h-4 w-4" />
                  Edit profile
                </button>
                <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500">
                  <Clock3 className="h-4 w-4" />
                  {formatCooldown(usernameCooldown)}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <SectionButton
              active={section === "shared"}
              onClick={() => setSection("shared")}
              label={`Shared (${sharedEntries.length})`}
            />
            <SectionButton
              active={section === "liked"}
              onClick={() => setSection("liked")}
              label={`Liked (${likedEntries.length})`}
            />
          </div>

          {section === "shared" && (
            <KnowledgeSection
              title={
                isOwnProfile
                  ? "Your shared knowledge"
                  : `@${profile.username}'s shared knowledge`
              }
              emptyMessage="No shared knowledge yet."
              entries={sharedEntries}
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
                  : `Knowledge liked by @${profile.username}`
              }
              emptyMessage="No liked knowledge yet."
              entries={likedEntries}
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
          username={profile.username}
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

function ProfileSocialLinks({ socialLinks }: { socialLinks: UserSocialLinks }) {
  const links = [
    {
      key: "linkedin",
      label: "Open LinkedIn profile",
      href: socialLinks.linkedin,
      icon: <Linkedin className="h-4 w-4" />,
    },
    {
      key: "instagram",
      label: "Open Instagram profile",
      href: socialLinks.instagram,
      icon: <Instagram className="h-4 w-4" />,
    },
    {
      key: "youtube",
      label: "Open YouTube channel",
      href: socialLinks.youtube,
      icon: <Youtube className="h-4 w-4" />,
    },
  ].filter((link) => Boolean(link.href));

  if (links.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {links.map((link) => (
        <a
          key={link.key}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          aria-label={link.label}
          title={link.label}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
        >
          {link.icon}
        </a>
      ))}
    </div>
  );
}

function EditProfileModal({
  profile,
  usernameCooldown,
  isSaving,
  errorMessage,
  onChangePhoto,
  onSave,
  onClose,
}: {
  profile: UserProfile;
  usernameCooldown: number;
  isSaving: boolean;
  errorMessage: string | null;
  onChangePhoto: () => void;
  onSave: (input: {
    username: string;
    socialLinks: UserSocialLinks;
  }) => void | Promise<void>;
  onClose: () => void;
}) {
  const [username, setUsername] = useState(profile.username);
  const [linkedin, setLinkedin] = useState(profile.socialLinks.linkedin || "");
  const [instagram, setInstagram] = useState(
    profile.socialLinks.instagram || "",
  );
  const [youtube, setYoutube] = useState(profile.socialLinks.youtube || "");

  const handleSave = () => {
    void onSave({
      username,
      socialLinks: {
        linkedin,
        instagram,
        youtube,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center overflow-y-auto bg-slate-950/35 p-3 pt-16 backdrop-blur-sm sm:p-4 sm:pt-20">
      <div className="relative w-full max-w-xl overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.2)]">
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
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <ProfileAvatar
              authorId={profile.id}
              image={profile.profileImage}
              photoUrl={profile.photoUrl}
              username={profile.username}
              size="lg"
              className="border-slate-200 bg-white"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900">
                @{profile.username}
              </p>
              <button
                type="button"
                onClick={onChangePhoto}
                disabled={isSaving}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                <ImagePlus className="h-4 w-4" />
                Change photo
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Username
            </label>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="username"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <p className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Clock3 className="h-4 w-4" />
              {formatCooldown(usernameCooldown)}
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
            disabled={isSaving || username.trim().length < 3}
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
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition-all ${
        active
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-500 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}

function ProfileStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
    </div>
  );
}

function KnowledgeSection({
  title,
  emptyMessage,
  entries,
  currentIdentity,
  profiles,
  onIdentityRequired,
  onOpenProfile,
  onOpenEntry,
}: {
  title: string;
  emptyMessage: string;
  entries: KnowledgeEntry[];
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

      {entries.length === 0 ? (
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
