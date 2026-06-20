import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { type KnowledgeImageAsset, type KnowledgeImageLayout } from "../types";
import { Logo } from "./Logo";

interface KnowledgeImageCarouselProps {
  images: KnowledgeImageAsset[];
  layout: KnowledgeImageLayout;
  altBase: string;
  mode?: "feed" | "composer";
  renderOverlayAction?: (image: KnowledgeImageAsset, index: number) => ReactNode;
}

function getSlideClassName(layout: KnowledgeImageLayout, _mode: "feed" | "composer") {
  if (layout === "portrait") {
    return "min-w-full basis-full aspect-[8/9]";
  }

  return "min-w-full basis-full aspect-video";
}

function clampImageIndex(index: number, imageCount: number) {
  if (imageCount <= 0) return 0;
  return Math.min(Math.max(index, 0), imageCount - 1);
}

function getNearestSlideIndex(scroller: HTMLDivElement) {
  const slides = Array.from(scroller.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );

  if (slides.length === 0) return 0;

  const scrollerCenter = scroller.scrollLeft + scroller.clientWidth / 2;
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  slides.forEach((slide, index) => {
    const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
    const distance = Math.abs(slideCenter - scrollerCenter);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
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
  const [activeIndex, setActiveIndex] = useState(0);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const scrollAnimationFrameRef = useRef<number | null>(null);
  const galleryTouchStartRef = useRef<{ x: number; y: number } | null>(null);

  const activeImageIndex = clampImageIndex(activeIndex, images.length);
  const activeGalleryIndex =
    galleryIndex === null ? null : clampImageIndex(galleryIndex, images.length);
  const activeGalleryImage =
    activeGalleryIndex === null ? null : images[activeGalleryIndex] || null;

  const updateActiveIndex = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    setActiveIndex((current) => {
      const nextIndex = clampImageIndex(getNearestSlideIndex(scroller), images.length);
      return current === nextIndex ? current : nextIndex;
    });
  }, [images.length]);

  const scheduleActiveIndexUpdate = useCallback(() => {
    if (typeof window === "undefined") return;
    if (scrollAnimationFrameRef.current !== null) return;

    scrollAnimationFrameRef.current = window.requestAnimationFrame(() => {
      scrollAnimationFrameRef.current = null;
      updateActiveIndex();
    });
  }, [updateActiveIndex]);

  const openGallery = useCallback(
    (index: number) => {
      if (mode !== "feed") return;
      setGalleryIndex(clampImageIndex(index, images.length));
    },
    [images.length, mode],
  );

  const closeGallery = useCallback(() => {
    setGalleryIndex(null);
    galleryTouchStartRef.current = null;
  }, []);

  const scrollToSlide = useCallback(
    (index: number) => {
      const scroller = scrollerRef.current;
      const nextIndex = clampImageIndex(index, images.length);

      setActiveIndex(nextIndex);

      if (!scroller) return;

      const slide = scroller.children[nextIndex];
      if (slide instanceof HTMLElement) {
        scroller.scrollTo({
          left: slide.offsetLeft,
          behavior: "smooth",
        });
      }
    },
    [images.length],
  );

  const showPreviousSlide = useCallback(() => {
    if (images.length <= 1 || activeImageIndex === 0) return;
    scrollToSlide(activeImageIndex - 1);
  }, [activeImageIndex, images.length, scrollToSlide]);

  const showNextSlide = useCallback(() => {
    if (images.length <= 1 || activeImageIndex === images.length - 1) return;
    scrollToSlide(activeImageIndex + 1);
  }, [activeImageIndex, images.length, scrollToSlide]);

  const showNextGalleryImage = useCallback(() => {
    setGalleryIndex((current) => {
      if (current === null || images.length <= 1 || current === images.length - 1) return current;
      return current + 1;
    });
  }, [images.length]);

  const showPreviousGalleryImage = useCallback(() => {
    setGalleryIndex((current) => {
      if (current === null || images.length <= 1 || current === 0) return current;
      return current - 1;
    });
  }, [images.length]);

  useEffect(() => {
    setActiveIndex((current) => clampImageIndex(current, images.length));
    setGalleryIndex((current) =>
      current === null || images.length === 0
        ? null
        : clampImageIndex(current, images.length),
    );
  }, [images.length]);

  useEffect(() => {
    return () => {
      if (
        typeof window !== "undefined" &&
        scrollAnimationFrameRef.current !== null
      ) {
        window.cancelAnimationFrame(scrollAnimationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (galleryIndex === null || typeof document === "undefined") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [galleryIndex]);

  useEffect(() => {
    if (galleryIndex === null || typeof window === "undefined") return;

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        closeGallery();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        showNextGalleryImage();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showPreviousGalleryImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    closeGallery,
    galleryIndex,
    showNextGalleryImage,
    showPreviousGalleryImage,
  ]);

  const handleSlideKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    index: number,
    hasFailed: boolean,
  ) => {
    if (mode !== "feed" || hasFailed) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openGallery(index);
    }
  };

  const handleGalleryPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    galleryTouchStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handleGalleryPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = galleryTouchStartRef.current;
    galleryTouchStartRef.current = null;
    if (!start || images.length <= 1) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;

    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) {
      return;
    }

    if (deltaX < 0) {
      showNextGalleryImage();
      return;
    }

    showPreviousGalleryImage();
  };

  if (images.length === 0) return null;

  return (
    <div className="relative overflow-hidden bg-slate-50">
      <div
        ref={scrollerRef}
        onScroll={scheduleActiveIndexUpdate}
        className="readative-scrollbar-hidden flex snap-x snap-mandatory overflow-x-auto"
      >
        {images.map((image, index) => {
          const imageKey = `${image.optimizedAt}-${index}-${image.dataUrl.length}`;
          const isLoaded = Boolean(loadedImages[imageKey]);
          const hasFailed = Boolean(failedImages[imageKey]);
          const canShowImmediately = mode === "composer";
          const shouldShowImage = !hasFailed && (isLoaded || canShowImmediately);

          return (
            <figure
              key={imageKey}
              role={mode === "feed" && !hasFailed ? "button" : undefined}
              tabIndex={mode === "feed" && !hasFailed ? 0 : undefined}
              aria-label={
                mode === "feed" && !hasFailed
                  ? `Open image ${index + 1} of ${images.length}`
                  : undefined
              }
              onClick={() => {
                if (!hasFailed) {
                  openGallery(index);
                }
              }}
              onKeyDown={(event) => handleSlideKeyDown(event, index, hasFailed)}
              className={`${getSlideClassName(layout, mode)} relative shrink-0 snap-center overflow-hidden bg-slate-100 ${
                mode === "feed" && !hasFailed
                  ? "cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2"
                  : ""
              }`}
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
                  className={`relative h-full w-full object-contain transition-opacity duration-500 ${
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
        <>
          <button
            type="button"
            onClick={showPreviousSlide}
            disabled={activeImageIndex === 0}
            className="absolute left-3 top-1/2 z-20 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-lg shadow-slate-950/10 ring-1 ring-slate-200/80 transition-colors hover:bg-white hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-30 disabled:pointer-events-none"
            aria-label="Previous image"
            title="Previous image"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={showNextSlide}
            disabled={activeImageIndex === images.length - 1}
            className="absolute right-3 top-1/2 z-20 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-lg shadow-slate-950/10 ring-1 ring-slate-200/80 transition-colors hover:bg-white hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-30 disabled:pointer-events-none"
            aria-label="Next image"
            title="Next image"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="pointer-events-none absolute bottom-4 right-5 rounded-full bg-slate-950/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur-md">
            {activeImageIndex + 1}/{images.length}
          </div>
        </>
      )}

      {activeGalleryImage &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex touch-pan-y select-none items-center justify-center bg-slate-950/95 px-4 py-6 text-white sm:px-6"
            role="dialog"
            aria-modal="true"
            aria-label="Image gallery"
            onPointerDown={handleGalleryPointerDown}
            onPointerUp={handleGalleryPointerUp}
          >
            <button
              type="button"
              onClick={closeGallery}
              className="absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              aria-label="Close image gallery"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="absolute left-4 top-4 z-20 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black tracking-[0.16em] text-white backdrop-blur-md">
              {(activeGalleryIndex ?? 0) + 1}/{images.length}
            </div>

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={showPreviousGalleryImage}
                  disabled={activeGalleryIndex === 0}
                  className="absolute left-3 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-30 disabled:pointer-events-none sm:h-12 sm:w-12"
                  aria-label="Previous image"
                  title="Previous"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={showNextGalleryImage}
                  disabled={activeGalleryIndex === images.length - 1}
                  className="absolute right-3 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-30 disabled:pointer-events-none sm:h-12 sm:w-12"
                  aria-label="Next image"
                  title="Next"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}

            <img
              key={`${activeGalleryImage.optimizedAt}-${activeGalleryIndex ?? 0}-${activeGalleryImage.dataUrl.length}`}
              src={activeGalleryImage.dataUrl}
              alt={`${altBase} ${(activeGalleryIndex ?? 0) + 1}`}
              loading="eager"
              decoding="async"
              width={activeGalleryImage.width}
              height={activeGalleryImage.height}
              className="max-h-full max-w-full object-contain"
            />
          </div>,
          document.body,
        )}
    </div>
  );
});
