import {
  arrayUnion,
  type DocumentReference,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { type User } from "firebase/auth";
import { db } from "../firebase/firebaseDb";
import {
  type KnowledgeEntry,
  type KnowledgeImageAsset,
  type UserProfile,
  type UserSocialLinks,
} from "../types";
import { getGuestId, getSavedGuestId, saveGuestName } from "./guestIdentity";
import { saveKnowledgeIdentity } from "./knowledgeIdentity";
import { hydrateUserProfile } from "./profileData";
import { getTrustMetrics } from "./trustSystem";
import {
  buildUsernameCandidate,
  normalizeUsernameInput,
  validateUsernameInput,
  withUsernameSuffix,
} from "./usernames";

export const USERNAME_CHANGE_COOLDOWN_DAYS = 5;
export const USERNAME_CHANGE_COOLDOWN_MS =
  USERNAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
export const USER_PROFILE_UPDATED_EVENT = "readative:user-profile-updated";
const GOOGLE_MIGRATION_KEY_PREFIX = "readativeGoogleMigration";
const SOCIAL_HOSTS: Partial<Record<keyof UserSocialLinks, string[]>> = {
  linkedin: ["linkedin.com"],
  instagram: ["instagram.com"],
  github: ["github.com"],
  twitter: ["x.com", "twitter.com"],
  youtube: ["youtube.com", "youtu.be"],
};

export interface UserProfileDetailsInput {
  displayName: string;
  jobTitle: string;
  bio: string;
  socialLinks: Partial<UserSocialLinks>;
  showSocialLinksOnPosts: boolean;
}

function syncLocalProfileIdentity(profile: UserProfile) {
  saveGuestName(profile.username);
  saveKnowledgeIdentity(profile.username, profile.id, profile.email);
}

function announceUserProfileUpdated(profile: UserProfile) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<UserProfile>(USER_PROFILE_UPDATED_EVENT, {
      detail: profile,
    }),
  );
}

function normalizeGooglePhotoUrl(value: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function buildGoogleUsernameBase(user: User): string {
  const source =
    user.displayName ||
    user.email?.split("@")[0] ||
    `reader_${user.uid.slice(0, 8)}`;

  return buildUsernameCandidate(source, `reader_${user.uid.slice(0, 8)}`);
}

function buildGoogleUsernameCandidate(user: User) {
  const base = buildGoogleUsernameBase(user);
  const uidSuffix = user.uid.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return validateUsernameInput(
    withUsernameSuffix(base, uidSuffix.slice(0, 6) || user.uid.slice(0, 6)),
  );
}

async function commitUpdates(
  updates: Array<{
    ref: DocumentReference;
    data: Record<string, unknown>;
  }>
) {
  if (updates.length === 0) return;

  let batch = writeBatch(db);
  let pendingCount = 0;

  for (const update of updates) {
    batch.update(update.ref, update.data);
    pendingCount += 1;

    if (pendingCount >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      pendingCount = 0;
    }
  }

  if (pendingCount > 0) {
    await batch.commit();
  }
}

export function sanitizeUsername(input: string): string {
  return normalizeUsernameInput(input);
}

export function validateUsername(rawInput: string): string {
  return validateUsernameInput(rawInput);
}

function validateDisplayName(rawInput: string, fallbackUsername: string): string {
  const displayName = rawInput.replace(/\s+/g, " ").trim();
  if (!displayName) {
    return fallbackUsername;
  }

  if (displayName.length < 2) {
    throw new Error("Name must be at least 2 characters.");
  }

  if (displayName.length > 64) {
    throw new Error("Name must be 64 characters or less.");
  }

  return displayName;
}

function normalizeProfileText(rawInput: string, maxLength: number): string {
  return rawInput.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeSocialLink(
  platform: keyof UserSocialLinks,
  rawInput?: string,
): string | undefined {
  const input = rawInput?.trim();
  if (!input) {
    return undefined;
  }

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(input)
    ? input
    : `https://${input}`;

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error(`Use a valid ${platform} profile URL.`);
  }

  if (url.protocol === "http:") {
    url.protocol = "https:";
  }

  if (url.protocol !== "https:") {
    throw new Error(`Use a secure ${platform} profile URL.`);
  }

  const hostname = url.hostname.replace(/^www\./i, "").toLowerCase();
  const allowedHosts = SOCIAL_HOSTS[platform];
  if (allowedHosts) {
    const isAllowedHost = allowedHosts.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    );

    if (!isAllowedHost) {
      throw new Error(`Use a valid ${platform} profile URL.`);
    }
  }

  return url.toString();
}

