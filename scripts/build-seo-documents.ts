import fs from "node:fs";
import path from "node:path";
import {
  SEO_V2_BUILDER_VERSION,
  SEO_V2_MAX_ANSWER_PREVIEW,
  SEO_V2_PROJECTION_VERSION,
  SEO_V2_SCHEMA_VERSION,
} from "../src/utils/seoV2Types.js";
import {
  buildSeoProjection,
  validateSeoV2Projection,
  verifyProjectionDeterminism,
  type ProjectionBuildContext,
  type ProjectionValidationIssue,
  type SeoProjectionBuildResult,
  type SeoProjectionSourceInput,
} from "../src/utils/seoProjection.js";

const DEFAULT_REPORT_PATH = path.join(
  process.cwd(),
  "seo_v2_projection_dry_run_report.json",
);
const FIXTURE_PROJECTED_AT = Date.UTC(2026, 6, 19, 0, 0, 0);

interface DryRunOptions {
  source: "fixture";
  reportPath: string;
  validationSelfTest: boolean;
}

interface ProjectionReportItem {
  type: SeoProjectionSourceInput["type"];
  sourceId: string;
  documentId: string;
  success: boolean;
  validation: ProjectionValidationIssue[];
  deterministic: boolean;
}

function getArgValue(name: string) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
}

function hasArg(name: string) {
  return process.argv.includes(name);
}

function readOptions(): DryRunOptions {
  const source = getArgValue("--source") || "fixture";
  if (source !== "fixture") {
    throw new Error(
      "Milestone 2 dry-run supports only --source=fixture to avoid Firestore reads.",
    );
  }

  return {
    source,
    reportPath: getArgValue("--report") || DEFAULT_REPORT_PATH,
    validationSelfTest: hasArg("--validation-self-test"),
  };
}

function fixtureSources(): SeoProjectionSourceInput[] {
  return [
    {
      type: "post",
      value: {
        id: "post_alpha",
        title: "A Practical Guide to Focused Reading",
        description:
          "A compact guide for improving reading sessions with notes, reflection, and deliberate review.",
        content:
          "Focused reading starts with one clear question. Readative helps a reader turn that question into a reusable knowledge note.",
        authorId: "user_atul",
        authorName: "Atul",
        authorUsername: "atul_hinge",
        category: "learning",
        hashtags: ["reading", "learning", "notes"],
        createdAt: Date.UTC(2026, 6, 1),
        updatedAt: Date.UTC(2026, 6, 5),
        public: true,
      },
    },
    {
      type: "profile",
      value: {
        id: "user_atul",
        name: "Atul",
        username: "atul_hinge",
        description:
          "A Readative contributor publishing and curating practical knowledge.",
        createdAt: Date.UTC(2026, 5, 20),
        updatedAt: Date.UTC(2026, 6, 6),
        postCount: 12,
        smartTalkCount: 4,
        public: true,
      },
    },
    {
      type: "smarttalk",
      value: {
        id: "smarttalk_alpha",
        title: "How can I use AI without losing my own thinking?",
        description:
          "How can I use AI for writing and study without becoming dependent on it?",
        authorId: "user_atul",
        authorName: "Atul",
        authorUsername: "atul_hinge",
        category: "ai",
        answerCount: 6,
        answers: [
          {
            authorName: "Reader One",
            text: "Use AI as a thinking partner after writing your own first draft.",
          },
          {
            authorName: "Reader Two",
            text: "Ask it to challenge your assumptions instead of replacing your judgment.",
          },
          {
            authorName: "Reader Three",
            text: "Keep a personal summary of what you actually learned.",
          },
          {
            authorName: "Reader Four",
            text: "Compare generated ideas with your own notes.",
          },
          {
            authorName: "Reader Five",
            text: "Use it for review prompts, not as a final answer machine.",
          },
          {
            authorName: "Reader Six",
            text: "This answer should be clipped by the preview limit.",
          },
        ],
        createdAt: Date.UTC(2026, 6, 2),
        updatedAt: Date.UTC(2026, 6, 7),
        public: true,
      },
    },
  ];
}

function countByType(items: SeoProjectionSourceInput[]) {
  return items.reduce(
    (counts, item) => ({
      ...counts,
      [item.type]: counts[item.type] + 1,
    }),
    { post: 0, profile: 0, smarttalk: 0 },
  );
}

function summarizeIssueCodes(items: ProjectionReportItem[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const issue of item.validation) {
      counts.set(issue.code, (counts.get(issue.code) || 0) + 1);
    }
  }
  return Object.fromEntries([...counts.entries()].sort());
}

