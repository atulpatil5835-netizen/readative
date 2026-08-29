import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  SITE_URL,
  type SeoPost,
  type SeoProfile,
  type SeoSmartTalk,
  buildSeoProfilePath,
  getIndexableSeoPosts,
  getIndexableSeoSmartTalks,
  loadSeoData,
} from "./_seoData.js";
import {
  SEO_CATEGORIES,
} from "../src/utils/seoTaxonomy.js";
import {
  buildPostSeoPath,
  buildSmartTalkSeoPath,
} from "../src/utils/seoUrls.js";
import {
  SEO_DOCUMENT_STYLES,
  escapeHtml,
  renderAppDocument,
  renderJsonLd,
} from "./_document.js";

const HOME_ITEM_LIMIT = 12;
const SMARTTALK_LIMIT = 8;

function absoluteUrl(path: string) {
  return `${SITE_URL}${path}`;
}

function renderNav() {
  return `<nav class="seo-nav" aria-label="Primary">
    <a class="seo-brand" href="/">Readative</a>
    <span class="seo-navlinks">
      <a href="/smarttalks">SmartTalk</a>
      <a href="/posts">Posts</a>
      <a href="/explore">Explore</a>
      <a href="/about">About</a>
    </span>
  </nav>`;
}

function renderPostList(posts: SeoPost[], profilesById: ReadonlyMap<string, SeoProfile>) {
  if (posts.length === 0) {
    return '<li><a href="/posts">Browse the Readative post index</a></li>';
  }

  return posts
    .slice(0, HOME_ITEM_LIMIT)
    .map((post) => {
      const authorProfile = profilesById.get(post.authorId);
      const authorPath = authorProfile
        ? buildSeoProfilePath(authorProfile)
        : post.authorId
          ? `/profile/${encodeURIComponent(post.authorId)}`
          : "";
      const author = authorPath
        ? `<a href="${escapeHtml(authorPath)}">by ${escapeHtml(post.authorName)}</a>`
        : `by ${escapeHtml(post.authorName)}`;
      const category = post.category
        ? `<a href="/category/${encodeURIComponent(post.category)}">${escapeHtml(post.category)}</a>`
        : "";

      return `<li>
        <a href="${escapeHtml(buildPostSeoPath(post.id, post.title))}">${escapeHtml(post.title)}</a>
        <span> - ${escapeHtml(post.description)}</span>
        <small>${[author, category].filter(Boolean).join(" / ")}</small>
      </li>`;
    })
    .join("");
}

function renderSmartTalkList(questions: SeoSmartTalk[]) {
  if (questions.length === 0) {
    return '<li><a href="/smarttalks">Browse SmartTalk discussions</a></li>';
  }

  return questions
    .slice(0, SMARTTALK_LIMIT)
    .map(
      (question) => `<li>
        <a href="${escapeHtml(buildSmartTalkSeoPath(question.id, question.title))}">${escapeHtml(question.title)}</a>
        <span> - ${question.answerCount} ${question.answerCount === 1 ? "answer" : "answers"}</span>
      </li>`,
    )
    .join("");
}

