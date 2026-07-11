export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const PROFILE_HANDLE_PREFIX = "@";

const RESERVED_USERNAMES = new Set([
  "about",
  "account",
  "admin",
  "api",
  "app",
  "auth",
  "category",
  "community",
  "contact",
  "cookies",
  "copyright",
  "dashboard",
  "discover",
  "dmca",
  "edit",
  "explore",
  "favicon",
  "feed",
  "help",
  "home",
  "index",
  "knowledge",
  "legal",
  "login",
  "logout",
  "me",
  "mission",
  "new",
  "notifications",
  "post",
  "posts",
  "privacy",
  "profile",
  "profiles",
  "projects",
  "robots",
  "search",
  "settings",
  "signin",
  "signup",
  "sitemap",
  "smarttalk",
  "smarttalks",
  "support",
  "tag",
  "terms",
  "topic",
  "user",
  "users",
  "www",
]);

export function normalizeUsernameInput(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, USERNAME_MAX_LENGTH);
}

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username);
}

export function validateUsernameInput(rawInput: string): string {
  const username = normalizeUsernameInput(rawInput);

  if (username.length < USERNAME_MIN_LENGTH) {
    throw new Error("Username must be at least 3 characters.");
  }

  if (username.length > USERNAME_MAX_LENGTH) {
    throw new Error("Username must be 20 characters or less.");
  }

  if (!/^[a-z0-9_]+$/.test(username)) {
    throw new Error("Username can use lowercase letters, numbers, and underscores.");
  }

  if (username.startsWith("_") || username.endsWith("_")) {
    throw new Error("Username cannot start or end with an underscore.");
  }

  if (username.includes("__")) {
    throw new Error("Username cannot include repeated underscores.");
  }

  if (isReservedUsername(username)) {
    throw new Error("That username is reserved.");
  }

  return username;
}

export function getUsernameValidationError(rawInput: string): string | null {
  try {
    validateUsernameInput(rawInput);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Use a valid username.";
  }
}

export function isCanonicalUsername(value: string | null | undefined): value is string {
  if (!value) return false;

  try {
    return validateUsernameInput(value) === value;
  } catch {
    return false;
  }
}

export function buildUsernameCandidate(source: string, fallback: string): string {
  const normalizedSource = normalizeUsernameInput(source);
  if (normalizedSource.length >= USERNAME_MIN_LENGTH) {
    return normalizedSource;
  }

  return normalizeUsernameInput(fallback);
}

export function withUsernameSuffix(base: string, suffix: string): string {
  const cleanBase = normalizeUsernameInput(base);
  const cleanSuffix = normalizeUsernameInput(suffix);
  const suffixWithSeparator = cleanSuffix ? `_${cleanSuffix}` : "";
  const baseLimit = Math.max(
    USERNAME_MIN_LENGTH,
    USERNAME_MAX_LENGTH - suffixWithSeparator.length,
  );

  return normalizeUsernameInput(`${cleanBase.slice(0, baseLimit)}${suffixWithSeparator}`);
}

export function getProfileUsernamePath(username: string): string {
  const normalized = validateUsernameInput(username);
  return `/${PROFILE_HANDLE_PREFIX}${encodeURIComponent(normalized)}`;
}

export function getProfilePathForIdentity(profile: {
  id?: string | null;
  username?: string | null;
  usernameLower?: string | null;
}): string {
  const username = profile.usernameLower || profile.username;
  if (isCanonicalUsername(username)) {
    return getProfileUsernamePath(username);
  }

  return `/profile/${encodeURIComponent(profile.id || "")}`;
}

export function parseProfileUsernameHandle(segment: string): string | null {
  if (!segment.startsWith(PROFILE_HANDLE_PREFIX)) return null;

  try {
    return validateUsernameInput(decodeURIComponent(segment.slice(1)));
  } catch {
    return null;
  }
}
