import { lazy, Suspense, useMemo, useRef } from "react";
import { ProfileAvatar } from "../ProfileAvatar";
import { renderRichText } from "../../utils/renderRichText";
import { CardContentProps } from "./cardTypes";
import { buildProfilePath, buildTagPath } from "./cardHelpers";
import { buildInkBlockKey } from "../../ink/blockKey";

const InkSurface = lazy(() => import("../../ink/InkSurface"));

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
  currentUserId,
  isFocusedPost,
  isInkMode,
  shouldRenderInk,
  inkColor,
  inkWidth,
  onPostHasInk,
  onInkStatus,
}: CardContentProps) {
  const inkHostRef = useRef<HTMLDivElement | null>(null);
  const blockKeys = useMemo(() => {
    const occurrences = new Map<string, number>();
    return contentSections.map((section) => {
      const normalized = section.replace(/\s+/g, " ").trim();
      const occurrence = occurrences.get(normalized) || 0;
      occurrences.set(normalized, occurrence + 1);
      return buildInkBlockKey(section, occurrence);
    });
  }, [contentSections]);

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
            ref={inkHostRef}
            className="relative mt-6 space-y-0 text-[15px] leading-7 text-slate-700 sm:text-base sm:leading-8"
          >
            {contentSections.map((section, index) => (
                <div
                  key={`${entry.id}-section-${index}`}
                  data-ink-block-key={blockKeys[index]}
                  data-ink-block-ordinal={index}
                >
                  {index > 0 && (
                    <div
                      className="my-6 border-t border-slate-100"
                      aria-hidden="true"
                    />
                  )}
                  <p
                    className={`whitespace-pre-wrap ${
                      isFocusedPost && isInkMode ? "select-none" : "select-text"
                    }`}
                  >
                    {renderRichText({
                      text: section,
                      mentions,
                      onOpenProfile: onOpenAuthorProfile,
                    })}
                  </p>
                </div>
              ))}
            {shouldRenderInk && currentUserId && (
              <Suspense fallback={null}>
                <InkSurface
                  hostRef={inkHostRef}
                  userId={currentUserId}
                  postId={entry.id}
                  content={entry.content}
                  isInkMode={isFocusedPost && isInkMode}
                  color={inkColor}
                  width={inkWidth}
                  onPostHasInk={onPostHasInk}
                  onStatus={onInkStatus}
                />
              </Suspense>
            )}
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
