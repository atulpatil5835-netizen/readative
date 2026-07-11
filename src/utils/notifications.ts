import {
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/firebaseDb";
import { KnowledgeComment, KnowledgeEntry, TaggedUser, UserNotification } from "../types";

interface NotificationActor {
  authorId: string;
  username: string;
}

const READATIVE_SYSTEM_ACTOR: NotificationActor = {
  authorId: "readative-system",
  username: "Readative",
};

function normalizeNotificationIdPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}

function buildLikeNotificationId(entryId: string, actorAuthorId: string) {
  return `like_${entryId}_${actorAuthorId}`;
}

function buildCommentNotificationId(entryId: string, commentId: string) {
  return `comment_${entryId}_${commentId}`;
}

function buildPostTagNotificationId(
  entryId: string,
  targetAuthorId: string,
  actorAuthorId: string
) {
  return `tag_post_${entryId}_${targetAuthorId}_${actorAuthorId}`;
}

function buildCommentTagNotificationId(
  entryId: string,
  commentId: string,
  targetAuthorId: string,
  actorAuthorId: string
) {
  return `tag_comment_${entryId}_${commentId}_${targetAuthorId}_${actorAuthorId}`;
}

function buildContributorLevelNotificationId(
  targetAuthorId: string,
  contributorLevel: string,
) {
  return `level_up_${targetAuthorId}_${normalizeNotificationIdPart(contributorLevel)}`;
}

function buildTrustScoreNotificationId(targetAuthorId: string, score: number) {
  return `trust_score_${targetAuthorId}_${Math.max(0, Math.round(score))}`;
}

function buildBestAnswerNotificationId(questionId: string, answerId: string) {
  return `best_answer_${questionId}_${answerId}`;
}

function buildHelpfulMilestoneNotificationId(entryId: string, helpfulCount: number) {
  return `helpful_milestone_${entryId}_${helpfulCount}`;
}

function createNotification(
  input: Omit<UserNotification, "id" | "read" | "createdAt">
): Omit<UserNotification, "id"> {
  return {
    ...input,
    read: false,
    createdAt: Date.now(),
  };
}

export async function notifyLikeOnKnowledge(
  entry: KnowledgeEntry,
  actor: NotificationActor
) {
  if (!entry.authorId || actor.authorId === entry.authorId) return;

  const notificationId = buildLikeNotificationId(entry.id, actor.authorId);
  const payload = createNotification({
    targetAuthorId: entry.authorId,
    actorAuthorId: actor.authorId,
    actorUsername: actor.username,
    type: "like",
    entryId: entry.id,
    entryTitle: entry.title,
    preview: `@${actor.username} marked your post helpful "${entry.title}".`,
  });

  await setDoc(doc(db, "notifications", notificationId), payload);
}

export async function removeLikeNotification(
  entryId: string,
  actorAuthorId: string
) {
  await deleteDoc(doc(db, "notifications", buildLikeNotificationId(entryId, actorAuthorId)));
}

export async function notifyCommentOnKnowledge(
  entry: KnowledgeEntry,
  actor: NotificationActor,
  comment: KnowledgeComment
) {
  if (!entry.authorId || actor.authorId === entry.authorId) return;

  const notificationId = buildCommentNotificationId(entry.id, comment.id);
  const payload = createNotification({
    targetAuthorId: entry.authorId,
    actorAuthorId: actor.authorId,
    actorUsername: actor.username,
    type: "comment",
    entryId: entry.id,
    entryTitle: entry.title,
    preview: `@${actor.username} commented on your post: ${comment.text.slice(0, 80)}`,
  });

  await setDoc(doc(db, "notifications", notificationId), payload);
}

export async function notifyTaggedUsers(
  entry: Pick<KnowledgeEntry, "id" | "title" | "authorId">,
  actor: NotificationActor,
  mentions: TaggedUser[]
) {
  const uniqueMentions = mentions.filter(
    (mention, index, current) =>
      current.findIndex((item) => item.authorId === mention.authorId) === index &&
      mention.authorId !== actor.authorId &&
      mention.authorId !== entry.authorId
  );

  if (uniqueMentions.length === 0) return;

  const batch = writeBatch(db);

  uniqueMentions.forEach((mention) => {
    const notificationId = buildPostTagNotificationId(
      entry.id,
      mention.authorId,
      actor.authorId
    );
    const payload = createNotification({
      targetAuthorId: mention.authorId,
      actorAuthorId: actor.authorId,
      actorUsername: actor.username,
      type: "tag",
      entryId: entry.id,
      entryTitle: entry.title,
      preview: `@${actor.username} tagged you in "${entry.title}".`,
    });

    batch.set(doc(db, "notifications", notificationId), payload);
  });

  await batch.commit();
}

