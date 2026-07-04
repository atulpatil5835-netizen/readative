import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SITE_URL } from "./_seoData.js";
import {
  SEO_DOCUMENT_STYLES,
  escapeHtml,
  renderJsonLd,
  renderStandaloneDocument,
} from "./_document.js";

type LegalSlug = "about" | "contact" | "privacy" | "terms" | "disclaimer" | "community";

interface LegalSection {
  title: string;
  paragraphs?: string[];
  items?: string[];
}

interface LegalPage {
  slug: LegalSlug;
  title: string;
  eyebrow: string;
  description: string;
  schemaType: "AboutPage" | "ContactPage" | "WebPage";
  sections: LegalSection[];
}

const EFFECTIVE_DATE = "July 4, 2026";
const CONTACT_EMAIL = "reader@readative.com";

const LEGAL_PAGES: Record<LegalSlug, LegalPage> = {
  about: {
    slug: "about",
    title: "About Readative",
    eyebrow: "Knowledge with context",
    description: "Learn about Readative's mission, creator, community knowledge model, and approach to useful learning.",
    schemaType: "AboutPage",
    sections: [
      {
        title: "Our mission",
        paragraphs: [
          "Readative is a knowledge-first community for practical ideas, thoughtful learning posts, and SmartTalk discussions. It is designed to help readers discover useful explanations, tools, perspectives, and next steps without turning learning into an attention contest.",
          "Readative combines creator-published knowledge posts with community questions and answers. Posts and SmartTalk contributions remain attributable to their authors so readers can understand where information came from and explore related work.",
        ],
      },
      {
        title: "Creator and company presence",
        paragraphs: [
          "Readative was created by Atul Hinge. The platform's company presence is listed as Innovation InfoHub on LinkedIn.",
        ],
        items: [
          "Creator: Atul Hinge",
          "Company presence: Innovation InfoHub",
          `General contact: ${CONTACT_EMAIL}`,
        ],
      },
      {
        title: "How content works",
        items: [
          "Knowledge posts are published by identified contributors and may include links, images, comments, reactions, categories, and tags.",
          "SmartTalk is the community question-and-answer space for practical learning discussions.",
          "Trust indicators and community reactions are context signals, not professional endorsements or guarantees of accuracy.",
          "Recommendations and discovery surfaces help readers find related material; they do not replace independent judgment.",
        ],
      },
      {
        title: "Independence and corrections",
        paragraphs: [
          "Authors are responsible for their contributions. Readers can report policy, copyright, privacy, or accuracy concerns by contacting Readative. Material concerns may result in review, correction, reduced visibility, or removal.",
        ],
      },
    ],
  },
  contact: {
    slug: "contact",
    title: "Contact Readative",
    eyebrow: "We're listening",
    description: "Contact Readative for support, privacy, policy, copyright, corrections, safety, or business questions.",
    schemaType: "ContactPage",
    sections: [
      {
        title: "General contact",
        paragraphs: [
          `Email Readative at ${CONTACT_EMAIL}. Include the relevant post, SmartTalk question, profile, or page URL when your request concerns specific content.`,
        ],
      },
      {
        title: "What to include",
        items: [
          "Support: the feature, browser, device, and a concise description of the problem.",
          "Privacy: the account email or profile identifier and the action you are requesting.",
          "Corrections: the disputed statement, supporting source, and requested correction.",
          "Copyright or safety: the exact URL, the protected work or policy concern, and your relationship to it.",
          "Business: organization, purpose, and a reliable reply address.",
        ],
      },
      {
        title: "Urgent matters",
        paragraphs: [
          "Readative is not an emergency service. If someone is in immediate danger, contact the appropriate local emergency service. Legal notices should clearly identify the sender and the authority or right relied upon.",
        ],
      },
    ],
  },
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    eyebrow: "Your data, explained",
    description: "Readative's privacy policy explains account, content, device, analytics, advertising, storage, and privacy-request practices.",
    schemaType: "WebPage",
    sections: [
      {
        title: "Scope",
        paragraphs: [
          "This policy describes information processed when people browse Readative, sign in, publish content, participate in SmartTalk, react, comment, save preferences, or contact the platform.",
        ],
      },
      {
        title: "Information Readative processes",
        items: [
          "Account information provided through Google sign-in, such as an account identifier, name, email address, and profile image when available.",
          "Public contributions such as profile details, posts, images, comments, reactions, questions, answers, categories, tags, and trust signals.",
          "Private or device-local information used for Notebook features, guest identity, feed preferences, seen-item history, saved state, and performance caches where the product indicates that storage location.",
          "Technical and usage information such as page views, browser or device characteristics, referrers, and diagnostic events.",
          "Messages and supporting information sent to the contact address.",
        ],
      },
      {
        title: "Why information is used",
        items: [
          "Provide authentication, profiles, publishing, discussion, moderation, notification, personalization, and support features.",
          "Protect the service, enforce community rules, investigate abuse, and correct technical problems.",
          "Measure usage and improve reliability, navigation, and content discovery.",
          "Display and measure advertising and comply with legal obligations where applicable.",
        ],
      },
      {
        title: "Public content",
        paragraphs: [
          "Content and profile information published as public may be visible to anyone, linked by other users, included in search-engine indexes, and retained in third-party caches. Do not publish personal information you do not want publicly associated with you.",
        ],
      },
      {
        title: "Cookies, local storage, analytics, and advertising",
        paragraphs: [
          "Readative uses browser storage for sign-in persistence, guest identity, preferences, feed state, performance, and other requested features. Google Analytics is used to understand site usage. Google advertising technology may use cookies or similar identifiers to deliver and measure ads, subject to Google's controls and applicable consent requirements.",
        ],
      },
      {
        title: "Service providers and external services",
        paragraphs: [
          "Readative relies on service providers including Firebase and Google services for hosting, authentication, database, analytics, and advertising capabilities. External links, including LinkedIn and payment or support links, are governed by the destination's own policies.",
        ],
      },
      {
        title: "Retention, security, and requests",
        paragraphs: [
          "Information is retained for as long as reasonably needed to operate the service, preserve security and integrity, meet legal obligations, resolve disputes, and enforce policies. No internet service can guarantee absolute security.",
          `To request access, correction, deletion, or another privacy action, email ${CONTACT_EMAIL}. Readative may need to verify the request and may retain information where law, safety, fraud prevention, or recordkeeping requires it.`,
        ],
      },
      {
        title: "Children and changes",
        paragraphs: [
          "Readative is a general-audience knowledge service and is not directed to children under 13. If you believe a child provided personal information without appropriate permission, contact Readative.",
          `This policy is effective ${EFFECTIVE_DATE}. Material updates will be reflected on this page with a revised effective date.`,
        ],
      },
    ],
  },
  terms: {
    slug: "terms",
    title: "Terms of Use",
    eyebrow: "Use Readative responsibly",
    description: "Readative's terms cover accounts, user content, acceptable use, moderation, intellectual property, and service limitations.",
    schemaType: "WebPage",
    sections: [
      {
        title: "Acceptance and eligibility",
        paragraphs: [
          "By accessing or using Readative, you agree to these Terms and the Community Guidelines. If you do not agree, do not use the service. You must be legally able to enter this agreement and meet any minimum age required where you live.",
        ],
      },
      {
        title: "Accounts",
        paragraphs: [
          "You are responsible for activity under your account, the accuracy of information you provide, and keeping access to your sign-in provider secure. Do not impersonate another person or misrepresent your affiliation.",
        ],
      },
      {
        title: "Your content and the platform license",
        paragraphs: [
          "You retain ownership of content you create. By publishing content on Readative, you grant Readative a non-exclusive, worldwide, royalty-free license to host, store, reproduce, format, display, distribute, and make that content available as needed to operate, promote, secure, and improve the service. This license ends when content is removed, except for reasonable backups, legal records, and copies already shared or cached by others.",
          "You confirm that you have the rights and permissions needed for everything you publish and that your content does not violate law, privacy, intellectual property, or these policies.",
        ],
      },
      {
        title: "Prohibited use",
        items: [
          "Illegal, fraudulent, deceptive, abusive, hateful, sexually exploitative, or dangerous activity.",
          "Spam, scams, manipulation, impersonation, malware, unauthorized scraping, or interference with the service.",
          "Publishing private information, infringing content, or material you do not have permission to share.",
          "Attempting to bypass security, access controls, moderation, rate limits, or account restrictions.",
        ],
      },
      {
        title: "Moderation and termination",
        paragraphs: [
          "Readative may review, limit, label, hide, remove, or preserve content and may restrict or terminate access when reasonably necessary for policy enforcement, safety, legal compliance, or service integrity. Contact Readative if you believe an enforcement decision was made in error.",
        ],
      },
      {
        title: "Intellectual property and reports",
        paragraphs: [
          `Readative's software, branding, and original site materials are protected by applicable rights. To report copyright or other rights concerns, email ${CONTACT_EMAIL} with the exact URL, identification of the protected work, your contact information, and a good-faith explanation of the issue.`,
        ],
      },
      {
        title: "Service and liability limits",
        paragraphs: [
          "Readative is provided on an as-available basis. Features may change, be interrupted, or be discontinued. User-created content may be inaccurate or incomplete and does not constitute professional advice.",
          "To the maximum extent permitted by applicable law, Readative and its creator are not liable for indirect, incidental, special, consequential, or punitive losses arising from use of the service or reliance on user content. Nothing in these Terms excludes rights or liability that cannot legally be excluded.",
        ],
      },
      {
        title: "Changes and contact",
        paragraphs: [
          `These Terms are effective ${EFFECTIVE_DATE}. Continued use after a material update means you accept the revised Terms. Questions may be sent to ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  disclaimer: {
    slug: "disclaimer",
    title: "Disclaimer",
    eyebrow: "Important limits",
    description: "Important limits concerning Readative's educational, user-created, AI-assisted, external, and advertising content.",
    schemaType: "WebPage",
    sections: [
      {
        title: "Educational information only",
        paragraphs: [
          "Readative provides general information and learning material. It is not a substitute for legal, medical, financial, mental-health, safety, or other professional advice. Consult an appropriately qualified professional for decisions that carry significant risk.",
        ],
      },
      {
        title: "User-created and AI-assisted content",
        paragraphs: [
          "Creators are responsible for their posts, questions, answers, comments, and sources. Some material may be prepared with AI assistance. Readative does not guarantee that every contribution is accurate, complete, current, original, or suitable for a particular purpose. Verify important claims independently.",
        ],
      },
      {
        title: "Trust signals and recommendations",
        paragraphs: [
          "Reactions, badges, answer labels, rankings, recommendations, and related-content links are contextual product signals. They are not professional endorsements and should not be treated as proof that a claim is correct.",
        ],
      },
      {
        title: "External links, advertising, and support",
        paragraphs: [
          "External websites control their own content and practices. Readative may display advertising and may link to payment, donation, or other commercial services. The presence of a link or advertisement does not guarantee or endorse the destination, product, or claim unless expressly stated.",
        ],
      },
      {
        title: "Updates",
        paragraphs: [
          `Content may change without notice as authors revise work or the service evolves. This disclaimer is effective ${EFFECTIVE_DATE}. Report a material concern to ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  community: {
    slug: "community",
    title: "Community Guidelines",
    eyebrow: "Learn generously",
    description: "Readative's community guidelines explain participation, prohibited content, attribution, moderation, reporting, and appeals.",
    schemaType: "WebPage",
    sections: [
      {
        title: "Share useful knowledge",
        items: [
          "Make posts and answers relevant, understandable, and genuinely useful to readers.",
          "Distinguish evidence, personal experience, opinion, and uncertainty.",
          "Credit sources and creators, and disclose material sponsorship, affiliation, or AI assistance when it affects reader understanding.",
          "Correct meaningful errors when they are identified.",
        ],
      },
      {
        title: "Treat people with respect",
        paragraphs: [
          "Challenge ideas without attacking people. Harassment, threats, hateful conduct, sexual exploitation, targeted humiliation, stalking, and unwanted disclosure of personal information are not allowed.",
        ],
      },
      {
        title: "Keep the platform safe and authentic",
        items: [
          "No impersonation, coordinated deception, scams, spam, malware, manipulated engagement, or fraudulent credentials.",
          "No instructions intended to facilitate serious harm, illegal access, exploitation, or evasion of safety controls.",
          "Do not present dangerous, medical, legal, or financial claims as certain when qualified context is necessary.",
          "Do not upload copyrighted, private, or confidential material without permission or another lawful basis.",
        ],
      },
      {
        title: "Commercial content",
        paragraphs: [
          "Relevant commercial references may be allowed when transparent and useful. Repetitive promotion, undisclosed affiliate interests, deceptive claims, and link spam are not allowed.",
        ],
      },
      {
        title: "Enforcement, reporting, and appeals",
        paragraphs: [
          "Readative may warn, label, reduce distribution, hide, remove, or preserve content, and may restrict accounts based on severity, context, history, and risk. Repeated or severe violations may lead to permanent restrictions.",
          `Report concerns or appeal a decision at ${CONTACT_EMAIL}. Include the exact URL, the rule or right involved, relevant evidence, and why you believe action is needed or should be reconsidered.`,
        ],
      },
      {
        title: "Policy date",
        paragraphs: [`These guidelines are effective ${EFFECTIVE_DATE}.`],
      },
    ],
  },
};

const PAGE_ORDER: LegalSlug[] = ["about", "contact", "privacy", "terms", "disclaimer", "community"];

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function isLegalSlug(value: string): value is LegalSlug {
  return value in LEGAL_PAGES;
}

function renderSection(section: LegalSection) {
  return `<section class="seo-card">
    <h2>${escapeHtml(section.title)}</h2>
    ${(section.paragraphs || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
    ${section.items?.length ? `<ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
  </section>`;
}

function renderPage(page: LegalPage) {
  const canonicalPath = `/${page.slug}`;
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const pageTitle = `${page.title} | Readative`;
  const schemas = [
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
