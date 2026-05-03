import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import {
  type KnowledgeEntry,
  type KnowledgeImageAsset,
  type KnowledgeImageLayout,
} from "../types";

const MAX_IMAGE_DIMENSION = 1280;
const MAX_INLINE_IMAGE_CHARS = 360_000;
const OUTPUT_QUALITIES = [0.78, 0.68, 0.58, 0.48];
const MIN_DIMENSION_SCALE = 0.55;
const DOWNSCALE_STEP = 0.86;
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
    maxInlineChars: 190_000,
    maxDimension: 1400,
  },
  portrait: {
    label: "4 x 8:9",
    description: "Four compact portraits",
    maxImages: 4,
    targetRatio: PORTRAIT_IMAGE_RATIO,
    maxInlineChars: 120_000,
    maxDimension: 1180,
  },
};

export type OptimizedKnowledgeImage = KnowledgeImageAsset;

interface OptimizeImageOptions {
  targetRatio?: number;
  maxInlineChars?: number;
  maxDimension?: number;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load the selected image."));
    image.src = source;
  });
}

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

function normalizeImageSize(width: number, height: number, maxDimension: number) {
  const scale = Math.min(1, maxDimension / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function getCropArea(width: number, height: number, targetRatio?: number) {
  if (!targetRatio || width <= 0 || height <= 0) {
    return {
      offsetX: 0,
      offsetY: 0,
      width,
      height,
    };
  }

  const currentRatio = width / height;
  if (Math.abs(currentRatio - targetRatio) < 0.015) {
    return {
      offsetX: 0,
      offsetY: 0,
      width,
      height,
    };
  }

  if (currentRatio > targetRatio) {
    const croppedWidth = height * targetRatio;
    return {
      offsetX: (width - croppedWidth) / 2,
      offsetY: 0,
      width: croppedWidth,
      height,
    };
  }

  const croppedHeight = width / targetRatio;
  return {
    offsetX: 0,
    offsetY: (height - croppedHeight) / 2,
    width,
    height: croppedHeight,
  };
}

function exportCanvas(canvas: HTMLCanvasElement, quality: number): {
  dataUrl: string;
  mimeType: string;
} {
  const preferred = canvas.toDataURL("image/webp", quality);

  if (preferred.startsWith("data:image/webp")) {
    return { dataUrl: preferred, mimeType: "image/webp" };
  }

  return {
    dataUrl: canvas.toDataURL("image/jpeg", quality),
    mimeType: "image/jpeg",
  };
}

async function optimizeImageSource(
  source: string,
  options: OptimizeImageOptions = {},
): Promise<OptimizedKnowledgeImage> {
  const image = await loadImage(source);
  const cropArea = getCropArea(image.width, image.height, options.targetRatio);
  const initialSize = normalizeImageSize(
    cropArea.width,
    cropArea.height,
    options.maxDimension || MAX_IMAGE_DIMENSION,
  );
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const maxInlineChars = options.maxInlineChars || MAX_INLINE_IMAGE_CHARS;

  if (!context) {
    throw new Error("Could not prepare the image canvas.");
  }

  let width = initialSize.width;
  let height = initialSize.height;

  while (true) {
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(
      image,
      cropArea.offsetX,
      cropArea.offsetY,
      cropArea.width,
      cropArea.height,
      0,
      0,
      width,
      height,
    );

    for (const quality of OUTPUT_QUALITIES) {
      const exported = exportCanvas(canvas, quality);

      if (
        exported.dataUrl.length <= maxInlineChars ||
        width / initialSize.width <= MIN_DIMENSION_SCALE
      ) {
        if (exported.dataUrl.length > Math.max(maxInlineChars * 1.6, 600_000)) {
          throw new Error("Image is still too large. Please choose a smaller image.");
        }

        return {
          dataUrl: exported.dataUrl,
          width,
          height,
          mimeType: exported.mimeType,
          optimizedAt: Date.now(),
        };
      }
    }

    const nextWidth = Math.max(1, Math.round(width * DOWNSCALE_STEP));
    const nextHeight = Math.max(1, Math.round(height * DOWNSCALE_STEP));

    if (
      nextWidth === width ||
      nextHeight === height ||
      nextWidth / initialSize.width < MIN_DIMENSION_SCALE
    ) {
      break;
    }

    width = nextWidth;
    height = nextHeight;
  }

  throw new Error("Image is too large. Please choose a smaller image.");
}

export async function optimizeKnowledgeImageFile(
  file: File,
  options: OptimizeImageOptions = {},
): Promise<OptimizedKnowledgeImage> {
  const rawDataUrl = await readFileAsDataUrl(file);
  return optimizeImageSource(rawDataUrl, options);
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

  const optimized = await optimizeImageSource(entry.imageDataUrl);

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
