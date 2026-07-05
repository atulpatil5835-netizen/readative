import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SITE_URL } from "./_seoData.js";
import {
  SEO_DOCUMENT_STYLES,
  escapeHtml,
  renderJsonLd,
  renderStandaloneDocument,
} from "./_document.js";

import {
  COMPANY_LINKEDIN_URL,
  CONTACT_EMAIL,
  EFFECTIVE_DATE,
  GITHUB_URL,
  LEGAL_PAGES,
  PAGE_ORDER,
  PERSONAL_LINKEDIN_URL,
  type InnovationProject,
  type LegalLink,
  type LegalOfficialLinks,
  type LegalPage,
  type LegalSection,
  type LegalSlug,
} from "../src/content/legalPages.js";

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function isLegalSlug(value: string): value is LegalSlug {
  return value in LEGAL_PAGES;
}

function renderSection(section: LegalSection) {
  const sectionId = section.id ? ` id="${escapeHtml(section.id)}"` : "";
  return `<section class="seo-card"${sectionId}>
    <h2>${escapeHtml(section.title)}</h2>
    ${(section.paragraphs || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
    ${section.items?.length ? `<ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
    ${section.links?.length ? `<div class="seo-grid">${section.links.map(renderLinkCard).join("")}</div>` : ""}
    ${section.officialLinks ? renderOfficialLinks(section.officialLinks) : ""}
  </section>`;
}

function renderLinkedInIcon() {
  return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="currentColor"><path d="M5.4 3.8a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4ZM3.5 9.8h3.8v10.7H3.5V9.8Zm6.1 0h3.6v1.5h.1c.5-.9 1.7-1.9 3.5-1.9 3.8 0 4.5 2.5 4.5 5.7v5.4h-3.8v-4.8c0-1.1 0-2.7-1.8-2.7s-2.1 1.3-2.1 2.6v4.9H9.8V9.8Z" /></svg>`;
}

function renderOfficialLinks(officialLinks: LegalOfficialLinks) {
  const linkedInIcon = renderLinkedInIcon();
  const linkCards = officialLinks.links.map((link) => {
    if (link.kind === "linkedin") {
      return `<a href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer" class="seo-card" style="margin-top:0;display:flex;align-items:center;gap:.85rem;text-decoration:none">
        <span style="display:inline-flex;color:#0a66c2">${linkedInIcon}</span>
        <span><span class="seo-kicker" style="display:block;margin-bottom:.2rem">${escapeHtml(link.label)}</span><strong style="color:#0f172a">${escapeHtml(link.name)}</strong></span>
      </a>`;
    }

    return `<a href="${escapeHtml(link.href)}" class="seo-card" style="margin-top:0;text-decoration:none">
      <span class="seo-kicker" style="display:block;margin-bottom:.2rem">${escapeHtml(link.label)}</span>
      <strong style="color:#0f172a">${escapeHtml(link.name)}</strong>
    </a>`;
  }).join("");
  const support = officialLinks.support;

  return `<div style="margin-top:1.5rem">
    <h3 style="margin:0 0 1rem;color:#0f172a;font-size:1rem">${escapeHtml(officialLinks.heading)}</h3>
    <div class="seo-grid">
      ${linkCards}
      <article class="seo-card" style="margin-top:0">
        <p class="seo-kicker" style="margin-bottom:.35rem">${escapeHtml(support.title)}</p>
        <p style="margin:.35rem 0 1rem">${escapeHtml(support.description)}</p>
        <a href="${escapeHtml(support.href)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;border-radius:.75rem;background:#047857;color:#fff;padding:.65rem .9rem;font-size:.82rem;font-weight:800;text-decoration:none">${escapeHtml(support.label)}</a>
      </article>
    </div>
  </div>`;
}

function renderLinkCard(link: LegalLink) {
  const external = /^https?:\/\//i.test(link.href);
  return `<a href="${escapeHtml(link.href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""} class="seo-card" style="margin-top:0;text-decoration:none">
    <h3>${escapeHtml(link.label)}</h3>
    ${link.description ? `<p>${escapeHtml(link.description)}</p>` : ""}
  </a>`;
}

function renderProject(project: InnovationProject) {
  return `<article class="seo-card" style="margin-top:0">
    <p class="seo-kicker">${escapeHtml(project.status)}</p>
    <h3>${escapeHtml(project.name)}</h3>
    <p>${escapeHtml(project.description)}</p>
    <dl class="seo-meta" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem 1rem">
      <div><dt>Status</dt><dd>${escapeHtml(project.status)}</dd></div>
      <div><dt>Category</dt><dd>${escapeHtml(project.category)}</dd></div>
      <div style="grid-column:1/-1"><dt>Current Stage</dt><dd>${escapeHtml(project.currentStage)}</dd></div>
    </dl>
  </article>`;
}

