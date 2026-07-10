import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  SITE_URL,
  type SeoPost,
  type SeoSmartTalk,
  loadSeoPostPage,
} from "./_seoData.js";
import {
  SEO_DOCUMENT_STYLES,
  escapeHtml,
  renderAppDocument,
  renderJsonLd,
  renderTextParagraphs,
} from "./_document.js";
import {
  buildPostSeoPath,
  buildSmartTalkSeoPath,
  extractSeoDocumentId,
  isCanonicalSeoDocumentSegment,
} from "../src/utils/seoUrls.js";

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function postPath(post: Pick<SeoPost, "id" | "title">) {
  return buildPostSeoPath(post.id, post.title);
}

function shouldRedirectToCanonical(
  requestedSegment: string,
  canonicalPost: SeoPost,
  legacy: string,
) {
  return (
    Boolean(legacy) ||
    !isCanonicalSeoDocumentSegment(
      "post",
      requestedSegment,
      canonicalPost.id,
      canonicalPost.title,
    )
  );
}

function renderPostList(posts: SeoPost[]) {
  if (posts.length === 0) {
    return '<li><a href="/posts">Browse the post index</a></li>';
  }

  return posts
    .map(
      (post) => `<li>
        <a href="${postPath(post)}">${escapeHtml(post.title)}</a>
        <span> — ${escapeHtml(post.description)}</span>
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
        <span> — ${question.answerCount} ${question.answerCount === 1 ? "answer" : "answers"}</span>
      </li>`,
    )
    .join("");
}

