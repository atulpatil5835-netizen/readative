import { useEffect, useState } from "react";
import { Highlighter, Trash2 } from "lucide-react";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import type { NotebookNoteItem } from "../highlights/repository";
import { useNotebook } from "../context/NotebookContext";

function formatNoteDate(value: number) {
  if (!Number.isFinite(value)) return "Date unavailable";

  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ProfileMyNotes({ userId }: { userId: string }) {
  const {
    notesCacheVersion,
    readCachedMyNotesFirstPage,
    loadMyNotesFirstPage,
    loadMyNotesPage,
    deleteNotebookHighlight,
  } = useNotebook();
  const cachedFirstPage = readCachedMyNotesFirstPage();
  const [notes, setNotes] = useState<NotebookNoteItem[]>(
    () => cachedFirstPage?.items || [],
  );
  const [isLoading, setIsLoading] = useState(!cachedFirstPage);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [cursor, setCursor] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(
      () => cachedFirstPage?.cursor || null,
    );
  const [hasMore, setHasMore] = useState(cachedFirstPage?.hasMore || false);
  const [error, setError] = useState<string | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cachedPage = readCachedMyNotesFirstPage();
    if (cachedPage) {
      setNotes(cachedPage.items);
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
        const known = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !known.has(item.id))];
      });
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (loadError) {
      console.error("Failed to load more notes:", loadError);
      setError("More notes could not be loaded right now.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleDelete = async (note: NotebookNoteItem) => {
    if (!window.confirm("Delete this note?")) return;

    setDeletingNoteId(note.id);
    try {
      await deleteNotebookHighlight(note.postId, note.highlight);
      setNotes((current) => current.filter((item) => item.id !== note.id));
    } catch (deleteError) {
      console.error("Failed to delete note:", deleteError);
      setError("This note could not be deleted right now.");
    } finally {
      setDeletingNoteId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3" aria-label="Loading My Notes">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white"
          />
        ))}
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center">
        <Highlighter className="mx-auto h-7 w-7 text-amber-500" />
        <p className="mt-3 text-sm font-bold text-slate-600">No text notes yet.</p>
        <p className="mt-1 text-xs text-slate-400">
          Open a post, turn on Notebook Highlight, then tap a paragraph number.
        </p>
        {error && <p className="mt-3 text-xs font-semibold text-rose-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {notes.map((note) => {
        const noteText = note.highlight.text?.trim() || "";
        return (
          <article
            key={note.id}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <time
                dateTime={new Date(note.highlight.createdAt).toISOString()}
                className="text-[11px] font-semibold text-slate-400"
              >
                {formatNoteDate(note.highlight.createdAt)}
              </time>
              <button
                type="button"
                disabled={deletingNoteId === note.id}
                onClick={() => void handleDelete(note)}
                aria-label="Delete note"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              <mark className="readative-notebook-highlight">{noteText}</mark>
            </p>
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
          {isLoadingMore ? "Loading..." : "Load more notes"}
        </button>
      )}
    </div>
  );
}
