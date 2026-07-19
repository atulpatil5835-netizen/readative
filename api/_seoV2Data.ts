import {
  SEO_DOCUMENTS_COLLECTION,
  SEO_META_COLLECTION,
  SEO_V2_PROJECTION_VERSION,
  SEO_V2_SCHEMA_VERSION,
  type SeoArchitectureMode,
  type SeoV2Document,
  type SeoV2DocumentType,
  type SeoV2MetaSummary,
} from "../src/utils/seoV2Types.js";

const SEO_ARCHITECTURE_ENV = "READATIVE_SEO_ARCHITECTURE";

function readEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function normalizeSeoArchitectureMode(value: string): SeoArchitectureMode {
  return value.trim().toLowerCase() === "v2" ? "v2" : "v1";
}

export function getSeoArchitectureMode(): SeoArchitectureMode {
  return normalizeSeoArchitectureMode(readEnv(SEO_ARCHITECTURE_ENV));
}

export function isSeoV2Enabled() {
  return getSeoArchitectureMode() === "v2";
}

export function describeSeoV2Foundation() {
  return {
    mode: getSeoArchitectureMode(),
    flagName: SEO_ARCHITECTURE_ENV,
    documentsCollection: SEO_DOCUMENTS_COLLECTION,
    metaCollection: SEO_META_COLLECTION,
    schemaVersion: SEO_V2_SCHEMA_VERSION,
    projectionVersion: SEO_V2_PROJECTION_VERSION,
  };
}

interface SeoV2ReaderResult<T> {
  source: "v2";
  data: T | null;
  errors: string[];
}

function milestoneOneReaderMessage(resource: string) {
  return `SEO V2 ${resource} reader is not implemented in Milestone 1.`;
}

export async function loadSeoV2Document(
  type: SeoV2DocumentType,
  sourceId: string,
): Promise<SeoV2ReaderResult<SeoV2Document>> {
  void type;
  void sourceId;

  return {
    source: "v2",
    data: null,
    errors: [milestoneOneReaderMessage("document")],
  };
}

export async function loadSeoV2MetaSummary(): Promise<
  SeoV2ReaderResult<SeoV2MetaSummary>
> {
  return {
    source: "v2",
    data: null,
    errors: [milestoneOneReaderMessage("meta summary")],
  };
}
