import { useState, useEffect, useRef } from "react";
import { Award, Bookmark, MoreVertical, Pencil, Share2, Trash2 } from "lucide-react";
import { ProfileAvatar } from "../ProfileAvatar";
import { ProfileSocialLinks } from "../ProfileSocialLinks";
import { cn } from "../../utils/classNames";
import { CardHeaderProps } from "./cardTypes";
import { buildProfilePath } from "./cardHelpers";

export function CardHeader({
  resolvedAuthorId,
  authorProfile,
  authorDisplayName,
  authorUsername,
  authorReputation,
  reputationTitle,
  shouldShowAuthorSocialLinks,
  canManageEntry,
  isSaved,
  isUpdatingSave,
  isDeleting,
  onOpenAuthorProfile,
  onSaveToggle,
  onShare,
  setShowEditModal,
  onDeleteEntry,
}: CardHeaderProps) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!actionsOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        actionsMenuRef.current &&
        !actionsMenuRef.current.contains(event.target as Node)
      ) {
        setActionsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActionsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [actionsOpen]);

  const handlePostMenuAction = (action: () => void | Promise<void>) => {
    setActionsOpen(false);
    void action();
  };

  const authorProfilePath = buildProfilePath(resolvedAuthorId);

  return (
    <div className="px-4 pb-3 pt-4 sm:px-5 sm:pb-4 sm:pt-5">
      <div className="flex items-start gap-3.5">
        <a
          href={authorProfilePath}
          onClick={(event) => {
            event.preventDefault();
            onOpenAuthorProfile(resolvedAuthorId);
          }}
          className="shrink-0 rounded-full transition-transform hover:scale-[1.01]"
          aria-label={`Open ${authorDisplayName}'s profile`}
        >
          <ProfileAvatar
            authorId={resolvedAuthorId}
            image={authorProfile?.profileImage}
            photoUrl={authorProfile?.photoUrl}
            username={authorDisplayName}
            size="sm"
            className="border-slate-200"
          />
        </a>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <a
              href={authorProfilePath}
              onClick={(event) => {
                event.preventDefault();
                onOpenAuthorProfile(resolvedAuthorId);
              }}
              className="min-w-0 truncate text-left text-sm font-extrabold text-slate-900 transition-colors hover:text-emerald-700 sm:text-[15px]"
            >
              {authorDisplayName}
            </a>
            {shouldShowAuthorSocialLinks && (
              <ProfileSocialLinks
                socialLinks={authorProfile?.socialLinks || {}}
                compact
                iconOnly
                className="shrink-0"
              />
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] font-medium leading-5 text-slate-500">
            <span>@{authorUsername}</span>
            {authorReputation && (
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50/70 text-emerald-700"
                title={reputationTitle}
                aria-label={reputationTitle}
              >
                <Award className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        </div>

        <div ref={actionsMenuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setActionsOpen((current) => !current)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-400 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
            aria-label="Open post actions"
            aria-expanded={actionsOpen}
            aria-haspopup="menu"
            title="Post actions"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {actionsOpen && (
            <div
              role="menu"
              className="readative-menu-surface absolute right-0 top-11 z-40 w-52 py-1.5 text-sm"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => handlePostMenuAction(onSaveToggle)}
                disabled={isUpdatingSave}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left font-bold text-slate-700 transition-colors hover:bg-sky-50 hover:text-sky-700 disabled:opacity-60"
              >
                <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} />
                {isSaved ? "Remove saved post" : "Save post"}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => handlePostMenuAction(onShare)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left font-bold text-slate-700 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
              >
                <Share2 className="h-4 w-4" />
                Share post
              </button>
              {canManageEntry && (
                <>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() =>
                      handlePostMenuAction(() => setShowEditModal(true))
                    }
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left font-bold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit post
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handlePostMenuAction(onDeleteEntry)}
                    disabled={isDeleting}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left font-bold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete post
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
