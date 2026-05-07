import {
  type KnowledgeEntry,
  type KnowledgeVisibility,
} from "../types";

export function normalizeKnowledgeVisibility(
  value: unknown,
): KnowledgeVisibility {
  return value === "private" ? "private" : "public";
}

export function canViewKnowledgeEntry(
  entry: Pick<KnowledgeEntry, "authorId"> & { visibility?: unknown },
  viewerAuthorId?: string | null,
) {
  return (
    normalizeKnowledgeVisibility(entry.visibility) === "public" ||
    Boolean(viewerAuthorId && entry.authorId === viewerAuthorId)
  );
}
