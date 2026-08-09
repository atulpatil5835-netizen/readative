import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  startAfter,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/firebaseDb";
import {
  MAX_NOTEBOOK_HIGHLIGHTS_PER_POST,
  isNotebookHighlight,
  isSameNotebookRange,
  type NotebookHighlight,
} from "./types";

export const MY_NOTES_PAGE_SIZE = 12;

export interface NotebookNoteItem {
  id: string;
  postId: string;
  highlight: NotebookHighlight;
}

function notebookPostsCollection(userId: string) {
  return collection(db, "userNotebook", userId, "posts");
}

function notebookPostReference(userId: string, postId: string) {
  return doc(db, "userNotebook", userId, "posts", postId);
}

function normalizeHighlights(value: unknown, postId: string) {
  if (!value || typeof value !== "object") return [];
  const highlights = (value as { highlights?: unknown }).highlights;
  if (!Array.isArray(highlights)) return [];
  return highlights
    .filter(isNotebookHighlight)
    .filter((highlight) => highlight.postId === postId)
    .slice(0, MAX_NOTEBOOK_HIGHLIGHTS_PER_POST);
}

export async function loadNotebookPostCount(userId: string) {
  const snapshot = await getCountFromServer(
    query(notebookPostsCollection(userId), where("updatedAt", ">", 0)),
  );
  return snapshot.data().count;
}

export async function loadNotebookPost(userId: string, postId: string) {
  const snapshot = await getDoc(notebookPostReference(userId, postId));
  return snapshot.exists() ? normalizeHighlights(snapshot.data(), postId) : [];
}

export async function saveNotebookHighlight(
  userId: string,
  postId: string,
  highlight: NotebookHighlight,
) {
  const reference = notebookPostReference(userId, postId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.exists()
      ? normalizeHighlights(snapshot.data(), postId)
      : [];
    const existingIndex = current.findIndex((item) =>
      isSameNotebookRange(item, highlight),
    );
    if (existingIndex >= 0) {
      const existing = current[existingIndex];
      if (!existing.text && highlight.text) {
        const highlights = [...current];
        highlights[existingIndex] = { ...existing, text: highlight.text };
        transaction.set(reference, {
          highlights,
          updatedAt: Date.now(),
        });
        return { saved: true, createdPost: false, highlights };
      }
      return { saved: false, createdPost: false, highlights: current };
    }
    if (current.length >= MAX_NOTEBOOK_HIGHLIGHTS_PER_POST) {
      throw new Error("Notebook highlight limit reached for this post.");
    }
    const highlights = [...current, highlight].sort(
      (left, right) => left.createdAt - right.createdAt,
    );
    transaction.set(reference, {
      highlights,
      updatedAt: Date.now(),
    });
    return {
      saved: true,
      createdPost: !snapshot.exists() || current.length === 0,
      highlights,
    };
  });
}

export async function deleteNotebookPost(userId: string, postId: string) {
  await deleteDoc(notebookPostReference(userId, postId));
}

export async function deleteNotebookHighlight(
  userId: string,
  postId: string,
  highlight: NotebookHighlight,
) {
  const reference = notebookPostReference(userId, postId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.exists()
      ? normalizeHighlights(snapshot.data(), postId)
      : [];
    const highlights = current.filter((item) => !isSameNotebookRange(item, highlight));

    if (highlights.length === current.length) {
      return { deletedPost: false, highlights: current };
    }

    if (highlights.length === 0) {
      transaction.delete(reference);
      return { deletedPost: true, highlights };
    }

    transaction.set(reference, {
      highlights,
      updatedAt: Date.now(),
    });
    return { deletedPost: false, highlights };
  });
}

function createNotebookNoteId(postId: string, highlight: NotebookHighlight) {
  return [
    postId,
    highlight.paragraphId,
    highlight.startOffset,
    highlight.endOffset,
    highlight.createdAt,
  ].join(":");
}

function flattenTextNotes(postId: string, highlights: NotebookHighlight[]) {
  return highlights
    .filter((highlight) => Boolean(highlight.text?.trim()))
    .map<NotebookNoteItem>((highlight) => ({
      id: createNotebookNoteId(postId, highlight),
      postId,
      highlight,
    }));
}

export async function loadMyNotes(
  userId: string,
  cursor?: QueryDocumentSnapshot<DocumentData> | null,
) {
  const notesQuery = query(
    notebookPostsCollection(userId),
    orderBy("updatedAt", "desc"),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(MY_NOTES_PAGE_SIZE),
  );
  const snapshot = await getDocs(notesQuery);
  const items = snapshot.docs
    .flatMap((item) => flattenTextNotes(item.id, normalizeHighlights(item.data(), item.id)))
    .sort(
      (left, right) =>
        right.highlight.createdAt - left.highlight.createdAt ||
        left.id.localeCompare(right.id),
    );
  return {
    items,
    cursor: snapshot.docs[snapshot.docs.length - 1] || null,
    hasMore: snapshot.docs.length === MY_NOTES_PAGE_SIZE,
  };
}
