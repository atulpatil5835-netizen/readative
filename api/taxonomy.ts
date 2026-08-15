import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  SITE_URL,
  type SeoPost,
  type SeoProfile,
  type SeoSmartTalk,
  buildSeoProfilePath,
  escapeXml,
  getIndexableSeoPosts,
  getIndexableSeoSmartTalks,
  getIndexableSeoTags,
  loadSeoData,
} from "./_seoData.js";
import {
  SEO_CATEGORIES,
  SEO_TAGS,
  SEO_TOPICS,
  getCategoryBySlug,
  getRelatedTagsForCategory,
  getRelatedTopicsForCategory,
  getTagBySlug,
  getTopicBySlug,
  normalizeSeoSlug,
  type SeoCategoryDefinition,
  type SeoTagDefinition,
  type SeoTopicDefinition,
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

const PAGE_ITEM_LIMIT = 30;
const JSON_LD_ITEM_LIMIT = 24;

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function absoluteUrl(path: string) {
  return `${SITE_URL}${path}`;
}

function getActivity(record: {
  createdAt?: number;
  updatedAt?: number | null;
}) {
  return record.updatedAt || record.createdAt || 0;
}

function sortByActivity<T extends { id: string; createdAt?: number; updatedAt?: number | null }>(
  records: T[],
) {
  return [...records].sort(
    (left, right) =>
      getActivity(right) - getActivity(left) || left.id.localeCompare(right.id),
  );
}

function normalizeMatchToken(value: string | null | undefined) {
  return normalizeSeoSlug(value) || "";
}

function titleCaseSlug(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildDynamicTagDefinition(tag: { id: string; label: string }): SeoTagDefinition {
  const slug = normalizeSeoSlug(tag.id) || tag.id;
  const label = tag.label.trim() ? titleCaseSlug(tag.label) : titleCaseSlug(slug);

  return {
    id: slug,
    label,
    path: `/tag/${encodeURIComponent(slug)}`,
    description: `Readative posts tagged #${label}, with practical guides, discussions, tools, and related knowledge from the community.`,
    categoryIds: [],
    aliases: [],
  };
}

function resolveTagDefinition(
  slug: string,
  tags: readonly { id: string; label: string; postCount: number }[],
) {
  const knownTag = getTagBySlug(slug);
  const canonicalSlug = knownTag?.id || slug;
  const dataTag = tags.find((tag) => tag.id === canonicalSlug);

  if (knownTag) {
    return {
      ...knownTag,
      postCount: dataTag?.postCount || 0,
    };
  }

  if (!dataTag || dataTag.postCount <= 0) return null;

  return {
    ...buildDynamicTagDefinition(dataTag),
    postCount: dataTag.postCount,
  };
}

function getTagMatchValues(tag: SeoTagDefinition) {
  return [tag.id, tag.label, ...tag.aliases]
    .map(normalizeMatchToken)
    .filter(Boolean);
}

function getPostText(post: SeoPost) {
  return [
    post.title,
    post.description,
    post.content,
    post.authorName,
    post.category || "",
    ...post.hashtags,
  ]
    .join(" ")
    .toLowerCase();
}

function getQuestionText(question: SeoSmartTalk) {
  return [
    question.title,
    question.description,
    question.authorName,
    question.category || "",
    ...question.answers.map((answer) => answer.text),
  ]
    .join(" ")
    .toLowerCase();
}

function includesSearchTerm(text: string, term: string) {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return false;

  if (/^[a-z0-9+#]{1,3}$/.test(normalized)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalized)}([^a-z0-9]|$)`).test(
      text,
    );
  }

  return text.includes(normalized);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getPostTags(post: SeoPost) {
  return new Set(post.hashtags.map(normalizeMatchToken).filter(Boolean));
}

function matchesCategoryPost(post: SeoPost, category: SeoCategoryDefinition) {
  const postCategory = normalizeMatchToken(post.category);
  if (postCategory === category.id) return true;

  const postTags = getPostTags(post);
  if (
    postTags.has(category.id) ||
    category.tagSlugs.some((tag) => postTags.has(tag)) ||
    category.topicSlugs.some((topic) => postTags.has(topic))
  ) {
    return true;
  }

  const text = getPostText(post);
  return category.keywords.some((keyword) => includesSearchTerm(text, keyword));
}

function matchesCategoryQuestion(
  question: SeoSmartTalk,
  category: SeoCategoryDefinition,
) {
  const questionCategory = normalizeMatchToken(question.category);
  if (questionCategory === category.id) return true;

  const text = getQuestionText(question);
  return category.keywords.some((keyword) => includesSearchTerm(text, keyword));
}

function getTopicTerms(topic: SeoTopicDefinition) {
  return [
    topic.id,
    topic.label,
    ...topic.aliases,
    ...topic.keywords,
    ...topic.tagSlugs,
  ].filter(Boolean);
}

function matchesTopicPost(post: SeoPost, topic: SeoTopicDefinition) {
  const postTags = getPostTags(post);
  if (
    postTags.has(topic.id) ||
    topic.tagSlugs.some((tag) => postTags.has(tag))
  ) {
    return true;
  }

  const text = getPostText(post);
  return getTopicTerms(topic).some((term) => includesSearchTerm(text, term));
}

function matchesTopicQuestion(
  question: SeoSmartTalk,
  topic: SeoTopicDefinition,
) {
  const text = getQuestionText(question);
  return getTopicTerms(topic).some((term) => includesSearchTerm(text, term));
}

function matchesTagPost(post: SeoPost, tag: SeoTagDefinition) {
  const tagMatchValues = new Set(getTagMatchValues(tag));

  return post.hashtags.some((postTag) =>
    tagMatchValues.has(normalizeMatchToken(postTag)),
  );
}

function matchesTagQuestion(question: SeoSmartTalk, tag: SeoTagDefinition) {
  const text = getQuestionText(question);

  return [tag.label, tag.id, ...tag.aliases].some((term) =>
    includesSearchTerm(text, term),
  );
}

function renderNav() {
  return `<nav class="seo-nav" aria-label="Primary"><a class="seo-brand" href="/">Readative</a><span class="seo-navlinks"><a href="/posts">Posts</a><a href="/smarttalks">SmartTalk</a><a href="/explore">Explore</a></span></nav>`;
}

function renderFooter() {
  return `<footer class="seo-footer"><a href="/about">About</a> &middot; <a href="/contact">Contact</a> &middot; <a href="/privacy">Privacy</a> &middot; <a href="/terms">Terms</a> &middot; <a href="/community">Community</a></footer>`;
}

function renderPostList(posts: SeoPost[]) {
  if (posts.length === 0) {
    return '<li><a href="/posts">Browse the full post index</a></li>';
  }

  return posts
    .slice(0, PAGE_ITEM_LIMIT)
    .map(
      (post) => `<li>
        <a href="${escapeHtml(buildPostSeoPath(post.id, post.title))}">${escapeHtml(post.title)}</a>
        <span> - ${escapeHtml(post.description)}</span>
      </li>`,
    )
    .join("");
}

function renderQuestionList(questions: SeoSmartTalk[]) {
  if (questions.length === 0) {
    return '<li><a href="/smarttalks">Browse SmartTalk discussions</a></li>';
  }

  return questions
    .slice(0, PAGE_ITEM_LIMIT)
    .map(
      (question) => `<li>
        <a href="${escapeHtml(buildSmartTalkSeoPath(question.id, question.title))}">${escapeHtml(question.title)}</a>
        <span> - ${question.answerCount} ${question.answerCount === 1 ? "answer" : "answers"}</span>
      </li>`,
    )
    .join("");
}

function renderProfileList(profiles: SeoProfile[]) {
  if (profiles.length === 0) {
    return '<li><a href="/posts">Browse Readative contributors through posts</a></li>';
  }

  return profiles
    .slice(0, 18)
    .map(
      (profile) => `<li>
        <a href="${escapeHtml(buildSeoProfilePath(profile))}">${escapeHtml(profile.name)}</a>
        <span> - @${escapeHtml(profile.username)} / ${profile.postCount} posts / ${profile.smartTalkCount} SmartTalk discussions</span>
      </li>`,
    )
    .join("");
}

function renderLinkPills(
  items: Array<{ href: string; label: string }>,
  emptyHref = "/explore",
) {
  if (items.length === 0) {
    return `<a href="${emptyHref}">Explore Readative topics</a>`;
  }

  return items
    .map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`)
    .join("");
}

function buildItemListSchema({
  name,
  url,
  posts,
  questions,
  profiles = [],
}: {
  name: string;
  url: string;
  posts: SeoPost[];
  questions: SeoSmartTalk[];
  profiles?: SeoProfile[];
}) {
  return {
    "@type": "ItemList",
    name,
    url,
    itemListElement: [
      ...posts.slice(0, JSON_LD_ITEM_LIMIT).map((post, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: post.title,
        url: absoluteUrl(buildPostSeoPath(post.id, post.title)),
      })),
      ...questions.slice(0, JSON_LD_ITEM_LIMIT).map((question, index) => ({
        "@type": "ListItem",
        position: posts.slice(0, JSON_LD_ITEM_LIMIT).length + index + 1,
        name: question.title,
        url: absoluteUrl(buildSmartTalkSeoPath(question.id, question.title)),
      })),
      ...profiles.slice(0, 12).map((profile, index) => ({
        "@type": "ListItem",
        position:
          posts.slice(0, JSON_LD_ITEM_LIMIT).length +
          questions.slice(0, JSON_LD_ITEM_LIMIT).length +
          index +
          1,
        name: profile.name,
        url: absoluteUrl(buildSeoProfilePath(profile)),
      })),
    ],
  };
}

function buildBaseSchemas({
  pageType,
  title,
  canonicalUrl,
  description,
  itemList,
  breadcrumbs,
  about,
}: {
  pageType: "CollectionPage" | "ItemPage";
  title: string;
  canonicalUrl: string;
  description: string;
  itemList: object;
  breadcrumbs: Array<{ name: string; item: string }>;
  about: string | string[];
}) {
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
      url: SITE_URL,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@context": "https://schema.org",
      "@type": pageType,
      "@id": `${canonicalUrl}#page`,
      name: title,
      url: canonicalUrl,
      description,
      about,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      mainEntity: itemList,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((breadcrumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: breadcrumb.name,
        item: breadcrumb.item,
      })),
    },
  ];
}

