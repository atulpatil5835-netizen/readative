const SITE_NAME = "Readative";
const SITE_URL = "https://readative.com";
const DEFAULT_LOGO = "/logo.png";

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface ItemListInput {
  name: string;
  url: string;
  items: Array<{
    name: string;
    url: string;
    description?: string;
  }>;
}

interface CollectionPageInput {
  name: string;
  url: string;
  description: string;
  about?: string | string[];
  itemList?: ReturnType<typeof buildItemListSchema>;
}

interface ArticleSchemaInput {
  headline: string;
  description: string;
  url: string;
  authorName: string;
  datePublished: string;
  dateModified?: string;
  keywords?: string[];
  image?: string | string[];
  section?: string;
}

interface DiscussionForumPostingInput {
  headline: string;
  text: string;
  url: string;
  authorName: string;
  datePublished: string;
  answerCount?: number;
  commentCount?: number;
  keywords?: string[];
}

interface FAQPageInput {
  url: string;
  questions: Array<{
    question: string;
    answer: string;
  }>;
}

export function getReadativeUrl(pathOrUrl = "/") {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  return `${SITE_URL}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

export function buildOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: getReadativeUrl(DEFAULT_LOGO),
  };
}

export function buildWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
    },
  };
}

export function buildBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: getReadativeUrl(item.url),
    })),
  };
}

export function buildItemListSchema({ name, url, items }: ItemListInput) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url: getReadativeUrl(url),
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: getReadativeUrl(item.url),
      name: item.name,
      description: item.description,
    })),
  };
}

export function buildCollectionPageSchema({
  name,
  url,
  description,
  about,
  itemList,
}: CollectionPageInput) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    url: getReadativeUrl(url),
    description,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
    },
    about: Array.isArray(about) ? about.join(", ") : about,
    mainEntity: itemList,
  };
}

export function buildArticleSchema({
  headline,
  description,
  url,
  authorName,
  datePublished,
  dateModified,
  keywords = [],
  image,
  section,
}: ArticleSchemaInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    author: {
      "@type": "Person",
      name: authorName,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: getReadativeUrl(DEFAULT_LOGO),
      },
    },
    datePublished,
    dateModified,
    articleSection: section,
    keywords: keywords.join(", "),
    mainEntityOfPage: getReadativeUrl(url),
    image: Array.isArray(image) ? image : image ? [image] : undefined,
  };
}

export function buildDiscussionForumPostingSchema({
  headline,
  text,
  url,
  authorName,
  datePublished,
  answerCount = 0,
  commentCount = 0,
  keywords = [],
}: DiscussionForumPostingInput) {
  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline,
    text,
    author: {
      "@type": "Person",
      name: authorName,
    },
    datePublished,
    url: getReadativeUrl(url),
    keywords: keywords.join(", "),
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/ReplyAction",
        userInteractionCount: answerCount,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/CommentAction",
        userInteractionCount: commentCount,
      },
    ],
    isPartOf: {
      "@type": "CollectionPage",
      name: "SmartTalk",
      url: getReadativeUrl("/smarttalk"),
    },
  };
}

export function buildFAQPageSchema({ url, questions }: FAQPageInput) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: getReadativeUrl(url),
    mainEntity: questions.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
