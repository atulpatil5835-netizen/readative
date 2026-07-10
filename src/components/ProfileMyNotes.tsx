import { useEffect, useState } from "react";
import { BookOpenText, Highlighter, Trash2 } from "lucide-react";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import type { KnowledgeEntry } from "../types";
import type { NotebookHighlight } from "../highlights/types";
import { getNotebookPreview } from "../highlights/paragraphs";
import { useNotebook } from "../context/NotebookContext";
import { navigateToRoute } from "../utils/routes";

interface NoteRow {
  postId: string;
  highlights: NotebookHighlight[];
}

export default function ProfileMyNotes({ userId }: { userId: string }) {
  const {
    notesCacheVersion,
    readCachedMyNotesFirstPage,
    loadMyNotesFirstPage,
    loadMyNotesPage,
    deleteNotebookPostHighlights,
  } = useNotebook();
  const cachedFirstPage = readCachedMyNotesFirstPage();
  const [notes, setNotes] = useState<NoteRow[]>(
    () => cachedFirstPage?.items || [],
  );
  const [posts, setPosts] = useState<Map<string, KnowledgeEntry>>(
    () => cachedFirstPage?.posts || new Map(),
  );
  const [isLoading, setIsLoading] = useState(!cachedFirstPage);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [cursor, setCursor] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(
      () => cachedFirstPage?.cursor || null,
    );
  const [hasMore, setHasMore] = useState(cachedFirstPage?.hasMore || false);
  const [error, setError] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cachedPage = readCachedMyNotesFirstPage();
    if (cachedPage) {
      setNotes(cachedPage.items);
      setPosts(cachedPage.posts);
      setCursor(cachedPage.cursor);
      setHasMore(cachedPage.hasMore);
      setIsLoading(false);
      setError(null);
      return () => {
        cancelled = true;
      };
    }
    setIsLoading(true);
    setError(null);
    void loadMyNotesFirstPage()
      .then((page) => {
        if (cancelled) return;
        setNotes(page.items);
        setPosts(page.posts);
        setCursor(page.cursor);
        setHasMore(page.hasMore);
      })
      .catch((loadError) => {
        console.error("Failed to load My Notes:", loadError);
        if (!cancelled) setError("My Notes could not be loaded right now.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    loadMyNotesFirstPage,
    notesCacheVersion,
    readCachedMyNotesFirstPage,
    userId,
  ]);

  const handleLoadMore = async () => {
    if (!cursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = await loadMyNotesPage(cursor);
      setNotes((current) => {
        const known = new Set(current.map((item) => item.postId));
        return [...current, ...page.items.filter((item) => !known.has(item.postId))];
      });
      setPosts((current) => new Map([...current, ...page.posts]));
      setCursor(page.cursor);
      setHasMore(page.hasMore && page.items.length > 0);
    } catch (loadError) {
      console.error("Failed to load more notes:", loadError);
      setError("More notes could not be loaded right now.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!window.confirm("Delete all highlights from this post?")) return;
    setDeletingPostId(postId);
    try {
      await deleteNotebookPostHighlights(postId);
      setNotes((current) => current.filter((item) => item.postId !== postId));
      setPosts((current) => {
        const next = new Map(current);
        next.delete(postId);
        return next;
      });
    } catch (deleteError) {
      console.error("Failed to delete highlights:", deleteError);
      setError("Highlights could not be deleted right now.");
    } finally {
      setDeletingPostId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4" aria-label="Loading My Notes">
        {[0, 1].map((item) => (
          <div
            key={item}
            className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white"
          />
        ))}
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center">
        <Highlighter className="mx-auto h-7 w-7 text-amber-500" />
        <p className="mt-3 text-sm font-bold text-slate-600">No highlights yet.</p>
        <p className="mt-1 text-xs text-slate-400">
          Open a post and use its Notebook Highlight icon.
        </p>
        {error && <p className="mt-3 text-xs font-semibold text-rose-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}
      {notes.map(({ postId, highlights }) => {
        const post = posts.get(postId);
        const preview = post ? getNotebookPreview(post.content, highlights) : null;
        const highlightLabel = `${highlights.length} ${
          highlights.length === 1 ? "highlight" : "highlights"
        }`;
        return (
          <article
            key={postId}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="truncate text-base font-black text-slate-950 sm:text-lg">
                  {post?.title || "Post unavailable"}
                </h3>
                <p className="mt-0.5 text-xs font-semibold text-slate-400">
                  {post ? `by @${post.author}` : "The original post is no longer available"}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  {post ? new Date(post.createdAt).toLocaleDateString() : "Date unavailable"}
                  <span aria-hidden="true"> · </span>
                  {highlightLabel}
                </p>
              </div>
              <Highlighter className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            </div>

            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              {preview ? (
                <p className="line-clamp-2 text-sm leading-6 text-slate-700">
                  <mark className="readative-notebook-highlight">{preview}</mark>
                </p>
              ) : (
                <p className="text-sm text-slate-400">
                  Highlight preview is unavailable for the current post text.
                </p>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={!post}
                onClick={() =>
                  navigateToRoute("knowledge", {
                    focusedEntryId: postId,
                    seoTitle: post?.title,
                  })
                }
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-black text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <BookOpenText className="h-3.5 w-3.5" />
                Continue Reading
              </button>
              <button
                type="button"
                disabled={deletingPostId === postId}
                onClick={() => void handleDelete(postId)}
                aria-label={`Delete highlights from ${post?.title || "unavailable post"}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </article>
        );
      })}
      {hasMore && (
        <button
          type="button"
          disabled={isLoadingMore}
          onClick={() => void handleLoadMore()}
          className="mx-auto block rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 transition-colors hover:border-amber-200 hover:text-amber-700 disabled:opacity-50"
        >
          {isLoadingMore ? "Loading…" : "Load more notes"}
        </button>
      )}
    </div>
  );
}
