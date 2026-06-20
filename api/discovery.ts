import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  DISCOVERY_INDEX_PATH,
  SITE_URL,
  escapeXml,
  loadSeoData,
} from "./_seoData.js";
import { SEO_CATEGORIES, SEO_TOPICS } from "../src/utils/seoTaxonomy.js";

function escapeHtml(value: string) {
  return escapeXml(value);
}

function renderLink(path: string, label: string, description?: string) {
  return `<li><a href="${escapeHtml(path)}">${escapeHtml(label)}</a>${
    description ? ` <span>${escapeHtml(description)}</span>` : ""
  }</li>`;
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
  const recentPosts = [...data.posts].slice(0, 24);
  const allPosts = [...data.posts].sort((left, right) =>
    left.title.localeCompare(right.title),
  );

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Readative Posts and Discovery Index</title>
  <meta name="description" content="Crawlable Readative index of published posts, categories, tags, profiles, and important discovery pages." />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <link rel="canonical" href="${SITE_URL}${DISCOVERY_INDEX_PATH}" />
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
  </style>
</head>
<body>
<main>
  <header>
    <h1>Readative Discovery Index</h1>
  <p>${data.posts.length} published posts, ${data.smartTalks.length} SmartTalk discussions, ${data.tags.length} tags, and ${data.profiles.length} profiles are linked here for search crawlers and readers.</p>
  </header>
  ${renderSection("Important Pages", [
    renderLink("/", "Readative Home", "Knowledge feed"),
    renderLink("/explore", "Explore", "Topics, posts, discussions, and contributors"),
    renderLink("/smarttalk", "SmartTalk", "Community Q&A"),
    renderLink("/smarttalks", "SmartTalk Index", "Crawlable questions and answers"),
    renderLink("/sitemap.xml", "XML Sitemap", "Complete machine-readable URL list"),
  ])}
  ${renderSection(
    "Categories",
    SEO_CATEGORIES.map((category) =>
      renderLink(category.path, category.label, category.description),
    ),
  )}
  ${renderSection(
    "Topics",
    SEO_TOPICS.map((topic) =>
      renderLink(topic.path, topic.label, topic.description),
    ),
  )}
  ${renderSection(
    "Tags",
    data.tags.map((tag) =>
      renderLink(`/tag/${encodeURIComponent(tag.id)}`, `#${tag.id}`, `${tag.postCount} posts`),
    ),
  )}
  ${renderSection(
    "Recent Posts",
    recentPosts.map((post) =>
      renderLink(`/post/${encodeURIComponent(post.id)}`, post.title, post.description),
    ),
  )}
  ${renderSection(
    "SmartTalk Discussions",
    data.smartTalks.map((question) =>
      renderLink(
        `/smarttalks/${encodeURIComponent(question.id)}`,
        question.title,
        `${question.answerCount} answers by @${question.authorName}`,
      ),
    ),
  )}
  ${renderSection(
    "All Published Posts",
    allPosts.map((post) =>
      renderLink(`/post/${encodeURIComponent(post.id)}`, post.title, `by @${post.authorName}`),
    ),
  )}
  ${renderSection(
    "Profiles",
    data.profiles.map((profile) =>
      renderLink(`/profile/${encodeURIComponent(profile.id)}`, profile.name),
    ),
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
