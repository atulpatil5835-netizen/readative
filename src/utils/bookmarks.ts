import {
  arrayRemove,
  arrayUnion,
  doc,
  runTransaction,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import type { KnowledgeEntry, SmartQuestion } from "../types";
import { mergeTrustIds, normalizeTrustIdArray } from "./trustSystem";

function getSavedBy(data: unknown) {
  if (!data || typeof data !== "object") return [];

  const source = data as {
    savedBy?: unknown;
    savedIds?: unknown;
    savedByIds?: unknown;
  };

  return mergeTrustIds(
    normalizeTrustIdArray(source.savedBy),
    normalizeTrustIdArray(source.savedIds),
    normalizeTrustIdArray(source.savedByIds),
  );
}

export function getSaveMetrics(
  source: Partial<KnowledgeEntry | SmartQuestion> & {
    savedBy?: unknown;
    savedIds?: unknown;
    savedByIds?: unknown;
    saveCount?: unknown;
  },
) {
  const savedBy = getSavedBy(source);
  const saveCount =
    typeof source.saveCount === "number" && Number.isFinite(source.saveCount)
      ? Math.max(savedBy.length, Math.round(source.saveCount))
      : savedBy.length;

  return {
    savedBy,
    saveCount,
  };
}

export async function toggleKnowledgeSave({
  entry,
  actorId,
  shouldSave,
}: {
  entry: Pick<KnowledgeEntry, "id">;
  actorId: string;
  shouldSave: boolean;
}) {
  const entryRef = doc(db, "knowledge", entry.id);
  const profileRef = doc(db, "userProfiles", actorId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(entryRef);
    if (!snapshot.exists()) {
      throw new Error("Post no longer exists.");
    }

    const currentSavedBy = getSavedBy(snapshot.data());
    const nextSavedBy = shouldSave
      ? mergeTrustIds(currentSavedBy, [actorId])
      : currentSavedBy.filter((id) => id !== actorId);

    transaction.update(entryRef, {
      savedBy: nextSavedBy,
      saveCount: nextSavedBy.length,
    });
    transaction.set(
      profileRef,
      {
        savedKnowledgeIds: shouldSave
          ? arrayUnion(entry.id)
          : arrayRemove(entry.id),
      },
      { merge: true },
    );
  });
}

export async function toggleSmartTalkSave({
  question,
  actorId,
  shouldSave,
}: {
  question: Pick<SmartQuestion, "id">;
  actorId: string;
  shouldSave: boolean;
}) {
  const questionRef = doc(db, "smarttalk", question.id);
  const profileRef = doc(db, "userProfiles", actorId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(questionRef);
    if (!snapshot.exists()) {
      throw new Error("Discussion no longer exists.");
    }

    const currentSavedBy = getSavedBy(snapshot.data());
    const nextSavedBy = shouldSave
      ? mergeTrustIds(currentSavedBy, [actorId])
      : currentSavedBy.filter((id) => id !== actorId);

    transaction.update(questionRef, {
      savedBy: nextSavedBy,
      saveCount: nextSavedBy.length,
    });
    transaction.set(
      profileRef,
      {
        savedSmartTalkIds: shouldSave
          ? arrayUnion(question.id)
          : arrayRemove(question.id),
      },
      { merge: true },
    );
  });
}
