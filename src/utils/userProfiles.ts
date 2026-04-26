import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  writeBatch,
  where,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../firebase/firebase";
import { UserProfile } from "../types";
import {
  emailToAuthorId,
  saveKnowledgeIdentity,
} from "./knowledgeIdentity";

export const USERNAME_CHANGE_COOLDOWN_DAYS = 5;
export const USERNAME_CHANGE_COOLDOWN_MS =
  USERNAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

function mapProfile(data: Partial<UserProfile>, id: string): UserProfile {
  return {
    id,
    email: data.email || "",
    username: data.username || "",
    usernameLower: data.usernameLower || "",
    bio: data.bio || "",
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
    lastUsernameChangedAt: data.lastUsernameChangedAt ?? null,
  };
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
  const knowledgeSnapshot = await getDocs(
    query(collection(db, "knowledge"), where("authorId", "==", authorId))
  );

  if (!knowledgeSnapshot.empty) {
    const knowledgeBatch = writeBatch(db);
    knowledgeSnapshot.docs.forEach((item) => {
      knowledgeBatch.update(item.ref, {
        author: username,
      });
    });
    await knowledgeBatch.commit();
  }

  const notificationSnapshot = await getDocs(
    query(collection(db, "notifications"), where("actorAuthorId", "==", authorId))
  );

  if (!notificationSnapshot.empty) {
    const notificationBatch = writeBatch(db);
    notificationSnapshot.docs.forEach((item) => {
      notificationBatch.update(item.ref, {
        actorUsername: username,
      });
    });
    await notificationBatch.commit();
  }
}

function normalizeUsernameSeed(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s.-]+/g, "_");
}

function buildGoogleUsernameSeeds(user: User, authorId: string): string[] {
  const emailLocal = user.email?.split("@")[0] || "";
  const displayName = user.displayName || "";

  return [
    normalizeUsernameSeed(displayName),
    normalizeUsernameSeed(emailLocal),
    `reader_${authorId.slice(0, 6)}`,
  ].filter(Boolean);
}

async function reserveAvailableUsername(
  user: User,
  authorId: string
): Promise<string> {
  const seeds = buildGoogleUsernameSeeds(user, authorId);

  for (const seed of seeds) {
    const candidate = sanitizeUsername(seed);
    if (candidate.length < 3) continue;
    if (!(await isUsernameTaken(candidate, authorId))) {
      return candidate;
    }
  }

  const fallbackBase = sanitizeUsername(seeds[0] || "reader") || "reader";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const suffix = attempt === 0 ? authorId.slice(0, 4) : `${authorId.slice(0, 4)}${attempt}`;
    const candidate = sanitizeUsername(`${fallbackBase}_${suffix}`);
    if (candidate.length < 3) continue;
    if (!(await isUsernameTaken(candidate, authorId))) {
      return candidate;
    }
  }

  throw new Error("Could not reserve a username for this Google account.");
}

export async function getUserProfile(authorId: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(doc(db, "userProfiles", authorId));
  if (!snapshot.exists()) return null;
  return mapProfile(snapshot.data() as Partial<UserProfile>, snapshot.id);
}

export async function ensureSignedInProfile(
  email: string,
  requestedUsername: string
): Promise<UserProfile> {
  const authorId = emailToAuthorId(email);
  const reference = doc(db, "userProfiles", authorId);
  const existing = await getDoc(reference);

  if (existing.exists()) {
    const profile = mapProfile(existing.data() as Partial<UserProfile>, existing.id);
    saveKnowledgeIdentity(profile.email, profile.username);
    return profile;
  }

  const username = validateUsername(requestedUsername);
  if (await isUsernameTaken(username)) {
    throw new Error("That username is already taken.");
  }

  const now = Date.now();
  const profile: UserProfile = {
    id: authorId,
    email: email.trim(),
    username,
    usernameLower: username,
    bio: "",
    createdAt: now,
    updatedAt: now,
    lastUsernameChangedAt: null,
  };

  await setDoc(reference, profile);
  saveKnowledgeIdentity(profile.email, profile.username);
  return profile;
}

export async function ensureGoogleProfile(user: User): Promise<UserProfile> {
  const email = user.email?.trim().toLowerCase();
  if (!email) {
    throw new Error("Your Google account did not return an email address.");
  }

  const authorId = emailToAuthorId(email);
  const reference = doc(db, "userProfiles", authorId);
  const existing = await getDoc(reference);

  if (existing.exists()) {
    const profile = mapProfile(existing.data() as Partial<UserProfile>, existing.id);

    if (profile.email !== email) {
      await updateDoc(reference, {
        email,
        updatedAt: Date.now(),
      });
      profile.email = email;
      profile.updatedAt = Date.now();
    }

    saveKnowledgeIdentity(profile.email, profile.username);
    return profile;
  }

  const username = await reserveAvailableUsername(user, authorId);
  const now = Date.now();
  const profile: UserProfile = {
    id: authorId,
    email,
    username,
    usernameLower: username,
    bio: "",
    createdAt: now,
    updatedAt: now,
    lastUsernameChangedAt: null,
  };

  await setDoc(reference, profile);
  saveKnowledgeIdentity(profile.email, profile.username);
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

  saveKnowledgeIdentity(updated.email, updated.username);
  return updated;
}
