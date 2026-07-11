import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  SITE_URL,
  type SeoPost,
  type SeoProfile,
  type SeoSmartTalk,
  buildSeoProfilePath,
  loadSeoData,
} from "./_seoData.js";
import {
  SEO_DOCUMENT_STYLES,
  escapeHtml,
  renderAppDocument,
  renderJsonLd,
} from "./_document.js";
import { buildPostSeoPath, buildSmartTalkSeoPath } from "../src/utils/seoUrls.js";
import { normalizeUsernameInput } from "../src/utils/usernames.js";

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function findProfile({
  profiles,
  id,
  username,
}: {
  profiles: SeoProfile[];
  id: string;
  username: string;
}) {
  const normalizedUsername = normalizeUsernameInput(username.replace(/^@/, ""));
  if (normalizedUsername) {
    const byUsername = profiles.find(
      (profile) => normalizeUsernameInput(profile.username) === normalizedUsername,
    );
    if (byUsername) return byUsername;
  }

  return profiles.find((profile) => profile.id === id) || null;
}

function renderNotFound(identifier: string) {
  const head = `
    <title>Profile Not Found | Readative</title>
    <meta name="description" content="The requested Readative profile is not available." />
    <meta name="robots" content="noindex, follow" />
    ${SEO_DOCUMENT_STYLES}`;
  const main = `<div class="seo-document"><div class="seo-shell">
    <nav class="seo-nav"><a class="seo-brand" href="/">Readative</a><a href="/posts">Browse posts</a></nav>
    <main class="seo-card"><p class="seo-kicker">Error 404</p><h1>Profile not found</h1><p>The profile <code>${escapeHtml(identifier || "unknown")}</code> is not public or does not exist.</p></main>
  </div></div>`;
  return renderAppDocument({ head, main });
}

function renderPostList(posts: SeoPost[]) {
  if (posts.length === 0) {
    return '<li><a href="/posts">Browse Readative posts</a></li>';
  }

  return posts
    .map(
      (post) => `<li>
        <a href="${buildPostSeoPath(post.id, post.title)}">${escapeHtml(post.title)}</a>
        <span>${escapeHtml(post.description)}</span>
      </li>`,
    )
    .join("");
}

function renderSmartTalkList(questions: SeoSmartTalk[]) {
  if (questions.length === 0) {
    return '<li><a href="/smarttalks">Browse SmartTalk discussions</a></li>';
  }

  return questions
    .map(
      (question) => `<li>
        <a href="${buildSmartTalkSeoPath(question.id, question.title)}">${escapeHtml(question.title)}</a>
        <span>${question.answerCount} ${question.answerCount === 1 ? "answer" : "answers"}</span>
      </li>`,
    )
    .join("");
}

