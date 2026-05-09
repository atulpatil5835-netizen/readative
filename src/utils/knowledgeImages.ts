import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import {
  type KnowledgeEntry,
  type KnowledgeImageAsset,
  type KnowledgeImageLayout,
} from "../types";

const MAX_INLINE_IMAGE_CHARS = 360_000;
const legacyMigrationQueue: KnowledgeEntry[] = [];
const queuedLegacyEntryIds = new Set<string>();
const WIDE_IMAGE_RATIO = 16 / 9;
const PORTRAIT_IMAGE_RATIO = 8 / 9;

export const KNOWLEDGE_IMAGE_LAYOUTS: Record<
  KnowledgeImageLayout,
  {
    label: string;
    description: string;
    maxImages: number;
    targetRatio: number;
    maxInlineChars: number;
    maxDimension: number;
  }
> = {
  wide: {
    label: "2 x 16:9",
    description: "Two wide slides",
    maxImages: 2,
    targetRatio: WIDE_IMAGE_RATIO,
    maxInlineChars: 150_000,
    maxDimension: 1080,
  },
  portrait: {
    label: "4 x 8:9",
    description: "Four compact portraits",
    maxImages: 4,
    targetRatio: PORTRAIT_IMAGE_RATIO,
    maxInlineChars: 95_000,
    maxDimension: 960,
  },
};

function waitForIdle(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => resolve(), { timeout: 1500 });
      return;
    }

    setTimeout(resolve, 120);
  });
}

export function getKnowledgeImageLayoutSettings(layout: KnowledgeImageLayout) {
  return KNOWLEDGE_IMAGE_LAYOUTS[layout];
}

function isKnowledgeImageLayout(value: unknown): value is KnowledgeImageLayout {
  return value === "wide" || value === "portrait";
}

function isKnowledgeImageAsset(value: unknown): value is KnowledgeImageAsset {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<KnowledgeImageAsset>;
  return (
    typeof candidate.dataUrl === "string" &&
    candidate.dataUrl.length > 0 &&
    typeof candidate.mimeType === "string" &&
    typeof candidate.width === "number" &&
    typeof candidate.height === "number" &&
    typeof candidate.optimizedAt === "number"
  );
}

export function getKnowledgeEntryImages(entry: KnowledgeEntry): KnowledgeImageAsset[] {
  if (Array.isArray(entry.images)) {
    const normalizedImages = entry.images.filter(isKnowledgeImageAsset);
    if (normalizedImages.length > 0) {
      return normalizedImages;
    }
  }

  if (!entry.imageDataUrl) {
    return [];
  }

  return [
    {
      dataUrl: entry.imageDataUrl,
      mimeType: entry.imageMimeType || "image/jpeg",
      width: entry.imageWidth || 1280,
      height: entry.imageHeight || 720,
      optimizedAt: entry.imageOptimizedAt || entry.createdAt,
    },
  ];
}

export function getKnowledgeEntryImageLayout(
  entry: Pick<
    KnowledgeEntry,
    "imageLayout" | "images" | "imageDataUrl" | "imageWidth" | "imageHeight" | "createdAt"
  >,
): KnowledgeImageLayout {
  if (isKnowledgeImageLayout(entry.imageLayout)) {
    return entry.imageLayout;
  }

  const [firstImage] = getKnowledgeEntryImages(entry as KnowledgeEntry);
  if (!firstImage) {
    return "wide";
  }

  const imageRatio = firstImage.width / Math.max(firstImage.height, 1);
  const wideDistance = Math.abs(imageRatio - WIDE_IMAGE_RATIO);
  const portraitDistance = Math.abs(imageRatio - PORTRAIT_IMAGE_RATIO);
  return portraitDistance < wideDistance ? "portrait" : "wide";
}

function needsLegacyImageMigration(entry: KnowledgeEntry) {
  if (Array.isArray(entry.images) && entry.images.length > 0) {
    return false;
  }

  const imageDataUrl = entry.imageDataUrl;

  if (!imageDataUrl?.startsWith("data:image/")) {
    return false;
  }

  if (entry.imageMimeType !== "image/webp") {
    return true;
  }

  return imageDataUrl.length > MAX_INLINE_IMAGE_CHARS;
}

async function migrateLegacyImage(entry: KnowledgeEntry) {
  if (!entry.imageDataUrl) {
    return;
  }

  const { optimizeKnowledgeImageSource } = await import(
    "./knowledgeImageOptimizer"
  );
  const optimized = await optimizeKnowledgeImageSource(entry.imageDataUrl);

  if (
    optimized.dataUrl.length >= entry.imageDataUrl.length &&
    entry.imageMimeType === optimized.mimeType
  ) {
    return;
  }

  await updateDoc(doc(db, "knowledge", entry.id), {
    images: [optimized],
    imageLayout: getKnowledgeEntryImageLayout(entry),
    imageDataUrl: optimized.dataUrl,
    imageWidth: optimized.width,
    imageHeight: optimized.height,
    imageMimeType: optimized.mimeType,
    imageOptimizedAt: optimized.optimizedAt,
  });
}

async function processLegacyMigrationQueue() {
  while (legacyMigrationQueue.length > 0) {
    const entry = legacyMigrationQueue.shift();

    if (!entry) {
      continue;
    }

    try {
      await waitForIdle();
      await migrateLegacyImage(entry);
    } catch (error) {
      console.error(`Failed to optimize image for post ${entry.id}:`, error);
    } finally {
      queuedLegacyEntryIds.delete(entry.id);
    }
  }
}

export function queueLegacyKnowledgeImageMigration(entry: KnowledgeEntry) {
  if (!needsLegacyImageMigration(entry) || queuedLegacyEntryIds.has(entry.id)) {
    return;
  }

  queuedLegacyEntryIds.add(entry.id);
  legacyMigrationQueue.push(entry);

  if (legacyMigrationQueue.length === 1) {
    void processLegacyMigrationQueue();
  }
}
