import { getGuestId, getGuestName } from "./guestIdentity";

const KNOWLEDGE_IDENTITY_KEY = "readativeKnowledgeIdentity";
export const KNOWLEDGE_IDENTITY_EVENT = "knowledge-identity-changed";

export interface KnowledgeIdentity {
  displayName: string;
  authorId: string;
  email?: string;
}

function emitIdentityChange(identity: KnowledgeIdentity | null) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(KNOWLEDGE_IDENTITY_EVENT, {
      detail: identity,
    })
  );
}

function normalizeIdentity(parsed: Partial<KnowledgeIdentity> | null) {
  const displayName = parsed?.displayName?.trim() || getGuestName();
  if (!displayName) {
    return null;
  }

  const authorId = parsed?.authorId?.trim() || getGuestId();

  return {
    displayName,
    authorId,
    ...(typeof parsed?.email === "string" && parsed.email.trim()
      ? { email: parsed.email.trim().toLowerCase() }
      : {}),
  };
}

export function getKnowledgeIdentity(): KnowledgeIdentity | null {
  try {
    const raw = localStorage.getItem(KNOWLEDGE_IDENTITY_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<KnowledgeIdentity>) : null;
    const identity = normalizeIdentity(parsed);

    if (!identity) {
      return null;
    }

    localStorage.setItem(KNOWLEDGE_IDENTITY_KEY, JSON.stringify(identity));
    return identity;
  } catch {
    const fallbackName = getGuestName();
    if (!fallbackName) {
      return null;
    }

    const identity = {
      displayName: fallbackName,
      authorId: getGuestId(),
    };

    localStorage.setItem(KNOWLEDGE_IDENTITY_KEY, JSON.stringify(identity));
    return identity;
  }
}

export function saveKnowledgeIdentity(
  displayName: string,
  authorId: string = getGuestId(),
  email?: string | null,
): KnowledgeIdentity {
  const identity: KnowledgeIdentity = {
    displayName: displayName.trim(),
    authorId,
    ...(email?.trim() ? { email: email.trim().toLowerCase() } : {}),
  };

  localStorage.setItem(KNOWLEDGE_IDENTITY_KEY, JSON.stringify(identity));
  emitIdentityChange(identity);
  return identity;
}

export function clearKnowledgeIdentity() {
  localStorage.removeItem(KNOWLEDGE_IDENTITY_KEY);
  emitIdentityChange(null);
}