function normalizeSocialLinksInput(
  rawSocialLinks: Partial<UserSocialLinks>,
): UserSocialLinks {
  return {
    ...(normalizeSocialLink("linkedin", rawSocialLinks.linkedin)
      ? { linkedin: normalizeSocialLink("linkedin", rawSocialLinks.linkedin) }
      : {}),
    ...(normalizeSocialLink("instagram", rawSocialLinks.instagram)
      ? { instagram: normalizeSocialLink("instagram", rawSocialLinks.instagram) }
      : {}),
    ...(normalizeSocialLink("github", rawSocialLinks.github)
      ? { github: normalizeSocialLink("github", rawSocialLinks.github) }
      : {}),
    ...(normalizeSocialLink("twitter", rawSocialLinks.twitter)
      ? { twitter: normalizeSocialLink("twitter", rawSocialLinks.twitter) }
      : {}),
    ...(normalizeSocialLink("website", rawSocialLinks.website)
      ? { website: normalizeSocialLink("website", rawSocialLinks.website) }
      : {}),
    ...(normalizeSocialLink("youtube", rawSocialLinks.youtube)
      ? { youtube: normalizeSocialLink("youtube", rawSocialLinks.youtube) }
      : {}),
  };
}

async function commitUsernameMappingTransaction({
  authorId,
  username,
  previousUsername,
  profilePayload,
}: {
  authorId: string;
  username: string;
  previousUsername?: string | null;
  profilePayload: Record<string, unknown>;
}) {
  const normalizedUsername = validateUsername(username);
  const normalizedPreviousUsername = previousUsername
    ? normalizeUsernameInput(previousUsername)
    : "";
  const profileRef = doc(db, "userProfiles", authorId);
  const usernameRef = doc(db, "usernames", normalizedUsername);
  const previousUsernameRef =
    normalizedPreviousUsername && normalizedPreviousUsername !== normalizedUsername
      ? doc(db, "usernames", normalizedPreviousUsername)
      : null;

  await runTransaction(db, async (transaction) => {
    const usernameSnapshot = await transaction.get(usernameRef);
    const previousUsernameSnapshot = previousUsernameRef
      ? await transaction.get(previousUsernameRef)
      : null;
    const existingAuthorId = usernameSnapshot.exists()
      ? usernameSnapshot.data().authorId
      : null;

    if (
      typeof existingAuthorId === "string" &&
      existingAuthorId &&
      existingAuthorId !== authorId
    ) {
      throw new Error("That username is already taken.");
    }

    const now = Date.now();
    transaction.set(
      usernameRef,
      {
        authorId,
        username: normalizedUsername,
        usernameLower: normalizedUsername,
        createdAt:
          usernameSnapshot.exists() && typeof usernameSnapshot.data().createdAt === "number"
            ? usernameSnapshot.data().createdAt
            : now,
        updatedAt: now,
      },
      { merge: true },
    );

    if (
      previousUsernameRef &&
      previousUsernameSnapshot?.exists() &&
      previousUsernameSnapshot.data().authorId === authorId
    ) {
      transaction.delete(previousUsernameRef);
    }

    transaction.set(
      profileRef,
      {
        ...profilePayload,
        username: normalizedUsername,
        usernameLower: normalizedUsername,
        updatedAt: typeof profilePayload.updatedAt === "number" ? profilePayload.updatedAt : now,
      },
      { merge: true },
    );
  });

  return normalizedUsername;
}

export async function getUserProfile(authorId: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(doc(db, "userProfiles", authorId));
  if (!snapshot.exists()) return null;
  return hydrateUserProfile(snapshot.data() as Partial<UserProfile>, snapshot.id);
}