function renderPage(page: LegalPage) {
  const canonicalPath = `/${page.slug}`;
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const pageTitle = `${page.title} | Readative`;
  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Readative",
      alternateName: "Info Hub Innovation Platform",
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
      sameAs: [GITHUB_URL, PERSONAL_LINKEDIN_URL, COMPANY_LINKEDIN_URL],
      contactPoint: { "@type": "ContactPoint", email: CONTACT_EMAIL, contactType: "customer support" },
    },
    {
      "@context": "https://schema.org",
      "@type": page.schemaType,
      "@id": `${canonicalUrl}#page`,
      url: canonicalUrl,
      name: page.title,
      description: page.description,
      dateModified: "2026-07-04",
      isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: "Readative", url: SITE_URL },
      publisher: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "Readative", url: SITE_URL },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: page.title, item: canonicalUrl },
      ],
    },
    ...(page.projects?.length
      ? [{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Info Hub Projects",
          url: canonicalUrl,
          itemListElement: page.projects.map((project, index) => ({
            "@type": "ListItem",
            position: index + 1,
            item: {
              "@type": "CreativeWork",
              name: project.name,
              description: project.description,
              genre: project.category,
              creativeWorkStatus: project.status,
              additionalProperty: [
                { "@type": "PropertyValue", name: "Current Stage", value: project.currentStage },
              ],
            },
          })),
        }]
      : []),
    ...(page.slug === "contact"
      ? [{
          "@context": "https://schema.org",
          "@type": "Organization",
          "@id": `${SITE_URL}/#organization`,
          name: "Readative",
          url: SITE_URL,
          contactPoint: { "@type": "ContactPoint", email: CONTACT_EMAIL, contactType: "customer support" },
        }]
      : []),
  ];
  const head = `
    <title>${escapeHtml(pageTitle)}</title>
    <meta name="description" content="${escapeHtml(page.description)}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(pageTitle)}" />
    <meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${SITE_URL}/logo.png" />
    <meta property="og:image:alt" content="Readative" />
    <meta property="og:site_name" content="Readative" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(page.description)}" />
    <meta name="twitter:image" content="${SITE_URL}/logo.png" />
    <meta name="twitter:image:alt" content="Readative" />
    ${renderJsonLd(schemas)}
    ${SEO_DOCUMENT_STYLES}`;
  const relatedLinks = PAGE_ORDER
    .filter((slug) => slug !== page.slug)
    .map((slug) => `<a href="/${slug}">${escapeHtml(LEGAL_PAGES[slug].title)}</a>`)
    .join("");
  const main = `<div class="seo-document"><div class="seo-shell">
    <nav class="seo-nav" aria-label="Primary">
      <a class="seo-brand" href="/">Readative</a>
      <span class="seo-navlinks"><a href="/posts">Posts</a><a href="/smarttalks">SmartTalk</a><a href="/explore">Explore</a></span>
    </nav>
    <main>
      <header class="seo-hero"><div class="seo-hero-inner">
        <p class="seo-kicker">${escapeHtml(page.eyebrow)}</p>
        <h1>${escapeHtml(page.title)}</h1>
        <p class="seo-lede">${escapeHtml(page.description)}</p>
        <p class="seo-meta"><span>Effective ${EFFECTIVE_DATE}</span><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
      </div></header>
      ${page.sections.map(renderSection).join("")}
      ${page.projects?.length ? `<section class="seo-card"><h2>Project lifecycle</h2><div class="seo-grid">${page.projects.map(renderProject).join("")}</div></section>` : ""}
      <nav class="seo-card" aria-label="Readative policies"><h2>Readative information and policies</h2><div class="seo-navlinks">${relatedLinks}</div></nav>
    </main>
    <footer class="seo-footer">Copyright ${new Date().getUTCFullYear()} Readative. All rights reserved.</footer>
  </div></div>`;
  return renderStandaloneDocument({ head, main });
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800");

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).end();
  }

  const slug = getQueryValue(req.query.slug);
  if (!isLegalSlug(slug)) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(404).send("Legal page not found.");
  }

  if (req.method === "HEAD") return res.status(200).end();
  return res.status(200).send(renderPage(LEGAL_PAGES[slug]));
}
