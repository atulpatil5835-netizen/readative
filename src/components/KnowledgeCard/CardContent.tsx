import { useCallback, useEffect, useMemo, useState } from "react";
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
  type NotebookHighlight,
} from "../../highlights/types";
import { useNotebook } from "../../context/NotebookContext";

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
    if (!currentUserId) {
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
    };
    if (highlights.some((item) => isSameNotebookRange(item, highlight))) {
      selection.removeAllRanges();
      setArmedParagraphId(null);
      onExitNotebookMode();
      return;
    }
    selection.removeAllRanges();
    setArmedParagraphId(null);
    setIsNotebookReady(false);
    setNotebookStatus("Saving highlight...");
    onExitNotebookMode();

    void saveNotebookPostHighlight(entry.id, highlight)
      .then((result) => {
        setHighlights(result.highlights);
        setNotebookStatus(result.saved ? "Highlight saved." : "Highlight already saved.");
        setIsNotebookReady(true);
      })
      .catch((error) => {
        console.error("Failed to save Notebook Highlight:", error);
        setNotebookStatus("Highlight was not saved.");
        setIsNotebookReady(true);
      });
  }, [
    armedParagraphId,
    currentUserId,
    entry.id,
    highlights,
    isFocusedPost,
    isNotebookMode,
    isNotebookReady,
    onExitNotebookMode,
    saveNotebookPostHighlight,
  ]);

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
              const renderedParagraphLength = getRenderedParagraphText(section).length;
              const paragraphHighlights = highlights.filter(
                (highlight) =>
                  highlight.paragraphId === paragraphId &&
                  highlight.endOffset <= renderedParagraphLength,
              );
              const richText = renderRichText({
                text: section,
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
                  <div className="relative">
                    {isFocusedPost && isNotebookMode && (
                      <button
                        type="button"
                        disabled={!isNotebookReady}
                        onClick={() => setArmedParagraphId(paragraphId)}
                        aria-label={`Select paragraph ${index + 1} for highlighting`}
                        aria-pressed={isArmed}
                        className="readative-notebook-margin-control absolute right-full top-0 mr-1 flex h-7 w-3 items-center justify-center disabled:opacity-40"
                      >
                        <span aria-hidden="true" />
                      </button>
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

      {entry.hashtags.length > 0 && (
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
