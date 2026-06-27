import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  SITE_URL,
  type SeoSmartTalk,
  escapeXml,
  loadSeoData,
} from "./_seoData.js";
import { SEO_CATEGORIES } from "../src/utils/seoTaxonomy.js";

function escapeHtml(value: string) {
  return escapeXml(value);
}

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function smartTalkPath(id: string) {
  return `/smarttalks/${encodeURIComponent(id)}`;
}

function absoluteUrl(path: string) {
  return `${SITE_URL}${path}`;
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
    const pageTitle = `${focusedQuestion.title} | SmartTalk | Readative`;
    const pageDescription = focusedQuestion.description;
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(pageDescription)}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <link rel="canonical" href="${SITE_URL}${canonicalPath}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(pageTitle)}" />
  <meta property="og:description" content="${escapeHtml(pageDescription)}" />
  <meta property="og:url" content="${SITE_URL}${canonicalPath}" />
  <meta property="og:image" content="${SITE_URL}/logo.png" />
  <meta property="og:site_name" content="Readative" />
  <meta property="og:locale" content="en_US" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(pageDescription)}" />
  <meta name="twitter:image" content="${SITE_URL}/logo.png" />
  ${renderJsonLd(buildSmartTalkQuestionSchemas(focusedQuestion))}
  <style>
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a; background: #f8fafc; }
    main { max-width: 860px; margin: 0 auto; padding: 32px 18px 56px; }
    article { border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; padding: 18px; }
    h1 { margin: 0 0 12px; font-size: clamp(1.7rem, 3vw, 2.4rem); line-height: 1.1; }
    p, li { color: #475569; line-height: 1.6; }
    a { color: #047857; font-weight: 700; text-decoration-thickness: 1px; text-underline-offset: 3px; }
    .meta { margin-top: 8px; font-size: .85rem; color: #64748b; }
  </style>
</head>
<body>
<main>
  <p><a href="/smarttalks">SmartTalk Discussions</a></p>
  <article id="question-${escapeHtml(focusedQuestion.id)}">
    <h1>${escapeHtml(focusedQuestion.title)}</h1>
    <p>${escapeHtml(focusedQuestion.description)}</p>
    <p class="meta">${renderQuestionMeta(focusedQuestion)}</p>
    ${
      focusedQuestion.answers.length > 0
        ? `<ul>${focusedQuestion.answers
            .map(
              (answer) =>
                `<li><strong>@${escapeHtml(answer.authorName)}:</strong> ${escapeHtml(answer.text)}</li>`,
            )
            .join("")}</ul>`
        : ""
    }
  </article>
</main>
</body>
</html>`;

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

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SmartTalk Discussions | Readative</title>
  <meta name="description" content="Crawlable index of Readative SmartTalk questions, answer snippets, and topic discussions." />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <link rel="canonical" href="${SITE_URL}/smarttalks" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="SmartTalk Discussions | Readative" />
  <meta property="og:description" content="Crawlable index of Readative SmartTalk questions, answer snippets, and topic discussions." />
  <meta property="og:url" content="${SITE_URL}/smarttalks" />
  <meta property="og:image" content="${SITE_URL}/logo.png" />
  <meta property="og:site_name" content="Readative" />
  <meta property="og:locale" content="en_US" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="SmartTalk Discussions | Readative" />
  <meta name="twitter:description" content="Crawlable index of Readative SmartTalk questions, answer snippets, and topic discussions." />
  <meta name="twitter:image" content="${SITE_URL}/logo.png" />
  ${renderJsonLd(buildSmartTalkIndexSchemas(questions))}
  <style>
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a; background: #f8fafc; }
    main { max-width: 920px; margin: 0 auto; padding: 32px 18px 56px; }
    h1 { margin: 0 0 8px; font-size: clamp(2rem, 4vw, 3rem); line-height: 1.05; }
    article { margin-top: 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; padding: 18px; }
    h2 { margin: 0; font-size: 1.05rem; line-height: 1.45; }
    p, li { color: #475569; line-height: 1.6; }
    a { color: #047857; font-weight: 700; text-decoration-thickness: 1px; text-underline-offset: 3px; }
    .meta { margin-top: 8px; font-size: .85rem; color: #64748b; }
  </style>
</head>
<body>
<main>
  <h1>SmartTalk Discussions</h1>
  <p>Readative SmartTalk has ${questions.length} crawlable knowledge discussions. Open the interactive SmartTalk feed at <a href="/smarttalk">/smarttalk</a>.</p>
  ${questions
    .map(
      (question) => `<article id="question-${escapeHtml(question.id)}">
    <h2><a href="${escapeHtml(smartTalkPath(question.id))}">${escapeHtml(question.title)}</a></h2>
    <p>${escapeHtml(question.description)}</p>
    <p class="meta">${renderQuestionMeta(question)}</p>
    ${
      question.answers.length > 0
        ? `<ul>${question.answers
            .map(
              (answer) =>
                `<li><strong>@${escapeHtml(answer.authorName)}:</strong> ${escapeHtml(answer.text)}</li>`,
            )
            .join("")}</ul>`
        : ""
    }
  </article>`,
    )
    .join("\n")}
</main>
</body>
</html>`;

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