async function migrateGuestActivityToGoogleProfile(
  guestAuthorId: string,
  profile: UserProfile,
) {
  const updates: Array<{
    ref: DocumentReference;
    data: Record<string, unknown>;
  }> = [];
  const migratedLikedEntryIds: string[] = [];

  const knowledgeSnapshot = await getDocs(collection(db, "knowledge"));
  knowledgeSnapshot.docs.forEach((item) => {
    const data = item.data() as Partial<KnowledgeEntry>;
    const payload: Record<string, unknown> = {};

    if (data.authorId === guestAuthorId) {
      payload.authorId = profile.id;
      payload.author = profile.username;
      payload.authorEmail = profile.email || "";
    }

    const trustMetrics = getTrustMetrics(data);

    if (trustMetrics.helpfulIds.includes(guestAuthorId)) {
      migratedLikedEntryIds.push(item.id);
      const nextHelpfulIds = [
        ...new Set(
          trustMetrics.helpfulIds.map((authorId) =>
            authorId === guestAuthorId ? profile.id : authorId,
          ),
        ),
      ];
      payload.likes = nextHelpfulIds;
      payload.likeCount = nextHelpfulIds.length;
      payload.helpfulIds = nextHelpfulIds;
      payload.helpfulCount = nextHelpfulIds.length;
    }

    if (trustMetrics.misleadingIds.includes(guestAuthorId)) {
      const nextMisleadingIds = [
        ...new Set(
          trustMetrics.misleadingIds.map((authorId) =>
            authorId === guestAuthorId ? profile.id : authorId,
          ),
        ),
      ];
      payload.dislikes = nextMisleadingIds;
      payload.dislikeCount = nextMisleadingIds.length;
      payload.misleadingIds = nextMisleadingIds;
      payload.misleadingCount = nextMisleadingIds.length;
    }

    const currentComments = Array.isArray(data.comments) ? data.comments : [];
    const currentMentions = Array.isArray(data.mentions) ? data.mentions : [];
    const nextComments = currentComments.map((comment) =>
      comment.authorId === guestAuthorId
        ? {
            ...comment,
            authorId: profile.id,
            author: profile.username,
          }
        : comment,
    );
    const nextMentions = currentMentions.map((mention) =>
      mention.authorId === guestAuthorId
        ? {
            ...mention,
            authorId: profile.id,
            username: profile.username,
          }
        : mention,
    );

    if (JSON.stringify(nextComments) !== JSON.stringify(currentComments)) {
      payload.comments = nextComments;
    }

    if (JSON.stringify(nextMentions) !== JSON.stringify(currentMentions)) {
      payload.mentions = nextMentions;
    }

    if (Object.keys(payload).length > 0) {
      updates.push({ ref: item.ref, data: payload });
    }
  });

  if (migratedLikedEntryIds.length > 0) {
    updates.push({
      ref: doc(db, "userProfiles", profile.id),
      data: {
        likedKnowledgeIds: arrayUnion(...migratedLikedEntryIds),
      },
    });
  }

  const [targetNotificationSnapshot, actorNotificationSnapshot] = await Promise.all([
    getDocs(
      query(
        collection(db, "notifications"),
        where("targetAuthorId", "==", guestAuthorId),
      ),
    ),
    getDocs(
      query(
        collection(db, "notifications"),
        where("actorAuthorId", "==", guestAuthorId),
      ),
    ),
  ]);
  const notificationDocsById = new Map(
    [...targetNotificationSnapshot.docs, ...actorNotificationSnapshot.docs].map(
      (item) => [item.id, item] as const,
    ),
  );

  notificationDocsById.forEach((item) => {
    const data = item.data() as {
      targetAuthorId?: string;
      actorAuthorId?: string;
    };
    const payload: Record<string, unknown> = {};

    if (data.targetAuthorId === guestAuthorId) {
      payload.targetAuthorId = profile.id;
    }

    if (data.actorAuthorId === guestAuthorId) {
      payload.actorAuthorId = profile.id;
      payload.actorUsername = profile.username;
    }

    if (Object.keys(payload).length > 0) {
      updates.push({ ref: item.ref, data: payload });
    }
  });

  await commitUpdates(updates);
}

async function migrateSavedGuestActivity(profile: UserProfile) {
  if (typeof window === "undefined") return;

  const guestAuthorId = getSavedGuestId();
  if (!guestAuthorId || guestAuthorId === profile.id) return;

  const migrationKey = `${GOOGLE_MIGRATION_KEY_PREFIX}:${profile.id}:${guestAuthorId}`;
  if (localStorage.getItem(migrationKey) === "done") return;

  await migrateGuestActivityToGoogleProfile(guestAuthorId, profile);
  localStorage.setItem(migrationKey, "done");
}

