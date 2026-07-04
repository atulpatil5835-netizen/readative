import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  SITE_URL,
  type SeoSmartTalk,
  loadSeoData,
} from "./_seoData.js";
import { SEO_CATEGORIES } from "../src/utils/seoTaxonomy.js";
import {
  SEO_DOCUMENT_STYLES,
  escapeHtml,
  renderAppDocument,
  renderJsonLd,
} from "./_document.js";

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function smartTalkPath(id: string) {
  return `/smarttalks/${encodeURIComponent(id)}`;
}

function absoluteUrl(path: string) {
  return `${SITE_URL}${path}`;
}

function getCategoryLabel(categoryId: string | null) {
  if (!categoryId) return "";
  return SEO_CATEGORIES.find((category) => category.id === categoryId)?.label || categoryId;
}

function renderQuestionMeta(question: SeoSmartTalk) {
  const metaLinks = [
    question.authorId
      ? `<a href="/profile/${escapeHtml(encodeURIComponent(question.authorId))}">@${escapeHtml(question.authorName)}</a>`
      : `@${escapeHtml(question.authorName)}`,
    question.category
      ? `<a href="/category/${escapeHtml(encodeURIComponent(question.category))}">${escapeHtml(getCategoryLabel(question.category))}</a>`
      : "",
    `${question.answerCount} answers`,
  ].filter(Boolean);

  return metaLinks.join(" / ");
}

function buildSmartTalkIndexSchemas(questions: SeoSmartTalk[]) {
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
          name: "SmartTalk Discussions",
          item: absoluteUrl("/smarttalks"),
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "SmartTalk Discussions",
      url: absoluteUrl("/smarttalks"),
      description:
        "Crawlable index of Readative SmartTalk questions, answer snippets, and topic discussions.",
      mainEntity: {
        "@type": "ItemList",
        name: "SmartTalk discussion list",
        itemListElement: questions.slice(0, 50).map((question, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: question.title,
          url: absoluteUrl(smartTalkPath(question.id)),
        })),
      },
    },
  ];
}

