import { UserProfile, KnowledgeEntry } from "../../types";

export function getProfileDisplayName(profile: UserProfile | undefined, fallback: string) {
  return profile?.displayName?.trim() || fallback;
}

export function findAuthorProfile(
  entry: KnowledgeEntry,
  profiles: UserProfile[],
  profileMap: ReadonlyMap<string, UserProfile>,
) {
  const directProfile = profileMap.get(entry.authorId);
  if (directProfile) return directProfile;

  const authorIdKey = entry.authorId.trim().toLowerCase();
  const authorNameKey = entry.author.trim().toLowerCase();
  const authorEmailKey = entry.authorEmail.trim().toLowerCase();

  return profiles.find((profile) => {
    const profileKeys = [
      profile.id,
      profile.username,
      profile.usernameLower,
      profile.displayName,
      profile.email,
    ]
      .filter(Boolean)
      .map((value) => value.trim().toLowerCase());

    return (
      (authorIdKey && profileKeys.includes(authorIdKey)) ||
      (authorNameKey && profileKeys.includes(authorNameKey)) ||
      (authorEmailKey && profileKeys.includes(authorEmailKey))
    );
  });
}

export function isShareAbortError(error: unknown) {
  return (
    error instanceof DOMException &&
    error.name === "AbortError"
  );
}

export async function copyShareTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    if (!document.execCommand("copy")) {
      throw new Error("Clipboard copy was not accepted.");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

const SEEN_VISIBILITY_THRESHOLD = 0.6;
const SEEN_DWELL_MS = 450;

export function observeEntryVisibilityOnce(target: Element, onVisible: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  if (typeof window.IntersectionObserver !== "function") {
    onVisible();
    return () => undefined;
  }

  let timeoutId: number | null = null;
  const clearVisibilityTimeout = () => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  const observer = new window.IntersectionObserver(
    (observedEntries) => {
      const [observedEntry] = observedEntries;
      if (!observedEntry) {
        return;
      }

      if (
        observedEntry.isIntersecting &&
        observedEntry.intersectionRatio >= SEEN_VISIBILITY_THRESHOLD
      ) {
        if (timeoutId !== null) {
          return;
        }

        timeoutId = window.setTimeout(() => {
          clearVisibilityTimeout();
          observer.disconnect();
          onVisible();
        }, SEEN_DWELL_MS);
        return;
      }

      clearVisibilityTimeout();
    },
    {
      threshold: [0.3, SEEN_VISIBILITY_THRESHOLD, 0.9],
    },
  );

  observer.observe(target);

  return () => {
    clearVisibilityTimeout();
    observer.disconnect();
  };
}

export function buildProfilePath(authorId: string) {
  return `/profile/${encodeURIComponent(authorId)}`;
}

export function buildTagPath(tag: string) {
  const normalized = tag.replace(/^#/, "").trim().toLowerCase();
  return `/tag/${encodeURIComponent(normalized || tag)}`;
}
