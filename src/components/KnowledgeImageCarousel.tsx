import { memo, useState, type ReactNode } from "react";
import { type KnowledgeImageAsset, type KnowledgeImageLayout } from "../types";
import { Logo } from "./Logo";

interface KnowledgeImageCarouselProps {
  images: KnowledgeImageAsset[];
  layout: KnowledgeImageLayout;
  altBase: string;
  mode?: "feed" | "composer";
  renderOverlayAction?: (image: KnowledgeImageAsset, index: number) => ReactNode;
}

function getSlideClassName(layout: KnowledgeImageLayout, mode: "feed" | "composer") {
  if (layout === "portrait") {
    return mode === "composer"
      ? "basis-[56%] sm:basis-[42%] aspect-[8/9]"
      : "basis-[76%] sm:basis-[58%] aspect-[8/9]";
  }

  return mode === "composer"
    ? "basis-[90%] sm:basis-[72%] aspect-video"
    : "basis-[calc(100%-0.75rem)] sm:basis-[calc(100%-1rem)] aspect-video";
}

export const KnowledgeImageCarousel = memo(function KnowledgeImageCarousel({
  images,
  layout,
  altBase,
  mode = "feed",
  renderOverlayAction,
}: KnowledgeImageCarouselProps) {
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  if (images.length === 0) return null;

  return (
    <div className="relative overflow-hidden bg-slate-100">
      <div className="readative-scrollbar-hidden flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 py-4 sm:gap-4 sm:px-5">
        {images.map((image, index) => {
          const imageKey = `${image.optimizedAt}-${index}-${image.dataUrl.length}`;
          const isLoaded = Boolean(loadedImages[imageKey]);
          const hasFailed = Boolean(failedImages[imageKey]);
          const canShowImmediately = mode === "composer";
          const shouldShowImage = !hasFailed && (isLoaded || canShowImmediately);

          return (
            <figure
              key={imageKey}
              className={`${getSlideClassName(layout, mode)} relative shrink-0 snap-center overflow-hidden rounded-lg bg-slate-200 shadow-[0_12px_35px_rgba(15,23,42,0.12)]`}
            >
              <div
                className={`absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.85),transparent_32%),linear-gradient(135deg,#e2e8f0,#f8fafc_44%,#cbd5e1)] transition-opacity duration-500 ${
                  shouldShowImage ? "opacity-0" : "opacity-70"
                }`}
                aria-hidden="true"
              />
              <div
                className={`absolute inset-0 bg-slate-200 transition-opacity duration-500 ${
                  shouldShowImage ? "opacity-0" : "opacity-100"
                }`}
                aria-hidden="true"
              />
              {!shouldShowImage && (
                <div
                  className="absolute inset-x-6 bottom-6 z-10 space-y-2"
                  aria-hidden="true"
                >
                  <span className="block h-3 w-1/2 rounded-full bg-white/70" />
                  <span className="block h-3 w-2/3 rounded-full bg-white/60" />
                </div>
              )}
              {!hasFailed && (
                <img
                  src={image.dataUrl}
                  alt={`${altBase} ${index + 1}`}
                  loading={mode === "feed" ? "lazy" : "eager"}
                  decoding="async"
                  width={image.width}
                  height={image.height}
                  sizes={
                    layout === "portrait"
                      ? "(max-width: 768px) 76vw, 58vw"
                      : "(max-width: 768px) 92vw, 72vw"
                  }
                  onLoad={() =>
                    setLoadedImages((current) =>
                      current[imageKey]
                        ? current
                        : {
                            ...current,
                            [imageKey]: true,
                          },
                    )
                  }
                  onError={() =>
                    setFailedImages((current) =>
                      current[imageKey]
                        ? current
                        : {
                            ...current,
                            [imageKey]: true,
                          },
                    )
                  }
                  className={`relative h-full w-full object-cover transition-opacity duration-500 ${
                    shouldShowImage ? "opacity-100" : "opacity-0"
                  }`}
                />
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/28 via-transparent to-transparent" />

              <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1 px-0 py-0 text-[10px] font-semibold tracking-[0.16em] text-white">
                <Logo className="h-4 w-4 opacity-95" loading="lazy" />
                <span className="readative-watermark-wordmark uppercase text-white">
                  Readative
                </span>
              </div>

              {renderOverlayAction && (
                <div className="absolute right-3 top-3">
                  {renderOverlayAction(image, index)}
                </div>
              )}
            </figure>
          );
        })}
      </div>

      {images.length > 1 && (
        <div className="pointer-events-none absolute bottom-4 right-5 rounded-full bg-slate-950/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur-md">
          {images.length} images
        </div>
      )}
    </div>
  );
});
