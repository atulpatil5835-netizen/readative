import { useEffect, useState } from "react";
import { BookOpenText, PenLine, Trash2 } from "lucide-react";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import type { KnowledgeEntry } from "../types";
import type { InkPostDocument } from "../ink/types";
import { InkPreview } from "../ink/InkPreview";
import {
  deleteInkPost,
  loadMyNotes,
  loadNotePosts,
} from "../ink/repository";
import { useInk } from "../context/InkContext";
import { navigateToRoute } from "../utils/routes";

interface NoteRow {
  postId: string;
  note: InkPostDocument;
}

export default function ProfileMyNotes({ userId }: { userId: string }) {
  const { unmarkPostHasInk } = useInk();
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [posts, setPosts] = useState<Map<string, KnowledgeEntry>>(() => new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [cursor, setCursor] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    void loadMyNotes(userId)
      .then(async (page) => {
        const nextPosts = await loadNotePosts(page.items.map((item) => item.postId));
        if (cancelled) return;
        setNotes(page.items);
        setPosts(nextPosts);
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
  }, [userId]);

  const handleLoadMore = async () => {
    if (!cursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = await loadMyNotes(userId, cursor);
      const nextPosts = await loadNotePosts(page.items.map((item) => item.postId));
      setNotes((current) => {
        const known = new Set(current.map((item) => item.postId));
        return [...current, ...page.items.filter((item) => !known.has(item.postId))];
      });
      setPosts((current) => new Map([...current, ...nextPosts]));
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
    if (!window.confirm("Delete all Ink from this post?")) return;
    setDeletingPostId(postId);
    try {
      await deleteInkPost(userId, postId);
      setNotes((current) => current.filter((item) => item.postId !== postId));
      setPosts((current) => {
        const next = new Map(current);
        next.delete(postId);
        return next;
      });
      unmarkPostHasInk(postId);
    } catch (deleteError) {
      console.error("Failed to delete Ink:", deleteError);
      setError("Ink could not be deleted right now.");
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
            className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white"
          />
        ))}
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center">
        <PenLine className="mx-auto h-7 w-7 text-blue-500" />
        <p className="mt-3 text-sm font-bold text-slate-600">No Ink yet.</p>
        <p className="mt-1 text-xs text-slate-400">
          Open a post, tap the pen, then hold and draw.
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
      {notes.map(({ postId, note }) => {
        const post = posts.get(postId);
        const isAvailable = Boolean(post);
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
                  Last annotated {new Date(note.lastAnnotatedAt).toLocaleDateString()}
                </p>
              </div>
              <PenLine className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
              <InkPreview strokes={note.strokes} />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={!isAvailable}
                onClick={() =>
                  navigateToRoute("knowledge", { focusedEntryId: postId })
                }
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-black text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <BookOpenText className="h-3.5 w-3.5" />
                Continue Reading
              </button>
              <button
                type="button"
                disabled={deletingPostId === postId}
                onClick={() => void handleDelete(postId)}
                aria-label={`Delete Ink from ${post?.title || "unavailable post"}`}
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
          className="mx-auto block rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 transition-colors hover:border-blue-200 hover:text-blue-700 disabled:opacity-50"
        >
          {isLoadingMore ? "Loading…" : "Load more notes"}
        </button>
      )}
    </div>
  );
}
