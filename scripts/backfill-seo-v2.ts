import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import {
  FieldPath,
  getFirestore,
  type Firestore,
} from "firebase-admin/firestore";
import { normalizeContentGraphTags } from "../src/utils/contentGraph.js";
import {
  SEO_DOCUMENTS_COLLECTION,
  SEO_META_COLLECTION,
  SEO_V2_BACKFILL_CHECKPOINT_ID,
  SEO_V2_BATCH_SIZE_ENV,
  SEO_V2_BUILDER_VERSION,
  SEO_V2_DEFAULT_BATCH_SIZE,
  SEO_V2_DEFAULT_PAGE_SIZE,
  SEO_V2_MAX_BATCH_SIZE,
  SEO_V2_MAX_PAGE_SIZE,
  SEO_V2_PAGE_SIZE_ENV,
  SEO_V2_PROJECTION_VERSION,
  SEO_V2_SCHEMA_VERSION,
  buildSeoV2DocumentId,
  type SeoV2Document,
} from "../src/utils/seoV2Types.js";
import {
  buildSeoProjection,
  createProjectionExcerpt,
  verifyProjectionDeterminism,
  type ProjectionBuildContext,
  type ProjectionValidationIssue,
  type SeoProjectionSourceInput,
} from "../src/utils/seoProjection.js";
import { normalizeSeoSlug } from "../src/utils/seoTaxonomy.js";
import { normalizeUsernameInput } from "../src/utils/usernames.js";

type SourceCollection = "knowledge" | "userProfiles" | "smarttalk";
type BackfillCollectionOption = SourceCollection | "all";
type BackfillSourceMode = "fixture" | "firestore";
type BackfillRunMode = "dry-run" | "write";

const SOURCE_COLLECTIONS = ["knowledge", "smarttalk", "userProfiles"] as const;
const DEFAULT_REPORT_PATH = path.join(process.cwd(), "seo_v2_backfill_report.json");
const DEFAULT_VALIDATION_REPORT_PATH = path.join(
  process.cwd(),
  "seo_v2_backfill_validation_report.json",
);
const DEFAULT_RESUME_REPORT_PATH = path.join(
  process.cwd(),
  "seo_v2_backfill_resume_test_report.json",
);
const DEFAULT_IDEMPOTENCY_REPORT_PATH = path.join(
  process.cwd(),
  "seo_v2_backfill_idempotency_test_report.json",
);
const DEFAULT_BATCH_RETRY_REPORT_PATH = path.join(
  process.cwd(),
  "seo_v2_backfill_batch_retry_test_report.json",
);
const FIRESTORE_BATCH_LIMIT = 500;
const CHECKPOINT_VERSION = 1;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 250;
const FIXTURE_PROJECTED_AT = Date.UTC(2026, 6, 19, 0, 0, 0);
const PRIVATE_STATUSES = new Set([
  "archived",
  "deleted",
  "draft",
  "hidden",
  "private",
]);

interface SourceDocument {
  collection: SourceCollection;
  id: string;
  data: Record<string, unknown>;
}

interface BackfillCheckpoint {
  version: number;
  buildId: string;
  currentCollection: SourceCollection | "complete";
  lastProcessedDocument: string | null;
  processedCount: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  startedAt: number;
  updatedAt: number;
}

interface BackfillOptions {
  source: BackfillSourceMode;
  mode: BackfillRunMode;
  collection: BackfillCollectionOption;
  sourceId: string | null;
  retryReportPath: string | null;
  resume: boolean;
  resetCheckpoint: boolean;
  reportPath: string;
  checkpointId: string;
  batchSize: number;
  pageSize: number;
  buildId: string;
  maxRetries: number;
  simulateInterruptionAfter: number | null;
}

interface BackfillStore {
  readonly name: string;
  readCheckpoint(checkpointId: string): Promise<BackfillCheckpoint | null>;
  writeCheckpoint(checkpointId: string, checkpoint: BackfillCheckpoint): Promise<void>;
  listSourcePage(
    collection: SourceCollection,
    afterDocumentId: string | null,
    limit: number,
  ): Promise<SourceDocument[]>;
  getSourceDocument(
    collection: SourceCollection,
    sourceId: string,
  ): Promise<SourceDocument | null>;
  getExistingSeoDocuments(documentIds: string[]): Promise<Map<string, SeoV2Document>>;
  writeSeoDocumentsBatch(items: ProjectionCandidate[]): Promise<void>;
  getMetrics(): StoreMetrics;
}

interface StoreMetrics {
  sourceReads: number;
  existingProjectionReads: number;
  checkpointReads: number;
  seoDocumentWrites: number;
  checkpointWrites: number;
  networkRequests: number;
}

interface ProjectionCandidate {
  collection: SourceCollection;
  sourceId: string;
  documentId: string;
  document: SeoV2Document;
  sizeBytes: number;
}

interface ProfileStats {
  postCount: number;
  smartTalkCount: number;
  lastmod: number | null;
}

interface WriteFailure {
  collection: SourceCollection;
  sourceId: string;
  documentId: string;
  message: string;
  retryable: boolean;
}

interface WriteOutcome {
  written: number;
  unchanged: number;
  skippedWrites: number;
  failed: number;
  failures: WriteFailure[];
  batchCount: number;
  batchDurationsMs: number[];
  batchAttempts: number;
}

interface ProgressState {
  processed: number;
  written: number;
  skipped: number;
  unchanged: number;
  failed: number;
  currentCollection: SourceCollection | "complete";
}

interface BackfillWarning {
  collection?: SourceCollection;
  sourceId?: string;
  code: string;
  message: string;
}

interface SkippedDocument {
  collection: SourceCollection;
  sourceId: string;
  reason: string;
}

interface ValidationFailure {
  collection: SourceCollection;
  sourceId: string;
  documentId: string;
  issues: ProjectionValidationIssue[];
}

interface BackfillReport {
  schemaVersion: number;
  projectionVersion: number;
  builderVersion: string;
  generatedAt: string;
  buildId: string;
  source: BackfillSourceMode;
  mode: BackfillRunMode;
  adminOnlyWritePath: boolean;
  featureFlagExpected: "v1";
  options: {
    collection: BackfillCollectionOption;
    sourceId: string | null;
    retryReportPath: string | null;
    resume: boolean;
    resetCheckpoint: boolean;
    batchSize: number;
    pageSize: number;
    checkpointId: string;
  };
  backfillReport: {
    processed: number;
    written: number;
    skipped: number;
    unchanged: number;
    failed: number;
    elapsedMs: number;
    estimatedRemainingMs: number | null;
    averageThroughputPerSecond: number;
    currentCollection: SourceCollection | "complete";
  };
  validationReport: {
    successfulProjections: number;
    failedProjections: number;
    validationFailures: number;
    warnings: number;
    duplicateIds: number;
  };
  checkpointReport: BackfillCheckpoint;
  parityReport: {
    sourceCount: number;
    projectionCount: number;
    missingProjections: Array<{ collection: SourceCollection; sourceId: string }>;
    duplicateIds: string[];
    validationFailures: ValidationFailure[];
    warnings: BackfillWarning[];
    errors: WriteFailure[];
  };
  metrics: {
    totalReads: number;
    sourceReads: number;
    existingProjectionReads: number;
    checkpointReads: number;
    totalWrites: number;
    seoDocumentWrites: number;
    checkpointWrites: number;
    networkRequests: number;
    skippedWrites: number;
    unchangedProjections: number;
    failedWrites: number;
    batchCount: number;
    batchAttempts: number;
    averageBatchDurationMs: number;
    averageDocumentSizeBytes: number;
    largestDocument:
      | {
          documentId: string;
          sizeBytes: number;
        }
      | null;
    buildDurationMs: number;
  };
  skippedDocuments: SkippedDocument[];
  failures: WriteFailure[];
  warnings: BackfillWarning[];
}

