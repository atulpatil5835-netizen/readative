import { type KnowledgeImageAsset } from "../types";

const MAX_IMAGE_DIMENSION = 1280;
const MAX_INLINE_IMAGE_CHARS = 360_000;
const OUTPUT_QUALITIES = [0.78, 0.68, 0.58, 0.48];
const MIN_DIMENSION_SCALE = 0.55;
const DOWNSCALE_STEP = 0.86;

export interface OptimizeImageOptions {
  targetRatio?: number;
  maxInlineChars?: number;
  maxDimension?: number;
}

export type OptimizedKnowledgeImage = KnowledgeImageAsset;

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

function exportCanvas(
  canvas: HTMLCanvasElement,
  quality: number,
): {
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

export async function optimizeKnowledgeImageSource(
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
  return optimizeKnowledgeImageSource(rawDataUrl, options);
}
