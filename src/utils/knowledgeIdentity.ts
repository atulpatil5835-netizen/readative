const KNOWLEDGE_IDENTITY_KEY = "readativeKnowledgeIdentity";
export const KNOWLEDGE_IDENTITY_EVENT = "knowledge-identity-changed";

export interface KnowledgeIdentity {
  email: string;
  displayName: string;
  authorId: string;
}

export function emailToAuthorId(email: string): string {
  return email.toLowerCase().replace(/[^a-z0-9]/g, "_");
}

function emitIdentityChange(identity: KnowledgeIdentity | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(KNOWLEDGE_IDENTITY_EVENT, {
      detail: identity,
    })
  );
}

export function getKnowledgeIdentity(): KnowledgeIdentity | null {
  try {
    const raw = localStorage.getItem(KNOWLEDGE_IDENTITY_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<KnowledgeIdentity>;
    if (!parsed.email || !parsed.displayName || !parsed.authorId) return null;

    return {
      email: parsed.email,
      displayName: parsed.displayName,
      authorId: parsed.authorId,
    };
  } catch {
    return null;
  }
}

export function saveKnowledgeIdentity(
  email: string,
  displayName: string
): KnowledgeIdentity {
  const identity: KnowledgeIdentity = {
    email: email.trim(),
    displayName: displayName.trim(),
    authorId: emailToAuthorId(email),
  };

  localStorage.setItem(KNOWLEDGE_IDENTITY_KEY, JSON.stringify(identity));
  emitIdentityChange(identity);
  return identity;
}

export function clearKnowledgeIdentity() {
  localStorage.removeItem(KNOWLEDGE_IDENTITY_KEY);
  emitIdentityChange(null);
}
