import type { ReactNode } from "react";
import { type KnowledgeImageAsset, type KnowledgeImageLayout } from "../types";

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

function ReadativeWatermark() {
  return (
    <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40 drop-shadow-[0_1px_1px_rgba(255,255,255,0.32)] select-none">
      <svg
        viewBox="0 0 64 64"
        aria-hidden="true"
        className="h-5 w-5 shrink-0 text-black/45"
        fill="none"
      >
        <path
          d="M19 18h17c6.6 0 12 5.4 12 12v16H31c-6.6 0-12-5.4-12-12V18zm12 8v12h13"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="5"
        />
      </svg>
      <span>Readative</span>
    </div>
  );
}

export function KnowledgeImageCarousel({
  images,
  layout,
  altBase,
  mode = "feed",
  renderOverlayAction,
}: KnowledgeImageCarouselProps) {
  if (images.length === 0) return null;

  return (
    <div className="relative overflow-hidden bg-slate-100">
      <div className="readative-scrollbar-hidden flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 py-4 sm:gap-4 sm:px-5">
        {images.map((image, index) => (
          <figure
            key={`${image.optimizedAt}-${index}`}
            className={`${getSlideClassName(layout, mode)} relative shrink-0 snap-center overflow-hidden rounded-[24px] bg-slate-200 shadow-[0_12px_35px_rgba(15,23,42,0.12)]`}
          >
            <img
              src={image.dataUrl}
              alt={`${altBase} ${index + 1}`}
              loading={mode === "feed" ? "lazy" : undefined}
              decoding="async"
              width={image.width}
              height={image.height}
              sizes={
                layout === "portrait"
                  ? "(max-width: 768px) 76vw, 58vw"
                  : "(max-width: 768px) 92vw, 72vw"
              }
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/28 via-transparent to-transparent" />
            <ReadativeWatermark />

            {renderOverlayAction && (
              <div className="absolute right-3 top-3">
                {renderOverlayAction(image, index)}
              </div>
            )}
          </figure>
        ))}
      </div>

      {images.length > 1 && (
        <div className="pointer-events-none absolute bottom-4 right-5 rounded-full bg-slate-950/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur-md">
          {images.length} images
        </div>
      )}
    </div>
  );
}
