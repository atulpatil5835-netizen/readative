import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SITE_URL, escapeXml, loadSeoData } from "./_seoData";

function escapeHtml(value: string) {
  return escapeXml(value);
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
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SmartTalk Discussions | Readative</title>
  <meta name="description" content="Crawlable index of Readative SmartTalk questions, answer snippets, and topic discussions." />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <link rel="canonical" href="${SITE_URL}/smarttalks" />
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
    <h2><a href="/smarttalk#question-${escapeHtml(encodeURIComponent(question.id))}">${escapeHtml(question.title)}</a></h2>
    <p>${escapeHtml(question.description)}</p>
    <p class="meta">Asked by @${escapeHtml(question.authorName)} / ${question.answerCount} answers${question.category ? ` / ${escapeHtml(question.category)}` : ""}</p>
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
