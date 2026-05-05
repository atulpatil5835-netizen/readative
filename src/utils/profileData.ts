import { type UserProfile } from "../types";
import { normalizeProfileImage } from "./profileImageOptimizer";

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
    profileImage: normalizeProfileImage(data.profileImage),
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
    lastUsernameChangedAt: data.lastUsernameChangedAt ?? null,
  };
}
