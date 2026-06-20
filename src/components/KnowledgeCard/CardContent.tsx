import { ProfileAvatar } from "../ProfileAvatar";
import { renderRichText } from "../../utils/renderRichText";
import { CardContentProps } from "./cardTypes";
import { buildProfilePath, buildTagPath } from "./cardHelpers";
import { highlightReactTree, getAbsoluteOffsets } from "./highlightHelpers";

export function CardContent({
  entry,
  contentSections,
  mentions,
  onOpenAuthorProfile,
  onOpenEntryDetails,
  onSelectHashtag,
  topComment,
  topCommentProfile,
  topCommentDisplayName,
  topCommentUsername,
  isHighlightMode,
  highlights = [],
  onAddHighlight,
  onRemoveHighlight,
}: CardContentProps) {
  const handleTextSelection = () => {
    if (!isHighlightMode || !onAddHighlight) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    const startNode = range.startContainer;
    const paragraphElement = startNode.parentElement?.closest("[data-paragraph-index]") as HTMLElement | null;
    if (!paragraphElement) return;

    const paragraphIndexAttr = paragraphElement.getAttribute("data-paragraph-index");
    if (paragraphIndexAttr === null) return;
    const paragraphIndex = parseInt(paragraphIndexAttr, 10);

    const { startOffset, endOffset } = getAbsoluteOffsets(paragraphElement, range);

    onAddHighlight({
      postId: entry.id,
      postTitle: entry.title,
      authorName: entry.author,
      selectedText,
      paragraphIndex,
      startOffset,
      endOffset,
    });

    selection.removeAllRanges();
  };

  const handleParagraphClick = (e: React.MouseEvent) => {
    if (!onRemoveHighlight) return;
    const target = e.target as HTMLElement;
    const highlightId = target.getAttribute("data-highlight-id");
    if (highlightId) {
      e.stopPropagation();
      if (window.confirm("Remove this highlight?")) {
        void onRemoveHighlight(highlightId);
      }
    }
  };

  return (
    <div>
      <div>
        <a
          href={`/post/${entry.id}`}
          onClick={(e) => {
            e.preventDefault();
            onOpenEntryDetails();
          }}
          className="text-left transition-colors hover:text-emerald-700"
        >
          <h3 className="text-2xl font-black leading-tight tracking-normal text-slate-950 sm:text-3xl">
            {entry.title}
          </h3>
        </a>

        {contentSections.length > 0 && (
          <div
            className="mt-6 space-y-0 text-[15px] leading-7 text-slate-700 sm:text-base sm:leading-8"
            onMouseUp={handleTextSelection}
            onTouchEnd={handleTextSelection}
            onClick={handleParagraphClick}
          >
            {contentSections.map((section, index) => {
              const paragraphHighlights = highlights
                .filter((hl) => hl.paragraphIndex === index)
                .map((hl) => ({
                  startOffset: hl.startOffset,
                  endOffset: hl.endOffset,
                  id: hl.id,
                }));

              return (
                <div key={`${entry.id}-section-${index}`} data-paragraph-index={index}>
                  {index > 0 && (
                    <div
                      className="my-6 border-t border-slate-100"
                      aria-hidden="true"
                    />
                  )}
                  <p className="whitespace-pre-wrap select-text">
                    {highlightReactTree(
                      renderRichText({
                        text: section,
                        mentions,
                        onOpenProfile: onOpenAuthorProfile,
                      }),
                      paragraphHighlights
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {entry.hashtags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {entry.contentKind && (
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black capitalize text-slate-500">
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
              className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100"
            >
              #{tag}
            </a>
          ))}
        </div>
      )}

      {mentions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {mentions.map((mention) => (
            <a
              key={`${mention.authorId}-${mention.username}`}
              href={buildProfilePath(mention.authorId)}
              onClick={(event) => {
                event.preventDefault();
                onOpenAuthorProfile(mention.authorId);
              }}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
            >
              @{mention.username}
            </a>
          ))}
        </div>
      )}

      {topComment && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
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
                  href={buildProfilePath(topComment.authorId)}
                  onClick={(event) => {
                    event.preventDefault();
                    onOpenAuthorProfile(topComment.authorId);
                  }}
                  className="text-xs font-bold text-slate-800 transition-colors hover:text-emerald-700"
                >
                  {topCommentDisplayName}
                </a>
              ) : (
                <span className="text-xs font-bold text-slate-800">
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
                  mentions: topComment.mentions || [],
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
