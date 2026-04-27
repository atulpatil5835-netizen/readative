import { useEffect, useState } from "react";
import { BookOpenText, Clock3, Heart, Sparkles, User } from "lucide-react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { KnowledgeEntry, UserProfile } from "../types";
import { SEO } from "./SEO";
import { IdentityPrompt, UsernamePrompt } from "./Auth";
import { KnowledgeCard } from "./KnowledgeCard";
import {
  changeProfileUsername,
  ensureGuestProfile,
  getUsernameChangeRemaining,
} from "../utils/userProfiles";
import { type KnowledgeIdentity } from "../utils/knowledgeIdentity";
import { getGuestName } from "../utils/guestIdentity";

type ProfileSection = "shared" | "liked";

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
  const [showIdentityPrompt, setShowIdentityPrompt] = useState(false);
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
  const [section, setSection] = useState<ProfileSection>("shared");
  const [pendingAction, setPendingAction] = useState<
    { type: "like" | "comment"; entryId: string } | null
  >(null);

  const guestName = getGuestName();
  const activeAuthorId = viewedAuthorId || currentIdentity?.authorId || null;
  const isOwnProfile =
    Boolean(currentIdentity?.authorId) &&
    activeAuthorId === currentIdentity?.authorId;

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

    unsubscribers.push(
      onSnapshot(doc(db, "userProfiles", activeAuthorId), (snapshot) => {
        if (!snapshot.exists()) {
          setProfile(null);
          setIsLoadingProfile(false);
          return;
        }

        const data = snapshot.data() as UserProfile;
        setProfile({
          ...data,
          id: snapshot.id,
        });
        setIsLoadingProfile(false);
      })
    );

    unsubscribers.push(
      onSnapshot(
        query(collection(db, "knowledge"), where("authorId", "==", activeAuthorId)),
        (snapshot) => {
          const data = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
            createdAt:
              item.data().createdAt?.toMillis?.() ||
              item.data().createdAt ||
              Date.now(),
          })) as KnowledgeEntry[];

          setSharedEntries(sortKnowledge(data));
        }
      )
    );

    unsubscribers.push(
      onSnapshot(
        query(collection(db, "knowledge"), where("likes", "array-contains", activeAuthorId)),
        (snapshot) => {
          const data = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
            createdAt:
              item.data().createdAt?.toMillis?.() ||
              item.data().createdAt ||
              Date.now(),
          })) as KnowledgeEntry[];

          setLikedEntries(sortKnowledge(data));
        }
      )
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [activeAuthorId, isOwnProfile]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "userProfiles"), (snapshot) => {
      const data = snapshot.docs.map((item) => ({
        ...(item.data() as UserProfile),
        id: item.id,
      }));

      setProfiles(data);
    });

    return () => unsubscribe();
  }, []);

  const usernameCooldown = profile ? getUsernameChangeRemaining(profile) : 0;
  const engagementCount = sharedEntries.reduce(
    (sum, entry) =>
      sum + (entry.likes?.length || 0) + (entry.comments?.length || 0),
    0
  );
  const profileUrl =
    typeof window === "undefined"
      ? "https://readative.com/#profile"
      : `${window.location.origin}${window.location.pathname}${
          profile ? `#profile/${profile.id}` : "#profile"
        }`;
  const profileSchema = profile
    ? {
        "@context": "https://schema.org",
        "@type": "Person",
        name: `@${profile.username}`,
        description:
          profile.bio || "A Readative member publishing and curating knowledge.",
        url: profileUrl,
      }
    : undefined;

  const handleClaimIdentity = async (username: string) => {
    const nextProfile = await ensureGuestProfile(username);
    onIdentityChange({
      displayName: nextProfile.username,
      authorId: nextProfile.id,
    });
    setShowIdentityPrompt(false);
  };

  const handleChangeUsername = async (nextUsername: string) => {
    if (!profile || !isOwnProfile) return;

    const updatedProfile = await changeProfileUsername(profile, nextUsername);
    setProfile(updatedProfile);
    onIdentityChange({
      displayName: updatedProfile.username,
      authorId: updatedProfile.id,
    });
    setShowUsernamePrompt(false);
  };

  const handleNameConfirm = async (username: string) => {
    if (!pendingAction) return;

    const nextProfile = await ensureGuestProfile(username);
    onIdentityChange({
      displayName: nextProfile.username,
      authorId: nextProfile.id,
    });

    window.dispatchEvent(
      new CustomEvent("knowledge-action", {
        detail: {
          ...pendingAction,
          username: nextProfile.username,
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
          description="Claim a username once to unlock your Readative profile, posts, and likes."
        />

        <div className="rounded-[32px] bg-gradient-to-br from-slate-900 via-emerald-900 to-teal-700 p-8 text-center text-white shadow-[0_24px_72px_rgba(15,23,42,0.2)]">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/15">
            <Sparkles className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-2xl font-black tracking-tight">
            Claim your username once
          </h2>
          <p className="mt-2 text-sm text-emerald-100">
            Readative remembers your username on this device for posts, likes,
            comments, mentions, and realtime notifications.
          </p>
          <button
            onClick={() => setShowIdentityPrompt(true)}
            className="mt-6 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50"
          >
            Save my username
          </button>
        </div>

        {showIdentityPrompt && (
          <IdentityPrompt
            initialValue={guestName || ""}
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
          <div className="rounded-[32px] bg-gradient-to-br from-slate-900 via-emerald-900 to-teal-700 p-8 text-white shadow-[0_24px_72px_rgba(15,23,42,0.2)]">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/15 text-3xl font-black">
                  {profile.username[0]?.toUpperCase() || "U"}
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-200">
                  {isOwnProfile ? "Your Profile" : "Community Profile"}
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">
                  @{profile.username}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-100">
                  {profile.bio || "Building a strong knowledge trail on Readative."}
                </p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/80">
                  Joined {new Date(profile.createdAt).toLocaleDateString()}
                </p>
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
                  onClick={() => setShowUsernamePrompt(true)}
                  className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50"
                >
                  Change username
                </button>
                <div className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-emerald-100">
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
              profiles={profiles}
              onIdentityRequired={(action) => setPendingAction(action)}
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
              profiles={profiles}
              onIdentityRequired={(action) => setPendingAction(action)}
              onOpenProfile={onOpenProfile}
              onOpenEntry={onOpenEntry}
            />
          )}
        </>
      )}

      {showIdentityPrompt && (
        <IdentityPrompt
          initialValue={currentIdentity?.displayName || guestName || ""}
          onConfirm={handleClaimIdentity}
          onClose={() => setShowIdentityPrompt(false)}
        />
      )}

      {showUsernamePrompt && profile && (
        <UsernamePrompt
          title="Change username"
          description="You can change your username only once every 5 days."
          submitLabel="Save username"
          initialValue={profile.username}
          onConfirm={handleChangeUsername}
          onClose={() => setShowUsernamePrompt(false)}
        />
      )}

      {pendingAction && (
        <UsernamePrompt
          action={pendingAction.type}
          initialValue={currentIdentity?.displayName || guestName || ""}
          onConfirm={handleNameConfirm}
          onClose={() => setPendingAction(null)}
        />
      )}
    </div>
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
    <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-emerald-50/80">
        {label}
      </p>
    </div>
  );
}

function KnowledgeSection({
  title,
  emptyMessage,
  entries,
  profiles,
  onIdentityRequired,
  onOpenProfile,
  onOpenEntry,
}: {
  title: string;
  emptyMessage: string;
  entries: KnowledgeEntry[];
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
        entries.map((entry) => (
          <KnowledgeCard
            key={entry.id}
            entry={entry}
            profiles={profiles}
            onIdentityRequired={onIdentityRequired}
            onOpenProfile={onOpenProfile}
            onOpenEntry={onOpenEntry}
          />
        ))
      )}
    </div>
  );
}