class BackfillInterruption extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackfillInterruption";
  }
}

function readEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function hasArg(name: string) {
  return process.argv.includes(name);
}

function getArgValue(name: string) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
}

function parseInteger(value: string, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(parsed);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function parseSource(value: string): BackfillSourceMode {
  if (value === "firestore") return "firestore";
  return "fixture";
}

function parseMode(): BackfillRunMode {
  return hasArg("--write") ? "write" : "dry-run";
}

function parseCollection(value: string): BackfillCollectionOption {
  if (SOURCE_COLLECTIONS.includes(value as SourceCollection)) {
    return value as SourceCollection;
  }

  return "all";
}

function createBuildId() {
  return `seo-v2-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

function readOptions(): BackfillOptions {
  const batchSize = clamp(
    parseInteger(
      getArgValue("--batch-size") || readEnv(SEO_V2_BATCH_SIZE_ENV),
      SEO_V2_DEFAULT_BATCH_SIZE,
    ),
    1,
    Math.min(SEO_V2_MAX_BATCH_SIZE, FIRESTORE_BATCH_LIMIT),
  );
  const pageSize = clamp(
    parseInteger(
      getArgValue("--page-size") || readEnv(SEO_V2_PAGE_SIZE_ENV),
      SEO_V2_DEFAULT_PAGE_SIZE,
    ),
    1,
    SEO_V2_MAX_PAGE_SIZE,
  );

  return {
    source: parseSource(getArgValue("--source") || "fixture"),
    mode: parseMode(),
    collection: parseCollection(getArgValue("--collection") || "all"),
    sourceId: getArgValue("--source-id") || null,
    retryReportPath: getArgValue("--retry-report") || null,
    resume: hasArg("--resume"),
    resetCheckpoint: hasArg("--reset-checkpoint"),
    reportPath: getArgValue("--report") || DEFAULT_REPORT_PATH,
    checkpointId:
      getArgValue("--checkpoint-id") || SEO_V2_BACKFILL_CHECKPOINT_ID,
    batchSize,
    pageSize,
    buildId: getArgValue("--build-id") || createBuildId(),
    maxRetries: clamp(
      parseInteger(getArgValue("--max-retries"), MAX_RETRY_ATTEMPTS),
      0,
      8,
    ),
    simulateInterruptionAfter: getArgValue("--simulate-interruption-after")
      ? Math.max(1, parseInteger(getArgValue("--simulate-interruption-after"), 1))
      : null,
  };
}

function isCollectionOption(value: string): value is SourceCollection {
  return SOURCE_COLLECTIONS.includes(value as SourceCollection);
}

function selectedCollections(option: BackfillCollectionOption) {
  return option === "all" ? [...SOURCE_COLLECTIONS] : [option];
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
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();

  if (
    value &&
    typeof value === "object" &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    const millis = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(millis) ? millis : fallback;
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

function normalizeCount(value: unknown) {
  return Math.max(0, parseInteger(String(value ?? ""), 0));
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

function isPublishedPost(data: Record<string, unknown>) {
  return (
    isPublicRecord(data) &&
    Boolean(normalizeString(data.title)) &&
    Boolean(normalizeString(data.content))
  );
}

function mapSourceToProjectionInput(
  source: SourceDocument,
  profileStats: Map<string, ProfileStats>,
  profileStatsComplete: boolean,
): { input: SeoProjectionSourceInput | null; skippedReason: string | null } {
  const { collection, id, data } = source;

  if (collection === "knowledge") {
    if (!isPublishedPost(data)) {
      return { input: null, skippedReason: "post is not public or is incomplete" };
    }

    const content = normalizeString(data.content);
    const createdAt =
      normalizeTimestamp(data.createdAt) ||
      normalizeTimestamp(data.updatedAt) ||
      0;

    return {
      skippedReason: null,
      input: {
        type: "post",
        value: {
          id,
          title: normalizeString(data.title),
          description: createProjectionExcerpt(
            normalizeString(data.excerpt) || content,
          ),
          content,
          authorId: normalizeString(data.authorId),
          authorName:
            normalizeString(data.author) ||
            normalizeString(data.username) ||
            "Readative contributor",
          authorUsername:
            normalizeString(data.authorUsername) || normalizeString(data.username),
          category: normalizeSeoSlug(normalizeString(data.category)),
          hashtags: normalizeContentGraphTags(normalizeStringArray(data.hashtags)),
          createdAt,
          updatedAt: normalizeTimestamp(data.updatedAt),
          public: true,
        },
      },
    };
  }

  if (collection === "userProfiles") {
    if (!isPublicRecord(data)) {
      return { input: null, skippedReason: "profile is not public" };
    }

    const name =
      normalizeString(data.displayName) ||
      normalizeString(data.name) ||
      normalizeString(data.username);

    if (!name) {
      return { input: null, skippedReason: "profile is missing a display name" };
    }

    const stats = profileStats.get(id);
    if (profileStatsComplete && !stats) {
      return {
        input: null,
        skippedReason: "profile has no public SEO content",
      };
    }

    const sourceUpdatedAt = normalizeTimestamp(
      data.updatedAt,
      normalizeTimestamp(data.createdAt),
    );
    const derivedUpdatedAt =
      Math.max(sourceUpdatedAt || 0, stats?.lastmod || 0) || sourceUpdatedAt;

    return {
      skippedReason: null,
      input: {
        type: "profile",
        value: {
          id,
          name,
          username:
            normalizeUsernameInput(normalizeString(data.username)) ||
            normalizeUsernameInput(name) ||
            id,
          description:
            normalizeString(data.bio) ||
            normalizeString(data.description) ||
            "A Readative contributor publishing and curating practical knowledge.",
          createdAt: normalizeTimestamp(data.createdAt),
          updatedAt: derivedUpdatedAt,
          postCount:
            stats?.postCount ??
            normalizeCount(
              data.postCount ??
                data.knowledgeCount ??
                data.publicPostCount ??
                data.publishedPostCount,
            ),
          smartTalkCount:
            stats?.smartTalkCount ??
            normalizeCount(
              data.smartTalkCount ??
                data.smarttalkCount ??
                data.questionCount ??
                data.publicSmartTalkCount,
            ),
          public: true,
        },
      },
    };
  }

  if (!isPublicRecord(data)) {
    return { input: null, skippedReason: "SmartTalk question is not public" };
  }

  const content = normalizeString(data.content);
  if (!content) {
    return { input: null, skippedReason: "SmartTalk question is missing content" };
  }

  const answers = Array.isArray(data.answers) ? data.answers : [];
  const publicAnswers = answers
    .map((answer) =>
      answer && typeof answer === "object" ? (answer as Record<string, unknown>) : null,
    )
    .filter((answer): answer is Record<string, unknown> =>
      Boolean(answer && isPublicRecord(answer)),
    );
  const createdAt =
    normalizeTimestamp(data.createdAt) ||
    normalizeTimestamp(data.updatedAt) ||
    0;

  return {
    skippedReason: null,
    input: {
      type: "smarttalk",
      value: {
        id,
        title: createProjectionExcerpt(content, 90),
        description: createProjectionExcerpt(content),
        authorId: normalizeString(data.authorId),
        authorName: normalizeString(data.author) || "Readative contributor",
        authorUsername:
          normalizeString(data.authorUsername) || normalizeString(data.username),
        category: normalizeSeoSlug(normalizeString(data.category)),
        answerCount: publicAnswers.filter((answer) =>
          Boolean(normalizeString(answer.content)),
        ).length,
        answers: publicAnswers
          .map((answer) => ({
            authorName:
              normalizeString(answer.author) || "Readative contributor",
            text: normalizeString(answer.content),
          }))
          .filter((answer) => answer.text),
        createdAt,
        updatedAt: normalizeTimestamp(data.updatedAt),
        public: true,
      },
    },
  };
}

function documentSizeBytes(document: SeoV2Document) {
  return new TextEncoder().encode(JSON.stringify(document)).length;
}

function createCheckpoint(
  options: BackfillOptions,
  currentCollection: SourceCollection | "complete",
): BackfillCheckpoint {
  const now = Date.now();
  return {
    version: CHECKPOINT_VERSION,
    buildId: options.buildId,
    currentCollection,
    lastProcessedDocument: null,
    processedCount: 0,
    successCount: 0,
    skippedCount: 0,
    failedCount: 0,
    startedAt: now,
    updatedAt: now,
  };
}

function isCheckpoint(value: unknown): value is BackfillCheckpoint {
  if (!value || typeof value !== "object") return false;
  const candidate = value as BackfillCheckpoint;
  return (
    candidate.version === CHECKPOINT_VERSION &&
    typeof candidate.buildId === "string" &&
    (candidate.currentCollection === "complete" ||
      isCollectionOption(candidate.currentCollection)) &&
    typeof candidate.processedCount === "number" &&
    typeof candidate.successCount === "number" &&
    typeof candidate.skippedCount === "number" &&
    typeof candidate.failedCount === "number"
  );
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function fixtureSources(): SourceDocument[] {
  return [
    {
      collection: "knowledge",
      id: "post_alpha",
      data: {
        title: "A Practical Guide to Focused Reading",
        excerpt:
          "A compact guide for improving reading sessions with notes, reflection, and deliberate review.",
        content:
          "Focused reading starts with one clear question. Readative helps a reader turn that question into a reusable knowledge note.",
        authorId: "user_atul",
        author: "Atul",
        username: "atul_hinge",
        category: "learning",
        hashtags: ["reading", "learning", "notes"],
        visibility: "public",
        createdAt: Date.UTC(2026, 6, 1),
        updatedAt: Date.UTC(2026, 6, 5),
      },
    },
    {
      collection: "userProfiles",
      id: "user_atul",
      data: {
        displayName: "Atul",
        username: "atul_hinge",
        bio: "A Readative contributor publishing and curating practical knowledge.",
        visibility: "public",
        postCount: 1,
        smartTalkCount: 1,
        createdAt: Date.UTC(2026, 5, 20),
        updatedAt: Date.UTC(2026, 6, 6),
      },
    },
    {
      collection: "smarttalk",
      id: "smarttalk_alpha",
      data: {
        content:
          "How can I use AI for writing and study without becoming dependent on it?",
        authorId: "user_atul",
        author: "Atul",
        username: "atul_hinge",
        category: "ai",
        visibility: "public",
        answers: [
          {
            author: "Reader One",
            content: "Use AI as a thinking partner after writing your own first draft.",
            visibility: "public",
          },
          {
            author: "Reader Two",
            content:
              "Ask it to challenge your assumptions instead of replacing your judgment.",
            visibility: "public",
          },
        ],
        createdAt: Date.UTC(2026, 6, 2),
        updatedAt: Date.UTC(2026, 6, 7),
      },
    },
    {
      collection: "knowledge",
      id: "private_post",
      data: {
        title: "Private note",
        content: "This should never be projected.",
        visibility: "private",
        createdAt: Date.UTC(2026, 6, 1),
      },
    },
  ];
}

function retryReportSourceIds(reportPath: string) {
  const payload = JSON.parse(fs.readFileSync(reportPath, "utf8")) as Partial<BackfillReport>;
  const failures = [
    ...(payload.failures || []),
    ...((payload.parityReport?.errors || []) as WriteFailure[]),
  ];
  const sourceIds = new Map<SourceCollection, Set<string>>();

  for (const failure of failures) {
    if (!failure.collection || !failure.sourceId) continue;
    if (!sourceIds.has(failure.collection)) {
      sourceIds.set(failure.collection, new Set());
    }
    sourceIds.get(failure.collection)?.add(failure.sourceId);
  }

  return sourceIds;
}

function getProjectId() {
  return (
    readEnv("FIREBASE_PROJECT_ID") ||
    readEnv("VITE_FIREBASE_PROJECT_ID") ||
    "readative-803b0"
  );
}

function initializeAdminFirestore() {
  const projectId = getProjectId();
  const clientEmail = readEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = readEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

  if (!getApps().length) {
    initializeApp(
      clientEmail && privateKey
        ? {
            credential: cert({
              projectId,
              clientEmail,
              privateKey,
            }),
          }
        : {
            credential: applicationDefault(),
            projectId,
          },
    );
  }

  return getFirestore();
}

class FirestoreBackfillStore implements BackfillStore {
  readonly name = "firestore-admin";

  private readonly metrics: StoreMetrics = {
    sourceReads: 0,
    existingProjectionReads: 0,
    checkpointReads: 0,
    seoDocumentWrites: 0,
    checkpointWrites: 0,
    networkRequests: 0,
  };

  constructor(private readonly database: Firestore) {}

  async readCheckpoint(checkpointId: string) {
    this.metrics.checkpointReads += 1;
    this.metrics.networkRequests += 1;
    const snapshot = await this.database
      .collection(SEO_META_COLLECTION)
      .doc(checkpointId)
      .get();

    if (!snapshot.exists) return null;
    const data = snapshot.data();
    return isCheckpoint(data) ? data : null;
  }

  async writeCheckpoint(checkpointId: string, checkpoint: BackfillCheckpoint) {
    this.metrics.checkpointWrites += 1;
    this.metrics.networkRequests += 1;
    await this.database.collection(SEO_META_COLLECTION).doc(checkpointId).set(
      {
        ...checkpoint,
        updatedAt: Date.now(),
      },
      { merge: false },
    );
  }

  async listSourcePage(
    collection: SourceCollection,
    afterDocumentId: string | null,
    limit: number,
  ) {
    let query = this.database
      .collection(collection)
      .orderBy(FieldPath.documentId())
      .limit(limit);

    if (afterDocumentId) {
      query = query.startAfter(afterDocumentId);
    }

    this.metrics.networkRequests += 1;
    const snapshot = await query.get();
    this.metrics.sourceReads += snapshot.size;

    return snapshot.docs.map((document) => ({
      collection,
      id: document.id,
      data: document.data(),
    }));
  }

  async getSourceDocument(collection: SourceCollection, sourceId: string) {
    this.metrics.sourceReads += 1;
    this.metrics.networkRequests += 1;
    const snapshot = await this.database.collection(collection).doc(sourceId).get();
    if (!snapshot.exists) return null;
    return {
      collection,
      id: snapshot.id,
      data: snapshot.data() || {},
    };
  }

  async getExistingSeoDocuments(documentIds: string[]) {
    const existing = new Map<string, SeoV2Document>();
    const uniqueIds = [...new Set(documentIds)];

    for (let index = 0; index < uniqueIds.length; index += 100) {
      const ids = uniqueIds.slice(index, index + 100);
      const refs = ids.map((id) =>
        this.database.collection(SEO_DOCUMENTS_COLLECTION).doc(id),
      );
      this.metrics.existingProjectionReads += ids.length;
      this.metrics.networkRequests += 1;
      const snapshots = await this.database.getAll(...refs);

      snapshots.forEach((snapshot) => {
        if (snapshot.exists) {
          existing.set(snapshot.id, snapshot.data() as SeoV2Document);
        }
      });
    }

    return existing;
  }

  async writeSeoDocumentsBatch(items: ProjectionCandidate[]) {
    const batch = this.database.batch();

    items.forEach((item) => {
      batch.set(
        this.database.collection(SEO_DOCUMENTS_COLLECTION).doc(item.documentId),
        item.document,
        { merge: false },
      );
    });

    this.metrics.networkRequests += 1;
    await batch.commit();
    this.metrics.seoDocumentWrites += items.length;
  }

  getMetrics() {
    return { ...this.metrics };
  }
}

class FixtureBackfillStore implements BackfillStore {
  readonly name = "fixture-memory";

  private readonly metrics: StoreMetrics = {
    sourceReads: 0,
    existingProjectionReads: 0,
    checkpointReads: 0,
    seoDocumentWrites: 0,
    checkpointWrites: 0,
    networkRequests: 0,
  };

  private readonly sources: SourceDocument[];

  private readonly checkpoints = new Map<string, BackfillCheckpoint>();

  private readonly seoDocuments = new Map<string, SeoV2Document>();

  failNextWriteAttempts = 0;

  constructor(sources = fixtureSources()) {
    this.sources = sources.map((source) => clone(source));
  }

  async readCheckpoint(checkpointId: string) {
    this.metrics.checkpointReads += 1;
    const checkpoint = this.checkpoints.get(checkpointId);
    return checkpoint ? clone(checkpoint) : null;
  }

  async writeCheckpoint(checkpointId: string, checkpoint: BackfillCheckpoint) {
    this.metrics.checkpointWrites += 1;
    this.checkpoints.set(checkpointId, clone({ ...checkpoint, updatedAt: Date.now() }));
  }

  async listSourcePage(
    collection: SourceCollection,
    afterDocumentId: string | null,
    limit: number,
  ) {
    const page = this.sources
      .filter((source) => source.collection === collection)
      .sort((left, right) => left.id.localeCompare(right.id))
      .filter((source) => !afterDocumentId || source.id > afterDocumentId)
      .slice(0, limit)
      .map((source) => clone(source));
    this.metrics.sourceReads += page.length;
    return page;
  }

  async getSourceDocument(collection: SourceCollection, sourceId: string) {
    this.metrics.sourceReads += 1;
    const source = this.sources.find(
      (item) => item.collection === collection && item.id === sourceId,
    );
    return source ? clone(source) : null;
  }

  async getExistingSeoDocuments(documentIds: string[]) {
    const existing = new Map<string, SeoV2Document>();
    const uniqueIds = [...new Set(documentIds)];
    this.metrics.existingProjectionReads += uniqueIds.length;

    uniqueIds.forEach((id) => {
      const document = this.seoDocuments.get(id);
      if (document) existing.set(id, clone(document));
    });

    return existing;
  }

  async writeSeoDocumentsBatch(items: ProjectionCandidate[]) {
    if (this.failNextWriteAttempts > 0) {
      this.failNextWriteAttempts -= 1;
      const error = new Error("Fixture transient write failure.");
      (error as Error & { code?: string }).code = "unavailable";
      throw error;
    }

    items.forEach((item) => {
      this.seoDocuments.set(item.documentId, clone(item.document));
    });
    this.metrics.seoDocumentWrites += items.length;
  }

  getMetrics() {
    return { ...this.metrics };
  }

  resetMetrics() {
    this.metrics.sourceReads = 0;
    this.metrics.existingProjectionReads = 0;
    this.metrics.checkpointReads = 0;
    this.metrics.seoDocumentWrites = 0;
    this.metrics.checkpointWrites = 0;
    this.metrics.networkRequests = 0;
  }

  getSeoDocumentCount() {
    return this.seoDocuments.size;
  }
}

function isUnchangedProjection(
  existing: SeoV2Document | undefined,
  candidate: ProjectionCandidate,
) {
  return (
    Boolean(existing) &&
    existing?.schemaVersion === candidate.document.schemaVersion &&
    existing?.projectionVersion === candidate.document.projectionVersion &&
    existing?.contentHash === candidate.document.contentHash &&
    existing?.canonicalPath === candidate.document.canonicalPath
  );
}

function isRetryableError(error: unknown) {
  const code = String((error as { code?: unknown })?.code || "").toLowerCase();
  return [
    "aborted",
    "cancelled",
    "deadline-exceeded",
    "internal",
    "resource-exhausted",
    "unavailable",
  ].includes(code);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function commitBatchWithRetry(
  store: BackfillStore,
  items: ProjectionCandidate[],
  maxRetries: number,
) {
  let attempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    attempts += 1;

    try {
      const startedAt = performance.now();
      await store.writeSeoDocumentsBatch(items);
      return {
        attempts,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      };
    } catch (error) {
      const retryable = isRetryableError(error);
      if (!retryable) throw error;
      if (attempt >= maxRetries) throw error;
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }

  return { attempts, durationMs: 0 };
}

async function writeProjectionCandidates(
  store: BackfillStore,
  candidates: ProjectionCandidate[],
  options: BackfillOptions,
): Promise<WriteOutcome> {
  const outcome: WriteOutcome = {
    written: 0,
    unchanged: 0,
    skippedWrites: 0,
    failed: 0,
    failures: [],
    batchCount: 0,
    batchDurationsMs: [],
    batchAttempts: 0,
  };

  if (candidates.length === 0) return outcome;

  if (options.mode === "dry-run") {
    outcome.skippedWrites = candidates.length;
    return outcome;
  }

  const existing = await store.getExistingSeoDocuments(
    candidates.map((candidate) => candidate.documentId),
  );
  const writable = candidates.filter((candidate) => {
    if (isUnchangedProjection(existing.get(candidate.documentId), candidate)) {
      outcome.unchanged += 1;
      outcome.skippedWrites += 1;
      return false;
    }

    return true;
  });

  for (let index = 0; index < writable.length; index += options.batchSize) {
    const batch = writable.slice(index, index + options.batchSize);
    outcome.batchCount += 1;

    try {
      const result = await commitBatchWithRetry(
        store,
        batch,
        options.maxRetries,
      );
      outcome.batchAttempts += result.attempts;
      outcome.batchDurationsMs.push(result.durationMs);
      outcome.written += batch.length;
    } catch (error) {
      const retryable = isRetryableError(error);
      outcome.batchAttempts += retryable ? options.maxRetries + 1 : 1;
      const failures = batch.map((candidate) => ({
        collection: candidate.collection,
        sourceId: candidate.sourceId,
        documentId: candidate.documentId,
        message: errorMessage(error),
        retryable,
      }));
      outcome.failed += failures.length;
      outcome.failures.push(...failures);
      if (!retryable) {
        const remaining = writable
          .slice(index + batch.length)
          .map((candidate) => ({
            collection: candidate.collection,
            sourceId: candidate.sourceId,
            documentId: candidate.documentId,
            message: "Skipped after fatal batch write failure.",
            retryable: false,
          }));
        outcome.failed += remaining.length;
        outcome.failures.push(...remaining);
        break;
      }
    }
  }

  return outcome;
}

function buildProjectionCandidate(
  source: SourceDocument,
  context: ProjectionBuildContext,
  profileStats: Map<string, ProfileStats>,
  profileStatsComplete: boolean,
): {
  candidate: ProjectionCandidate | null;
  validationFailure: ValidationFailure | null;
  warning: BackfillWarning | null;
} {
  const mapped = mapSourceToProjectionInput(
    source,
    profileStats,
    profileStatsComplete,
  );
  if (!mapped.input) {
    return {
      candidate: null,
      validationFailure: null,
      warning: {
        collection: source.collection,
        sourceId: source.id,
        code: "source_skipped",
        message: mapped.skippedReason || "source document skipped",
      },
    };
  }

  const first = buildSeoProjection(mapped.input, context);
  const second = buildSeoProjection(mapped.input, context);
  const deterministic = verifyProjectionDeterminism(first, second);
  const validation = [...first.validation];

  if (!deterministic) {
    validation.push({
      severity: "error",
      code: "non_deterministic_projection",
      path: "document",
      message: "Builder returned different output for the same input.",
    });
  }

  if (
    first.documentId !==
    buildSeoV2DocumentId(first.document.type, first.document.sourceId)
  ) {
    validation.push({
      severity: "error",
      code: "non_deterministic_document_id",
      path: "documentId",
      message: "Projection document ID does not match source type and source ID.",
    });
  }

  const errors = validation.filter((issue) => issue.severity === "error");
  if (errors.length > 0) {
    return {
      candidate: null,
      warning: null,
      validationFailure: {
        collection: source.collection,
        sourceId: source.id,
        documentId: first.documentId,
        issues: validation,
      },
    };
  }

  return {
    validationFailure: null,
    warning: null,
    candidate: {
      collection: source.collection,
      sourceId: source.id,
      documentId: first.documentId,
      document: first.document,
      sizeBytes: documentSizeBytes(first.document),
    },
  };
}

function recordProfileStats(
  profileStats: Map<string, ProfileStats>,
  candidate: ProjectionCandidate,
) {
  if (candidate.document.type === "profile") return;
  const authorId = candidate.document.authorId;
  if (!authorId) return;

  const current = profileStats.get(authorId) || {
    postCount: 0,
    smartTalkCount: 0,
    lastmod: null,
  };

  if (candidate.document.type === "post") {
    current.postCount += 1;
  }

  if (candidate.document.type === "smarttalk") {
    current.smartTalkCount += 1;
  }

  current.lastmod =
    Math.max(current.lastmod || 0, candidate.document.lastmod || 0) ||
    current.lastmod;
  profileStats.set(authorId, current);
}

function appendWriteOutcome(progress: ProgressState, outcome: WriteOutcome) {
  progress.written += outcome.written;
  progress.unchanged += outcome.unchanged;
  progress.failed += outcome.failed;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(
    (values.reduce((total, value) => total + value, 0) / values.length) * 100,
  ) / 100;
}

function createReport(params: {
  options: BackfillOptions;
  checkpoint: BackfillCheckpoint;
  progress: ProgressState;
  startedAtMs: number;
  successfulProjections: number;
  skippedDocuments: SkippedDocument[];
  validationFailures: ValidationFailure[];
  warnings: BackfillWarning[];
  duplicateIds: string[];
  failures: WriteFailure[];
  batchDurationsMs: number[];
  batchAttempts: number;
  documentSizes: Array<{ documentId: string; sizeBytes: number }>;
  storeMetrics: StoreMetrics;
  skippedWrites: number;
}) {
  const elapsedMs = Math.round((performance.now() - params.startedAtMs) * 100) / 100;
  const averageThroughputPerSecond =
    elapsedMs > 0
      ? Math.round((params.progress.processed / (elapsedMs / 1000)) * 100) / 100
      : 0;
  const largestDocument = params.documentSizes.reduce<
    { documentId: string; sizeBytes: number } | null
  >(
    (largest, current) =>
      !largest || current.sizeBytes > largest.sizeBytes ? current : largest,
    null,
  );
  const missingProjections = [
    ...params.validationFailures.map((failure) => ({
      collection: failure.collection,
      sourceId: failure.sourceId,
    })),
    ...params.failures.map((failure) => ({
      collection: failure.collection,
      sourceId: failure.sourceId,
    })),
  ];
  const storeMetrics = params.storeMetrics;

  return {
    schemaVersion: SEO_V2_SCHEMA_VERSION,
    projectionVersion: SEO_V2_PROJECTION_VERSION,
    builderVersion: SEO_V2_BUILDER_VERSION,
    generatedAt: new Date().toISOString(),
    buildId: params.checkpoint.buildId,
    source: params.options.source,
    mode: params.options.mode,
    adminOnlyWritePath: params.options.source === "firestore",
    featureFlagExpected: "v1",
    options: {
      collection: params.options.collection,
      sourceId: params.options.sourceId,
      retryReportPath: params.options.retryReportPath,
      resume: params.options.resume,
      resetCheckpoint: params.options.resetCheckpoint,
      batchSize: params.options.batchSize,
      pageSize: params.options.pageSize,
      checkpointId: params.options.checkpointId,
    },
    backfillReport: {
      processed: params.progress.processed,
      written: params.progress.written,
      skipped: params.progress.skipped,
      unchanged: params.progress.unchanged,
      failed: params.progress.failed,
      elapsedMs,
      estimatedRemainingMs: null,
      averageThroughputPerSecond,
      currentCollection: params.progress.currentCollection,
    },
    validationReport: {
      successfulProjections: params.successfulProjections,
      failedProjections: params.validationFailures.length + params.failures.length,
      validationFailures: params.validationFailures.reduce(
        (total, failure) =>
          total +
          failure.issues.filter((issue) => issue.severity === "error").length,
        0,
      ),
      warnings: params.warnings.length,
      duplicateIds: params.duplicateIds.length,
    },
    checkpointReport: params.checkpoint,
    parityReport: {
      sourceCount: params.progress.processed,
      projectionCount: params.successfulProjections,
      missingProjections,
      duplicateIds: params.duplicateIds,
      validationFailures: params.validationFailures,
      warnings: params.warnings,
      errors: params.failures,
    },
    metrics: {
      totalReads:
        storeMetrics.sourceReads +
        storeMetrics.existingProjectionReads +
        storeMetrics.checkpointReads,
      sourceReads: storeMetrics.sourceReads,
      existingProjectionReads: storeMetrics.existingProjectionReads,
      checkpointReads: storeMetrics.checkpointReads,
      totalWrites: storeMetrics.seoDocumentWrites + storeMetrics.checkpointWrites,
      seoDocumentWrites: storeMetrics.seoDocumentWrites,
      checkpointWrites: storeMetrics.checkpointWrites,
      networkRequests: storeMetrics.networkRequests,
      skippedWrites: params.skippedWrites,
      unchangedProjections: params.progress.unchanged,
      failedWrites: params.failures.length,
      batchCount: params.batchDurationsMs.length,
      batchAttempts: params.batchAttempts,
      averageBatchDurationMs: average(params.batchDurationsMs),
      averageDocumentSizeBytes: average(
        params.documentSizes.map((item) => item.sizeBytes),
      ),
      largestDocument,
      buildDurationMs: elapsedMs,
    },
    skippedDocuments: params.skippedDocuments,
    failures: params.failures,
    warnings: params.warnings,
  } satisfies BackfillReport;
}

function writeReport(reportPath: string, report: BackfillReport) {
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

function logProgress(report: BackfillReport) {
  console.log(
    [
      `collection=${report.backfillReport.currentCollection}`,
      `processed=${report.backfillReport.processed}`,
      `written=${report.backfillReport.written}`,
      `unchanged=${report.backfillReport.unchanged}`,
      `skipped=${report.backfillReport.skipped}`,
      `failed=${report.backfillReport.failed}`,
      `throughput=${report.backfillReport.averageThroughputPerSecond}/s`,
    ].join(" "),
  );
}

async function writeCheckpointIfAllowed(
  store: BackfillStore,
  options: BackfillOptions,
  checkpoint: BackfillCheckpoint,
) {
  checkpoint.updatedAt = Date.now();

  if (options.mode === "write") {
    await store.writeCheckpoint(options.checkpointId, checkpoint);
  }
}

async function processSourceDocuments(params: {
  store: BackfillStore;
  options: BackfillOptions;
  checkpoint: BackfillCheckpoint;
  progress: ProgressState;
  sources: SourceDocument[];
  context: ProjectionBuildContext;
  profileStats: Map<string, ProfileStats>;
  profileStatsComplete: boolean;
  seenIds: Set<string>;
  successfulProjections: { count: number };
  skippedDocuments: SkippedDocument[];
  validationFailures: ValidationFailure[];
  warnings: BackfillWarning[];
  duplicateIds: string[];
  failures: WriteFailure[];
  batchDurationsMs: number[];
  batchAttempts: { count: number };
  documentSizes: Array<{ documentId: string; sizeBytes: number }>;
  skippedWrites: { count: number };
}) {
  const candidates: ProjectionCandidate[] = [];

  for (const source of params.sources) {
    params.progress.processed += 1;
    params.checkpoint.processedCount += 1;
    const result = buildProjectionCandidate(
      source,
      params.context,
      params.profileStats,
      params.profileStatsComplete && source.collection === "userProfiles",
    );

    if (result.warning) {
      params.warnings.push(result.warning);
      params.skippedDocuments.push({
        collection: source.collection,
        sourceId: source.id,
        reason: result.warning.message,
      });
      params.progress.skipped += 1;
      params.checkpoint.skippedCount += 1;
      continue;
    }

    if (result.validationFailure) {
      params.validationFailures.push(result.validationFailure);
      params.progress.failed += 1;
      params.checkpoint.failedCount += 1;
      continue;
    }

    if (!result.candidate) continue;

    if (params.seenIds.has(result.candidate.documentId)) {
      params.duplicateIds.push(result.candidate.documentId);
      params.progress.failed += 1;
      params.checkpoint.failedCount += 1;
      continue;
    }

    params.seenIds.add(result.candidate.documentId);
    recordProfileStats(params.profileStats, result.candidate);
    params.documentSizes.push({
      documentId: result.candidate.documentId,
      sizeBytes: result.candidate.sizeBytes,
    });
    candidates.push(result.candidate);
  }

  const outcome = await writeProjectionCandidates(
    params.store,
    candidates,
    params.options,
  );
  appendWriteOutcome(params.progress, outcome);
  params.successfulProjections.count +=
    candidates.length - outcome.failed;
  params.failures.push(...outcome.failures);
  params.batchDurationsMs.push(...outcome.batchDurationsMs);
  params.batchAttempts.count += outcome.batchAttempts;
  params.skippedWrites.count += outcome.skippedWrites;
  params.checkpoint.successCount += candidates.length - outcome.failed;
  params.checkpoint.failedCount += outcome.failed;
}

async function exactSourceDocuments(
  store: BackfillStore,
  options: BackfillOptions,
) {
  const collections = selectedCollections(options.collection);
  const sources: SourceDocument[] = [];

  if (options.retryReportPath) {
    const retryIds = retryReportSourceIds(options.retryReportPath);
    for (const [collection, ids] of retryIds.entries()) {
      for (const id of ids) {
        const source = await store.getSourceDocument(collection, id);
        if (source) sources.push(source);
      }
    }
    return sources;
  }

  if (!options.sourceId) return null;

  for (const collection of collections) {
    const source = await store.getSourceDocument(collection, options.sourceId);
    if (source) sources.push(source);
  }

  return sources;
}

async function rebuildProfileStats(
  store: BackfillStore,
  context: ProjectionBuildContext,
  collections: SourceCollection[],
  pageSize: number,
) {
  const profileStats = new Map<string, ProfileStats>();

  for (const collection of collections) {
    let afterDocumentId: string | null = null;

    while (true) {
      const page = await store.listSourcePage(
        collection,
        afterDocumentId,
        pageSize,
      );

      if (page.length === 0) break;

      for (const source of page) {
        const result = buildProjectionCandidate(
          source,
          context,
          profileStats,
          false,
        );
        if (result.candidate) {
          recordProfileStats(profileStats, result.candidate);
        }
      }

      afterDocumentId = page[page.length - 1].id;
    }
  }

  return profileStats;
}

function profileStatsPrepassCollections(
  options: BackfillOptions,
  checkpoint: BackfillCheckpoint,
) {
  if (options.sourceId || options.retryReportPath) return [];

  if (options.collection === "userProfiles") {
    return ["knowledge", "smarttalk"] as SourceCollection[];
  }

  if (options.collection !== "all" || !options.resume) return [];
  if (
    checkpoint.currentCollection !== "smarttalk" &&
    checkpoint.currentCollection !== "userProfiles"
  ) {
    return [];
  }

  const currentIndex = SOURCE_COLLECTIONS.indexOf(checkpoint.currentCollection);
  return SOURCE_COLLECTIONS.slice(0, currentIndex).filter(
    (collection) => collection !== "userProfiles",
  );
}

function hasCompleteProfileStats(options: BackfillOptions) {
  return (
    !options.sourceId &&
    !options.retryReportPath &&
    (options.collection === "all" || options.collection === "userProfiles")
  );
}

async function runBackfill(
  store: BackfillStore,
  options: BackfillOptions,
): Promise<BackfillReport> {
  const startedAtMs = performance.now();
  const checkpointFromStore =
    options.resume && !options.resetCheckpoint
      ? await store.readCheckpoint(options.checkpointId)
      : null;
  const firstCollection = selectedCollections(options.collection)[0] || "complete";
  const checkpoint =
    checkpointFromStore ||
    createCheckpoint(options, firstCollection);
  const progress: ProgressState = {
    processed: checkpoint.processedCount,
    written: 0,
    skipped: checkpoint.skippedCount,
    unchanged: 0,
    failed: checkpoint.failedCount,
    currentCollection: checkpoint.currentCollection,
  };
  const seenIds = new Set<string>();
  const successfulProjections = { count: checkpoint.successCount };
  const skippedDocuments: SkippedDocument[] = [];
  const validationFailures: ValidationFailure[] = [];
  const warnings: BackfillWarning[] = [];
  const duplicateIds: string[] = [];
  const failures: WriteFailure[] = [];
  const batchDurationsMs: number[] = [];
  const batchAttempts = { count: 0 };
  const documentSizes: Array<{ documentId: string; sizeBytes: number }> = [];
  const skippedWrites = { count: 0 };
  const context = {
    projectedAt:
      options.source === "fixture" ? FIXTURE_PROJECTED_AT : Date.now(),
  };
  const prepassCollections = profileStatsPrepassCollections(options, checkpoint);
  const profileStats =
    prepassCollections.length > 0
      ? await rebuildProfileStats(
          store,
          context,
          prepassCollections,
          options.pageSize,
        )
      : new Map<string, ProfileStats>();
  const profileStatsComplete = hasCompleteProfileStats(options);
  const exactSources = await exactSourceDocuments(store, options);

  if (exactSources) {
    await processSourceDocuments({
      store,
      options,
      checkpoint,
      progress,
      sources: exactSources,
      context,
      profileStats,
      profileStatsComplete,
      seenIds,
      successfulProjections,
      skippedDocuments,
      validationFailures,
      warnings,
      duplicateIds,
      failures,
      batchDurationsMs,
      batchAttempts,
      documentSizes,
      skippedWrites,
    });
    checkpoint.currentCollection = "complete";
    checkpoint.lastProcessedDocument = null;
    progress.currentCollection = "complete";
    await writeCheckpointIfAllowed(store, options, checkpoint);

    return createReport({
      options,
      checkpoint,
      progress,
      startedAtMs,
      successfulProjections: successfulProjections.count,
      skippedDocuments,
      validationFailures,
      warnings,
      duplicateIds,
      failures,
      batchDurationsMs,
      batchAttempts: batchAttempts.count,
      documentSizes,
      storeMetrics: store.getMetrics(),
      skippedWrites: skippedWrites.count,
    });
  }

  const collections = selectedCollections(options.collection);
  let collectionIndex = Math.max(
    0,
    collections.indexOf(
      checkpoint.currentCollection === "complete"
        ? collections[0]
        : checkpoint.currentCollection,
    ),
  );
  let afterDocumentId = checkpoint.lastProcessedDocument;

  if (checkpoint.currentCollection === "complete") {
    collectionIndex = collections.length;
  }

  for (; collectionIndex < collections.length; collectionIndex += 1) {
    const collection = collections[collectionIndex];
    checkpoint.currentCollection = collection;
    progress.currentCollection = collection;

    while (true) {
      const page = await store.listSourcePage(
        collection,
        afterDocumentId,
        options.pageSize,
      );

      if (page.length === 0) {
        afterDocumentId = null;
        checkpoint.currentCollection =
          collections[collectionIndex + 1] || "complete";
        checkpoint.lastProcessedDocument = null;
        progress.currentCollection = checkpoint.currentCollection;
        await writeCheckpointIfAllowed(store, options, checkpoint);
        break;
      }

      await processSourceDocuments({
        store,
        options,
        checkpoint,
        progress,
        sources: page,
        context,
        profileStats,
        profileStatsComplete,
        seenIds,
        successfulProjections,
        skippedDocuments,
        validationFailures,
        warnings,
        duplicateIds,
        failures,
        batchDurationsMs,
        batchAttempts,
        documentSizes,
        skippedWrites,
      });

      afterDocumentId = page[page.length - 1].id;
      checkpoint.lastProcessedDocument = afterDocumentId;
      await writeCheckpointIfAllowed(store, options, checkpoint);

      const partialReport = createReport({
        options,
        checkpoint,
        progress,
        startedAtMs,
        successfulProjections: successfulProjections.count,
        skippedDocuments,
        validationFailures,
        warnings,
        duplicateIds,
        failures,
        batchDurationsMs,
        batchAttempts: batchAttempts.count,
        documentSizes,
        storeMetrics: store.getMetrics(),
        skippedWrites: skippedWrites.count,
      });
      logProgress(partialReport);

      if (
        options.simulateInterruptionAfter &&
        progress.processed >= options.simulateInterruptionAfter
      ) {
        throw new BackfillInterruption("Simulated interruption after checkpoint.");
      }
    }
  }

  checkpoint.currentCollection = "complete";
  checkpoint.lastProcessedDocument = null;
  progress.currentCollection = "complete";
  await writeCheckpointIfAllowed(store, options, checkpoint);

  return createReport({
    options,
    checkpoint,
    progress,
    startedAtMs,
    successfulProjections: successfulProjections.count,
    skippedDocuments,
    validationFailures,
    warnings,
    duplicateIds,
    failures,
    batchDurationsMs,
    batchAttempts: batchAttempts.count,
    documentSizes,
    storeMetrics: store.getMetrics(),
    skippedWrites: skippedWrites.count,
  });
}

function createStore(options: BackfillOptions): BackfillStore {
  if (options.source === "firestore") {
    return new FirestoreBackfillStore(initializeAdminFirestore());
  }

  return new FixtureBackfillStore();
}

function assertSafeOptions(options: BackfillOptions) {
  if (options.mode === "write" && options.source !== "firestore") {
    return;
  }

  if (options.mode === "write" && options.source === "firestore") {
    const hasServiceAccount =
      Boolean(readEnv("FIREBASE_CLIENT_EMAIL")) &&
      Boolean(readEnv("FIREBASE_PRIVATE_KEY"));
    const hasApplicationDefault = Boolean(readEnv("GOOGLE_APPLICATION_CREDENTIALS"));

    if (!hasServiceAccount && !hasApplicationDefault) {
      throw new Error(
        "Firestore write mode requires Firebase Admin credentials. Provide FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY or GOOGLE_APPLICATION_CREDENTIALS.",
      );
    }
  }
}

async function runValidationSelfTest() {
  const options: BackfillOptions = {
    ...readOptions(),
    source: "fixture",
    mode: "dry-run",
    collection: "all",
    sourceId: null,
    retryReportPath: null,
    resume: false,
    resetCheckpoint: true,
    reportPath: DEFAULT_VALIDATION_REPORT_PATH,
    batchSize: 2,
    pageSize: 2,
    buildId: "seo-v2-validation-self-test",
    simulateInterruptionAfter: null,
  };
  const store = new FixtureBackfillStore([
    {
      collection: "knowledge",
      id: "",
      data: {
        title: "Invalid projection source",
        content: "This fixture intentionally uses an empty source id.",
        visibility: "public",
      },
    },
    ...fixtureSources(),
  ]);
  const report = await runBackfill(store, options);
  writeReport(options.reportPath, report);

  if (report.validationReport.validationFailures === 0) {
    throw new Error("Validation self-test expected at least one validation failure.");
  }

  return report;
}

async function runResumeSelfTest() {
  const store = new FixtureBackfillStore();
  const firstOptions: BackfillOptions = {
    ...readOptions(),
    source: "fixture",
    mode: "write",
    collection: "all",
    sourceId: null,
    retryReportPath: null,
    resume: false,
    resetCheckpoint: true,
    reportPath: DEFAULT_RESUME_REPORT_PATH,
    batchSize: 2,
    pageSize: 1,
    buildId: "seo-v2-resume-self-test",
    simulateInterruptionAfter: 1,
  };

  try {
    await runBackfill(store, firstOptions);
  } catch (error) {
    if (!(error instanceof BackfillInterruption)) throw error;
  }

  const secondOptions: BackfillOptions = {
    ...firstOptions,
    resume: true,
    resetCheckpoint: false,
    simulateInterruptionAfter: null,
  };
  const report = await runBackfill(store, secondOptions);
  writeReport(secondOptions.reportPath, report);

  if (report.backfillReport.currentCollection !== "complete") {
    throw new Error("Resume self-test did not complete.");
  }

  return report;
}

async function runIdempotencySelfTest() {
  const store = new FixtureBackfillStore();
  const options: BackfillOptions = {
    ...readOptions(),
    source: "fixture",
    mode: "write",
    collection: "all",
    sourceId: null,
    retryReportPath: null,
    resume: false,
    resetCheckpoint: true,
    reportPath: DEFAULT_IDEMPOTENCY_REPORT_PATH,
    batchSize: 2,
    pageSize: 2,
    buildId: "seo-v2-idempotency-self-test",
    simulateInterruptionAfter: null,
  };
  const first = await runBackfill(store, options);
  store.resetMetrics();
  const second = await runBackfill(store, {
    ...options,
    buildId: "seo-v2-idempotency-self-test-rerun",
  });
  writeReport(options.reportPath, second);

  if (first.metrics.seoDocumentWrites === 0) {
    throw new Error("Idempotency self-test expected the first run to write projections.");
  }

  if (second.backfillReport.unchanged === 0 || second.backfillReport.written > 0) {
    throw new Error("Idempotency self-test expected the second run to skip unchanged projections.");
  }

  if (store.getSeoDocumentCount() !== first.validationReport.successfulProjections) {
    throw new Error("Idempotency self-test created duplicate projection documents.");
  }

  return second;
}

async function runBatchRetrySelfTest() {
  const store = new FixtureBackfillStore();
  store.failNextWriteAttempts = 1;
  const options: BackfillOptions = {
    ...readOptions(),
    source: "fixture",
    mode: "write",
    collection: "all",
    sourceId: null,
    retryReportPath: null,
    resume: false,
    resetCheckpoint: true,
    reportPath: DEFAULT_BATCH_RETRY_REPORT_PATH,
    batchSize: 2,
    pageSize: 2,
    buildId: "seo-v2-batch-retry-self-test",
    maxRetries: 2,
    simulateInterruptionAfter: null,
  };
  const report = await runBackfill(store, options);
  writeReport(options.reportPath, report);

  if (report.metrics.seoDocumentWrites === 0 || report.failures.length > 0) {
    throw new Error("Batch retry self-test did not recover from transient failure.");
  }

  return report;
}

async function main() {
  if (hasArg("--validation-self-test")) {
    const report = await runValidationSelfTest();
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (hasArg("--resume-self-test")) {
    const report = await runResumeSelfTest();
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (hasArg("--idempotency-self-test")) {
    const report = await runIdempotencySelfTest();
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (hasArg("--batch-retry-self-test")) {
    const report = await runBatchRetrySelfTest();
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const options = readOptions();
  assertSafeOptions(options);
  const store = createStore(options);
  const report = await runBackfill(store, options);
  writeReport(options.reportPath, report);
  console.log(JSON.stringify(report, null, 2));

  if (
    report.validationReport.validationFailures > 0 ||
    report.failures.length > 0 ||
    report.validationReport.duplicateIds > 0
  ) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});
