import { ProfileAvatar } from "../ProfileAvatar";
import { CommentSkeleton } from "../Skeletons";
import { renderRichText } from "../../utils/renderRichText";
import { CardCommentsProps } from "./cardTypes";
import { buildProfilePath, getProfileDisplayName } from "./cardHelpers";

export function CardComments({
  entry,
  activeIdentity,
  commentText,
  setCommentText,
  commentInputRef,
  commentMessage,
  isCommenting,
  isModeratingComment,
  activeCommentMention,
  filteredCommentMentionProfiles,
  localComments,
  profileMap,
  onCommentSubmit,
  onCommentMentionInsert,
  onOpenAuthorProfile,
  updateCommentMentionState,
  setCommentMessage,
  onIdentityRequired,
}: CardCommentsProps) {
  return (
    <div className="border-t border-slate-100 bg-slate-50/70 p-5">
      {activeIdentity && (
        <p className="mb-3 text-xs text-slate-400">
          Commenting as{" "}
          <span className="font-semibold text-slate-600">
            @{activeIdentity.displayName}
          </span>
        </p>
      )}

      <div className="relative">
        <div className="flex gap-3">
          <input
            ref={commentInputRef}
            value={commentText}
            onChange={(event) => {
              setCommentText(event.target.value);
              updateCommentMentionState(
                event.target.value,
                event.target.selectionStart || event.target.value.length,
              );
              if (commentMessage) setCommentMessage(null);
            }}
            onClick={(event) => {
              if (!activeIdentity) {
                onIdentityRequired({ type: "comment", entryId: entry.id });
                return;
              }

              updateCommentMentionState(
                event.currentTarget.value,
                event.currentTarget.selectionStart ||
                  event.currentTarget.value.length,
              );
            }}
            onFocus={() => {
              if (!activeIdentity) {
                onIdentityRequired({ type: "comment", entryId: entry.id });
              }
            }}
            onKeyDown={(event) =>
              event.key === "Enter" &&
              !event.shiftKey &&
              onCommentSubmit()
            }
            placeholder={
              activeIdentity
                ? `Commenting as @${activeIdentity.displayName}...`
                : "Sign in to comment and tag with @username..."
            }
            className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
          />
          <button
            type="button"
            onClick={onCommentSubmit}
            disabled={
              isCommenting || isModeratingComment || !commentText.trim()
            }
            className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
          >
            {isCommenting || isModeratingComment ? "..." : "Post"}
          </button>
        </div>

        {activeCommentMention &&
          filteredCommentMentionProfiles.length > 0 && (
            <div className="absolute left-0 right-16 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
              {filteredCommentMentionProfiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => onCommentMentionInsert(profile)}
                  className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left text-sm last:border-b-0 hover:bg-emerald-50"
                >
                  <span className="font-semibold text-slate-800">
                    @{profile.username}
                  </span>
                  <span className="text-xs text-slate-400">User</span>
                </button>
              ))}
            </div>
          )}
      </div>

      {commentMessage && (
        <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {commentMessage}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {(isCommenting || isModeratingComment) && <CommentSkeleton />}

        {localComments.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-center text-sm text-slate-400">
            No comments yet. Start the discussion.
          </p>
        ) : (
          localComments.map((comment) => {
            const commentProfile = comment.authorId
              ? profileMap.get(comment.authorId)
              : undefined;
            const commentDisplayName = getProfileDisplayName(
              commentProfile,
              comment.author,
            );
            const commentUsername = commentProfile?.username || comment.author;

            return (
              <div
                key={comment.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-1 flex items-start gap-3">
                  <ProfileAvatar
                    authorId={comment.authorId || comment.id}
                    image={commentProfile?.profileImage}
                    photoUrl={commentProfile?.photoUrl}
                    username={commentDisplayName}
                    size="xs"
                    className="border-slate-200"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {comment.authorId ? (
                        <a
                          href={buildProfilePath(comment.authorId)}
                          onClick={(event) => {
                            event.preventDefault();
                            onOpenAuthorProfile(comment.authorId);
                          }}
                          className="text-xs font-bold text-slate-800 transition-colors hover:text-emerald-700"
                        >
                          {commentDisplayName}
                        </a>
                      ) : (
                        <span className="text-xs font-bold text-slate-800">
                          {commentDisplayName}
                        </span>
                      )}
                      <span className="text-[11px] font-semibold text-slate-400">
                        @{commentUsername}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-slate-600">
                      {renderRichText({
                        text: comment.text,
                        mentions: comment.mentions || [],
                        onOpenProfile: onOpenAuthorProfile,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
