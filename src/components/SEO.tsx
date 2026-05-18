import { Helmet } from "react-helmet-async";

interface SEOProps {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  url?: string;
  ampUrl?: string;
  type?: "website" | "article" | "profile";
  schema?: object | object[];
}

function toAbsoluteUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  if (typeof window === "undefined") {
    return `https://readative.com${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
  }

  return new URL(pathOrUrl, window.location.origin).toString();
}

export function SEO({
  title,
  description,
  keywords = [],
  image,
  url,
  ampUrl,
  type = "website",
  schema,
}: SEOProps) {
  const siteTitle = "Readative";
  const baseUrl =
    typeof window === "undefined"
      ? "https://readative.com"
      : `${window.location.origin}${window.location.pathname}`;
  const resolvedUrl = url || baseUrl;
  const resolvedAmpUrl = ampUrl ? toAbsoluteUrl(ampUrl) : null;
  const resolvedImage = toAbsoluteUrl(image || "/logo.png");
  const fullTitle = title.includes(siteTitle) ? title : `${title} | ${siteTitle}`;
  const keywordList = [
    "knowledge sharing",
    "learning community",
    "educational posts",
    "readative",
    ...keywords,
  ];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywordList.join(", ")} />
      <meta name="application-name" content={siteTitle} />
      <link rel="canonical" href={resolvedUrl} />
      {resolvedAmpUrl && <link rel="amphtml" href={resolvedAmpUrl} />}

      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={resolvedImage} />
      <meta property="og:image:alt" content={`${siteTitle} knowledge sharing`} />
      <meta property="og:url" content={resolvedUrl} />
      <meta property="og:site_name" content={siteTitle} />
      <meta property="og:locale" content="en_US" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={resolvedImage} />
      <meta name="twitter:image:alt" content={`${siteTitle} knowledge sharing`} />

      <meta
        name="robots"
        content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
      />
      <meta
        name="googlebot"
        content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
      />

      {schema && (
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
      )}
    </Helmet>
  );
}
