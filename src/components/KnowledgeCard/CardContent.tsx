import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Globe2 } from "lucide-react";
import { ProfileAvatar } from "../ProfileAvatar";
import { renderRichText } from "../../utils/renderRichText";
import { buildPublicPath } from "../../utils/routes";
import { CardContentProps } from "./cardTypes";
import { buildProfilePath, buildTagPath } from "./cardHelpers";
import {
  buildNotebookParagraphIds,
  getRenderedParagraphText,
} from "../../highlights/paragraphs";
import { highlightNotebookReactTree } from "../../highlights/highlightReactTree";
import {
  NOTEBOOK_HIGHLIGHT_COLOR,
  isSameNotebookRange,
  normalizeNotebookHighlightText,
  type NotebookHighlight,
} from "../../highlights/types";
import { useNotebook } from "../../context/NotebookContext";

interface ProductResourceLink {
  label: string;
  url: string;
  host: string;
}

const PRODUCT_LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi;

function isSafeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getProductResourceLinks(text: string): ProductResourceLink[] {
  const seenUrls = new Set<string>();

  return Array.from(text.matchAll(PRODUCT_LINK_PATTERN)).flatMap((match) => {
    const label = match[1]?.trim();
    const url = match[2]?.trim();
    if (!label || !url || !isSafeExternalUrl(url) || seenUrls.has(url)) {
      return [];
    }

    seenUrls.add(url);
    return [{ label, url, host: new URL(url).hostname.replace(/^www\./i, "") }];
  });
}

function getParagraphTextWithoutInlineProductLinks(text: string) {
  return text.replace(PRODUCT_LINK_PATTERN, (match, label: string, url: string) =>
    isSafeExternalUrl(url) ? label : match,
  );
}

function getNodeElement(node: Node) {
  return node.nodeType === Node.ELEMENT_NODE
    ? (node as Element)
    : node.parentElement;
}

function getTextOffset(root: HTMLElement, node: Node, offset: number) {
  if (node !== root && !root.contains(node)) return null;
  const range = document.createRange();
  range.selectNodeContents(root);
  try {
    range.setEnd(node, offset);
    return range.toString().length;
  } catch {
    return null;
  }
}

