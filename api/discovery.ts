import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  DISCOVERY_INDEX_PATH,
  SITE_URL,
  type SeoPost,
  type SeoProfile,
  type SeoSmartTalk,
  escapeXml,
  loadSeoData,
} from "./_seoData.js";
import { SEO_CATEGORIES, SEO_TOPICS } from "../src/utils/seoTaxonomy.js";
import {
  buildPostSeoPath,
  buildSmartTalkSeoPath,
} from "../src/utils/seoUrls.js";

function escapeHtml(value: string) {
  return escapeXml(value);
}

function renderLink(path: string, label: string, description?: string) {
  return `<li><a href="${escapeHtml(path)}">${escapeHtml(label)}</a>${
    description ? ` <span>${escapeHtml(description)}</span>` : ""
  }</li>`;
}

function escapeJsonForHtml(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function renderJsonLd(schema: object | object[]) {
  return `<script type="application/ld+json">${escapeJsonForHtml(schema)}</script>`;
}

function absoluteUrl(path: string) {
  return `${SITE_URL}${path}`;
}

function buildDiscoverySchemas({
  posts,
  profiles,
  smartTalks,
}: {
  posts: SeoPost[];
  profiles: SeoProfile[];
  smartTalks: SeoSmartTalk[];
}) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Readative",
      url: SITE_URL,
      logo: absoluteUrl("/logo.png"),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Readative",
      url: SITE_URL,
      publisher: {
        "@type": "Organization",
        name: "Readative",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: SITE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Discovery Index",
          item: absoluteUrl(DISCOVERY_INDEX_PATH),
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Readative Discovery Index",
      url: absoluteUrl(DISCOVERY_INDEX_PATH),
      description:
        "Crawlable Readative index of published posts, categories, profiles, and SmartTalk discussions.",
      mainEntity: {
        "@type": "ItemList",
        name: "Readative crawlable content",
        itemListElement: [
          ...posts.slice(0, 30).map((post, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: post.title,
            url: absoluteUrl(buildPostSeoPath(post.id, post.title)),
          })),
          ...smartTalks.slice(0, 20).map((question, index) => ({
            "@type": "ListItem",
            position: posts.slice(0, 30).length + index + 1,
            name: question.title,
            url: absoluteUrl(buildSmartTalkSeoPath(question.id, question.title)),
          })),
          ...profiles.slice(0, 20).map((profile, index) => ({
            "@type": "ListItem",
            position: posts.slice(0, 30).length + smartTalks.slice(0, 20).length + index + 1,
            name: profile.name,
            url: absoluteUrl(`/profile/${encodeURIComponent(profile.id)}`),
          })),
        ],
      },
    },
  ];
}

function renderSection(title: string, links: string[]) {
  if (links.length === 0) return "";

  return `<section>
  <h2>${escapeHtml(title)}</h2>
  <ul>
    ${links.join("\n    ")}
  </ul>
</section>`;
}

function renderPostLink(post: SeoPost) {
  const metaLinks = [
    post.category
      ? `<a href="/category/${escapeHtml(encodeURIComponent(post.category))}">${escapeHtml(post.category)}</a>`
      : "",
    post.authorId
      ? `<a href="/profile/${escapeHtml(encodeURIComponent(post.authorId))}">by @${escapeHtml(post.authorName)}</a>`
      : `by @${escapeHtml(post.authorName)}`,
    ...post.hashtags.slice(0, 4).map(
      (tag) => `<a href="/tag/${escapeHtml(encodeURIComponent(tag))}">#${escapeHtml(tag)}</a>`,
    ),
  ].filter(Boolean);

  return `<li><a href="${escapeHtml(buildPostSeoPath(post.id, post.title))}">${escapeHtml(post.title)}</a> <span>${escapeHtml(post.description)}</span>${
    metaLinks.length > 0 ? ` <small>${metaLinks.join(" / ")}</small>` : ""
  }</li>`;
}

function renderSmartTalkLink(question: SeoSmartTalk) {
  const metaLinks = [
    question.category
      ? `<a href="/category/${escapeHtml(encodeURIComponent(question.category))}">${escapeHtml(question.category)}</a>`
      : "",
    question.authorId
      ? `<a href="/profile/${escapeHtml(encodeURIComponent(question.authorId))}">by @${escapeHtml(question.authorName)}</a>`
      : `by @${escapeHtml(question.authorName)}`,
    `${question.answerCount} answers`,
  ].filter(Boolean);

  return `<li><a href="${escapeHtml(buildSmartTalkSeoPath(question.id, question.title))}">${escapeHtml(question.title)}</a> <span>${escapeHtml(question.description)}</span> <small>${metaLinks.join(" / ")}</small></li>`;
}