function renderHead({
  pageTitle,
  description,
  canonicalUrl,
  schema,
}: {
  pageTitle: string;
  description: string;
  canonicalUrl: string;
  schema: object | object[];
}) {
  return `
    <title>${escapeHtml(pageTitle)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(pageTitle)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${SITE_URL}/logo.png" />
    <meta property="og:image:alt" content="Readative knowledge discovery" />
    <meta property="og:site_name" content="Readative" />
    <meta property="og:locale" content="en_US" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${SITE_URL}/logo.png" />
    <meta name="twitter:image:alt" content="Readative knowledge discovery" />
    ${renderJsonLd(schema)}
    ${SEO_DOCUMENT_STYLES}`;
}

function renderNotFound(slug: string, noun = "Topic") {
  const lowerNoun = noun.toLowerCase();
  const head = `
    <title>${noun} Not Found | Readative</title>
    <meta name="description" content="The requested Readative ${lowerNoun} is not available." />
    <meta name="robots" content="noindex, follow" />
    ${SEO_DOCUMENT_STYLES}`;
  const main = `<div class="seo-document"><div class="seo-shell">
    ${renderNav()}
    <main class="seo-card"><p class="seo-kicker">Error 404</p><h1>${noun} not found</h1><p>The requested ${lowerNoun} <code>${escapeHtml(slug || "unknown")}</code> is not part of the public Readative ${lowerNoun} map.</p><p><a href="/explore">Explore public topics</a></p></main>
    ${renderFooter()}
  </div></div>`;

  return renderAppDocument({ head, main });
}

