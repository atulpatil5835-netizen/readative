export const CURRENT_SCHEMA_VERSION = 1;
export const CURRENT_PROJECTION_VERSION = 1;
export const SEO_V2_SCHEMA_VERSION = CURRENT_SCHEMA_VERSION;
export const SEO_V2_PROJECTION_VERSION = CURRENT_PROJECTION_VERSION;
export const SEO_DOCUMENTS_COLLECTION = "seo_documents";
export const SEO_META_COLLECTION = "seo_meta";
export const SEO_V2_BUILDER_VERSION = "seo-v2-builder-1";
export const SEO_V2_MAX_DISCOVERY_POSTS = 100;
export const SEO_V2_MAX_DISCOVERY_SMARTTALKS = 100;
export const SEO_V2_MAX_SITEMAP_DOCS = 10_000;
export const SEO_V2_MAX_RELATED = 4;
export const SEO_V2_MAX_ANSWER_PREVIEW = 5;
export const SEO_V2_MAX_ANSWER_PREVIEW_CHARS = 220;
export const SEO_V2_MAX_DESCRIPTION_CHARS = 160;
export const SEO_V2_MAX_SMARTTALK_TITLE_CHARS = 90;
export const SEO_V2_MAX_DOCUMENT_BYTES = 900_000;
export const SEO_V2_BATCH_SIZE_ENV = "SEO_V2_BATCH_SIZE";
export const SEO_V2_PAGE_SIZE_ENV = "SEO_V2_PAGE_SIZE";
export const SEO_V2_DEFAULT_BATCH_SIZE = 100;
export const SEO_V2_MAX_BATCH_SIZE = 450;
export const SEO_V2_DEFAULT_PAGE_SIZE = 100;
export const SEO_V2_MAX_PAGE_SIZE = 500;
export const SEO_V2_BACKFILL_CHECKPOINT_ID = "seo_v2_backfill_checkpoint";
export const SEO_V2_BACKFILL_REPORT_ID_PREFIX = "seo_v2_backfill_report";

export type SeoArchitectureMode = "v1" | "v2";
export type SeoV2DocumentType = "post" | "profile" | "smarttalk";

export interface SeoV2BaseDocument {
  type: SeoV2DocumentType;
  sourceId: string;
  public: boolean;
  canonicalPath: string;
  title: string;
  description: string;
  createdAt: number;
  updatedAt: number | null;
  lastmod: number | null;
  schemaVersion: number;
  projectionVersion: number;
  sourceUpdatedAt: number | null;
  projectedAt: number;
  contentHash: string;
}

export interface SeoV2PostDocument extends SeoV2BaseDocument {
  type: "post";
  content: string;
  excerpt: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  category: string | null;
  tags: string[];
}

export interface SeoV2ProfileDocument extends SeoV2BaseDocument {
  type: "profile";
  username: string;
  usernameLower: string;
  name: string;
  bio: string;
  postCount: number;
  smartTalkCount: number;
}

export interface SeoV2SmartTalkAnswerPreview {
  authorName: string;
  text: string;
}

export interface SeoV2SmartTalkDocument extends SeoV2BaseDocument {
  type: "smarttalk";
  question: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  category: string | null;
  answerCount: number;
  answersPreview: SeoV2SmartTalkAnswerPreview[];
}

export type SeoV2Document =
  | SeoV2PostDocument
  | SeoV2ProfileDocument
  | SeoV2SmartTalkDocument;

export interface SeoV2MetaSummary {
  schemaVersion: number;
  projectionVersion: number;
  generatedAt: number;
  verifiedAt: number | null;
  postCount: number;
  profileCount: number;
  smartTalkCount: number;
  sitemapUrlCount: number;
  status: "empty" | "backfilling" | "ready" | "degraded";
}

export function buildSeoV2DocumentId(
  type: SeoV2DocumentType,
  sourceId: string,
) {
  return `${type}:${sourceId}`;
}
