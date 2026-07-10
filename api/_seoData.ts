import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  SEO_CATEGORIES,
  SEO_TAGS,
  SEO_TOPICS,
  normalizeSeoSlug,
} from "../src/utils/seoTaxonomy.js";
import {
  getRelatedPosts,
  getRelatedQuestions,
  normalizeContentGraphTags,
} from "../src/utils/contentGraph.js";
import {
  buildPostSeoPath,
  buildSmartTalkSeoPath,
  extractSeoDocumentId,
} from "../src/utils/seoUrls.js";

export const SITE_URL = "https://www.readative.com";
export const DISCOVERY_INDEX_PATH = "/posts";

const DEFAULT_PROJECT_ID = "readative-803b0";
const PRIVATE_STATUSES = new Set(["archived", "deleted", "draft", "hidden", "private"]);

export interface SeoPost {
  id: string;
  title: string;
  description: string;
  content: string;
  authorId: string;
  authorName: string;
  category: string | null;
  hashtags: string[];
  createdAt: number;
  updatedAt: number | null;
}

export interface SeoProfile {
  id: string;
  name: string;
  username: string;
  description: string;
  updatedAt: number | null;
  postCount: number;
  smartTalkCount: number;
}

export interface SeoTag {
  id: string;
  label: string;
  lastmod: number | null;
  postCount: number;
}

export interface SeoSmartTalk {
  id: string;
  title: string;
  description: string;
  authorId: string;
  authorName: string;
  category: string | null;
  answerCount: number;
  answers: Array<{
    authorName: string;
    text: string;
  }>;
  createdAt: number;
  updatedAt: number | null;
}

export interface SeoData {
  source: "admin" | "rest" | "static";
  generatedAt: number;
  posts: SeoPost[];
  profiles: SeoProfile[];
  tags: SeoTag[];
  smartTalks: SeoSmartTalk[];
  errors: string[];
}

export interface SeoPostPageData {
  source: "admin" | "rest";
  post: SeoPost;
  relatedPosts: SeoPost[];
  relatedSmartTalks: SeoSmartTalk[];
}

export interface SitemapEntry {
  loc: string;
  path: string;
  lastmod?: string;
  changefreq: "daily" | "weekly" | "monthly";
  priority: string;
  type: "page" | "category" | "topic" | "tag" | "post" | "profile" | "smarttalk";
}

type FirestoreDocument = {
  name: string;
  fields?: Record<string, FirestoreValue>;
};

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { arrayValue?: { values?: FirestoreValue[] } }
  | { mapValue?: { fields?: Record<string, FirestoreValue> } }
  | { nullValue: null };

const STATIC_PAGES = [
  { path: "/", priority: "1.0", changefreq: "daily" as const, lastmod: null },
  { path: "/explore", priority: "0.8", changefreq: "weekly" as const, lastmod: null },
  { path: "/smarttalks", priority: "0.8", changefreq: "weekly" as const, lastmod: null },
  { path: DISCOVERY_INDEX_PATH, priority: "0.9", changefreq: "daily" as const, lastmod: null },
  { path: "/about", priority: "0.6", changefreq: "monthly" as const, lastmod: Date.UTC(2026, 6, 4) },
  { path: "/contact", priority: "0.5", changefreq: "monthly" as const, lastmod: Date.UTC(2026, 6, 4) },
  { path: "/privacy", priority: "0.5", changefreq: "monthly" as const, lastmod: Date.UTC(2026, 6, 4) },
  { path: "/terms", priority: "0.5", changefreq: "monthly" as const, lastmod: Date.UTC(2026, 6, 4) },
  { path: "/disclaimer", priority: "0.5", changefreq: "monthly" as const, lastmod: Date.UTC(2026, 6, 4) },
  { path: "/community", priority: "0.6", changefreq: "monthly" as const, lastmod: Date.UTC(2026, 6, 4) },
  { path: "/support", priority: "0.6", changefreq: "monthly" as const, lastmod: Date.UTC(2026, 6, 4) },
  { path: "/projects", priority: "0.7", changefreq: "monthly" as const, lastmod: Date.UTC(2026, 6, 4) },
  { path: "/mission", priority: "0.6", changefreq: "monthly" as const, lastmod: Date.UTC(2026, 6, 4) },
  { path: "/editorial-policy", priority: "0.5", changefreq: "monthly" as const, lastmod: Date.UTC(2026, 6, 4) },
  { path: "/content-policy", priority: "0.5", changefreq: "monthly" as const, lastmod: Date.UTC(2026, 6, 4) },
  { path: "/corrections-policy", priority: "0.5", changefreq: "monthly" as const, lastmod: Date.UTC(2026, 6, 4) },
  { path: "/cookies", priority: "0.5", changefreq: "monthly" as const, lastmod: Date.UTC(2026, 6, 4) },
  { path: "/copyright", priority: "0.5", changefreq: "monthly" as const, lastmod: Date.UTC(2026, 6, 4) },
  { path: "/dmca", priority: "0.5", changefreq: "monthly" as const, lastmod: Date.UTC(2026, 6, 4) },
];

function readEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function getProjectId() {
  return (
    readEnv("FIREBASE_PROJECT_ID") ||
    readEnv("VITE_FIREBASE_PROJECT_ID") ||
    DEFAULT_PROJECT_ID
  );
}

function getApiKey() {
  return (
    readEnv("FIREBASE_API_KEY") ||
    readEnv("VITE_FIREBASE_API_KEY") ||
    readEnv("VITE_FIREBASE_WEB_API_KEY")
  );
}

function getAdminDatabase() {
  const projectId = getProjectId();
  const clientEmail = readEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = readEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    return null;
  }

  const app =
    getApps()[0] ||
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

  return getFirestore(app);
}

function decodeFirestoreValue(value: FirestoreValue | undefined): unknown {
  if (!value || typeof value !== "object") return undefined;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return Date.parse(value.timestampValue);
  if ("arrayValue" in value) {
    return (value.arrayValue?.values || []).map((item) =>
      decodeFirestoreValue(item),
    );
  }
  if ("mapValue" in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue?.fields || {}).map(([key, item]) => [
        key,
        decodeFirestoreValue(item),
      ]),
    );
  }
  return null;
}

function decodeRestDocument(document: FirestoreDocument) {
  const id = document.name.split("/").pop() || "";
  const data = Object.fromEntries(
    Object.entries(document.fields || {}).map(([key, value]) => [
      key,
      decodeFirestoreValue(value),
    ]),
  );

  return { id, data };
}