function getProfilesForContent({
  profiles,
  posts,
  questions,
}: {
  profiles: SeoProfile[];
  posts: SeoPost[];
  questions: SeoSmartTalk[];
}) {
  const authorIds = new Set([
    ...posts.map((post) => post.authorId).filter(Boolean),
    ...questions.map((question) => question.authorId).filter(Boolean),
  ]);

  return profiles.filter((profile) => authorIds.has(profile.id));
}

function renderExplorePage({
  posts,
  questions,
  profiles,
}: {
  posts: SeoPost[];
  questions: SeoSmartTalk[];
  profiles: SeoProfile[];
}) {
  const canonicalPath = "/explore";
  const canonicalUrl = absoluteUrl(canonicalPath);
  const pageTitle = "Explore Topics, Posts, and SmartTalk | Readative";
  const pageDescription =
    "Explore Readative topics, practical posts, SmartTalk discussions, and contributor profiles across AI, technology, business, marketing, startups, productivity, development, and cybersecurity.";
  const recentPosts = sortByActivity(posts).slice(0, PAGE_ITEM_LIMIT);
  const activeQuestions = sortByActivity(questions).slice(0, PAGE_ITEM_LIMIT);
  const itemList = buildItemListSchema({
    name: "Readative Explore highlights",
    url: canonicalUrl,
    posts: recentPosts,
    questions: activeQuestions,
    profiles,
  });
  const schema = buildBaseSchemas({
    pageType: "CollectionPage",
    title: pageTitle,
    canonicalUrl,
    description: pageDescription,
    itemList,
    breadcrumbs: [
      { name: "Home", item: SITE_URL },
      { name: "Explore", item: canonicalUrl },
    ],
    about: SEO_CATEGORIES.map((category) => category.label),
  });
  const categoryLinks = SEO_CATEGORIES.map((category) => ({
    href: category.path,
    label: category.label,
  }));
  const topicLinks = SEO_TOPICS.slice(0, 30).map((topic) => ({
    href: topic.path,
    label: topic.label,
  }));
  const head = renderHead({
    pageTitle,
    description: pageDescription,
    canonicalUrl,
    schema,
  });
  const main = `<div class="seo-document"><div class="seo-shell">
    ${renderNav()}
    <main>
      <header class="seo-hero"><div class="seo-hero-inner">
        <p class="seo-kicker">Explore Readative</p>
        <h1>Explore Topics, Posts, and SmartTalk</h1>
        <p class="seo-lede">${escapeHtml(pageDescription)}</p>
        <div class="seo-meta"><span>${posts.length} public posts</span><span>${questions.length} SmartTalk discussions</span><span>${profiles.length} contributor profiles</span></div>
      </div></header>
      <section class="seo-card"><h2>Knowledge Categories</h2><div class="seo-tags">${renderLinkPills(categoryLinks)}</div></section>
      <section class="seo-card"><h2>Topic Map</h2><div class="seo-tags">${renderLinkPills(topicLinks)}</div></section>
      <section class="seo-card"><div class="seo-grid">
        <section><h2>Recent Posts</h2><ul class="seo-list">${renderPostList(recentPosts)}</ul></section>
        <section><h2>Active SmartTalk</h2><ul class="seo-list">${renderQuestionList(activeQuestions)}</ul></section>
      </div></section>
      <section class="seo-card"><h2>Contributors</h2><ul class="seo-list">${renderProfileList(profiles)}</ul></section>
    </main>
    ${renderFooter()}
  </div></div>`;

  return renderAppDocument({ head, main });
}

