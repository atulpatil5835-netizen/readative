import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { type KnowledgeEntry } from "../types";

const MAX_IMAGE_DIMENSION = 1280;
const MAX_INLINE_IMAGE_CHARS = 360_000;
const OUTPUT_QUALITIES = [0.78, 0.68, 0.58, 0.48];
const MIN_DIMENSION_SCALE = 0.55;
const DOWNSCALE_STEP = 0.86;
const legacyMigrationQueue: KnowledgeEntry[] = [];
const queuedLegacyEntryIds = new Set<string>();

export interface OptimizedKnowledgeImage {
  dataUrl: string;
  width: number;
  height: number;
  mimeType: string;
  optimizedAt: number;
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

function normalizeImageSize(width: number, height: number) {
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
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

async function optimizeImageSource(source: string): Promise<OptimizedKnowledgeImage> {
  const image = await loadImage(source);
  const initialSize = normalizeImageSize(image.width, image.height);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not prepare the image canvas.");
  }

  let width = initialSize.width;
  let height = initialSize.height;

  while (true) {
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    for (const quality of OUTPUT_QUALITIES) {
      const exported = exportCanvas(canvas, quality);

      if (
        exported.dataUrl.length <= MAX_INLINE_IMAGE_CHARS ||
        width / initialSize.width <= MIN_DIMENSION_SCALE
      ) {
        if (exported.dataUrl.length > 600_000) {
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
  file: File
): Promise<OptimizedKnowledgeImage> {
  const rawDataUrl = await readFileAsDataUrl(file);
  return optimizeImageSource(rawDataUrl);
}

function needsLegacyImageMigration(entry: KnowledgeEntry) {
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
