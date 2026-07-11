import {
  collection,
  deleteDoc,
  doc,
  documentId,
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
import type { KnowledgeEntry } from "../types";
import {
  MAX_NOTEBOOK_HIGHLIGHTS_PER_POST,
  isNotebookHighlight,
  isSameNotebookRange,
  type NotebookHighlight,
} from "./types";

export const MY_NOTES_PAGE_SIZE = 12;

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
  const snapshot = await getCountFromServer(notebookPostsCollection(userId));
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
    if (current.some((item) => isSameNotebookRange(item, highlight))) {
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

export async function loadMyNotes(
  userId: string,
  cursor?: QueryDocumentSnapshot<DocumentData> | null,
) {
  const notesQuery = query(
    notebookPostsCollection(userId),
    orderBy(documentId()),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(MY_NOTES_PAGE_SIZE),
  );
  const snapshot = await getDocs(notesQuery);
  const items = snapshot.docs
    .map((item) => ({
      postId: item.id,
      highlights: normalizeHighlights(item.data(), item.id),
    }))
    .filter((item) => item.highlights.length > 0);
  return {
    items,
    cursor: snapshot.docs[snapshot.docs.length - 1] || null,
    hasMore: snapshot.docs.length === MY_NOTES_PAGE_SIZE,
  };
}

export async function loadNotePosts(postIds: string[]) {
  if (postIds.length === 0) return new Map<string, KnowledgeEntry>();
  const postsQuery = query(
    collection(db, "knowledge"),
    where(documentId(), "in", postIds.slice(0, MY_NOTES_PAGE_SIZE)),
  );
  const snapshot = await getDocs(postsQuery);
  return new Map(
    snapshot.docs.map((item) => [
      item.id,
      { id: item.id, ...item.data() } as KnowledgeEntry,
    ]),
  );
}