function renderCategoryPage({
  category,
  posts,
  questions,
  profiles,
}: {
  category: SeoCategoryDefinition;
  posts: SeoPost[];
  questions: SeoSmartTalk[];
  profiles: SeoProfile[];
}) {
  const canonicalUrl = absoluteUrl(category.path);
  const pageTitle = `${category.label} SmartTalk and Knowledge | Readative`;
  const pageDescription = category.description;
  const relatedTopics = getRelatedTopicsForCategory(category.id, 10);
  const relatedTags = getRelatedTagsForCategory(category.id, 8);
  const matchedPosts = sortByActivity(
    posts.filter((post) => matchesCategoryPost(post, category)),
  );
  const matchedQuestions = sortByActivity(
    questions.filter((question) => matchesCategoryQuestion(question, category)),
  );
  const matchedProfiles = getProfilesForContent({
    profiles,
    posts: matchedPosts,
    questions: matchedQuestions,
  });
  const itemList = buildItemListSchema({
    name: `${category.label} Readative collection`,
    url: canonicalUrl,
    posts: matchedPosts,
    questions: matchedQuestions,
    profiles: matchedProfiles,
  });
  const schema = buildBaseSchemas({
    pageType: "CollectionPage",
    title: pageTitle,
    canonicalUrl,
    description: pageDescription,
    itemList,
    breadcrumbs: [
      { name: "Home", item: SITE_URL },
      { name: "Explore", item: absoluteUrl("/explore") },
      { name: category.label, item: canonicalUrl },
    ],
    about: [category.label, ...category.examples],
  });
  const topicLinks = relatedTopics.map((topic) => ({
    href: topic.path,
    label: topic.label,
  }));
  const tagLinks = relatedTags.map((tag) => ({
    href: tag.path,
    label: `#${tag.label}`,
  }));
  const head = renderHead({
    pageTitle,
    description: pageDescription,
    canonicalUrl,
    schema,
  });
  const main = `<div class="seo-document"><div class="seo-shell">
    ${renderNav()}
    <main>
      <article class="seo-hero"><div class="seo-hero-inner">
        <p class="seo-kicker">Knowledge category</p>
        <h1>${escapeHtml(category.label)} SmartTalk and Knowledge</h1>
        <p class="seo-lede">${escapeHtml(pageDescription)}</p>
        <div class="seo-meta"><span>${matchedPosts.length} related posts</span><span>${matchedQuestions.length} SmartTalk discussions</span><span>${matchedProfiles.length} contributors</span></div>
      </div></article>
      <section class="seo-card"><div class="seo-grid">
        <section><h2>What</h2><p>${escapeHtml(category.what)}</p></section>
        <section><h2>Why</h2><p>${escapeHtml(category.why)}</p></section>
        <section><h2>Who</h2><p>${escapeHtml(category.who)}</p></section>
        <section><h2>Benefits</h2><ul>${category.benefits.map((benefit) => `<li>${escapeHtml(benefit)}</li>`).join("")}</ul></section>
      </div></section>
      <section class="seo-card"><h2>Related Topics</h2><div class="seo-tags">${renderLinkPills(topicLinks)}</div></section>
      <section class="seo-card"><h2>Related Tags</h2><div class="seo-tags">${renderLinkPills(tagLinks, "/posts")}</div></section>
      <section class="seo-card"><div class="seo-grid">
        <section><h2>Posts</h2><ul class="seo-list">${renderPostList(matchedPosts)}</ul></section>
        <section><h2>SmartTalk Discussions</h2><ul class="seo-list">${renderQuestionList(matchedQuestions)}</ul></section>
      </div></section>
      <section class="seo-card"><h2>Contributors</h2><ul class="seo-list">${renderProfileList(matchedProfiles)}</ul></section>
    </main>
    ${renderFooter()}
  </div></div>`;

  return renderAppDocument({ head, main });
}

