import { type UserProfile, type UserSocialLinks } from "../types";
import { normalizeProfileImage } from "./profileImageOptimizer";

function normalizeProfilePhotoUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeProfileSocialUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  try {
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(value)
      ? value.trim()
      : `https://${value.trim()}`;
    const url = new URL(withProtocol);
    if (url.protocol !== "https:") {
      return undefined;
    }

    return url.toString();
  } catch {
    return undefined;
  }
}

function normalizeProfileSocialLinks(value: unknown): UserSocialLinks {
  if (!value || typeof value !== "object") {
    return {};
  }

  const links = value as Partial<UserSocialLinks>;
  return {
    ...(normalizeProfileSocialUrl(links.linkedin)
      ? { linkedin: normalizeProfileSocialUrl(links.linkedin) }
      : {}),
    ...(normalizeProfileSocialUrl(links.instagram)
      ? { instagram: normalizeProfileSocialUrl(links.instagram) }
      : {}),
    ...(normalizeProfileSocialUrl(links.youtube)
      ? { youtube: normalizeProfileSocialUrl(links.youtube) }
      : {}),
  };
}

function normalizeProfileKnowledgeIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value)]
    .filter((entryId): entryId is string => typeof entryId === "string")
    .map((entryId) => entryId.trim())
    .filter(Boolean);
}

function normalizeProfileText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function hydrateUserProfile(
  data: Partial<UserProfile>,
  id: string,
): UserProfile {
  const username = data.username || "";
  const displayName =
    normalizeProfileText(data.displayName, 64) ||
    normalizeProfileText(
      (data as Partial<UserProfile> & { googleDisplayName?: unknown }).googleDisplayName,
      64,
    ) ||
    username;

  return {
    id,
    email: data.email || "",
    displayName,
    username,
    usernameLower: data.usernameLower || "",
    jobTitle: normalizeProfileText(data.jobTitle, 90),
    bio: typeof data.bio === "string" ? data.bio.trim().slice(0, 220) : "",
    socialLinks: normalizeProfileSocialLinks(data.socialLinks),
    showSocialLinksOnPosts: data.showSocialLinksOnPosts === true,
    likedKnowledgeIds: normalizeProfileKnowledgeIds(data.likedKnowledgeIds),
    bannerImage: normalizeProfileImage(data.bannerImage),
    profileImage: normalizeProfileImage(data.profileImage),
    photoUrl: normalizeProfilePhotoUrl(data.photoUrl),
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
    lastUsernameChangedAt: data.lastUsernameChangedAt ?? null,
  };
}
