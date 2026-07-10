export const SEO_DOCUMENT_SEPARATOR = "--";

export type SeoDocumentKind = "post" | "smarttalk";

const SEO_DOCUMENT_PATH_PREFIX: Record<SeoDocumentKind, string> = {
  post: "/posts",
  smarttalk: "/smarttalk",
};

const SEO_DOCUMENT_FALLBACK_SLUG: Record<SeoDocumentKind, string> = {
  post: "readative-post",
  smarttalk: "smarttalk-question",
};

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function createSeoSlug(
  value: string | null | undefined,
  fallback = "readative",
) {
  const normalized = (value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['"`’‘“”]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

export function buildSeoDocumentSegment(
  kind: SeoDocumentKind,
  id: string,
  titleOrSlug?: string | null,
) {
  const slug = createSeoSlug(titleOrSlug, SEO_DOCUMENT_FALLBACK_SLUG[kind]);
  return `${slug}${SEO_DOCUMENT_SEPARATOR}${encodeURIComponent(id)}`;
}

export function buildSeoDocumentPath(
  kind: SeoDocumentKind,
  id: string,
  titleOrSlug?: string | null,
) {
  return `${SEO_DOCUMENT_PATH_PREFIX[kind]}/${buildSeoDocumentSegment(
    kind,
    id,
    titleOrSlug,
  )}`;
}

export function buildPostSeoPath(id: string, titleOrSlug?: string | null) {
  return buildSeoDocumentPath("post", id, titleOrSlug);
}

export function buildSmartTalkSeoPath(id: string, titleOrSlug?: string | null) {
  return buildSeoDocumentPath("smarttalk", id, titleOrSlug);
}

export function extractSeoDocumentId(segment: string | null | undefined) {
  const trimmed = (segment || "").trim().replace(/^\/+|\/+$/g, "");
  if (!trimmed) return "";

  const lastPathPart = trimmed.split("/").filter(Boolean).pop() || "";
  const separatorIndex = lastPathPart.lastIndexOf(SEO_DOCUMENT_SEPARATOR);
  const rawId =
    separatorIndex >= 0
      ? lastPathPart.slice(separatorIndex + SEO_DOCUMENT_SEPARATOR.length)
      : lastPathPart;

  return safeDecodeURIComponent(rawId);
}

export function isCanonicalSeoDocumentSegment(
  kind: SeoDocumentKind,
  segment: string,
  id: string,
  titleOrSlug?: string | null,
) {
  return segment === buildSeoDocumentSegment(kind, id, titleOrSlug);
}