export async function ensureGoogleProfile(user: User): Promise<UserProfile> {
  const reference = doc(db, "userProfiles", user.uid);
  const existing = await getDoc(reference);
  const now = Date.now();
  const email = user.email || "";
  const photoUrl = normalizeGooglePhotoUrl(user.photoURL);

  if (existing.exists()) {
    const existingData = existing.data() as Partial<UserProfile> & {
      googleDisplayName?: string;
    };
    const currentProfile = hydrateUserProfile(
      existingData,
      existing.id,
    );
    const hasSavedDisplayName =
      typeof existingData.displayName === "string" &&
      existingData.displayName.trim().length > 0;
    const payload: Record<string, unknown> = {
      email,
      photoUrl,
      authProvider: "google",
      googleDisplayName: user.displayName || "",
    };

    let profile = currentProfile;
    if (!currentProfile.usernameLower) {
      const username = buildGoogleUsernameCandidate(user);
      payload.username = username;
      payload.usernameLower = username;
      profile = {
        ...profile,
        username,
        usernameLower: username,
      };
    }

    if (!hasSavedDisplayName) {
      payload.displayName = validateDisplayName(
        user.displayName || profile.username,
        profile.username,
      );
      profile = {
        ...profile,
        displayName: String(payload.displayName),
      };
    }

    const shouldUpdateProfile =
      profile.email !== email ||
      profile.photoUrl !== photoUrl ||
      !currentProfile.usernameLower ||
      !hasSavedDisplayName;

    if (shouldUpdateProfile) {
      payload.updatedAt = now;
      profile = {
        ...profile,
        email,
        photoUrl,
        updatedAt: now,
      };
    }

    if (profile.usernameLower) {
      await commitUsernameMappingTransaction({
        authorId: user.uid,
        username: profile.usernameLower,
        previousUsername: currentProfile.usernameLower || currentProfile.username,
        profilePayload: shouldUpdateProfile
          ? payload
          : {
              updatedAt: profile.updatedAt,
            },
      });
    }

    syncLocalProfileIdentity(profile);

    try {
      await migrateSavedGuestActivity(profile);
    } catch (error) {
      console.error("Failed to migrate local guest activity:", error);
    }

    return profile;
  }

  const username = buildGoogleUsernameCandidate(user);
  const profile: UserProfile = {
    id: user.uid,
    email,
    displayName: validateDisplayName(user.displayName || username, username),
    username,
    usernameLower: username,
    jobTitle: "",
    bio: "",
    socialLinks: {},
    showSocialLinksOnPosts: false,
    likedKnowledgeIds: [],
    savedKnowledgeIds: [],
    savedSmartTalkIds: [],
    bannerImage: null,
    profileImage: null,
    photoUrl,
    createdAt: now,
    updatedAt: now,
    lastUsernameChangedAt: null,
  };

  await commitUsernameMappingTransaction({
    authorId: user.uid,
    username,
    profilePayload: {
      ...profile,
      authProvider: "google",
      googleDisplayName: user.displayName || "",
    },
  });
  syncLocalProfileIdentity(profile);

  try {
    await migrateSavedGuestActivity(profile);
  } catch (error) {
    console.error("Failed to migrate local guest activity:", error);
  }

  return profile;
}

export async function ensureGuestProfile(
  requestedUsername: string,
  authorId: string = getGuestId()
): Promise<UserProfile> {
  const reference = doc(db, "userProfiles", authorId);
  const existing = await getDoc(reference);

  if (existing.exists()) {
    const profile = hydrateUserProfile(
      existing.data() as Partial<UserProfile>,
      existing.id,
    );
    if (profile.usernameLower) {
      await commitUsernameMappingTransaction({
        authorId,
        username: profile.usernameLower,
        previousUsername: profile.username,
        profilePayload: {
          updatedAt: profile.updatedAt,
        },
      });
    }
    syncLocalProfileIdentity(profile);
    return profile;
  }

  const username = validateUsername(requestedUsername);

  const now = Date.now();
  const profile: UserProfile = {
    id: authorId,
    email: "",
    displayName: username,
    username,
    usernameLower: username,
    jobTitle: "",
    bio: "",
    socialLinks: {},
    showSocialLinksOnPosts: false,
    likedKnowledgeIds: [],
    savedKnowledgeIds: [],
    savedSmartTalkIds: [],
    bannerImage: null,
    profileImage: null,
    createdAt: now,
    updatedAt: now,
    lastUsernameChangedAt: null,
  };

  await commitUsernameMappingTransaction({
    authorId,
    username,
    profilePayload: { ...profile },
  });
  syncLocalProfileIdentity(profile);
  return profile;
}

