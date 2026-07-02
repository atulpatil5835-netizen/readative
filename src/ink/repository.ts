import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import type { KnowledgeEntry } from "../types";
import {
  INK_SCHEMA_VERSION,
  isInkStroke,
  type InkPostDocument,
  type InkStroke,
} from "./types";

const MAX_STROKES_PER_POST = 600;
export const MY_NOTES_PAGE_SIZE = 12;

function userInkReference(userId: string) {
  return doc(db, "userInk", userId);
}

function inkPostReference(userId: string, postId: string) {
  return doc(db, "userInk", userId, "posts", postId);
}

function normalizeInkPost(value: unknown): InkPostDocument | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<InkPostDocument>;
  if (record.schemaVersion !== INK_SCHEMA_VERSION) return null;
  const strokes = Array.isArray(record.strokes)
    ? record.strokes.filter(isInkStroke).slice(0, MAX_STROKES_PER_POST)
    : [];
  return {
    schemaVersion: INK_SCHEMA_VERSION,
    createdAt:
      typeof record.createdAt === "number" ? record.createdAt : Date.now(),
    lastAnnotatedAt:
      typeof record.lastAnnotatedAt === "number"
        ? record.lastAnnotatedAt
        : record.createdAt || Date.now(),
    strokes,
  };
}

export async function loadInkIndex(userId: string) {
  const snapshot = await getDoc(userInkReference(userId));
  if (!snapshot.exists()) return [];
  const postIds = snapshot.data().postIds;
  return Array.isArray(postIds)
    ? postIds.filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0 && value.length <= 1_500,
      )
    : [];
}

export async function loadInkPost(userId: string, postId: string) {
  const snapshot = await getDoc(inkPostReference(userId, postId));
  return snapshot.exists() ? normalizeInkPost(snapshot.data()) : null;
}

export async function appendInkStroke(
  userId: string,
  postId: string,
  stroke: InkStroke,
  isFirstStroke: boolean,
) {
  const now = Date.now();
  const postRef = inkPostReference(userId, postId);

  if (!isFirstStroke) {
    await setDoc(
      postRef,
      {
        schemaVersion: INK_SCHEMA_VERSION,
        lastAnnotatedAt: now,
        strokes: arrayUnion(stroke),
      },
      { merge: true },
    );
    return;
  }

  const batch = writeBatch(db);
  batch.set(
    postRef,
    {
      schemaVersion: INK_SCHEMA_VERSION,
      createdAt: now,
      lastAnnotatedAt: now,
      strokes: arrayUnion(stroke),
    },
    { merge: true },
  );
  batch.set(
    userInkReference(userId),
    {
      schemaVersion: INK_SCHEMA_VERSION,
      postIds: arrayUnion(postId),
      updatedAt: now,
    },
    { merge: true },
  );
  await batch.commit();
}

export async function deleteInkPost(userId: string, postId: string) {
  const batch = writeBatch(db);
  batch.delete(inkPostReference(userId, postId));
  batch.set(
    userInkReference(userId),
    { postIds: arrayRemove(postId), updatedAt: Date.now() },
    { merge: true },
  );
  await batch.commit();
}

export async function loadMyNotes(
  userId: string,
  cursor?: QueryDocumentSnapshot<DocumentData> | null,
) {
  const notesQuery = query(
    collection(db, "userInk", userId, "posts"),
    orderBy("lastAnnotatedAt", "desc"),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(MY_NOTES_PAGE_SIZE),
  );
  const snapshot = await getDocs(notesQuery);
  const items = snapshot.docs
    .map((item) => {
      const note = normalizeInkPost(item.data());
      return note ? { postId: item.id, note } : null;
    })
    .filter(
      (
        value,
      ): value is { postId: string; note: InkPostDocument } => Boolean(value),
    );
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
