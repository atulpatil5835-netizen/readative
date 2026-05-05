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
import { db } from "../firebase/firebase";
import {
  type KnowledgeEntry,
  type KnowledgeImageAsset,
  type UserProfile,
} from "../types";
import { getGuestId, saveGuestName } from "./guestIdentity";
import { saveKnowledgeIdentity } from "./knowledgeIdentity";
import { hydrateUserProfile } from "./profileData";

export const USERNAME_CHANGE_COOLDOWN_DAYS = 5;
export const USERNAME_CHANGE_COOLDOWN_MS =
  USERNAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

function syncLocalProfileIdentity(profile: UserProfile) {
  saveGuestName(profile.username);
  saveKnowledgeIdentity(profile.username, profile.id);
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

async function isUsernameTaken(usernameLower: string, authorId?: string) {
  const snapshot = await getDocs(
    query(collection(db, "userProfiles"), where("usernameLower", "==", usernameLower))
  );

  return snapshot.docs.some((item) => item.id !== authorId);
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
