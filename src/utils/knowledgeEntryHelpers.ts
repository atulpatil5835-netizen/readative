import type { TaggedUser, UserProfile } from "../types";

export const parseManualHashtags = (input: string) =>
  input
    .split(/[\s,\n]+/)
    .map((token) => token.replace(/^#/, "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);

export const extractInlineHashtags = (text: string) =>
  [...text.matchAll(/#([a-z0-9][a-z0-9_-]*)/gi)].map((match) =>
    match[1].toLowerCase(),
  );

export const mergeHashtags = (...sources: string[][]) =>
  [
    ...new Set(
      sources
        .flat()
        .map((tag) => tag.toLowerCase())
        .filter(Boolean),
    ),
  ].slice(0, 8);

export const createExcerpt = (text: string, maxLength = 155) => {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength - 3).trim()}...`;
};

export const estimateReadMinutes = (text: string) => {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(wordCount / 180) || 1);
};

export const extractMentionKeys = (text: string) => [
  ...new Set(
    [...text.matchAll(/(?:^|\s)@([a-z0-9_]{1,20})/gi)].map((match) =>
      match[1].toLowerCase(),
    ),
  ),
];

export const resolveMentions = (
  text: string,
  profiles: UserProfile[],
): TaggedUser[] => {
  const profileMap = new Map(
    profiles.map((profile) => [profile.usernameLower, profile] as const),
  );

  return extractMentionKeys(text)
    .map((usernameLower) => profileMap.get(usernameLower))
    .filter((profile): profile is UserProfile => Boolean(profile))
    .map((profile) => ({
      authorId: profile.id,
      username: profile.username,
    }));
};