function renderTopicPage({
  topic,
  posts,
  questions,
  profiles,
}: {
  topic: SeoTopicDefinition;
  posts: SeoPost[];
  questions: SeoSmartTalk[];
  profiles: SeoProfile[];
}) {
  const category = getCategoryBySlug(topic.categoryId);
  const canonicalUrl = absoluteUrl(topic.path);
  const pageTitle = `${topic.collectionTitle} | Readative`;
  const pageDescription = topic.description;
  const relatedTopics = category
    ? getRelatedTopicsForCategory(category.id, 10).filter(
        (candidate) => candidate.id !== topic.id,
      )
    : [];
  const matchedPosts = sortByActivity(
    posts.filter((post) => matchesTopicPost(post, topic)),
  );
  const matchedQuestions = sortByActivity(
    questions.filter((question) => matchesTopicQuestion(question, topic)),
  );
  const matchedProfiles = getProfilesForContent({
    profiles,
    posts: matchedPosts,
    questions: matchedQuestions,
  });
  const itemList = buildItemListSchema({
    name: `${topic.label} Readative collection`,
    url: canonicalUrl,
    posts: matchedPosts,
    questions: matchedQuestions,
    profiles: matchedProfiles,
  });
  const schema = buildBaseSchemas({
    pageType: "CollectionPage",
    title: pageTitle,
    canonicalUrl,
    description: pageDescription,
    itemList,
    breadcrumbs: [
      { name: "Home", item: SITE_URL },
      { name: "Explore", item: absoluteUrl("/explore") },
      ...(category ? [{ name: category.label, item: absoluteUrl(category.path) }] : []),
      { name: topic.label, item: canonicalUrl },
    ],
    about: [topic.label, ...topic.keywords],
  });
  const topicLinks = relatedTopics.map((relatedTopic) => ({
    href: relatedTopic.path,
    label: relatedTopic.label,
  }));
  const head = renderHead({
    pageTitle,
    description: pageDescription,
    canonicalUrl,
    schema,
  });
  const main = `<div class="seo-document"><div class="seo-shell">
    ${renderNav()}
    <main>
      <article class="seo-hero"><div class="seo-hero-inner">
        <p class="seo-kicker">Knowledge topic</p>
        <h1>${escapeHtml(topic.collectionTitle)}</h1>
        <p class="seo-lede">${escapeHtml(pageDescription)}</p>
        <div class="seo-meta"><span>${matchedPosts.length} related posts</span><span>${matchedQuestions.length} SmartTalk discussions</span>${category ? `<a href="${escapeHtml(category.path)}">${escapeHtml(category.label)}</a>` : ""}</div>
      </div></article>
      ${category ? `<section class="seo-card"><div class="seo-grid"><section><h2>Category Context</h2><p>${escapeHtml(category.description)}</p></section><section><h2>Useful For</h2><p>${escapeHtml(category.who)}</p></section></div></section>` : ""}
      <section class="seo-card"><h2>Related Topics</h2><div class="seo-tags">${renderLinkPills(topicLinks)}</div></section>
      <section class="seo-card"><div class="seo-grid">
        <section><h2>Posts</h2><ul class="seo-list">${renderPostList(matchedPosts)}</ul></section>
        <section><h2>SmartTalk Discussions</h2><ul class="seo-list">${renderQuestionList(matchedQuestions)}</ul></section>
      </div></section>
      <section class="seo-card"><h2>Contributors</h2><ul class="seo-list">${renderProfileList(matchedProfiles)}</ul></section>
    </main>
    ${renderFooter()}
  </div></div>`;

  return renderAppDocument({ head, main });
}

