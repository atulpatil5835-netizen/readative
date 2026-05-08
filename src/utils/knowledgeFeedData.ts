import {
  arrayRemove,
  arrayUnion,
  doc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import type { KnowledgeEntry } from "../types";
import { db } from "../firebase/firebase";
import { recordKnowledgeFeedActivity } from "./feedPersonalization";

interface ToggleKnowledgeEntryLikeInput {
  entry: KnowledgeEntry;
  actorId: string;
  actorName?: string | null;
  shouldLike: boolean;
}

export async function toggleKnowledgeEntryLike({
  entry,
  actorId,
  actorName,
  shouldLike,
}: ToggleKnowledgeEntryLikeInput) {
  const knowledgeLikeUpdate = {
    likes: shouldLike ? arrayUnion(actorId) : arrayRemove(actorId),
  };
  const profileLikeUpdate = {
    likedKnowledgeIds: shouldLike
      ? arrayUnion(entry.id)
      : arrayRemove(entry.id),
  };
  const batch = writeBatch(db);
  batch.update(doc(db, "knowledge", entry.id), knowledgeLikeUpdate);
  batch.update(doc(db, "userProfiles", actorId), profileLikeUpdate);

  try {
    await batch.commit();
  } catch (error) {
    console.warn("Profile liked-post tracking failed; saving post like only.", error);
    await updateDoc(doc(db, "knowledge", entry.id), knowledgeLikeUpdate);
  }

  const { notifyLikeOnKnowledge, removeLikeNotification } = await import("./notifications");

  if (shouldLike) {
    if (actorName) {
      await notifyLikeOnKnowledge(entry, {
        authorId: actorId,
        username: actorName,
      });
    }

    recordKnowledgeFeedActivity({
      type: "like",
      entry,
    });
    return;
  }

  await removeLikeNotification(entry.id, actorId);
}