export function CardContent({
  entry,
  contentSections,
  mentions,
  profileMap,
  onOpenAuthorProfile,
  onOpenEntryDetails,
  onSelectHashtag,
  topComment,
  topCommentProfile,
  topCommentDisplayName,
  topCommentUsername,
  currentUserId,
  isFocusedPost,
  isNotebookMode,
  onExitNotebookMode,
  hideHashtags = false,
}: CardContentProps) {
  const [highlights, setHighlights] = useState<NotebookHighlight[]>([]);
  const [armedParagraphId, setArmedParagraphId] = useState<string | null>(null);
  const [isNotebookReady, setIsNotebookReady] = useState(false);
  const [notebookStatus, setNotebookStatus] = useState("");
  const paragraphIds = useMemo(
    () => buildNotebookParagraphIds(contentSections),
    [contentSections],
  );
  const resolvedMentions = useMemo(
    () =>
      mentions.map((mention) => {
        const profile = profileMap.get(mention.authorId);

        return profile?.username
          ? { ...mention, username: profile.username }
          : mention;
      }),
    [mentions, profileMap],
  );
  const {
    cacheVersion,
    readNotebookPostHighlights,
    loadNotebookPostHighlights,
    saveNotebookPostHighlight,
  } = useNotebook();

  useEffect(() => {
    if (!currentUserId || !isFocusedPost) {
      setHighlights([]);
      setIsNotebookReady(false);
      setArmedParagraphId(null);
      return;
    }
    let cancelled = false;
    const cachedHighlights = readNotebookPostHighlights(entry.id);
    if (cachedHighlights) {
      setHighlights(cachedHighlights);
      setIsNotebookReady(true);
    } else {
      setIsNotebookReady(false);
    }
    void loadNotebookPostHighlights(entry.id)
      .then((loadedHighlights) => {
        if (!cancelled) {
          setHighlights(loadedHighlights);
          setIsNotebookReady(true);
        }
      })
      .catch((error) => {
        console.error("Failed to load Notebook Highlights:", error);
        if (!cancelled) {
          setNotebookStatus("Highlights could not be loaded right now.");
          setIsNotebookReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    cacheVersion,
    currentUserId,
    entry.id,
    isFocusedPost,
    loadNotebookPostHighlights,
    readNotebookPostHighlights,
  ]);

  useEffect(() => {
    if (!isNotebookMode) setArmedParagraphId(null);
  }, [isNotebookMode]);

  useEffect(
    () => () => {
      if (isNotebookMode) onExitNotebookMode();
    },
    [isNotebookMode, onExitNotebookMode],
  );

  const saveNotebookHighlight = useCallback(
    (
      highlight: NotebookHighlight,
      options: { exitNotebookMode?: boolean; savedMessage?: string } = {},
    ) => {
      setArmedParagraphId(null);
      setIsNotebookReady(false);
      setNotebookStatus("Saving highlight...");
      if (options.exitNotebookMode) onExitNotebookMode();

      void saveNotebookPostHighlight(entry.id, highlight)
        .then((result) => {
          setHighlights(result.highlights);
          setNotebookStatus(
            result.saved
              ? options.savedMessage || "Highlight saved."
              : "Highlight already saved.",
          );
          setIsNotebookReady(true);
        })
        .catch((error) => {
          console.error("Failed to save Notebook Highlight:", error);
          setNotebookStatus("Highlight was not saved.");
          setIsNotebookReady(true);
        });
    },
    [entry.id, onExitNotebookMode, saveNotebookPostHighlight],
  );

  const captureSelection = useCallback(() => {
    if (
      !currentUserId ||
      !isFocusedPost ||
      !isNotebookMode ||
      !armedParagraphId ||
      !isNotebookReady
    ) {
      return;
    }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    const startParagraph = getNodeElement(range.startContainer)?.closest<HTMLElement>(
      "[data-notebook-paragraph-id]",
    );
    const endParagraph = getNodeElement(range.endContainer)?.closest<HTMLElement>(
      "[data-notebook-paragraph-id]",
    );
    if (
      !startParagraph ||
      startParagraph !== endParagraph ||
      startParagraph.dataset.notebookParagraphId !== armedParagraphId
    ) {
      selection.removeAllRanges();
      return;
    }
    const rawStart = getTextOffset(
      startParagraph,
      range.startContainer,
      range.startOffset,
    );
    const rawEnd = getTextOffset(
      startParagraph,
      range.endContainer,
      range.endOffset,
    );
    if (rawStart === null || rawEnd === null || rawStart >= rawEnd) {
      selection.removeAllRanges();
      return;
    }
    const paragraphText = startParagraph.textContent || "";
    let startOffset = rawStart;
    let endOffset = rawEnd;
    while (startOffset < endOffset && /\s/.test(paragraphText[startOffset] || "")) {
      startOffset += 1;
    }
    while (endOffset > startOffset && /\s/.test(paragraphText[endOffset - 1] || "")) {
      endOffset -= 1;
    }
    if (startOffset >= endOffset) {
      selection.removeAllRanges();
      return;
    }
    const highlight: NotebookHighlight = {
      postId: entry.id,
      paragraphId: armedParagraphId,
      startOffset,
      endOffset,
      color: NOTEBOOK_HIGHLIGHT_COLOR,
      createdAt: Date.now(),
      text: normalizeNotebookHighlightText(
        paragraphText.slice(startOffset, endOffset),
      ),
    };
    const existingHighlight = highlights.find((item) =>
      isSameNotebookRange(item, highlight),
    );
    if (existingHighlight?.text) {
      selection.removeAllRanges();
      setArmedParagraphId(null);
      onExitNotebookMode();
      return;
    }
    selection.removeAllRanges();
    saveNotebookHighlight(highlight, { exitNotebookMode: true });
  }, [
    armedParagraphId,
    currentUserId,
    entry.id,
    highlights,
    isFocusedPost,
    isNotebookMode,
    isNotebookReady,
    onExitNotebookMode,
    saveNotebookHighlight,
  ]);

  const saveFullParagraphHighlight = useCallback(
    (paragraphId: string, paragraphText: string, paragraphNumber: number) => {
      if (!currentUserId || !isFocusedPost || !isNotebookMode || !isNotebookReady) {
        return;
      }

      const noteText = normalizeNotebookHighlightText(paragraphText);
      if (!noteText) return;

      const highlight: NotebookHighlight = {
        postId: entry.id,
        paragraphId,
        startOffset: 0,
        endOffset: paragraphText.length,
        color: NOTEBOOK_HIGHLIGHT_COLOR,
        createdAt: Date.now(),
        text: noteText,
      };

      const existingHighlight = highlights.find((item) =>
        isSameNotebookRange(item, highlight),
      );
      if (existingHighlight?.text) {
        setNotebookStatus(`Paragraph ${paragraphNumber} is already saved.`);
        return;
      }

      saveNotebookHighlight(highlight, {
        savedMessage: `Paragraph ${paragraphNumber} saved.`,
      });
    },
    [
      currentUserId,
      entry.id,
      highlights,
      isFocusedPost,
      isNotebookMode,
      isNotebookReady,
      saveNotebookHighlight,
    ],
  );

  const scheduleSelectionCapture = useCallback(() => {
    window.requestAnimationFrame(captureSelection);
  }, [captureSelection]);

  return (
    <div>
      <div>
        <a
          href={buildPublicPath("knowledge", {
            focusedEntryId: entry.id,
            seoTitle: entry.title,
          })}
          onClick={(e) => {
            e.preventDefault();
            onOpenEntryDetails();
          }}
          className="text-left transition-colors hover:text-emerald-700"
        >
          <h3 className="text-[1.55rem] font-extrabold leading-[1.14] tracking-[-0.018em] text-slate-950 sm:text-[2rem] sm:leading-[1.12]">
            {entry.title}
          </h3>
        </a>

        {contentSections.length > 0 && (
          <div className="readative-reading-body relative mt-5 space-y-0 text-[15.5px] leading-[1.72] text-slate-700 sm:mt-6 sm:text-[16.5px] sm:leading-[1.76]">
            {contentSections.map((section, index) => {
              const paragraphId = paragraphIds[index];
              const productLinks = getProductResourceLinks(section);
              const paragraphSource =
                productLinks.length > 0
                  ? getParagraphTextWithoutInlineProductLinks(section)
                  : section;
              const renderedParagraphText = getRenderedParagraphText(section);
              const renderedParagraphLength = renderedParagraphText.length;
              const paragraphHighlights = highlights.filter(
                (highlight) =>
                  highlight.paragraphId === paragraphId &&
                  highlight.endOffset <= renderedParagraphLength,
              );
              const hasFullParagraphHighlight = paragraphHighlights.some(
                (highlight) =>
                  Boolean(highlight.text?.trim()) &&
                  highlight.startOffset === 0 &&
                  highlight.endOffset >= renderedParagraphLength,
              );
              const richText = renderRichText({
                text: paragraphSource,
                mentions: resolvedMentions,
                onOpenProfile: onOpenAuthorProfile,
              });
              const isArmed = armedParagraphId === paragraphId;
              return (
                <div key={`${entry.id}-section-${index}`}>
                  {index > 0 && (
                    <div
                      className="my-6 border-t border-slate-100/90"
                      aria-hidden="true"
                    />
                  )}
                  <div
                    className={`relative ${
                      isFocusedPost && isNotebookMode ? "pl-9 sm:pl-10" : ""
                    }`}
                  >
                    {isFocusedPost && isNotebookMode && (
                      <div className="absolute left-0 top-0 flex w-7 flex-col items-center gap-1">
                        <button
                          type="button"
                          disabled={!isNotebookReady || hasFullParagraphHighlight}
                          onClick={() =>
                            saveFullParagraphHighlight(
                              paragraphId,
                              renderedParagraphText,
                              index + 1,
                            )
                          }
                          aria-label={
                            hasFullParagraphHighlight
                              ? `Paragraph ${index + 1} is saved`
                              : `Save paragraph ${index + 1} to My Notes`
                          }
                          title={
                            hasFullParagraphHighlight
                              ? `Paragraph ${index + 1} saved`
                              : `Save paragraph ${index + 1}`
                          }
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-[11px] font-black leading-none text-amber-700 transition-colors hover:border-amber-300 hover:bg-amber-100 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300"
                        >
                          {index + 1}
                        </button>
                        <button
                          type="button"
                          disabled={!isNotebookReady}
                          onClick={() => setArmedParagraphId(paragraphId)}
                          aria-label={`Select text in paragraph ${index + 1}`}
                          aria-pressed={isArmed}
                          title={`Select text in paragraph ${index + 1}`}
                          className="readative-notebook-margin-control flex h-6 w-4 items-center justify-center disabled:opacity-40"
                        >
                          <span aria-hidden="true" />
                        </button>
                      </div>
                    )}
                    <p
                      data-notebook-paragraph-id={paragraphId}
                      onMouseUp={scheduleSelectionCapture}
                      onTouchEnd={scheduleSelectionCapture}
                      onKeyUp={scheduleSelectionCapture}
                      tabIndex={isArmed ? 0 : undefined}
                      onClickCapture={(event) => {
                        const selection = window.getSelection();
                        if (isArmed && selection && !selection.isCollapsed) {
                          event.preventDefault();
                        }
                      }}
                      className={`readative-reading-paragraph whitespace-pre-wrap ${
                        isFocusedPost && isNotebookMode && !isArmed
                          ? "select-none"
                          : "select-text"
                      }`}
                    >
                      {paragraphHighlights.length > 0
                        ? highlightNotebookReactTree(
                            richText,
                            paragraphHighlights,
                          )
                        : richText}
                    </p>
                    {productLinks.length > 0 && (
                      <div
                        role="group"
                        className="mt-3 flex flex-wrap gap-2"
                        aria-label="Links mentioned in this post"
                      >
                        {productLinks.map((link) => (
                          <a
                            key={`${paragraphId}-${link.url}`}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            aria-label={`Visit ${link.label} at ${link.host}`}
                            className="group inline-flex w-fit max-w-full items-center gap-3 rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50/80 to-white px-3 py-2.5 text-left shadow-sm shadow-emerald-950/[0.03] transition hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-950/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-white text-emerald-700 shadow-sm">
                              <Globe2
                                className="h-[18px] w-[18px]"
                                aria-hidden="true"
                              />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold leading-5 text-slate-800 group-hover:text-emerald-800">
                                {link.label}
                              </span>
                              <span className="block truncate text-xs leading-4 text-slate-500">
                                {link.host}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-700">
                              <span className="hidden sm:inline">Visit</span>
                              <ArrowUpRight
                                className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                                aria-hidden="true"
                              />
                            </span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <span className="sr-only" role="status" aria-live="polite">
              {notebookStatus}
            </span>
          </div>
        )}
      </div>

      {!hideHashtags && entry.hashtags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {entry.contentKind && (
            <span className="rounded-full border border-slate-200/80 bg-slate-50/70 px-3 py-1 text-xs font-semibold capitalize text-slate-500">
              {entry.contentKind}
            </span>
          )}
          {entry.hashtags.map((tag) => (
            <a
              key={tag}
              href={buildTagPath(tag)}
              onClick={(event) => {
                event.preventDefault();
                onSelectHashtag(tag);
              }}
              className="rounded-full border border-slate-200/80 bg-slate-50/70 px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
            >
              #{tag}
            </a>
          ))}
        </div>
      )}

      {resolvedMentions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {resolvedMentions.map((mention) => (
            <a
              key={`${mention.authorId}-${mention.username}`}
              href={buildProfilePath(mention.authorId, mention.username)}
              onClick={(event) => {
                event.preventDefault();
                onOpenAuthorProfile(mention.authorId, mention.username);
              }}
              className="rounded-full bg-slate-100/80 px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
            >
              @{mention.username}
            </a>
          ))}
        </div>
      )}

      {topComment && (
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Top comment
          </p>
          <div className="flex items-start gap-3">
            <ProfileAvatar
              authorId={topComment.authorId || topComment.id}
              image={
                topComment.authorId ? topCommentProfile?.profileImage : undefined
              }
              photoUrl={
                topComment.authorId ? topCommentProfile?.photoUrl : undefined
              }
              username={topCommentDisplayName}
              size="xs"
              className="border-slate-200"
            />
            <div className="min-w-0 flex-1">
              {topComment.authorId ? (
                <a
                  href={buildProfilePath(
                    topComment.authorId,
                    topCommentProfile?.username || topCommentUsername,
                  )}
                  onClick={(event) => {
                    event.preventDefault();
                    onOpenAuthorProfile(
                      topComment.authorId,
                      topCommentProfile?.username || topCommentUsername,
                    );
                  }}
                  className="text-xs font-semibold text-slate-800 transition-colors hover:text-emerald-700"
                >
                  {topCommentDisplayName}
                </a>
              ) : (
                <span className="text-xs font-semibold text-slate-800">
                  {topCommentDisplayName}
                </span>
              )}
              {topCommentUsername && (
                <p className="text-[11px] font-semibold text-slate-400">
                  @{topCommentUsername}
                </p>
              )}
              <p className="line-clamp-2 text-sm leading-6 text-slate-600">
                {renderRichText({
                  text: topComment.text,
                  mentions: (topComment.mentions || []).map((mention) => {
                    const profile = profileMap.get(mention.authorId);
                    return profile?.username
                      ? { ...mention, username: profile.username }
                      : mention;
                  }),
                  onOpenProfile: onOpenAuthorProfile,
                })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