function renderTagPage({
  tag,
  posts,
  questions,
  profiles,
}: {
  tag: SeoTagDefinition;
  posts: SeoPost[];
  questions: SeoSmartTalk[];
  profiles: SeoProfile[];
}) {
  const canonicalUrl = absoluteUrl(tag.path);
  const pageTitle = `#${tag.label} Knowledge Posts | Readative`;
  const pageDescription = tag.description;
  const matchedPosts = sortByActivity(
    posts.filter((post) => matchesTagPost(post, tag)),
  );
  const matchedQuestions = sortByActivity(
    questions.filter((question) => matchesTagQuestion(question, tag)),
  );
  const matchedProfiles = getProfilesForContent({
    profiles,
    posts: matchedPosts,
    questions: matchedQuestions,
  });
  const relatedCategories = tag.categoryIds
    .map((categoryId) => getCategoryBySlug(categoryId))
    .filter(Boolean) as SeoCategoryDefinition[];
  const inferredCategories =
    relatedCategories.length > 0
      ? relatedCategories
      : SEO_CATEGORIES.filter((category) =>
          matchedPosts.some(
            (post) =>
              post.category === category.id ||
              post.hashtags.some((postTag) =>
                (category.tagSlugs as readonly string[]).includes(
                  normalizeMatchToken(postTag),
                ),
              ),
          ),
        ).slice(0, 4);
  const itemList = buildItemListSchema({
    name: `#${tag.label} Readative collection`,
    url: canonicalUrl,
    posts: matchedPosts,
    questions: matchedQuestions,
    profiles: matchedProfiles,
  });
  const schema = buildBaseSchemas({
    pageType: "CollectionPage",
    title: pageTitle,
    canonicalUrl,
    description: pageDescription,
    itemList,
    breadcrumbs: [
      { name: "Home", item: SITE_URL },
      { name: "Explore", item: absoluteUrl("/explore") },
      { name: `#${tag.label}`, item: canonicalUrl },
    ],
    about: [`#${tag.label}`, tag.id, ...tag.aliases],
  });
  const categoryLinks = inferredCategories.map((category) => ({
    href: category.path,
    label: category.label,
  }));
  const knownRelatedTags = SEO_TAGS.filter(
    (candidate) =>
      candidate.id !== tag.id &&
      candidate.categoryIds.some((categoryId) =>
        inferredCategories.some((category) => category.id === categoryId),
      ),
  )
    .slice(0, 8)
    .map((candidate) => ({
      href: candidate.path,
      label: `#${candidate.label}`,
    }));
  const head = renderHead({
    pageTitle,
    description: pageDescription,
    canonicalUrl,
    schema,
  });
  const main = `<div class="seo-document"><div class="seo-shell">
    ${renderNav()}
    <main>
      <article class="seo-hero"><div class="seo-hero-inner">
        <p class="seo-kicker">Knowledge tag</p>
        <h1>#${escapeHtml(tag.label)}</h1>
        <p class="seo-lede">${escapeHtml(pageDescription)}</p>
        <div class="seo-meta"><span>${matchedPosts.length} related posts</span><span>${matchedQuestions.length} SmartTalk discussions</span><span>${matchedProfiles.length} contributors</span></div>
      </div></article>
      <section class="seo-card"><h2>Related Categories</h2><div class="seo-tags">${renderLinkPills(categoryLinks, "/explore")}</div></section>
      <section class="seo-card"><div class="seo-grid">
        <section><h2>Posts</h2><ul class="seo-list">${renderPostList(matchedPosts)}</ul></section>
        <section><h2>SmartTalk Discussions</h2><ul class="seo-list">${renderQuestionList(matchedQuestions)}</ul></section>
      </div></section>
      <section class="seo-card"><h2>Related Tags</h2><div class="seo-tags">${renderLinkPills(knownRelatedTags, "/posts")}</div></section>
      <section class="seo-card"><h2>Contributors</h2><ul class="seo-list">${renderProfileList(matchedProfiles)}</ul></section>
    </main>
    ${renderFooter()}
  </div></div>`;

  return renderAppDocument({ head, main });
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

  const type = getQueryValue(req.query.type);
  const view = getQueryValue(req.query.view);
  const rawSlug = getQueryValue(req.query.slug);
  const slug = normalizeSeoSlug(rawSlug) || "";

  try {
    const data = await loadSeoData();
    if (data.source === "static") {
      console.error("Taxonomy SEO data unavailable:", data.errors);
      res.setHeader("Cache-Control", "no-store");
    }
    const posts = getIndexableSeoPosts(data.posts);
    const questions = getIndexableSeoSmartTalks(data.smartTalks);
    const tags = getIndexableSeoTags(data.posts);

    res.setHeader("X-Readative-SEO-Source", data.source);
    res.setHeader("X-Readative-SEO-Post-Count", posts.length.toString());
    res.setHeader(
      "X-Readative-SEO-SmartTalk-Count",
      questions.length.toString(),
    );
    res.setHeader(
      "X-Readative-SEO-Profile-Count",
      data.profiles.length.toString(),
    );

    if (view === "explore" || (!type && !slug)) {
      if (req.method === "HEAD") return res.status(200).end();
      return res.status(200).send(
        renderExplorePage({
          posts,
          questions,
          profiles: data.profiles,
        }),
      );
    }

    if (type === "category") {
      const category = getCategoryBySlug(slug);
      if (!category) {
        if (req.method === "HEAD") return res.status(404).end();
        return res.status(404).send(renderNotFound(rawSlug));
      }

      if (slug !== category.id) {
        res.setHeader("Location", absoluteUrl(category.path));
        res.setHeader("Cache-Control", "public, max-age=0, s-maxage=86400");
        return res.status(301).end();
      }

      if (req.method === "HEAD") return res.status(200).end();
      return res.status(200).send(
        renderCategoryPage({
          category,
          posts,
          questions,
          profiles: data.profiles,
        }),
      );
    }

    if (type === "topic") {
      const topic = getTopicBySlug(slug);
      if (!topic) {
        if (req.method === "HEAD") return res.status(404).end();
        return res.status(404).send(renderNotFound(rawSlug));
      }

      if (slug !== topic.id) {
        res.setHeader("Location", absoluteUrl(topic.path));
        res.setHeader("Cache-Control", "public, max-age=0, s-maxage=86400");
        return res.status(301).end();
      }

      if (req.method === "HEAD") return res.status(200).end();
      return res.status(200).send(
        renderTopicPage({
          topic,
          posts,
          questions,
          profiles: data.profiles,
        }),
      );
    }

    if (type === "tag") {
      const tag = resolveTagDefinition(slug, tags);
      if (!tag || tag.postCount <= 0) {
        if (req.method === "HEAD") return res.status(404).end();
        return res.status(404).send(renderNotFound(rawSlug, "Tag"));
      }

      if (slug !== tag.id) {
        res.setHeader("Location", absoluteUrl(tag.path));
        res.setHeader("Cache-Control", "public, max-age=0, s-maxage=86400");
        return res.status(301).end();
      }

      if (req.method === "HEAD") return res.status(200).end();
      return res.status(200).send(
        renderTagPage({
          tag,
          posts,
          questions,
          profiles: data.profiles,
        }),
      );
    }

    if (req.method === "HEAD") return res.status(404).end();
    return res.status(404).send(renderNotFound(rawSlug));
  } catch (error) {
    console.error("Taxonomy document generation error:", error);
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).send(
      `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="robots" content="noindex, follow" /><title>Readative temporarily unavailable</title></head><body><main><h1>Readative temporarily unavailable</h1><p>${escapeXml("Topic data is temporarily unavailable.")}</p></main></body></html>`,
    );
  }
}