function buildProjectionItem(
  source: SeoProjectionSourceInput,
  context: ProjectionBuildContext,
): ProjectionReportItem {
  const first = buildSeoProjection(source, context);
  const second = buildSeoProjection(source, context);
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

  return {
    type: source.type,
    sourceId: source.value.id,
    documentId: first.documentId,
    success: validation.every((issue) => issue.severity !== "error"),
    validation,
    deterministic,
  };
}

function runValidationSelfTest(validResult: SeoProjectionBuildResult) {
  const corrupted = {
    ...validResult.document,
    title: "",
    canonicalPath: "https://www.readative.com/not-a-path",
    public: "yes",
    schemaVersion: -1,
    projectionVersion: -1,
    projectedAt: Number.NaN,
  } as unknown as typeof validResult.document;

  const issues = validateSeoV2Projection(corrupted, {
    documentId: "wrong:id",
  });
  const requiredCodes = [
    "required_string",
    "invalid_document_id",
    "invalid_public_state",
    "invalid_schema_version",
    "invalid_projection_version",
    "invalid_timestamp",
    "absolute_canonical_path",
  ];
  const issueCodes = new Set(issues.map((issue) => issue.code));
  const missingCodes = requiredCodes.filter((code) => !issueCodes.has(code));

  return {
    passed: missingCodes.length === 0,
    checkedCodes: requiredCodes,
    missingCodes,
    issuesDetected: issues.length,
  };
}

function main() {
  const options = readOptions();
  const context = { projectedAt: FIXTURE_PROJECTED_AT };
  const sources = fixtureSources();
  const startedAt = performance.now();
  const items = sources.map((source) => buildProjectionItem(source, context));
  const elapsedMs = Math.round((performance.now() - startedAt) * 100) / 100;
  const successful = items.filter((item) => item.success);
  const failed = items.filter((item) => !item.success);
  const warnings = items.flatMap((item) =>
    item.validation.filter((issue) => issue.severity === "warning"),
  );
  const validationSelfTest = options.validationSelfTest
    ? runValidationSelfTest(buildSeoProjection(sources[0], context))
    : null;
  const report = {
    schemaVersion: SEO_V2_SCHEMA_VERSION,
    projectionVersion: SEO_V2_PROJECTION_VERSION,
    builderVersion: SEO_V2_BUILDER_VERSION,
    generatedAt: new Date().toISOString(),
    source: options.source,
    dryRun: true,
    firestoreWrites: 0,
    networkRequests: 0,
    counts: {
      postsProcessed: countByType(sources).post,
      profilesProcessed: countByType(sources).profile,
      smartTalksProcessed: countByType(sources).smarttalk,
      successfulProjections: successful.length,
      failedProjections: failed.length,
      validationFailures: items.reduce(
        (total, item) =>
          total +
          item.validation.filter((issue) => issue.severity === "error").length,
        0,
      ),
      warnings: warnings.length,
      skippedDocuments: 0,
      deterministicFailures: items.filter((item) => !item.deterministic).length,
    },
    performance: {
      projectionGenerationTimeMs: elapsedMs,
      averageGenerationTimeMs:
        items.length > 0
          ? Math.round((elapsedMs / items.length) * 100) / 100
          : 0,
    },
    architectureValidation: {
      deterministicOutput: items.every((item) => item.deterministic),
      validCanonicals: !items.some((item) =>
        item.validation.some((issue) => issue.code.includes("canonical")),
      ),
      validPublicState: !items.some((item) =>
        item.validation.some((issue) => issue.code === "invalid_public_state"),
      ),
      validIds: !items.some((item) =>
        item.validation.some((issue) => issue.code === "invalid_document_id"),
      ),
      validRequiredFields: !items.some((item) =>
        item.validation.some((issue) => issue.code === "required_string"),
      ),
      documentSizeGuard: !items.some((item) =>
        item.validation.some((issue) => issue.code === "document_size_limit"),
      ),
      previewSizeGuard: !items.some((item) =>
        item.validation.some((issue) => issue.code.includes("preview")),
      ),
      maxAnswerPreview: SEO_V2_MAX_ANSWER_PREVIEW,
    },
    issueSummary: summarizeIssueCodes(items),
    validationSelfTest,
    items,
  };

  fs.writeFileSync(options.reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));

  if (failed.length > 0 || validationSelfTest?.passed === false) {
    process.exitCode = 1;
  }
}

main();
