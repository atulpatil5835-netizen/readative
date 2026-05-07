import {
  type DocumentReference,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { type User } from "firebase/auth";
import { db } from "../firebase/firebase";
import {
  type KnowledgeEntry,
  type KnowledgeImageAsset,
  type UserProfile,
  type UserSocialLinks,
} from "../types";
import { getGuestId, getSavedGuestId, saveGuestName } from "./guestIdentity";
import { saveKnowledgeIdentity } from "./knowledgeIdentity";
import { hydrateUserProfile } from "./profileData";

export const USERNAME_CHANGE_COOLDOWN_DAYS = 5;
export const USERNAME_CHANGE_COOLDOWN_MS =
  USERNAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
const GOOGLE_MIGRATION_KEY_PREFIX = "readativeGoogleMigration";
const SOCIAL_HOSTS: Record<keyof UserSocialLinks, string[]> = {
  linkedin: ["linkedin.com"],
  instagram: ["instagram.com"],
  youtube: ["youtube.com", "youtu.be"],
};

function syncLocalProfileIdentity(profile: UserProfile) {
  saveGuestName(profile.username);
  saveKnowledgeIdentity(profile.username, profile.id);
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
  const username = sanitizeUsername(source.replace(/\s+/g, "_"));

  if (username.length >= 3) {
    return username;
  }

  return sanitizeUsername(`reader_${user.uid.slice(0, 8)}`);
}

function withUsernameSuffix(base: string, suffix: string) {
  const cleanSuffix = sanitizeUsername(suffix);
  const safeBase = base.slice(0, Math.max(3, 20 - cleanSuffix.length));
  return sanitizeUsername(`${safeBase}${cleanSuffix}`);
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
  return input.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
}

export function validateUsername(rawInput: string): string {
  const username = sanitizeUsername(rawInput);
  if (username.length < 3) {
    throw new Error("Username must be at least 3 characters.");
  }

  if (!/^[a-z0-9_]+$/.test(username)) {
    throw new Error("Username can use lowercase letters, numbers, and underscores.");
  }

  return username;
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
  const isAllowedHost = allowedHosts.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );

  if (!isAllowedHost) {
    throw new Error(`Use a valid ${platform} profile URL.`);
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
    ...(normalizeSocialLink("youtube", rawSocialLinks.youtube)
      ? { youtube: normalizeSocialLink("youtube", rawSocialLinks.youtube) }
      : {}),
  };
}

async function isUsernameTaken(usernameLower: string, authorId?: string) {
  const snapshot = await getDocs(
    query(collection(db, "userProfiles"), where("usernameLower", "==", usernameLower))
  );

  return snapshot.docs.some((item) => item.id !== authorId);
}

async function getAvailableGoogleUsername(user: User) {
  const base = buildGoogleUsernameBase(user);
  const uidSuffix = user.uid.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const candidates = [
    base,
    withUsernameSuffix(base, `_${uidSuffix.slice(0, 4)}`),
    withUsernameSuffix(base, `_${uidSuffix.slice(0, 6)}`),
    withUsernameSuffix("reader", `_${uidSuffix.slice(0, 8)}`),
  ];

  for (const candidate of candidates) {
    if (candidate.length >= 3 && !(await isUsernameTaken(candidate, user.uid))) {
      return candidate;
    }
  }

  for (let index = 0; index < 12; index += 1) {
    const candidate = withUsernameSuffix(
      "reader",
      `_${uidSuffix.slice(0, 6)}${index}`,
    );
    if (!(await isUsernameTaken(candidate, user.uid))) {
      return candidate;
    }
  }

  throw new Error("Could not create a unique username for this Google account.");
}

