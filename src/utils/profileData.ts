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

export function hydrateUserProfile(
  data: Partial<UserProfile>,
  id: string,
): UserProfile {
  return {
    id,
    email: data.email || "",
    username: data.username || "",
    usernameLower: data.usernameLower || "",
    bio: data.bio || "",
    socialLinks: normalizeProfileSocialLinks(data.socialLinks),
    profileImage: normalizeProfileImage(data.profileImage),
    photoUrl: normalizeProfilePhotoUrl(data.photoUrl),
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
    lastUsernameChangedAt: data.lastUsernameChangedAt ?? null,
  };
}
