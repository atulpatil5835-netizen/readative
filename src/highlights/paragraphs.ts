import type { NotebookHighlight } from "./types";

const RICH_TEXT_TOKEN_PATTERN =
  /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*\*([\s\S]+?)\*\*\*|\*\*([\s\S]+?)\*\*|\*([\s\S]+?)\*|(@[a-z0-9_]+)/gi;

function hashParagraphText(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function normalizeParagraphSource(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function buildNotebookParagraphId(value: string, occurrence: number) {
  return `p-${hashParagraphText(normalizeParagraphSource(value))}-${occurrence}`;
}

export function buildNotebookParagraphIds(sections: string[]) {
  const occurrences = new Map<string, number>();
  return sections.map((section) => {
    const normalized = normalizeParagraphSource(section);
    const occurrence = occurrences.get(normalized) || 0;
    occurrences.set(normalized, occurrence + 1);
    return buildNotebookParagraphId(section, occurrence);
  });
}

export function splitNotebookParagraphs(content: string) {
  return content
    .split(/\r?\n(?:[ \t]*\r?\n)+/)
    .map((section) => section.trim())
    .filter(Boolean);
}

function isSafeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function getRenderedParagraphText(
  value: string,
  allowLinks = true,
): string {
  let result = "";
  let cursor = 0;
  RICH_TEXT_TOKEN_PATTERN.lastIndex = 0;

  for (const match of value.matchAll(RICH_TEXT_TOKEN_PATTERN)) {
    const start = match.index ?? 0;
    result += value.slice(cursor, start);
    if (match[1] && match[2] && allowLinks && isSafeHttpUrl(match[2])) {
      result += getRenderedParagraphText(match[1], false);
    } else if (match[1] && match[2]) {
      result += match[0];
    } else if (match[3]) {
      result += getRenderedParagraphText(match[3], allowLinks);
    } else if (match[4]) {
      result += getRenderedParagraphText(match[4], allowLinks);
    } else if (match[5]) {
      result += getRenderedParagraphText(match[5], allowLinks);
    } else if (match[6]) {
      result += match[6];
    }
    cursor = start + match[0].length;
  }

  result += value.slice(cursor);
  return result;
}

export function getNotebookPreview(
  content: string,
  highlights: NotebookHighlight[],
) {
  const sections = splitNotebookParagraphs(content);
  const paragraphIds = buildNotebookParagraphIds(sections);

  for (const highlight of [...highlights].sort(
    (left, right) => left.createdAt - right.createdAt,
  )) {
    const paragraphIndex = paragraphIds.indexOf(highlight.paragraphId);
    if (paragraphIndex < 0) continue;
    const paragraphText = getRenderedParagraphText(sections[paragraphIndex]);
    if (
      highlight.startOffset < 0 ||
      highlight.endOffset > paragraphText.length ||
      highlight.startOffset >= highlight.endOffset
    ) {
      continue;
    }
    const selected = paragraphText
      .slice(highlight.startOffset, highlight.endOffset)
      .trim();
    if (selected) return selected.slice(0, 180);
  }

  return null;
}