function renderProfileLink(profile: SeoProfile) {
  return renderLink(
    `/profile/${encodeURIComponent(profile.id)}`,
    profile.name,
    `@${profile.username} / ${profile.postCount} posts / ${profile.smartTalkCount} SmartTalk discussions`,
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  );

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).end();
  }

  const data = await loadSeoData();
  if (data.source === "static") {
    console.error("Discovery SEO data unavailable:", data.errors);
    res.setHeader("Cache-Control", "no-store");
  }
  const recentPosts = [...data.posts].slice(0, 24);
  const recentPostIds = new Set(recentPosts.map((post) => post.id));
  const allPosts = [...data.posts]
    .filter((post) => !recentPostIds.has(post.id))
    .sort((left, right) => left.title.localeCompare(right.title));
  const pageTitle = "Readative Posts and Discovery Index";
  const pageDescription =
    "Crawlable Readative index of published posts, categories, profiles, SmartTalk questions, and important discovery pages.";
  const discoverySchemas = buildDiscoverySchemas({
    posts: data.posts,
    profiles: data.profiles,
    smartTalks: data.smartTalks,
  });

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(pageDescription)}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <link rel="canonical" href="${SITE_URL}${DISCOVERY_INDEX_PATH}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(pageTitle)}" />
  <meta property="og:description" content="${escapeHtml(pageDescription)}" />
  <meta property="og:url" content="${SITE_URL}${DISCOVERY_INDEX_PATH}" />
  <meta property="og:image" content="${SITE_URL}/logo.png" />
  <meta property="og:site_name" content="Readative" />
  <meta property="og:locale" content="en_US" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(pageDescription)}" />
  <meta name="twitter:image" content="${SITE_URL}/logo.png" />
  ${renderJsonLd(discoverySchemas)}
  <style>
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a; background: #f8fafc; }
    main { max-width: 980px; margin: 0 auto; padding: 32px 18px 56px; }
    header { margin-bottom: 24px; }
    h1 { margin: 0 0 8px; font-size: clamp(2rem, 4vw, 3.2rem); line-height: 1.05; }
    h2 { margin: 0 0 12px; font-size: 1.1rem; }
    p { color: #475569; line-height: 1.6; }
    section { margin-top: 18px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; padding: 18px; }
    ul { display: grid; gap: 10px; margin: 0; padding-left: 18px; }
    a { color: #047857; font-weight: 700; text-decoration-thickness: 1px; text-underline-offset: 3px; }
    span { color: #64748b; }
    small { display: block; margin-top: 3px; color: #64748b; }
  </style>
</head>
<body>
<main>
  <header>
    <h1>Readative Discovery Index</h1>
  <p>${data.posts.length} published posts, ${data.smartTalks.length} SmartTalk discussions, and ${data.profiles.length} contributor profiles are linked here for search crawlers and readers.</p>
  </header>
  ${renderSection("Important Pages", [
    renderLink("/", "Readative Home", "Knowledge feed"),
    renderLink("/explore", "Explore", "Topics, posts, discussions, and contributors"),
    renderLink("/smarttalks", "SmartTalk", "Community questions and answers"),
    renderLink("/about", "About Readative", "Mission and platform information"),
    renderLink("/projects", "Projects", "Innovation platform project lifecycle"),
    renderLink("/mission", "Mission", "Info Hub vision and technology direction"),
    renderLink("/support", "Support Independent Innovation", "Maintenance, prototypes, research, and free public tools"),
    renderLink("/contact", "Contact Readative", "Support, privacy, policy, and corrections"),
    renderLink("/privacy", "Privacy Policy"),
    renderLink("/terms", "Terms of Use"),
    renderLink("/community", "Community Guidelines"),
    renderLink("/disclaimer", "Disclaimer"),
    renderLink("/cookies", "Cookie Policy"),
    renderLink("/editorial-policy", "Editorial Policy"),
    renderLink("/content-policy", "Content Policy"),
    renderLink("/corrections-policy", "Corrections Policy"),
    renderLink("/dmca", "DMCA Policy"),
    renderLink("/copyright", "Copyright Policy"),
    renderLink("/sitemap.xml", "XML Sitemap", "Complete machine-readable URL list"),
  ])}
  ${renderSection(
    "Categories",
    SEO_CATEGORIES.map((category) =>
      renderLink(
        category.path,
        category.label,
        `${category.description} Related: ${category.topicSlugs.slice(0, 4).join(", ")}`,
      ),
    ),
  )}
  ${renderSection(
    "Topics",
    SEO_TOPICS.map((topic) =>
      renderLink(topic.path, topic.label, topic.description),
    ),
  )}
  ${renderSection(
    "Recent Posts",
    recentPosts.map(renderPostLink),
  )}
  ${renderSection(
    "SmartTalk Discussions",
    data.smartTalks.map(renderSmartTalkLink),
  )}
  ${renderSection(
    "All Published Posts",
    allPosts.map(renderPostLink),
  )}
  ${renderSection(
    "Profiles",
    data.profiles.map(renderProfileLink),
  )}
</main>
</body>
</html>`;

  res.setHeader("X-Readative-SEO-Source", data.source);
  res.setHeader("X-Readative-SEO-Post-Count", data.posts.length.toString());

  if (req.method === "HEAD") {
    return res.status(200).end();
  }

  return res.status(200).send(html);
}