async function syncUsernameAcrossContent(authorId: string, username: string) {
  const updates: Array<{
    ref: DocumentReference;
    data: Record<string, unknown>;
  }> = [];

  const authoredKnowledgeSnapshot = await getDocs(
    query(collection(db, "knowledge"), where("authorId", "==", authorId))
  );

  authoredKnowledgeSnapshot.docs.forEach((item) => {
    updates.push({
      ref: item.ref,
      data: {
        author: username,
      },
    });
  });

  const allKnowledgeSnapshot = await getDocs(collection(db, "knowledge"));
  allKnowledgeSnapshot.docs.forEach((item) => {
    const data = item.data() as Partial<KnowledgeEntry>;
    const nextComments = (data.comments || []).map((comment) =>
      comment.authorId === authorId && comment.author !== username
        ? {
            ...comment,
            author: username,
          }
        : comment
    );
    const nextMentions = (data.mentions || []).map((mention) =>
      mention.authorId === authorId && mention.username !== username
        ? {
            ...mention,
            username,
          }
        : mention
    );

    const commentsChanged =
      JSON.stringify(nextComments) !== JSON.stringify(data.comments || []);
    const mentionsChanged =
      JSON.stringify(nextMentions) !== JSON.stringify(data.mentions || []);

    if (!commentsChanged && !mentionsChanged) {
      return;
    }

    const payload: Record<string, unknown> = {};
    if (commentsChanged) payload.comments = nextComments;
    if (mentionsChanged) payload.mentions = nextMentions;

    updates.push({
      ref: item.ref,
      data: payload,
    });
  });

  const notificationSnapshot = await getDocs(
    query(collection(db, "notifications"), where("actorAuthorId", "==", authorId))
  );

  notificationSnapshot.docs.forEach((item) => {
    updates.push({
      ref: item.ref,
      data: {
        actorUsername: username,
      },
    });
  });

  await commitUpdates(updates);
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

  const knowledgeSnapshot = await getDocs(collection(db, "knowledge"));
  knowledgeSnapshot.docs.forEach((item) => {
    const data = item.data() as Partial<KnowledgeEntry>;
    const payload: Record<string, unknown> = {};

    if (data.authorId === guestAuthorId) {
      payload.authorId = profile.id;
      payload.author = profile.username;
      payload.authorEmail = profile.email || "";
    }

    if (Array.isArray(data.likes) && data.likes.includes(guestAuthorId)) {
      payload.likes = [
        ...new Set(
          data.likes.map((authorId) =>
            authorId === guestAuthorId ? profile.id : authorId,
          ),
        ),
      ];
    }

    const nextComments = (data.comments || []).map((comment) =>
      comment.authorId === guestAuthorId
        ? {
            ...comment,
            authorId: profile.id,
            author: profile.username,
          }
        : comment,
    );
    const nextMentions = (data.mentions || []).map((mention) =>
      mention.authorId === guestAuthorId
        ? {
            ...mention,
            authorId: profile.id,
            username: profile.username,
          }
        : mention,
    );

    if (JSON.stringify(nextComments) !== JSON.stringify(data.comments || [])) {
      payload.comments = nextComments;
    }

    if (JSON.stringify(nextMentions) !== JSON.stringify(data.mentions || [])) {
      payload.mentions = nextMentions;
    }

    if (Object.keys(payload).length > 0) {
      updates.push({ ref: item.ref, data: payload });
    }
  });

  const notificationSnapshot = await getDocs(collection(db, "notifications"));
  notificationSnapshot.docs.forEach((item) => {
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
    const currentProfile = hydrateUserProfile(
      existing.data() as Partial<UserProfile>,
      existing.id,
    );
    const payload: Record<string, unknown> = {
      email,
      photoUrl,
      authProvider: "google",
      googleDisplayName: user.displayName || "",
    };

    let profile = currentProfile;
    if (!currentProfile.usernameLower) {
      const username = await getAvailableGoogleUsername(user);
      payload.username = username;
      payload.usernameLower = username;
      profile = {
        ...profile,
        username,
        usernameLower: username,
      };
    }

    const shouldUpdateProfile =
      profile.email !== email ||
      profile.photoUrl !== photoUrl ||
      !currentProfile.usernameLower;

    if (shouldUpdateProfile) {
      payload.updatedAt = now;
      await setDoc(reference, payload, { merge: true });
      profile = {
        ...profile,
        email,
        photoUrl,
        updatedAt: now,
      };
    }

    syncLocalProfileIdentity(profile);

    try {
      await migrateSavedGuestActivity(profile);
    } catch (error) {
      console.error("Failed to migrate local guest activity:", error);
    }

    return profile;
  }

  const username = await getAvailableGoogleUsername(user);
  const profile: UserProfile = {
    id: user.uid,
    email,
    username,
    usernameLower: username,
    bio: "",
    socialLinks: {},
    profileImage: null,
    photoUrl,
    createdAt: now,
    updatedAt: now,
    lastUsernameChangedAt: null,
  };

  await setDoc(reference, {
    ...profile,
    authProvider: "google",
    googleDisplayName: user.displayName || "",
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
    syncLocalProfileIdentity(profile);
    return profile;
  }

  const username = validateUsername(requestedUsername);
  if (await isUsernameTaken(username, authorId)) {
    throw new Error("That username is already taken.");
  }

  const now = Date.now();
  const profile: UserProfile = {
    id: authorId,
    email: "",
    username,
    usernameLower: username,
    bio: "",
    socialLinks: {},
    profileImage: null,
    createdAt: now,
    updatedAt: now,
    lastUsernameChangedAt: null,
  };

  await setDoc(reference, profile);
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

  if (await isUsernameTaken(nextUsername, profile.id)) {
    throw new Error("That username is already taken.");
  }

  const updated: UserProfile = {
    ...profile,
    username: nextUsername,
    usernameLower: nextUsername,
    updatedAt: Date.now(),
    lastUsernameChangedAt: Date.now(),
  };

  await updateDoc(doc(db, "userProfiles", profile.id), {
    username: updated.username,
    usernameLower: updated.usernameLower,
    updatedAt: updated.updatedAt,
    lastUsernameChangedAt: updated.lastUsernameChangedAt,
  });

  await syncUsernameAcrossContent(profile.id, updated.username);
  syncLocalProfileIdentity(updated);
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

  return updated;
}
