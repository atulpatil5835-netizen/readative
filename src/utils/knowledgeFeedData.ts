import {
  arrayRemove,
  arrayUnion,
  doc,
  increment,
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
    likeCount: increment(shouldLike ? 1 : -1),
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

  if (shouldLike) {
    if (actorName) {
      void import("./notifications")
        .then(({ notifyLikeOnKnowledge }) =>
          notifyLikeOnKnowledge(entry, {
            authorId: actorId,
            username: actorName,
          }),
        )
        .catch((error) => {
          console.warn("Like notification failed; like was saved.", error);
        });
    }

    recordKnowledgeFeedActivity({
      type: "like",
      entry,
    });
    return;
  }

  void import("./notifications")
    .then(({ removeLikeNotification }) =>
      removeLikeNotification(entry.id, actorId),
    )
    .catch((error) => {
      console.warn("Like notification cleanup failed; unlike was saved.", error);
    });
}