export function getUsernameChangeRemaining(profile: UserProfile): number {
  if (!profile.lastUsernameChangedAt) return 0;
  const elapsed = Date.now() - profile.lastUsernameChangedAt;
  return Math.max(0, USERNAME_CHANGE_COOLDOWN_MS - elapsed);
}

export async function changeProfileUsername(
  profile: UserProfile,
  nextUsernameInput: string
): Promise<UserProfile> {
  const nextUsername = validateUsername(nextUsernameInput);
  if (nextUsername === profile.usernameLower) {
    return profile;
  }

  const remaining = getUsernameChangeRemaining(profile);
  if (remaining > 0) {
    const remainingDays = Math.ceil(remaining / (24 * 60 * 60 * 1000));
    throw new Error(
      `You can change your username again in about ${remainingDays} day${remainingDays === 1 ? "" : "s"}.`
    );
  }

  const updated: UserProfile = {
    ...profile,
    username: nextUsername,
    usernameLower: nextUsername,
    updatedAt: Date.now(),
    lastUsernameChangedAt: Date.now(),
  };

  await commitUsernameMappingTransaction({
    authorId: profile.id,
    username: updated.username,
    previousUsername: profile.usernameLower || profile.username,
    profilePayload: {
      updatedAt: updated.updatedAt,
      lastUsernameChangedAt: updated.lastUsernameChangedAt,
    },
  });

  syncLocalProfileIdentity(updated);
  announceUserProfileUpdated(updated);
  return updated;
}

export async function changeProfilePhoto(
  profile: UserProfile,
  nextProfileImage: KnowledgeImageAsset,
): Promise<UserProfile> {
  if (profile.profileImage?.dataUrl === nextProfileImage.dataUrl) {
    return profile;
  }

  const updated: UserProfile = {
    ...profile,
    profileImage: nextProfileImage,
    updatedAt: Date.now(),
  };

  await updateDoc(doc(db, "userProfiles", profile.id), {
    profileImage: updated.profileImage,
    updatedAt: updated.updatedAt,
    avatarId: deleteField(),
  });

  announceUserProfileUpdated(updated);
  return updated;
}

export async function changeProfileBanner(
  profile: UserProfile,
  nextBannerImage: KnowledgeImageAsset,
): Promise<UserProfile> {
  if (profile.bannerImage?.dataUrl === nextBannerImage.dataUrl) {
    return profile;
  }

  const updated: UserProfile = {
    ...profile,
    bannerImage: nextBannerImage,
    updatedAt: Date.now(),
  };

  await updateDoc(doc(db, "userProfiles", profile.id), {
    bannerImage: updated.bannerImage,
    updatedAt: updated.updatedAt,
  });

  announceUserProfileUpdated(updated);
  return updated;
}

export async function updateProfileDetails(
  profile: UserProfile,
  input: UserProfileDetailsInput,
): Promise<UserProfile> {
  const displayName = validateDisplayName(input.displayName, profile.username);
  const jobTitle = normalizeProfileText(input.jobTitle, 90);
  const bio = input.bio.trim().slice(0, 220);
  const socialLinks = normalizeSocialLinksInput(input.socialLinks);
  const showSocialLinksOnPosts =
    input.showSocialLinksOnPosts && Object.keys(socialLinks).length > 0;
  const updated: UserProfile = {
    ...profile,
    displayName,
    jobTitle,
    bio,
    socialLinks,
    showSocialLinksOnPosts,
    updatedAt: Date.now(),
  };

  await updateDoc(doc(db, "userProfiles", profile.id), {
    displayName,
    jobTitle,
    bio,
    socialLinks,
    showSocialLinksOnPosts,
    updatedAt: updated.updatedAt,
  });

  announceUserProfileUpdated(updated);
  return updated;
}

export async function updateProfileSocialLinks(
  profile: UserProfile,
  rawSocialLinks: Partial<UserSocialLinks>,
): Promise<UserProfile> {
  const socialLinks = normalizeSocialLinksInput(rawSocialLinks);
  const updated: UserProfile = {
    ...profile,
    socialLinks,
    updatedAt: Date.now(),
  };

  await updateDoc(doc(db, "userProfiles", profile.id), {
    socialLinks,
    updatedAt: updated.updatedAt,
  });

  announceUserProfileUpdated(updated);
  return updated;
}
