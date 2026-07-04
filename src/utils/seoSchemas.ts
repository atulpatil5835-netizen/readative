const SITE_NAME = "Readative";
const SITE_URL = "https://www.readative.com";
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
  authorUrl?: string;
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
  authorUrl?: string;
  datePublished: string;
  dateModified?: string;
  answerCount?: number;
  commentCount?: number;
  keywords?: string[];
  answers?: Array<{ text: string; authorName: string; authorUrl?: string }>;
}

interface FAQPageInput {
  url: string;
  questions: Array<{
    question: string;
    answer?: string;
    suggestedAnswers?: Array<{ text: string; authorName?: string }>;
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
  authorUrl,
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
      url: authorUrl ? getReadativeUrl(authorUrl) : undefined,
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
    url: getReadativeUrl(url),
    image: Array.isArray(image) ? image : image ? [image] : undefined,
  };
}

export function buildDiscussionForumPostingSchema({
  headline,
  text,
  url,
  authorName,
  authorUrl,
  datePublished,
  dateModified,
  answerCount = 0,
  commentCount = 0,
  keywords = [],
  answers = [],
}: DiscussionForumPostingInput) {
  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline,
    text,
    author: {
      "@type": "Person",
      name: authorName,
      url: authorUrl ? getReadativeUrl(authorUrl) : undefined,
    },
    datePublished,
    dateModified,
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
      url: getReadativeUrl("/smarttalks"),
    },
    comment: answers.map((answer) => ({
      "@type": "Comment",
      text: answer.text,
      author: {
        "@type": "Person",
        name: answer.authorName,
        url: answer.authorUrl ? getReadativeUrl(answer.authorUrl) : undefined,
      },
    })),
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
      acceptedAnswer: item.answer
        ? {
            "@type": "Answer",
            text: item.answer,
          }
        : undefined,
      suggestedAnswer: item.suggestedAnswers?.map((answer) => ({
        "@type": "Answer",
        text: answer.text,
        author: answer.authorName
          ? { "@type": "Person", name: answer.authorName }
          : undefined,
      })),
    })),
  };
}
