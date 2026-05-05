import { type KnowledgeImageAsset } from "../types";

const PROFILE_IMAGE_DIMENSION = 176;
const PROFILE_IMAGE_MAX_INLINE_CHARS = 48_000;

export function normalizeProfileImage(
  value: unknown,
): KnowledgeImageAsset | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const image = value as Partial<KnowledgeImageAsset>;
  if (
    typeof image.dataUrl !== "string" ||
    typeof image.mimeType !== "string" ||
    typeof image.width !== "number" ||
    typeof image.height !== "number" ||
    typeof image.optimizedAt !== "number"
  ) {
    return null;
  }

  return {
    dataUrl: image.dataUrl,
    mimeType: image.mimeType,
    width: image.width,
    height: image.height,
    optimizedAt: image.optimizedAt,
  };
}

export async function optimizeProfileImageFile(
  file: File,
): Promise<KnowledgeImageAsset> {
  const { optimizeKnowledgeImageFile } = await import(
    "./knowledgeImageOptimizer"
  );

  return optimizeKnowledgeImageFile(file, {
    targetRatio: 1,
    maxDimension: PROFILE_IMAGE_DIMENSION,
    maxInlineChars: PROFILE_IMAGE_MAX_INLINE_CHARS,
  });
}