function buildProfileSchemas({
  profile,
  canonicalUrl,
  posts,
  smartTalks,
}: {
  profile: SeoProfile;
  canonicalUrl: string;
  posts: SeoPost[];
  smartTalks: SeoSmartTalk[];
}) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Person",
      "@id": `${canonicalUrl}#person`,
      name: profile.name,
      alternateName: `@${profile.username}`,
      description: profile.description,
      url: canonicalUrl,
      memberOf: {
        "@type": "Organization",
        name: "Readative",
        url: SITE_URL,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      "@id": `${canonicalUrl}#profile`,
      url: canonicalUrl,
      name: `${profile.name} on Readative`,
      description: profile.description,
      mainEntity: {
        "@id": `${canonicalUrl}#person`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: profile.name, item: canonicalUrl },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `Readative contributions by ${profile.name}`,
      url: canonicalUrl,
      itemListElement: [
        ...posts.slice(0, 12).map((post, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: post.title,
          url: `${SITE_URL}${buildPostSeoPath(post.id, post.title)}`,
        })),
        ...smartTalks.slice(0, 8).map((question, index) => ({
          "@type": "ListItem",
          position: posts.slice(0, 12).length + index + 1,
          name: question.title,
          url: `${SITE_URL}${buildSmartTalkSeoPath(question.id, question.title)}`,
        })),
      ],
    },
  ];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    "public, max-age=0, s-maxage=900, stale-while-revalidate=86400",
  );

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).end();
  }

  const requestedId = getQueryValue(req.query.id);
  const requestedUsername = getQueryValue(req.query.username);
  const requestedIdentifier = requestedUsername || requestedId;

  try {
    const data = await loadSeoData();
    const profile = findProfile({
      profiles: data.profiles,
      id: requestedId,
      username: requestedUsername,
    });

    if (!profile) {
      res.setHeader("X-Readative-SEO-Source", data.source);
      res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60");
      if (req.method === "HEAD") return res.status(404).end();
      return res.status(404).send(renderNotFound(requestedIdentifier));
    }

    const canonicalPath = buildSeoProfilePath(profile);
    const canonicalUrl = `${SITE_URL}${canonicalPath}`;
    const legacy = getQueryValue(req.query.legacy);
    const requestedUsernameSegment = requestedUsername.replace(/^@/, "");
    const requestedPath = requestedUsername
      ? `/@${encodeURIComponent(requestedUsernameSegment)}`
      : requestedId
        ? `/profile/${encodeURIComponent(requestedId)}`
        : "";

    if (legacy || requestedPath !== canonicalPath) {
      res.setHeader("Location", canonicalUrl);
      res.setHeader("Cache-Control", "public, max-age=0, s-maxage=86400");
      return res.status(301).end();
    }

    const posts = data.posts
      .filter((post) => post.authorId === profile.id)
      .sort((left, right) => right.createdAt - left.createdAt || left.id.localeCompare(right.id));
    const smartTalks = data.smartTalks
      .filter((question) => question.authorId === profile.id)
      .sort((left, right) => right.createdAt - left.createdAt || left.id.localeCompare(right.id));
    const pageTitle = `${profile.name} (@${profile.username}) | Readative`;
    const pageDescription =
      profile.description ||
      `${profile.name} publishes practical knowledge and SmartTalk discussions on Readative.`;
    const schemas = buildProfileSchemas({
      profile,
      canonicalUrl,
      posts,
      smartTalks,
    });

    const head = `
      <title>${escapeHtml(pageTitle)}</title>
      <meta name="description" content="${escapeHtml(pageDescription)}" />
      <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      <link rel="canonical" href="${canonicalUrl}" />
      <meta property="og:type" content="profile" />
      <meta property="og:title" content="${escapeHtml(pageTitle)}" />
      <meta property="og:description" content="${escapeHtml(pageDescription)}" />
      <meta property="og:url" content="${canonicalUrl}" />
      <meta property="og:image" content="${SITE_URL}/logo.png" />
      <meta property="og:image:alt" content="Readative profile" />
      <meta property="og:site_name" content="Readative" />
      <meta property="og:locale" content="en_US" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
      <meta name="twitter:description" content="${escapeHtml(pageDescription)}" />
      <meta name="twitter:image" content="${SITE_URL}/logo.png" />
      <meta name="twitter:image:alt" content="Readative profile" />
      ${renderJsonLd(schemas)}
      ${SEO_DOCUMENT_STYLES}`;

    const main = `<div class="seo-document"><div class="seo-shell">
      <nav class="seo-nav" aria-label="Primary">
        <a class="seo-brand" href="/">Readative</a>
        <span class="seo-navlinks"><a href="/posts">Posts</a><a href="/smarttalks">SmartTalk</a><a href="/explore">Explore</a></span>
      </nav>
      <main>
        <article class="seo-hero">
          <div class="seo-hero-inner">
            <p class="seo-kicker">Readative profile</p>
            <h1>${escapeHtml(profile.name)}</h1>
            <p class="seo-lede">${escapeHtml(pageDescription)}</p>
            <div class="seo-meta"><span>@${escapeHtml(profile.username)}</span><span>${profile.postCount} posts</span><span>${profile.smartTalkCount} SmartTalk discussions</span></div>
          </div>
        </article>
        <section class="seo-card">
          <div class="seo-grid">
            <section><h2>Latest Posts</h2><ul class="seo-list">${renderPostList(posts.slice(0, 12))}</ul></section>
            <section><h2>SmartTalk</h2><ul class="seo-list">${renderSmartTalkList(smartTalks.slice(0, 12))}</ul></section>
          </div>
          <div class="seo-meta"><a href="${canonicalPath}">Canonical profile</a><a href="/posts">Discovery index</a></div>
        </section>
      </main>
      <footer class="seo-footer"><a href="/about">About</a> &middot; <a href="/contact">Contact</a> &middot; <a href="/privacy">Privacy</a> &middot; <a href="/terms">Terms</a></footer>
    </div></div>`;

    res.setHeader("X-Readative-SEO-Source", data.source);
    res.setHeader("X-Readative-SEO-Profile-Id", profile.id);
    if (req.method === "HEAD") return res.status(200).end();
    return res.status(200).send(renderAppDocument({ head, main }));
  } catch (error) {
    console.error("Profile document generation error:", error);
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).send("Profile document is temporarily unavailable.");
  }
}
