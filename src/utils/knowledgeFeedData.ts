import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore";
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
  await updateDoc(doc(db, "knowledge", entry.id), {
    likes: shouldLike ? arrayUnion(actorId) : arrayRemove(actorId),
  });

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
