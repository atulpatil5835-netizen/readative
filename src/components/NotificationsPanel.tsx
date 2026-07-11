import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  AtSign,
  Award,
  MessageCircle,
  ThumbsUp,
  Trophy,
  TrendingUp,
  X,
} from "lucide-react";
import { type UserNotification } from "../types";
import { type KnowledgeIdentity } from "../utils/knowledgeIdentity";
import {
  markNotificationAsRead,
  markNotificationsAsRead,
} from "../utils/notifications";

interface NotificationsPanelProps {
  identity: KnowledgeIdentity | null;
  notifications: UserNotification[];
  unreadNotificationCount: number;
  notificationsError: string | null;
  onClose: () => void;
  onOpenProfile: (authorId: string, username?: string) => void;
  onOpenEntry: (entryId: string) => void;
  onOpenSmartTalk: (questionId?: string, selectedCategory?: string | null) => void;
  onOpenSignIn: () => void;
}

export function NotificationsPanel({
  identity,
  notifications,
  unreadNotificationCount,
  notificationsError,
  onClose,
  onOpenProfile,
  onOpenEntry,
  onOpenSmartTalk,
  onOpenSignIn,
}: NotificationsPanelProps) {
  const [panelError, setPanelError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const openNotification = async (notification: UserNotification) => {
    setPanelError(null);

    try {
      if (!notification.read) {
        await markNotificationAsRead(notification.id);
      }

      if (
        notification.type === "level-up" ||
        notification.type === "trust-score"
      ) {
        onOpenProfile(
          notification.targetAuthorId,
          notification.targetAuthorId === identity?.authorId
            ? identity.displayName
            : undefined,
        );
        return;
      }

      if (notification.type === "best-answer") {
        onOpenSmartTalk(notification.entryId);
        return;
      }

      onOpenEntry(notification.entryId);
    } catch (error) {
      console.error("Failed to open notification:", error);
      setPanelError("Could not open that notification right now. Please try again.");
    }
  };

  const markAllRead = async () => {
    setPanelError(null);

    try {
      await markNotificationsAsRead(
        notifications.map((notification) => notification.id),
      );
    } catch (error) {
      console.error("Failed to mark notifications as read:", error);
      setPanelError("Could not mark notifications as read right now.");
    }
  };

  const groupedNotifications = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return {
      today: notifications.filter(
        (notification) => notification.createdAt >= todayStart.getTime(),
      ),
      earlier: notifications.filter(
        (notification) => notification.createdAt < todayStart.getTime(),
      ),
    };
  }, [notifications]);

  const renderNotification = (notification: UserNotification) => {
    const actorProfileId =
      notification.actorAuthorId === "readative-system"
        ? notification.targetAuthorId
        : notification.actorAuthorId;
    const actorUsername =
      notification.actorAuthorId === "readative-system"
        ? notification.targetAuthorId === identity?.authorId
          ? identity.displayName
          : undefined
        : notification.actorUsername;

    return (
      <div
        key={notification.id}
        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
      >
        <div
          className={`mt-0.5 rounded-xl p-2 ${getNotificationAccentClass(
            notification.type,
          )}`}
        >
          {getNotificationIcon(notification.type)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenProfile(actorProfileId, actorUsername)}
              className="text-xs font-black text-slate-900 transition-colors hover:text-emerald-700"
            >
              @{notification.actorUsername}
            </button>
            {!notification.read && (
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-white">
                New
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => void openNotification(notification)}
            className="mt-1 block w-full text-left text-sm leading-5 text-slate-600 transition-colors hover:text-slate-950"
          >
            {notification.preview}
          </button>
          <p className="mt-1 text-[11px] font-semibold text-slate-400">
            {new Date(notification.createdAt).toLocaleString()}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-950/20 backdrop-blur-[1px]"
      onClick={onClose}
      role="presentation"
    >
      <aside
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notifications-panel-title"
        className="readative-panel-surface absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5rem)] top-[calc(env(safe-area-inset-top)+4.5rem)] flex flex-col overflow-hidden md:bottom-auto md:left-auto md:right-3 md:top-16 md:max-h-[min(78vh,720px)] md:w-[min(94vw,380px)]"
      >
        <div className="shrink-0 border-b border-slate-100 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 id="notifications-panel-title" className="text-base font-black tracking-tight text-slate-950">
                Notifications
              </h2>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                {identity
                  ? unreadNotificationCount === 0
                    ? `@${identity.displayName}, you are all caught up.`
                    : `@${identity.displayName}, ${unreadNotificationCount} unread updates are waiting.`
                  : "Choose a username once to start receiving alerts."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close notifications"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {identity && notifications.length > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={unreadNotificationCount === 0}
              className="mt-3 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600 transition-colors hover:border-emerald-200 hover:text-emerald-700 disabled:opacity-40"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {(notificationsError || panelError) && (
            <div className="border-b border-amber-100 bg-amber-50 px-6 py-4 text-sm text-amber-700">
              {panelError || notificationsError}
            </div>
          )}

          {!identity ? (
            <div className="space-y-4 px-6 py-8 text-sm text-slate-500">
              <p>
                Sign in with Google to receive realtime alerts for comments,
                helpful feedback, mentions, and SmartTalk updates.
              </p>
              <button
                type="button"
                onClick={onOpenSignIn}
                className="inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
              >
                Continue with Google
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-6 py-8 text-sm text-slate-500">
              No notifications yet. Helpful feedback, comments, and tags will appear here in
              realtime.
            </div>
          ) : (
            <div>
              {groupedNotifications.today.length > 0 && (
                <NotificationGroup title="Today">
                  {groupedNotifications.today.map((notification) =>
                    renderNotification(notification),
                  )}
                </NotificationGroup>
              )}
              {groupedNotifications.earlier.length > 0 && (
                <NotificationGroup title="Earlier">
                  {groupedNotifications.earlier.map((notification) =>
                    renderNotification(notification),
                  )}
                </NotificationGroup>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function NotificationGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-slate-100 last:border-b-0">
      <p className="px-4 pt-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
        {title}
      </p>
      <div className="divide-y divide-slate-100">{children}</div>
    </section>
  );
}

function getNotificationAccentClass(type: UserNotification["type"]) {
  if (type === "like" || type === "helpful-milestone") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (type === "comment") return "bg-sky-100 text-sky-700";
  if (type === "level-up" || type === "best-answer") {
    return "bg-amber-100 text-amber-700";
  }
  if (type === "trust-score") return "bg-indigo-100 text-indigo-700";
  return "bg-cyan-100 text-cyan-700";
}

function getNotificationIcon(type: UserNotification["type"]) {
  if (type === "like" || type === "helpful-milestone") {
    return <ThumbsUp className="h-4 w-4" />;
  }
  if (type === "comment") return <MessageCircle className="h-4 w-4" />;
  if (type === "level-up") return <Award className="h-4 w-4" />;
  if (type === "trust-score") return <TrendingUp className="h-4 w-4" />;
  if (type === "best-answer") return <Trophy className="h-4 w-4" />;
  return <AtSign className="h-4 w-4" />;
}