function renderNotFound(id: string) {
  const head = `
    <title>Post Not Found | Readative</title>
    <meta name="description" content="The requested Readative post is not available." />
    <meta name="robots" content="noindex, follow" />
    ${SEO_DOCUMENT_STYLES}`;
  const main = `<div class="seo-document"><div class="seo-shell">
    <nav class="seo-nav"><a class="seo-brand" href="/">Readative</a><a href="/posts">Browse posts</a></nav>
    <main class="seo-card"><p class="seo-kicker">Error 404</p><h1>Post not found</h1><p>The post <code>${escapeHtml(id)}</code> is not public or does not exist.</p></main>
  </div></div>`;
  return renderAppDocument({ head, main });
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

  const requestedSegment = getQueryValue(req.query.id);
  const id = extractSeoDocumentId(requestedSegment);
  if (!id) {
    if (req.method === "HEAD") return res.status(404).end();
    return res.status(404).send(renderNotFound("unknown"));
  }

  try {
    const page = await loadSeoPostPage(id);
    if (!page) {
      res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60");
      if (req.method === "HEAD") return res.status(404).end();
      return res.status(404).send(renderNotFound(id));
    }

    const { post, relatedPosts, relatedSmartTalks } = page;
    const canonicalPath = postPath(post);
    const canonicalUrl = `${SITE_URL}${canonicalPath}`;
    const legacy = getQueryValue(req.query.legacy);
    if (shouldRedirectToCanonical(requestedSegment, post, legacy)) {
      res.setHeader("Location", canonicalUrl);
      res.setHeader("Cache-Control", "public, max-age=0, s-maxage=86400");
      return res.status(301).end();
    }

    const pageTitle = `${post.title} | Readative`;
    const authorUrl = post.authorId
      ? `${SITE_URL}/profile/${encodeURIComponent(post.authorId)}`
      : undefined;
    const categoryPath = post.category
      ? `/category/${encodeURIComponent(post.category)}`
      : null;
    const breadcrumbItems = [
      { name: "Home", item: SITE_URL },
      ...(categoryPath
        ? [{ name: post.category || "Category", item: `${SITE_URL}${categoryPath}` }]
        : []),
      { name: post.title, item: canonicalUrl },
    ];
    const schemas = [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbItems.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: item.item,
        })),
      },
      {
        "@context": "https://schema.org",
        "@type": "Article",
        "@id": `${canonicalUrl}#article`,
        url: canonicalUrl,
        mainEntityOfPage: canonicalUrl,
        headline: post.title,
        description: post.description,
        articleBody: post.content,
        articleSection: post.category || undefined,
        keywords: post.hashtags.join(", "),
        author: {
          "@type": "Person",
          name: post.authorName,
          url: authorUrl,
        },
        publisher: {
          "@type": "Organization",
          "@id": `${SITE_URL}/#organization`,
          name: "Readative",
          url: SITE_URL,
          logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` },
        },
        datePublished: post.createdAt ? new Date(post.createdAt).toISOString() : undefined,
        dateModified: post.updatedAt ? new Date(post.updatedAt).toISOString() : undefined,
      },
      ...(authorUrl
        ? [{
            "@context": "https://schema.org",
            "@type": "Person",
            "@id": `${authorUrl}#person`,
            name: post.authorName,
            url: authorUrl,
          }]
        : []),
    ];

    const head = `
      <title>${escapeHtml(pageTitle)}</title>
      <meta name="description" content="${escapeHtml(post.description)}" />
      <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      <link rel="canonical" href="${canonicalUrl}" />
      <meta property="og:type" content="article" />
      <meta property="og:title" content="${escapeHtml(pageTitle)}" />
      <meta property="og:description" content="${escapeHtml(post.description)}" />
      <meta property="og:url" content="${canonicalUrl}" />
      <meta property="og:image" content="${SITE_URL}/logo.png" />
      <meta property="og:image:alt" content="Readative" />
      <meta property="og:image:width" content="512" />
      <meta property="og:image:height" content="512" />
      <meta property="og:site_name" content="Readative" />
      ${post.createdAt ? `<meta property="article:published_time" content="${new Date(post.createdAt).toISOString()}" />` : ""}
      ${post.updatedAt ? `<meta property="article:modified_time" content="${new Date(post.updatedAt).toISOString()}" />` : ""}
      ${post.category ? `<meta property="article:section" content="${escapeHtml(post.category)}" />` : ""}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
      <meta name="twitter:description" content="${escapeHtml(post.description)}" />
      <meta name="twitter:image" content="${SITE_URL}/logo.png" />
      <meta name="twitter:image:alt" content="Readative" />
      ${renderJsonLd(schemas)}
      ${SEO_DOCUMENT_STYLES}`;

    const meta = [
      authorUrl ? `<a href="/profile/${encodeURIComponent(post.authorId)}">By ${escapeHtml(post.authorName)}</a>` : `By ${escapeHtml(post.authorName)}`,
      categoryPath ? `<a href="${categoryPath}">${escapeHtml(post.category || "Category")}</a>` : "",
      post.createdAt ? `<time datetime="${new Date(post.createdAt).toISOString()}">${new Date(post.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}</time>` : "",
    ].filter(Boolean).join("");
    const tags = post.hashtags
      .map((tag) => `<a href="/tag/${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`)
      .join("");
    const nextPost = relatedPosts[0] || null;
    const main = `<div class="seo-document"><div class="seo-shell">
      <nav class="seo-nav" aria-label="Primary">
        <a class="seo-brand" href="/">Readative</a>
        <span class="seo-navlinks"><a href="/posts">Posts</a><a href="/smarttalks">SmartTalk</a><a href="/explore">Explore</a></span>
      </nav>
      <main>
        <article class="seo-hero">
          <div class="seo-hero-inner">
            <p class="seo-kicker">Knowledge post</p>
            <h1>${escapeHtml(post.title)}</h1>
            <div class="seo-meta">${meta}</div>
            ${tags ? `<div class="seo-tags" aria-label="Tags">${tags}</div>` : ""}
          </div>
          <div class="seo-card" style="border:0;border-top:1px solid #e2e8f0;border-radius:0;box-shadow:none;margin:0">
            ${renderTextParagraphs(post.content)}
          </div>
        </article>
        <section class="seo-card" aria-labelledby="journey-title">
          <p class="seo-kicker">Continue learning</p><h2 id="journey-title">Knowledge Journey</h2>
          <div class="seo-grid">
            <section><h3>Related Posts</h3><ul class="seo-list">${renderPostList(relatedPosts)}</ul></section>
            <section><h3>Related SmartTalk</h3><ul class="seo-list">${renderSmartTalkList(relatedSmartTalks)}</ul></section>
            <section><h3>Same Category</h3><ul class="seo-list"><li>${categoryPath ? `<a href="${categoryPath}">${escapeHtml(post.category || "Category")}</a>` : '<a href="/posts">Browse categories</a>'}</li></ul></section>
            <section><h3>Same Author</h3><ul class="seo-list"><li>${authorUrl ? `<a href="/profile/${encodeURIComponent(post.authorId)}">${escapeHtml(post.authorName)}</a>` : '<a href="/posts">Readative contributors</a>'}</li></ul></section>
          </div>
          <section><h3>Similar Topics</h3><div class="seo-tags">${tags || '<a href="/explore">Explore topics</a>'}</div></section>
          <div class="seo-meta">
            ${nextPost ? `<a href="${postPath(nextPost)}">Next reading: ${escapeHtml(nextPost.title)}</a>` : '<a href="/posts">Next reading</a>'}
          </div>
        </section>
      </main>
      <footer class="seo-footer"><a href="/about">About</a> · <a href="/contact">Contact</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></footer>
    </div></div>`;

    res.setHeader("X-Readative-SEO-Source", page.source);
    res.setHeader("X-Readative-SEO-Post-Id", post.id);
    if (req.method === "HEAD") return res.status(200).end();
    return res.status(200).send(renderAppDocument({ head, main }));
  } catch (error) {
    console.error("Post document generation error:", error);
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).send("Post document is temporarily unavailable.");
  }
}
