import {
  CURRENT_PROJECTION_VERSION,
  CURRENT_SCHEMA_VERSION,
  SEO_V2_MAX_ANSWER_PREVIEW,
  SEO_V2_MAX_ANSWER_PREVIEW_CHARS,
  SEO_V2_MAX_DESCRIPTION_CHARS,
  SEO_V2_MAX_DOCUMENT_BYTES,
  SEO_V2_MAX_SMARTTALK_TITLE_CHARS,
  buildSeoV2DocumentId,
  type SeoV2Document,
  type SeoV2DocumentType,
  type SeoV2PostDocument,
  type SeoV2ProfileDocument,
  type SeoV2SmartTalkAnswerPreview,
  type SeoV2SmartTalkDocument,
} from "./seoV2Types";
import { buildPostSeoPath, buildSmartTalkSeoPath } from "./seoUrls";
import { getProfilePathForIdentity, normalizeUsernameInput } from "./usernames";

export type ProjectionValidationSeverity = "error" | "warning";

export interface ProjectionValidationIssue {
  severity: ProjectionValidationSeverity;
  code: string;
  path: string;
  message: string;
}

export interface ProjectionBuildContext {
  projectedAt: number;
}

export interface SeoProjectionPostInput {
  id: string;
  title: string;
  description: string;
  content: string;
  authorId: string;
  authorName: string;
  authorUsername?: string;
  category: string | null;
  hashtags: string[];
  createdAt: number;
  updatedAt: number | null;
  public?: boolean;
}

export interface SeoProjectionProfileInput {
  id: string;
  name: string;
  username: string;
  description: string;
  updatedAt: number | null;
  postCount: number;
  smartTalkCount: number;
  createdAt?: number | null;
  public?: boolean;
}

export interface SeoProjectionSmartTalkInput {
  id: string;
  title: string;
  description: string;
  authorId: string;
  authorName: string;
  authorUsername?: string;
  category: string | null;
  answerCount: number;
  answers: SeoV2SmartTalkAnswerPreview[];
  createdAt: number;
  updatedAt: number | null;
  public?: boolean;
}

export type SeoProjectionSourceInput =
  | { type: "post"; value: SeoProjectionPostInput }
  | { type: "profile"; value: SeoProjectionProfileInput }
  | { type: "smarttalk"; value: SeoProjectionSmartTalkInput };

export interface SeoProjectionBuildResult {
  documentId: string;
  document: SeoV2Document;
  validation: ProjectionValidationIssue[];
}

function normalizeString(value: string | null | undefined) {
  return (value || "").trim();
}

function normalizeNullableString(value: string | null | undefined) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function normalizeStringArray(values: readonly string[] | null | undefined) {
  return [...new Set((values || []).map(normalizeString).filter(Boolean))];
}

