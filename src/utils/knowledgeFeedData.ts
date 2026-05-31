import {
  arrayRemove,
  arrayUnion,
  doc,
  runTransaction,
  updateDoc,
} from "firebase/firestore";
import type { KnowledgeEntry } from "../types";
import { db } from "../firebase/firebase";
import { recordKnowledgeFeedActivity } from "./feedPersonalization";
import { getTrustMetrics } from "./trustSystem";

const HELPFUL_MILESTONES = new Set([10, 25, 50, 100, 250, 500, 1000]);

interface ToggleKnowledgeEntryLikeInput {
  entry: KnowledgeEntry;
  actorId: string;
  actorName?: string | null;
  shouldLike: boolean;
}

interface ToggleKnowledgeEntryMisleadingInput {
  entry: KnowledgeEntry;
  actorId: string;
  shouldMarkMisleading: boolean;
}

export async function toggleKnowledgeEntryLike({
  entry,
  actorId,
  actorName,
  shouldLike,
}: ToggleKnowledgeEntryLikeInput) {
  const knowledgeRef = doc(db, "knowledge", entry.id);
  let nextHelpfulCount = getTrustMetrics(entry).helpfulCount;

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(knowledgeRef);
    const currentEntry = snapshot.exists()
      ? ({ ...entry, ...snapshot.data(), id: entry.id } as KnowledgeEntry)
      : entry;
    const metrics = getTrustMetrics(currentEntry);
    const nextHelpfulIds = shouldLike
      ? [...new Set([...metrics.helpfulIds, actorId])]
      : metrics.helpfulIds.filter((id) => id !== actorId);
    const nextMisleadingIds = shouldLike
      ? metrics.misleadingIds.filter((id) => id !== actorId)
      : metrics.misleadingIds;
    nextHelpfulCount = nextHelpfulIds.length;

    transaction.update(knowledgeRef, {
      likes: nextHelpfulIds,
      likeCount: nextHelpfulIds.length,
      helpfulIds: nextHelpfulIds,
      helpfulCount: nextHelpfulIds.length,
      dislikes: nextMisleadingIds,
      dislikeCount: nextMisleadingIds.length,
      misleadingIds: nextMisleadingIds,
      misleadingCount: nextMisleadingIds.length,
    });
  });

  try {
    await updateDoc(doc(db, "userProfiles", actorId), {
      likedKnowledgeIds: shouldLike
        ? arrayUnion(entry.id)
        : arrayRemove(entry.id),
    });
  } catch (error) {
    console.warn("Profile helpful-post tracking failed; post trust was saved.", error);
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

    if (HELPFUL_MILESTONES.has(nextHelpfulCount)) {
      void import("./notifications")
        .then(({ notifyHelpfulMilestone }) =>
          notifyHelpfulMilestone(
            { id: entry.id, title: entry.title, authorId: entry.authorId },
            nextHelpfulCount,
          ),
        )
        .catch((error) => {
          console.warn("Helpful milestone notification failed; like was saved.", error);
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

export async function toggleKnowledgeEntryMisleading({
  entry,
  actorId,
  shouldMarkMisleading,
}: ToggleKnowledgeEntryMisleadingInput) {
  const knowledgeRef = doc(db, "knowledge", entry.id);
  let shouldRemoveHelpfulProfileEntry = false;

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(knowledgeRef);
    const currentEntry = snapshot.exists()
      ? ({ ...entry, ...snapshot.data(), id: entry.id } as KnowledgeEntry)
      : entry;
    const metrics = getTrustMetrics(currentEntry);
    const nextMisleadingIds = shouldMarkMisleading
      ? [...new Set([...metrics.misleadingIds, actorId])]
      : metrics.misleadingIds.filter((id) => id !== actorId);
    const nextHelpfulIds = shouldMarkMisleading
      ? metrics.helpfulIds.filter((id) => id !== actorId)
      : metrics.helpfulIds;

    shouldRemoveHelpfulProfileEntry =
      shouldMarkMisleading && metrics.helpfulIds.includes(actorId);

    transaction.update(knowledgeRef, {
      likes: nextHelpfulIds,
      likeCount: nextHelpfulIds.length,
      helpfulIds: nextHelpfulIds,
      helpfulCount: nextHelpfulIds.length,
      dislikes: nextMisleadingIds,
      dislikeCount: nextMisleadingIds.length,
      misleadingIds: nextMisleadingIds,
      misleadingCount: nextMisleadingIds.length,
    });
  });

  if (shouldRemoveHelpfulProfileEntry) {
    try {
      await updateDoc(doc(db, "userProfiles", actorId), {
        likedKnowledgeIds: arrayRemove(entry.id),
      });
    } catch (error) {
      console.warn("Profile helpful-post cleanup failed; misleading trust was saved.", error);
    }
  }
}