export async function notifyTaggedUsersOnComment(
  entry: Pick<KnowledgeEntry, "id" | "title" | "authorId">,
  comment: Pick<KnowledgeComment, "id" | "text">,
  actor: NotificationActor,
  mentions: TaggedUser[]
) {
  const uniqueMentions = mentions.filter(
    (mention, index, current) =>
      current.findIndex((item) => item.authorId === mention.authorId) === index &&
      mention.authorId !== actor.authorId &&
      mention.authorId !== entry.authorId
  );

  if (uniqueMentions.length === 0) return;

  const batch = writeBatch(db);

  uniqueMentions.forEach((mention) => {
    const notificationId = buildCommentTagNotificationId(
      entry.id,
      comment.id,
      mention.authorId,
      actor.authorId
    );
    const payload = createNotification({
      targetAuthorId: mention.authorId,
      actorAuthorId: actor.authorId,
      actorUsername: actor.username,
      type: "tag",
      entryId: entry.id,
      entryTitle: entry.title,
      preview: `@${actor.username} tagged you in a comment on "${entry.title}": ${comment.text.slice(0, 80)}`,
    });

    batch.set(doc(db, "notifications", notificationId), payload);
  });

  await batch.commit();
}

export async function notifyContributorLevelUp(
  targetAuthorId: string,
  contributorLevel: string,
) {
  if (!targetAuthorId) return;

  const notificationId = buildContributorLevelNotificationId(
    targetAuthorId,
    contributorLevel,
  );
  const payload = createNotification({
    targetAuthorId,
    actorAuthorId: READATIVE_SYSTEM_ACTOR.authorId,
    actorUsername: READATIVE_SYSTEM_ACTOR.username,
    type: "level-up",
    entryId: targetAuthorId,
    entryTitle: "Contributor level",
    preview: `Your contributor level is now ${contributorLevel}.`,
  });

  await setDoc(doc(db, "notifications", notificationId), payload);
}

export async function notifyTrustScoreIncreased(
  targetAuthorId: string,
  trustScore: number,
) {
  if (!targetAuthorId) return;

  const safeScore = Math.max(0, Math.round(trustScore));
  const notificationId = buildTrustScoreNotificationId(targetAuthorId, safeScore);
  const payload = createNotification({
    targetAuthorId,
    actorAuthorId: READATIVE_SYSTEM_ACTOR.authorId,
    actorUsername: READATIVE_SYSTEM_ACTOR.username,
    type: "trust-score",
    entryId: targetAuthorId,
    entryTitle: "Trust score",
    preview: `Your trust score increased to ${safeScore}.`,
  });

  await setDoc(doc(db, "notifications", notificationId), payload);
}

export async function notifyBestAnswerEarned(
  question: { id: string; content?: string; authorId?: string },
  answer: { id: string; authorId?: string },
) {
  if (!answer.authorId) return;

  const notificationId = buildBestAnswerNotificationId(question.id, answer.id);
  const questionPreview = (question.content || "a SmartTalk discussion").slice(0, 80);
  const payload = createNotification({
    targetAuthorId: answer.authorId,
    actorAuthorId: READATIVE_SYSTEM_ACTOR.authorId,
    actorUsername: READATIVE_SYSTEM_ACTOR.username,
    type: "best-answer",
    entryId: question.id,
    entryTitle: "SmartTalk best answer",
    preview: `Your SmartTalk answer earned Best Answer: ${questionPreview}`,
  });

  await setDoc(doc(db, "notifications", notificationId), payload);
}

export async function notifyHelpfulMilestone(
  entry: Pick<KnowledgeEntry, "id" | "title" | "authorId">,
  helpfulCount: number,
) {
  if (!entry.authorId) return;

  const notificationId = buildHelpfulMilestoneNotificationId(
    entry.id,
    helpfulCount,
  );
  const payload = createNotification({
    targetAuthorId: entry.authorId,
    actorAuthorId: READATIVE_SYSTEM_ACTOR.authorId,
    actorUsername: READATIVE_SYSTEM_ACTOR.username,
    type: "helpful-milestone",
    entryId: entry.id,
    entryTitle: entry.title,
    preview: `"${entry.title}" reached ${helpfulCount} helpful marks.`,
  });

  await setDoc(doc(db, "notifications", notificationId), payload);
}

export async function markNotificationsAsRead(notificationIds: string[]) {
  if (notificationIds.length === 0) return;

  const batch = writeBatch(db);
  notificationIds.forEach((notificationId) => {
    batch.update(doc(db, "notifications", notificationId), {
      read: true,
    });
  });
  await batch.commit();
}

export async function markNotificationAsRead(notificationId: string) {
  await updateDoc(doc(db, "notifications", notificationId), {
    read: true,
  });
}
