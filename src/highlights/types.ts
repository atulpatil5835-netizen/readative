export const NOTEBOOK_HIGHLIGHT_COLOR = "yellow" as const;
export const MAX_NOTEBOOK_HIGHLIGHTS_PER_POST = 500;
export const MAX_NOTEBOOK_HIGHLIGHT_TEXT_CHARS = 3_000;

export interface NotebookHighlight {
  postId: string;
  paragraphId: string;
  startOffset: number;
  endOffset: number;
  color: typeof NOTEBOOK_HIGHLIGHT_COLOR;
  createdAt: number;
  text?: string;
}

export interface NotebookPostDocument {
  highlights: NotebookHighlight[];
}

export function isNotebookHighlight(value: unknown): value is NotebookHighlight {
  if (!value || typeof value !== "object") return false;
  const highlight = value as Partial<NotebookHighlight>;
  const keys = Object.keys(value as Record<string, unknown>);
  const allowedKeys = [
    "postId",
    "paragraphId",
    "startOffset",
    "endOffset",
    "color",
    "createdAt",
    "text",
  ];
  return (
    keys.every((key) => allowedKeys.includes(key)) &&
    typeof highlight.postId === "string" &&
    highlight.postId.length > 0 &&
    highlight.postId.length <= 1_500 &&
    typeof highlight.paragraphId === "string" &&
    highlight.paragraphId.length > 0 &&
    highlight.paragraphId.length <= 128 &&
    Number.isInteger(highlight.startOffset) &&
    Number.isInteger(highlight.endOffset) &&
    (highlight.startOffset ?? -1) >= 0 &&
    (highlight.endOffset ?? 0) > (highlight.startOffset ?? -1) &&
    (highlight.endOffset ?? 0) <= 1_000_000 &&
    highlight.color === NOTEBOOK_HIGHLIGHT_COLOR &&
    typeof highlight.createdAt === "number" &&
    Number.isFinite(highlight.createdAt) &&
    highlight.createdAt >= 0 &&
    (highlight.text === undefined ||
      (typeof highlight.text === "string" &&
        highlight.text.length > 0 &&
        highlight.text.length <= MAX_NOTEBOOK_HIGHLIGHT_TEXT_CHARS))
  );
}

export function normalizeNotebookHighlightText(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.slice(0, MAX_NOTEBOOK_HIGHLIGHT_TEXT_CHARS);
}

export function isSameNotebookRange(
  left: NotebookHighlight,
  right: NotebookHighlight,
) {
  return (
    left.postId === right.postId &&
    left.paragraphId === right.paragraphId &&
    left.startOffset === right.startOffset &&
    left.endOffset === right.endOffset &&
    left.color === right.color
  );
}