function renderPills(items: Array<{ href: string; label: string }>) {
  return items
    .map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`)
    .join("");
}

function buildHomeSchemas({
  posts,
  questions,
}: {
  posts: SeoPost[];
  questions: SeoSmartTalk[];
}) {
  const itemListElement = [
    ...posts.slice(0, HOME_ITEM_LIMIT).map((post, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: post.title,
      url: absoluteUrl(buildPostSeoPath(post.id, post.title)),
    })),
    ...questions.slice(0, SMARTTALK_LIMIT).map((question, index) => ({
      "@type": "ListItem",
      position: posts.slice(0, HOME_ITEM_LIMIT).length + index + 1,
      name: question.title,
      url: absoluteUrl(buildSmartTalkSeoPath(question.id, question.title)),
    })),
  ];

  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Readative",
      url: SITE_URL,
      logo: absoluteUrl("/logo.png"),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Readative",
      alternateName: ["Readative SmartTalk", "Readative Posts"],
      url: SITE_URL,
      description:
        "Readative is a knowledge feed for practical posts, visual explainers, study notes, and SmartTalk Q&A.",
      publisher: { "@id": `${SITE_URL}/#organization` },
      hasPart: [
        {
          "@type": "CollectionPage",
          "@id": `${SITE_URL}/smarttalks#page`,
          name: "SmartTalk",
          url: `${SITE_URL}/smarttalks`,
          description: "Readative SmartTalk questions and community answers.",
        },
        {
          "@type": "CollectionPage",
          "@id": `${SITE_URL}/posts#page`,
          name: "Readative Posts",
          url: `${SITE_URL}/posts`,
          description: "Published Readative posts and practical knowledge guides.",
        },
      ],
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/posts?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": `${SITE_URL}/#home`,
      name: "Readative",
      url: SITE_URL,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      description:
        "A crawlable entry point to Readative's published knowledge posts, SmartTalk discussions, and contributor pages.",
      mainEntity: {
        "@type": "ItemList",
        name: "Readative featured public content",
        itemListElement,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Readative primary sections",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Readative",
          url: SITE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "SmartTalk",
          url: `${SITE_URL}/smarttalks`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: "Posts",
          url: `${SITE_URL}/posts`,
        },
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

  try {
    const data = await loadSeoData();
    if (data.source === "static") {
      console.error("Home SEO data unavailable:", data.errors);
      res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60");
    }

    const indexablePosts = getIndexableSeoPosts(data.posts);
    const indexableSmartTalks = getIndexableSeoSmartTalks(data.smartTalks);
    const recentPosts = indexablePosts.slice(0, HOME_ITEM_LIMIT);
    const activeQuestions = indexableSmartTalks.slice(0, SMARTTALK_LIMIT);
    const profilesById = new Map(data.profiles.map((profile) => [profile.id, profile] as const));
    const categoryLinks = SEO_CATEGORIES.map((category) => ({
      href: category.path,
      label: category.label,
    }));
    const pageTitle = "Readative | Posts and SmartTalk";
    const pageDescription =
      "Readative helps readers discover practical posts, visual explainers, study notes, and SmartTalk Q&A from creator profiles.";
    const schema = buildHomeSchemas({
      posts: recentPosts,
      questions: activeQuestions,
    });
    const head = `
      <title>${escapeHtml(pageTitle)}</title>
      <meta name="description" content="${escapeHtml(pageDescription)}" />
      <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      <link rel="canonical" href="${SITE_URL}/" />
      <meta property="og:type" content="website" />
      <meta property="og:title" content="${escapeHtml(pageTitle)}" />
      <meta property="og:description" content="${escapeHtml(pageDescription)}" />
      <meta property="og:url" content="${SITE_URL}/" />
      <meta property="og:image" content="${SITE_URL}/logo.png" />
      <meta property="og:image:alt" content="Readative knowledge sharing" />
      <meta property="og:site_name" content="Readative" />
      <meta property="og:locale" content="en_US" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
      <meta name="twitter:description" content="${escapeHtml(pageDescription)}" />
      <meta name="twitter:image" content="${SITE_URL}/logo.png" />
      <meta name="twitter:image:alt" content="Readative knowledge sharing" />
      ${renderJsonLd(schema)}
      ${SEO_DOCUMENT_STYLES}`;
    const main = `<div class="seo-document"><div class="seo-shell">
      ${renderNav()}
      <main>
        <header class="seo-hero">
          <div class="seo-hero-inner">
            <p class="seo-kicker">Knowledge feed</p>
            <h1>Readative</h1>
            <p class="seo-lede">${escapeHtml(pageDescription)}</p>
            <div class="seo-meta">
              <span>${indexablePosts.length} public posts</span>
              <span>${indexableSmartTalks.length} SmartTalk discussions</span>
              <span>${data.profiles.length} contributor profiles</span>
            </div>
          </div>
        </header>
        <section class="seo-card">
          <h2>Latest Practical Posts</h2>
          <ul class="seo-list">${renderPostList(recentPosts, profilesById)}</ul>
        </section>
        <section class="seo-card">
          <h2>Active SmartTalk Questions</h2>
          <ul class="seo-list">${renderSmartTalkList(activeQuestions)}</ul>
        </section>
        <section class="seo-card">
          <h2>Knowledge Categories</h2>
          <div class="seo-tags">${renderPills(categoryLinks)}</div>
        </section>
        <section class="seo-card">
          <h2>Reader Trust</h2>
          <p>Readative keeps public discovery focused on useful posts, SmartTalk answers, creator context, and clear policies. Empty states, private activity, alerts, and account screens are not used as advertising inventory.</p>
          <div class="seo-tags">
            <a href="/editorial-policy">Editorial Policy</a>
            <a href="/content-policy">Content Policy</a>
            <a href="/community">Community Guidelines</a>
            <a href="/privacy">Privacy Policy</a>
          </div>
        </section>
      </main>
      <footer class="seo-footer"><a href="/about">About</a> &middot; <a href="/contact">Contact</a> &middot; <a href="/privacy">Privacy</a> &middot; <a href="/terms">Terms</a></footer>
    </div></div>`;

    res.setHeader("X-Readative-SEO-Source", data.source);
    res.setHeader("X-Readative-SEO-Post-Count", indexablePosts.length.toString());
    res.setHeader(
      "X-Readative-SEO-SmartTalk-Count",
      indexableSmartTalks.length.toString(),
    );
    res.setHeader(
      "X-Readative-SEO-Profile-Count",
      data.profiles.length.toString(),
    );

    if (req.method === "HEAD") return res.status(200).end();
    return res.status(200).send(renderAppDocument({ head, main }));
  } catch (error) {
    console.error("Home document generation error:", error);
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).send(
      '<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="robots" content="noindex, follow" /><title>Readative temporarily unavailable</title></head><body><main><h1>Readative temporarily unavailable</h1><p>Home content is temporarily unavailable.</p></main></body></html>',
    );
  }
}