function buildSmartTalkQuestionSchemas(question: SeoSmartTalk) {
  const questionUrl = absoluteUrl(smartTalkPath(question.id));

  return [
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
          name: "SmartTalk Discussions",
          item: absoluteUrl("/smarttalks"),
        },
        {
          "@type": "ListItem",
          position: 3,
          name: question.title,
          item: questionUrl,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "DiscussionForumPosting",
      "@id": `${questionUrl}#discussion`,
      headline: question.title,
      text: question.description,
      url: questionUrl,
      author: {
        "@type": "Person",
        name: question.authorName,
        url: question.authorId
          ? absoluteUrl(`/profile/${encodeURIComponent(question.authorId)}`)
          : undefined,
      },
      datePublished: new Date(question.createdAt).toISOString(),
      dateModified: question.updatedAt
        ? new Date(question.updatedAt).toISOString()
        : undefined,
      keywords: [getCategoryLabel(question.category), "SmartTalk", "Readative"]
        .filter(Boolean)
        .join(", "),
      interactionStatistic: {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/ReplyAction",
        userInteractionCount: question.answerCount,
      },
      comment: question.answers.map((answer) => ({
        "@type": "Comment",
        text: answer.text,
        author: {
          "@type": "Person",
          name: answer.authorName,
        },
      })),
      isPartOf: {
        "@type": "CollectionPage",
        name: "SmartTalk Discussions",
        url: absoluteUrl("/smarttalks"),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "@id": `${questionUrl}#faq`,
      url: questionUrl,
      mainEntity: {
        "@type": "Question",
        name: question.title,
        text: question.description,
        answerCount: question.answerCount,
        suggestedAnswer: question.answers.map((answer) => ({
          "@type": "Answer",
          text: answer.text,
          author: { "@type": "Person", name: answer.authorName },
        })),
      },
    },
  ];
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
    console.error("SmartTalk SEO data unavailable:", data.errors);
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).send("SmartTalk is temporarily unavailable.");
  }
  const questions = [...data.smartTalks].sort(
    (left, right) => right.createdAt - left.createdAt || left.id.localeCompare(right.id),
  );
  const requestedId = getQueryValue(req.query.id);
  const focusedQuestion = requestedId
    ? questions.find((question) => question.id === requestedId)
    : null;

  if (requestedId && !focusedQuestion) {
    res.setHeader("X-Readative-SEO-Source", data.source);
    res.setHeader(
      "X-Readative-SEO-SmartTalk-Count",
      data.smartTalks.length.toString(),
    );
    if (req.method === "HEAD") {
      return res.status(404).end();
    }

    return res.status(404).send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="robots" content="noindex, follow" />
  <title>SmartTalk Not Found | Readative</title>
</head>
<body>
  <main>
    <h1>SmartTalk Not Found</h1>
    <p>This SmartTalk discussion is not available.</p>
    <p><a href="/smarttalks">Browse SmartTalk discussions</a></p>
  </main>
</body>
</html>`);
  }

  if (focusedQuestion) {
    const canonicalPath = smartTalkPath(focusedQuestion.id);
    const canonicalUrl = `${SITE_URL}${canonicalPath}`;
    const pageTitle = `${focusedQuestion.title} | SmartTalk | Readative`;
    const pageDescription = focusedQuestion.description;
    const relatedQuestions = questions
      .filter(
        (question) =>
          question.id !== focusedQuestion.id &&
          (!focusedQuestion.category || question.category === focusedQuestion.category),
      )
      .slice(0, 5);
    const relatedPosts = data.posts
      .filter(
        (post) =>
          !focusedQuestion.category ||
          post.category === focusedQuestion.category ||
          post.hashtags.includes(focusedQuestion.category),
      )
      .slice(0, 5);
    const head = `
      <title>${escapeHtml(pageTitle)}</title>
      <meta name="description" content="${escapeHtml(pageDescription)}" />
      <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      <link rel="canonical" href="${canonicalUrl}" />
      <meta property="og:type" content="article" />
      <meta property="og:title" content="${escapeHtml(pageTitle)}" />
      <meta property="og:description" content="${escapeHtml(pageDescription)}" />
      <meta property="og:url" content="${canonicalUrl}" />
      <meta property="og:image" content="${SITE_URL}/logo.png" />
      <meta property="og:image:alt" content="Readative SmartTalk" />
      <meta property="og:image:width" content="512" />
      <meta property="og:image:height" content="512" />
      <meta property="og:site_name" content="Readative" />
      <meta property="og:locale" content="en_US" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
      <meta name="twitter:description" content="${escapeHtml(pageDescription)}" />
      <meta name="twitter:image" content="${SITE_URL}/logo.png" />
      <meta name="twitter:image:alt" content="Readative SmartTalk" />
      ${renderJsonLd(buildSmartTalkQuestionSchemas(focusedQuestion))}
      ${SEO_DOCUMENT_STYLES}`;
    const answerList = focusedQuestion.answers.length
      ? `<ul class="seo-list">${focusedQuestion.answers
          .map(
            (answer) => `<li><strong>${escapeHtml(answer.authorName)}:</strong> ${escapeHtml(answer.text)}</li>`,
          )
          .join("")}</ul>`
      : "<p>This discussion is awaiting its first community answer.</p>";
    const relatedQuestionList = relatedQuestions.length
      ? relatedQuestions
          .map(
            (question) => `<li><a href="${smartTalkPath(question.id)}">${escapeHtml(question.title)}</a></li>`,
          )
          .join("")
      : '<li><a href="/smarttalks">Browse all questions</a></li>';
    const relatedPostList = relatedPosts.length
      ? relatedPosts
          .map(
            (post) => `<li><a href="/post/${encodeURIComponent(post.id)}">${escapeHtml(post.title)}</a></li>`,
          )
          .join("")
      : '<li><a href="/posts">Browse all posts</a></li>';
    const nextReading = relatedPosts[0]
      ? `<a href="/post/${encodeURIComponent(relatedPosts[0].id)}">${escapeHtml(relatedPosts[0].title)}</a>`
      : relatedQuestions[0]
        ? `<a href="${smartTalkPath(relatedQuestions[0].id)}">${escapeHtml(relatedQuestions[0].title)}</a>`
        : '<a href="/posts">Explore more knowledge</a>';
    const main = `<div class="seo-document"><div class="seo-shell">
      <nav class="seo-nav" aria-label="Primary"><a class="seo-brand" href="/">Readative</a><span class="seo-navlinks"><a href="/posts">Posts</a><a href="/smarttalks">SmartTalk</a><a href="/explore">Explore</a></span></nav>
      <main>
        <article class="seo-hero" id="question-${escapeHtml(focusedQuestion.id)}"><div class="seo-hero-inner">
          <p class="seo-kicker">SmartTalk discussion</p>
          <h1>${escapeHtml(focusedQuestion.title)}</h1>
          <div class="seo-meta">${renderQuestionMeta(focusedQuestion)}</div>
        </div><section class="seo-card" style="border:0;border-top:1px solid #e2e8f0;border-radius:0;box-shadow:none;margin:0"><h2>Community answers</h2>${answerList}</section></article>
        <section class="seo-card"><div class="seo-grid">
          <section><h2>Related Questions</h2><ul class="seo-list">${relatedQuestionList}</ul></section>
          <section><h2>Related Posts</h2><ul class="seo-list">${relatedPostList}</ul></section>
        </div><div class="seo-meta">
          ${focusedQuestion.category ? `<a href="/category/${encodeURIComponent(focusedQuestion.category)}">Related Category: ${escapeHtml(getCategoryLabel(focusedQuestion.category))}</a>` : ""}
          ${focusedQuestion.authorId ? `<a href="/profile/${encodeURIComponent(focusedQuestion.authorId)}">Author: ${escapeHtml(focusedQuestion.authorName)}</a>` : ""}
          <span>Next Reading: ${nextReading}</span>
        </div></section>
      </main>
      <footer class="seo-footer"><a href="/about">About</a> · <a href="/contact">Contact</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/community">Community</a></footer>
    </div></div>`;
    const html = renderAppDocument({ head, main });

    res.setHeader("X-Readative-SEO-Source", data.source);
    res.setHeader(
      "X-Readative-SEO-SmartTalk-Count",
      data.smartTalks.length.toString(),
    );
    res.setHeader("X-Readative-SEO-SmartTalk-Id", focusedQuestion.id);

    if (req.method === "HEAD") {
      return res.status(200).end();
    }

    return res.status(200).send(html);
  }

  const pageDescription =
    "Readative SmartTalk questions, practical community answers, and topic-focused learning discussions.";
  const head = `
    <title>SmartTalk Discussions | Readative</title>
    <meta name="description" content="${pageDescription}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <link rel="canonical" href="${SITE_URL}/smarttalks" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="SmartTalk Discussions | Readative" />
    <meta property="og:description" content="${pageDescription}" />
    <meta property="og:url" content="${SITE_URL}/smarttalks" />
    <meta property="og:image" content="${SITE_URL}/logo.png" />
    <meta property="og:image:alt" content="Readative SmartTalk" />
    <meta property="og:site_name" content="Readative" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="SmartTalk Discussions | Readative" />
    <meta name="twitter:description" content="${pageDescription}" />
    <meta name="twitter:image" content="${SITE_URL}/logo.png" />
    <meta name="twitter:image:alt" content="Readative SmartTalk" />
    ${renderJsonLd(buildSmartTalkIndexSchemas(questions))}
    ${SEO_DOCUMENT_STYLES}`;
  const questionList = questions
    .slice(0, 100)
    .map(
      (question) => `<li id="question-${escapeHtml(question.id)}">
        <a href="${smartTalkPath(question.id)}">${escapeHtml(question.title)}</a>
        <span> — ${escapeHtml(getCategoryLabel(question.category) || "SmartTalk")} · ${question.answerCount} ${question.answerCount === 1 ? "answer" : "answers"}</span>
      </li>`,
    )
    .join("");
  const main = `<div class="seo-document"><div class="seo-shell">
    <nav class="seo-nav" aria-label="Primary"><a class="seo-brand" href="/">Readative</a><span class="seo-navlinks"><a href="/posts">Posts</a><a href="/smarttalks">SmartTalk</a><a href="/explore">Explore</a></span></nav>
    <main>
      <header class="seo-hero"><div class="seo-hero-inner"><p class="seo-kicker">Community knowledge</p><h1>SmartTalk Discussions</h1><p class="seo-lede">${pageDescription}</p><p class="seo-meta">${questions.length} public discussions</p></div></header>
      <section class="seo-card"><h2>Latest questions</h2><ul class="seo-list">${questionList || '<li>No public discussions are available.</li>'}</ul></section>
    </main>
    <footer class="seo-footer"><a href="/about">About</a> · <a href="/contact">Contact</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/community">Community</a></footer>
  </div></div>`;
  const html = renderAppDocument({ head, main });

  res.setHeader("X-Readative-SEO-Source", data.source);
  res.setHeader(
    "X-Readative-SEO-SmartTalk-Count",
    data.smartTalks.length.toString(),
  );

  if (req.method === "HEAD") {
    return res.status(200).end();
  }

  return res.status(200).send(html);
}