function normalizeTimestamp(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function lastModified(createdAt: number, updatedAt: number | null) {
  return updatedAt || createdAt || null;
}

export function createProjectionExcerpt(
  value: string,
  maxLength = SEO_V2_MAX_DESCRIPTION_CHARS,
) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function createDeterministicHash(value: unknown) {
  const input = stableStringify(value);
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function documentSizeBytes(document: SeoV2Document) {
  return new TextEncoder().encode(JSON.stringify(document)).length;
}

function buildBaseFields<TType extends SeoV2DocumentType>(
  type: TType,
  sourceId: string,
  canonicalPath: string,
  title: string,
  description: string,
  createdAt: number,
  updatedAt: number | null,
  publicState: boolean,
  contentHashInput: unknown,
  context: ProjectionBuildContext,
) {
  return {
    type,
    sourceId,
    public: publicState,
    canonicalPath,
    title,
    description,
    createdAt,
    updatedAt,
    lastmod: lastModified(createdAt, updatedAt),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projectionVersion: CURRENT_PROJECTION_VERSION,
    sourceUpdatedAt: updatedAt || createdAt || null,
    projectedAt: context.projectedAt,
    contentHash: createDeterministicHash(contentHashInput),
  };
}

export function buildPostSeoProjection(
  post: SeoProjectionPostInput,
  context: ProjectionBuildContext,
): SeoProjectionBuildResult {
  const sourceId = normalizeString(post.id);
  const title = normalizeString(post.title);
  const content = normalizeString(post.content);
  const description =
    normalizeString(post.description) || createProjectionExcerpt(content);
  const updatedAt = normalizeTimestamp(post.updatedAt);
  const createdAt = normalizeTimestamp(post.createdAt) || 0;
  const document: SeoV2PostDocument = {
    ...buildBaseFields(
      "post",
      sourceId,
      buildPostSeoPath(sourceId, title),
      title,
      description,
      createdAt,
      updatedAt,
      post.public ?? true,
      post,
      context,
    ),
    content,
    excerpt: createProjectionExcerpt(description || content),
    authorId: normalizeString(post.authorId),
    authorName: normalizeString(post.authorName) || "Readative contributor",
    authorUsername: normalizeString(post.authorUsername),
    category: normalizeNullableString(post.category),
    tags: normalizeStringArray(post.hashtags),
  };
  const documentId = buildSeoV2DocumentId("post", sourceId);

  return {
    documentId,
    document,
    validation: validateSeoV2Projection(document, { documentId }),
  };
}

export function buildProfileSeoProjection(
  profile: SeoProjectionProfileInput,
  context: ProjectionBuildContext,
): SeoProjectionBuildResult {
  const sourceId = normalizeString(profile.id);
  const name = normalizeString(profile.name);
  const username =
    normalizeUsernameInput(profile.username) ||
    normalizeUsernameInput(name) ||
    sourceId;
  const description = normalizeString(profile.description);
  const updatedAt = normalizeTimestamp(profile.updatedAt);
  const createdAt =
    normalizeTimestamp(profile.createdAt) || updatedAt || context.projectedAt;
  const document: SeoV2ProfileDocument = {
    ...buildBaseFields(
      "profile",
      sourceId,
      getProfilePathForIdentity({
        id: sourceId,
        username,
        usernameLower: username,
      }),
      name,
      description,
      createdAt,
      updatedAt,
      profile.public ?? true,
      profile,
      context,
    ),
    username,
    usernameLower: username.toLowerCase(),
    name,
    bio: description,
    postCount: Math.max(0, Math.trunc(profile.postCount || 0)),
    smartTalkCount: Math.max(0, Math.trunc(profile.smartTalkCount || 0)),
  };
  const documentId = buildSeoV2DocumentId("profile", sourceId);

  return {
    documentId,
    document,
    validation: validateSeoV2Projection(document, { documentId }),
  };
}

export function buildSmartTalkSeoProjection(
  question: SeoProjectionSmartTalkInput,
  context: ProjectionBuildContext,
): SeoProjectionBuildResult {
  const sourceId = normalizeString(question.id);
  const title =
    normalizeString(question.title) ||
    createProjectionExcerpt(question.description, SEO_V2_MAX_SMARTTALK_TITLE_CHARS);
  const description = normalizeString(question.description);
  const updatedAt = normalizeTimestamp(question.updatedAt);
  const createdAt = normalizeTimestamp(question.createdAt) || 0;
  const answersPreview = (question.answers || [])
    .slice(0, SEO_V2_MAX_ANSWER_PREVIEW)
    .map((answer) => ({
      authorName: normalizeString(answer.authorName) || "Readative contributor",
      text: createProjectionExcerpt(
        normalizeString(answer.text),
        SEO_V2_MAX_ANSWER_PREVIEW_CHARS,
      ),
    }))
    .filter((answer) => answer.text);
  const document: SeoV2SmartTalkDocument = {
    ...buildBaseFields(
      "smarttalk",
      sourceId,
      buildSmartTalkSeoPath(sourceId, title),
      title,
      description,
      createdAt,
      updatedAt,
      question.public ?? true,
      question,
      context,
    ),
    question: description,
    authorId: normalizeString(question.authorId),
    authorName: normalizeString(question.authorName) || "Readative contributor",
    authorUsername: normalizeString(question.authorUsername),
    category: normalizeNullableString(question.category),
    answerCount: Math.max(0, Math.trunc(question.answerCount || 0)),
    answersPreview,
  };
  const documentId = buildSeoV2DocumentId("smarttalk", sourceId);

  return {
    documentId,
    document,
    validation: validateSeoV2Projection(document, { documentId }),
  };
}

export function buildSeoProjection(
  source: SeoProjectionSourceInput,
  context: ProjectionBuildContext,
) {
  if (source.type === "post") {
    return buildPostSeoProjection(source.value, context);
  }

  if (source.type === "profile") {
    return buildProfileSeoProjection(source.value, context);
  }

  return buildSmartTalkSeoProjection(source.value, context);
}

function pushIssue(
  issues: ProjectionValidationIssue[],
  severity: ProjectionValidationSeverity,
  code: string,
  path: string,
  message: string,
) {
  issues.push({ severity, code, path, message });
}

function isFiniteTimestamp(value: number | null) {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function validateRequiredString(
  issues: ProjectionValidationIssue[],
  document: Record<string, unknown>,
  path: string,
) {
  const value = document[path];
  if (typeof value !== "string" || !value.trim()) {
    pushIssue(issues, "error", "required_string", path, `${path} is required.`);
  }
}

function validateCanonicalPath(
  issues: ProjectionValidationIssue[],
  document: SeoV2Document,
) {
  const expectedPrefix =
    document.type === "post"
      ? "/posts/"
      : document.type === "smarttalk"
        ? "/smarttalk/"
        : "/";

  if (!document.canonicalPath.startsWith(expectedPrefix)) {
    pushIssue(
      issues,
      "error",
      "invalid_canonical_path",
      "canonicalPath",
      `canonicalPath must start with ${expectedPrefix}.`,
    );
  }

  if (/^https?:\/\//i.test(document.canonicalPath)) {
    pushIssue(
      issues,
      "error",
      "absolute_canonical_path",
      "canonicalPath",
      "canonicalPath must be a path, not an absolute URL.",
    );
  }
}

export function validateSeoV2Projection(
  document: SeoV2Document,
  options: { documentId: string },
) {
  const issues: ProjectionValidationIssue[] = [];
  const record = document as unknown as Record<string, unknown>;
  const expectedDocumentId = buildSeoV2DocumentId(
    document.type,
    document.sourceId,
  );

  if (options.documentId !== expectedDocumentId) {
    pushIssue(
      issues,
      "error",
      "invalid_document_id",
      "documentId",
      `document id must be ${expectedDocumentId}.`,
    );
  }

  for (const field of ["sourceId", "canonicalPath", "title", "description", "contentHash"]) {
    validateRequiredString(issues, record, field);
  }

  if (typeof document.public !== "boolean") {
    pushIssue(issues, "error", "invalid_public_state", "public", "public must be boolean.");
  }

  if (document.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    pushIssue(
      issues,
      "error",
      "invalid_schema_version",
      "schemaVersion",
      `schemaVersion must be ${CURRENT_SCHEMA_VERSION}.`,
    );
  }

  if (document.projectionVersion !== CURRENT_PROJECTION_VERSION) {
    pushIssue(
      issues,
      "error",
      "invalid_projection_version",
      "projectionVersion",
      `projectionVersion must be ${CURRENT_PROJECTION_VERSION}.`,
    );
  }

  for (const field of ["createdAt", "updatedAt", "lastmod", "sourceUpdatedAt", "projectedAt"] as const) {
    if (!isFiniteTimestamp(document[field])) {
      pushIssue(
        issues,
        "error",
        "invalid_timestamp",
        field,
        `${field} must be a finite timestamp or null.`,
      );
    }
  }

  validateCanonicalPath(issues, document);

  if (document.type === "post") {
    validateRequiredString(issues, record, "content");
    validateRequiredString(issues, record, "authorName");
    if (!Array.isArray(document.tags)) {
      pushIssue(issues, "error", "invalid_tags", "tags", "tags must be an array.");
    }
  }

  if (document.type === "profile") {
    validateRequiredString(issues, record, "username");
    validateRequiredString(issues, record, "usernameLower");
    validateRequiredString(issues, record, "name");
  }

  if (document.type === "smarttalk") {
    validateRequiredString(issues, record, "question");
    validateRequiredString(issues, record, "authorName");
    if (document.answersPreview.length > SEO_V2_MAX_ANSWER_PREVIEW) {
      pushIssue(
        issues,
        "error",
        "answer_preview_limit",
        "answersPreview",
        `answersPreview must contain at most ${SEO_V2_MAX_ANSWER_PREVIEW} answers.`,
      );
    }
    document.answersPreview.forEach((answer, index) => {
      if (answer.text.length > SEO_V2_MAX_ANSWER_PREVIEW_CHARS) {
        pushIssue(
          issues,
          "error",
          "answer_preview_text_limit",
          `answersPreview.${index}.text`,
          `answer preview text must be at most ${SEO_V2_MAX_ANSWER_PREVIEW_CHARS} characters.`,
        );
      }
    });
  }

  const size = documentSizeBytes(document);
  if (size > SEO_V2_MAX_DOCUMENT_BYTES) {
    pushIssue(
      issues,
      "error",
      "document_size_limit",
      "document",
      `projection document is ${size} bytes, above ${SEO_V2_MAX_DOCUMENT_BYTES}.`,
    );
  }

  return issues;
}

export function verifyProjectionDeterminism(
  first: SeoProjectionBuildResult,
  second: SeoProjectionBuildResult,
) {
  return stableStringify(first) === stableStringify(second);
}