async function fetchRestCollection(collectionId: string) {
  const projectId = getProjectId();
  const apiKey = getApiKey();
  const documents: Array<{ id: string; data: Record<string, unknown> }> = [];
  let pageToken = "";

  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionId}`,
    );
    url.searchParams.set("pageSize", "1000");
    if (apiKey) url.searchParams.set("key", apiKey);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `${collectionId} REST fetch failed (${response.status}): ${body.slice(0, 220)}`,
      );
    }

    const payload = (await response.json()) as {
      documents?: FirestoreDocument[];
      nextPageToken?: string;
    };
    documents.push(...(payload.documents || []).map(decodeRestDocument));
    pageToken = payload.nextPageToken || "";
  } while (pageToken);

  return documents;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .map((item) => normalizeString(item))
        .filter(Boolean),
    ),
  ];
}

function normalizeTimestamp(value: unknown, fallback: number | null = null) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (
    value &&
    typeof value === "object" &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }

  if (
    value &&
    typeof value === "object" &&
    typeof (value as { seconds?: unknown }).seconds === "number"
  ) {
    return Math.round((value as { seconds: number }).seconds * 1000);
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function createExcerpt(text: string, maxLength = 160) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function isPublishedPost(data: Record<string, unknown>) {
  const visibility = normalizeString(data.visibility).toLowerCase();
  const status = normalizeString(data.status || data.publishStatus).toLowerCase();

  return (
    visibility !== "private" &&
    !PRIVATE_STATUSES.has(status) &&
    !data.deletedAt &&
    Boolean(normalizeString(data.title) && normalizeString(data.content))
  );
}

function isPublicRecord(data: Record<string, unknown>) {
  const visibility = normalizeString(data.visibility).toLowerCase();
  const status = normalizeString(data.status || data.publishStatus).toLowerCase();

  return (
    visibility !== "private" &&
    !PRIVATE_STATUSES.has(status) &&
    !data.deletedAt
  );
}

function normalizePost(id: string, data: Record<string, unknown>): SeoPost | null {
  if (!id || !isPublishedPost(data)) return null;

  const createdAt =
    normalizeTimestamp(data.createdAt) ||
    normalizeTimestamp(data.updatedAt) ||
    0;
  const updatedAt = normalizeTimestamp(data.updatedAt);
  const authorName =
    normalizeString(data.author) ||
    normalizeString(data.username) ||
    "Readative contributor";

  return {
    id,
    title: normalizeString(data.title),
    description: createExcerpt(normalizeString(data.excerpt) || normalizeString(data.content)),
    content: normalizeString(data.content),
    authorId: normalizeString(data.authorId),
    authorName,
    category: normalizeSeoSlug(normalizeString(data.category)),
    hashtags: normalizeContentGraphTags(normalizeStringArray(data.hashtags)),
    createdAt,
    updatedAt,
  };
}

function normalizeProfile(
  id: string,
  data: Record<string, unknown>,
): SeoProfile | null {
  if (!id || !isPublicRecord(data)) return null;

  const name =
    normalizeString(data.displayName) ||
    normalizeString(data.username);
  if (!name) return null;

  return {
    id,
    name,
    username: normalizeString(data.username) || normalizeSeoSlug(name) || name,
    description:
      normalizeString(data.bio) ||
      "A Readative contributor publishing and curating practical knowledge.",
    updatedAt: normalizeTimestamp(data.updatedAt, normalizeTimestamp(data.createdAt)),
    postCount: 0,
    smartTalkCount: 0,
  };
}

function normalizeSmartTalk(
  id: string,
  data: Record<string, unknown>,
): SeoSmartTalk | null {
  if (!id || !isPublicRecord(data)) return null;

  const content = normalizeString(data.content);
  if (!content) return null;

  const createdAt =
    normalizeTimestamp(data.createdAt) ||
    normalizeTimestamp(data.updatedAt) ||
    0;
  const updatedAt = normalizeTimestamp(data.updatedAt);
  const answers = Array.isArray(data.answers) ? data.answers : [];

  return {
    id,
    title: createExcerpt(content, 90),
    description: createExcerpt(content),
    authorId: normalizeString(data.authorId),
    authorName: normalizeString(data.author) || "Readative contributor",
    category: normalizeSeoSlug(normalizeString(data.category)),
    answers: answers
      .map((answer) =>
        answer &&
        typeof answer === "object" &&
        isPublicRecord(answer as Record<string, unknown>)
          ? {
              authorName:
                normalizeString((answer as Record<string, unknown>).author) ||
                "Readative contributor",
              text: createExcerpt(
                normalizeString((answer as Record<string, unknown>).content),
                220,
              ),
            }
          : null,
      )
      .filter(
        (answer): answer is { authorName: string; text: string } =>
          Boolean(answer?.text),
      )
      .slice(0, 5),
    answerCount: answers.filter(
      (answer) =>
        answer &&
        typeof answer === "object" &&
        isPublicRecord(answer as Record<string, unknown>) &&
        Boolean(normalizeString((answer as Record<string, unknown>).content)),
    ).length,
    createdAt,
    updatedAt,
  };
}

function contentLastmod(content: { createdAt: number; updatedAt: number | null }) {
  return content.updatedAt || content.createdAt;
}

function enrichProfiles(
  profiles: SeoProfile[],
  posts: SeoPost[],
  smartTalks: SeoSmartTalk[],
) {
  const profileStats = new Map<
    string,
    { postCount: number; smartTalkCount: number; lastmod: number | null }
  >();

  const getStats = (profileId: string) => {
    const current = profileStats.get(profileId) || {
      postCount: 0,
      smartTalkCount: 0,
      lastmod: null,
    };
    profileStats.set(profileId, current);
    return current;
  };

  for (const post of posts) {
    if (!post.authorId) continue;
    const stats = getStats(post.authorId);
    stats.postCount += 1;
    stats.lastmod = Math.max(stats.lastmod || 0, contentLastmod(post));
  }

  for (const question of smartTalks) {
    if (!question.authorId) continue;
    const stats = getStats(question.authorId);
    stats.smartTalkCount += 1;
    stats.lastmod = Math.max(stats.lastmod || 0, contentLastmod(question));
  }

  return profiles
    .map((profile) => {
      const stats = profileStats.get(profile.id);
      if (!stats) return profile;

      return {
        ...profile,
        postCount: stats.postCount,
        smartTalkCount: stats.smartTalkCount,
        updatedAt: Math.max(profile.updatedAt || 0, stats.lastmod || 0) || profile.updatedAt,
      };
    })
    .filter((profile) => profile.postCount + profile.smartTalkCount > 0);
}

function buildTags(posts: SeoPost[]) {
  const tagMap = new Map<string, SeoTag>();

  for (const tag of SEO_TAGS) {
    tagMap.set(tag.id, {
      id: tag.id,
      label: tag.label,
      lastmod: null,
      postCount: 0,
    });
  }

  for (const post of posts) {
    const postLastmod = post.updatedAt || post.createdAt;

    for (const tagId of post.hashtags) {
      const current = tagMap.get(tagId);
      tagMap.set(tagId, {
        id: tagId,
        label: current?.label || tagId.replace(/-/g, " "),
        lastmod: Math.max(current?.lastmod || 0, postLastmod),
        postCount: (current?.postCount || 0) + 1,
      });
    }
  }

  return [...tagMap.values()].sort(
    (left, right) => right.postCount - left.postCount || left.id.localeCompare(right.id),
  );
}

async function loadFromAdmin(): Promise<SeoData | null> {
  const database = getAdminDatabase();
  if (!database) return null;

  const [knowledgeSnapshot, profileSnapshot, smartTalkSnapshot] = await Promise.all([
    database.collection("knowledge").get(),
    database.collection("userProfiles").get(),
    database.collection("smarttalk").get(),
  ]);
  const posts = knowledgeSnapshot.docs
    .map((document) => normalizePost(document.id, document.data()))
    .filter((post): post is SeoPost => Boolean(post))
    .sort((left, right) => right.createdAt - left.createdAt || left.id.localeCompare(right.id));
  const rawProfiles = profileSnapshot.docs
    .map((document) => normalizeProfile(document.id, document.data()))
    .filter((profile): profile is SeoProfile => Boolean(profile))
    .sort((left, right) => left.name.localeCompare(right.name));
  const smartTalks = smartTalkSnapshot.docs
    .map((document) => normalizeSmartTalk(document.id, document.data()))
    .filter((question): question is SeoSmartTalk => Boolean(question))
    .sort((left, right) => right.createdAt - left.createdAt || left.id.localeCompare(right.id));
  const profiles = enrichProfiles(rawProfiles, posts, smartTalks);

  return {
    source: "admin",
    generatedAt: Date.now(),
    posts,
    profiles,
    tags: buildTags(posts),
    smartTalks,
    errors: [],
  };
}

async function loadFromRest(): Promise<SeoData> {
  const [knowledgeDocuments, profileDocuments, smartTalkDocuments] = await Promise.all([
    fetchRestCollection("knowledge"),
    fetchRestCollection("userProfiles").catch(() => []),
    fetchRestCollection("smarttalk").catch(() => []),
  ]);
  const posts = knowledgeDocuments
    .map((document) => normalizePost(document.id, document.data))
    .filter((post): post is SeoPost => Boolean(post))
    .sort((left, right) => right.createdAt - left.createdAt || left.id.localeCompare(right.id));
  const rawProfiles = profileDocuments
    .map((document) => normalizeProfile(document.id, document.data))
    .filter((profile): profile is SeoProfile => Boolean(profile))
    .sort((left, right) => left.name.localeCompare(right.name));
  const smartTalks = smartTalkDocuments
    .map((document) => normalizeSmartTalk(document.id, document.data))
    .filter((question): question is SeoSmartTalk => Boolean(question))
    .sort((left, right) => right.createdAt - left.createdAt || left.id.localeCompare(right.id));
  const profiles = enrichProfiles(rawProfiles, posts, smartTalks);

  return {
    source: "rest",
    generatedAt: Date.now(),
    posts,
    profiles,
    tags: buildTags(posts),
    smartTalks,
    errors: [],
  };
}

export async function loadSeoData(): Promise<SeoData> {
  const errors: string[] = [];

  try {
    const adminData = await loadFromAdmin();
    if (adminData) return adminData;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  try {
    const restData = await loadFromRest();
    return {
      ...restData,
      errors,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return {
    source: "static",
    generatedAt: Date.now(),
    posts: [],
    profiles: [],
    tags: buildTags([]),
    smartTalks: [],
    errors,
  };
}

export async function loadSeoPostPage(id: string): Promise<SeoPostPageData | null> {
  const documentId = extractSeoDocumentId(id);
  if (!documentId) return null;
  const data = await loadSeoData();
  if (data.source === "static") return null;

  const post = data.posts.find((candidate) => candidate.id === documentId);
  if (!post) return null;

  return {
    source: data.source,
    post,
    relatedPosts: getRelatedPosts(post, data.posts, 4),
    relatedSmartTalks: getRelatedQuestions(post, data.smartTalks, 4),
  };
}

function toIsoDate(value: number | null | undefined) {
  return value ? new Date(value).toISOString() : undefined;
}

function getChangeFrequency(updatedAt: number | null | undefined, createdAt: number) {
  const lastChanged = updatedAt || createdAt;
  const ageDays = (Date.now() - lastChanged) / 86_400_000;

  if (ageDays < 7) return "daily";
  if (ageDays < 45) return "weekly";
  return "monthly";
}

function maxPostLastmod(
  posts: SeoPost[],
  predicate: (post: SeoPost) => boolean,
) {
  return posts
    .filter(predicate)
    .reduce<number | null>(
      (lastmod, post) => Math.max(lastmod || 0, post.updatedAt || post.createdAt),
      null,
    );
}

function maxCategoryLastmod(
  data: SeoData,
  categoryId: string,
  categoryTagSlugs: readonly string[],
) {
  const postLastmod = maxPostLastmod(
    data.posts,
    (post) =>
      post.category === categoryId ||
      post.hashtags.some((tag) => categoryTagSlugs.includes(tag)),
  );
  const smartTalkLastmod = data.smartTalks
    .filter((question) => question.category === categoryId)
    .reduce<number | null>(
      (lastmod, question) => Math.max(lastmod || 0, contentLastmod(question)),
      null,
    );

  return Math.max(postLastmod || 0, smartTalkLastmod || 0) || null;
}

function buildEntry(
  path: string,
  type: SitemapEntry["type"],
  lastmod: number | null,
  changefreq: SitemapEntry["changefreq"],
  priority: string,
): SitemapEntry {
  return {
    loc: `${SITE_URL}${path}`,
    path,
    lastmod: toIsoDate(lastmod),
    changefreq,
    priority,
    type,
  };
}

export function buildSitemapEntries(data: SeoData): SitemapEntry[] {
  const entries: SitemapEntry[] = [];

  for (const page of STATIC_PAGES) {
    entries.push(
      buildEntry(page.path, "page", page.lastmod, page.changefreq, page.priority),
    );
  }

  for (const category of SEO_CATEGORIES) {
    const categoryTagSlugs = category.tagSlugs as readonly string[];
    const categoryLastmod = maxCategoryLastmod(data, category.id, categoryTagSlugs);
    if (!categoryLastmod) continue;
    entries.push(
      buildEntry(
        category.path,
        "category",
        categoryLastmod,
        "weekly",
        "0.9",
      ),
    );
  }

  for (const topic of SEO_TOPICS) {
    const topicLastmod = maxPostLastmod(data.posts, (post) =>
      post.hashtags.some((tag) => topic.tagSlugs.includes(tag) || tag === topic.id),
    );
    if (!topicLastmod) continue;
    entries.push(
      buildEntry(
        topic.path,
        "topic",
        topicLastmod,
        "weekly",
        "0.75",
      ),
    );
  }

  for (const post of data.posts) {
    entries.push(
      buildEntry(
        buildPostSeoPath(post.id, post.title),
        "post",
        post.updatedAt || post.createdAt,
        getChangeFrequency(post.updatedAt, post.createdAt),
        "0.8",
      ),
    );
  }

  for (const profile of data.profiles) {
    entries.push(
      buildEntry(
        `/profile/${encodeURIComponent(profile.id)}`,
        "profile",
        profile.updatedAt,
        "weekly",
        "0.7",
      ),
    );
  }

  for (const question of data.smartTalks) {
    entries.push(
      buildEntry(
        buildSmartTalkSeoPath(question.id, question.title),
        "smarttalk",
        question.updatedAt || question.createdAt,
        getChangeFrequency(question.updatedAt, question.createdAt),
        "0.65",
      ),
    );
  }

  const uniqueEntries = new Map(entries.map((entry) => [entry.loc, entry] as const));
  return [...uniqueEntries.values()];
}

export function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildSitemapXml(entries: SitemapEntry[]) {
  const urls = entries
    .map(
      (entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    ${entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ""}
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}
