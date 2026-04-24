import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
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

  saveKnowledgeIdentity(updated.email, updated.username);
  return updated;
}
