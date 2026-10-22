import { Helmet } from "react-helmet-async";
import { CANONICAL_SITE_ORIGIN } from "../utils/routes";

interface SEOProps {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  /** OG image width in pixels (default 1200) */
  imageWidth?: number;
  /** OG image height in pixels (default 630) */
  imageHeight?: number;
  imageAlt?: string;
  url?: string;
  ampUrl?: string;
  type?: "website" | "article" | "profile";
  schema?: object | object[];
  robots?: "index" | "noindex";
  /** Article-specific: ISO 8601 date string */
  publishedTime?: string;
  modifiedTime?: string;
  authorName?: string;
  /** Content section / category for article:section and AdSense targeting */
  section?: string;
  /** Disable following links on this page (nofollow) */
  noFollow?: boolean;
  /** Explicit canonical URL override – use sparingly */
  canonicalUrl?: string;
}

function toAbsoluteUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  return `${CANONICAL_SITE_ORIGIN}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

const SITE_TITLE = "Readative";
const SITE_TWITTER = "@Readative";
const ADSENSE_PUBLISHER = "ca-pub-8482951627272767";
const DEFAULT_OG_IMAGE_WIDTH = 1200;
const DEFAULT_OG_IMAGE_HEIGHT = 630;

function normalizeTitleBrand(value: string) {
  return value.replace(/\bReadative\b/g, SITE_TITLE);
}

/** Strip HTML tags, collapse whitespace, and truncate to maxLen characters. */
function cleanDescription(text: string, maxLen = 160) {
  const stripped = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return stripped.length > maxLen ? `${stripped.slice(0, maxLen - 1)}\u2026` : stripped;
}

export function SEO({
  title,
  description,
  keywords = [],
  image,
  imageWidth,
  imageHeight,
  imageAlt,
  url,
  ampUrl,
  type = "website",
  schema,
  robots = "index",
  publishedTime,
  modifiedTime,
  authorName,
  section,
  noFollow = false,
  canonicalUrl,
}: SEOProps) {
  const pathname = typeof window === "undefined" ? "/" : window.location.pathname;
  const baseUrl = `${CANONICAL_SITE_ORIGIN}${pathname}`;
  const resolvedUrl = url ? toAbsoluteUrl(url) : baseUrl;
  const resolvedCanonical = canonicalUrl ? toAbsoluteUrl(canonicalUrl) : resolvedUrl;
  const resolvedAmpUrl = ampUrl ? toAbsoluteUrl(ampUrl) : null;
  const resolvedImage = toAbsoluteUrl(image || "/logo.png");
  const resolvedImageWidth = imageWidth ?? DEFAULT_OG_IMAGE_WIDTH;
  const resolvedImageHeight = imageHeight ?? DEFAULT_OG_IMAGE_HEIGHT;
  const resolvedImageAlt = imageAlt || `${SITE_TITLE} – practical knowledge platform`;

  const normalizedTitle = normalizeTitleBrand(title);
  const fullTitle = /\breadative\b/i.test(normalizedTitle)
    ? normalizedTitle
    : `${normalizedTitle} | ${SITE_TITLE}`;

  const cleanedDesc = cleanDescription(description);

  // Deduplicated, site-wide + page-specific keyword list
  const keywordList = [
    "Readative",
    "knowledge sharing",
    "learning community",
    "educational posts",
    "SmartTalk Q&A",
    ...keywords,
  ].filter((k, i, arr) => arr.indexOf(k) === i);

  const robotsFollow = noFollow ? "nofollow" : "follow";
  const robotsDir = `${robots === "noindex" ? "noindex" : "index"}, ${robotsFollow}, max-image-preview:large, max-snippet:-1, max-video-preview:-1`;

  // Support arrays of schemas or a single schema object
  const schemas = schema
    ? Array.isArray(schema)
      ? schema
      : [schema]
    : [];

  return (
    <Helmet>
      {/* ── Core ──────────────────────────────────────── */}
      <title>{fullTitle}</title>
      <meta name="description" content={cleanedDesc} />
      <meta name="keywords" content={keywordList.join(", ")} />
      <meta name="application-name" content={SITE_TITLE} />
      <meta name="generator" content="Readative" />
      {authorName && <meta name="author" content={authorName} />}

      {/* ── Canonical & AMP ──────────────────────────── */}
      <link rel="canonical" href={resolvedCanonical} />
      {resolvedAmpUrl && <link rel="amphtml" href={resolvedAmpUrl} />}

      {/* ── Crawl directives ──────────────────────────── */}
      <meta name="robots" content={robotsDir} />
      <meta name="googlebot" content={robotsDir} />
      <meta name="bingbot" content={robotsDir} />

      {/* ── Open Graph ────────────────────────────────── */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={cleanedDesc} />
      <meta property="og:image" content={resolvedImage} />
      <meta property="og:image:secure_url" content={resolvedImage} />
      <meta property="og:image:width" content={String(resolvedImageWidth)} />
      <meta property="og:image:height" content={String(resolvedImageHeight)} />
      <meta property="og:image:alt" content={resolvedImageAlt} />
      <meta property="og:image:type" content="image/png" />
      <meta property="og:url" content={resolvedUrl} />
      <meta property="og:site_name" content={SITE_TITLE} />
      <meta property="og:locale" content="en_US" />

      {/* ── Article Open Graph ────────────────────────── */}
      {type === "article" && publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {type === "article" && modifiedTime && (
        <meta property="article:modified_time" content={modifiedTime} />
      )}
      {type === "article" && authorName && (
        <meta property="article:author" content={authorName} />
      )}
      {type === "article" && section && (
        <meta property="article:section" content={section} />
      )}
      {type === "article" &&
        keywords.slice(0, 6).map((tag) => (
          <meta key={`article-tag-${tag}`} property="article:tag" content={tag} />
        ))}

      {/* ── Twitter / X Card ──────────────────────────── */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={SITE_TWITTER} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={cleanedDesc} />
      <meta name="twitter:image" content={resolvedImage} />
      <meta name="twitter:image:alt" content={resolvedImageAlt} />
      {authorName && (
        <meta name="twitter:creator" content={`@${authorName.replace(/\s+/g, "")}`} />
      )}

      {/* ── Google AdSense publisher hint ─────────────── */}
      <meta name="google-adsense-account" content={ADSENSE_PUBLISHER} />
      {section && <meta name="content-section" content={section} />}

      {/* ── Structured Data (JSON-LD) ─────────────────── */}
      {schemas.map((s, i) => (
        <script key={`schema-${i}`} type="application/ld+json">
          {JSON.stringify(s)}
        </script>
      ))}
    </Helmet>
  );
}

