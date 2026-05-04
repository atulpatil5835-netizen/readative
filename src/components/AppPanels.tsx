import { type ReactNode, useState } from "react";
import {
  AtSign,
  Heart,
  Linkedin,
  Mail,
  MessageCircle,
  ShieldCheck,
  X,
} from "lucide-react";
import { type UserNotification } from "../types";
import { type KnowledgeIdentity } from "../utils/knowledgeIdentity";
import {
  markNotificationAsRead,
  markNotificationsAsRead,
} from "../utils/notifications";

type InfoSection = "about" | "contact" | "privacy";

export function InfoPanel({ onClose }: { onClose: () => void }) {
  const [activeSection, setActiveSection] = useState<InfoSection>("about");

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-950/20 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <aside
        onClick={(event) => event.stopPropagation()}
        className="absolute right-4 top-20 flex max-h-[min(78vh,720px)] w-[min(92vw,390px)] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.16)]"
      >
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-emerald-900 to-teal-700 px-6 py-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-200">
                Readative Info
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">
                About, contact, and privacy
              </h2>
              <p className="mt-2 text-sm text-emerald-50">
                Open the section you need from the buttons below.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full bg-white/10 p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <InfoSectionButton
              active={activeSection === "about"}
              label="About Us"
              onClick={() => setActiveSection("about")}
            />
            <InfoSectionButton
              active={activeSection === "contact"}
              label="Contact Us"
              onClick={() => setActiveSection("contact")}
            />
            <InfoSectionButton
              active={activeSection === "privacy"}
              label="Privacy Policy"
              onClick={() => setActiveSection("privacy")}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {activeSection === "about" && (
            <div className="space-y-6">
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/70 px-5 py-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                  About Us
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  Readative is a knowledge-first community designed for useful
                  ideas, thoughtful learning posts, and SmartTalk discussions that
                  stay educational and practical.
                </p>
                <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/80 bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Company LinkedIn
                    </p>
                    <p className="text-xs text-slate-500">
                      Innovation InfoHub
                    </p>
                  </div>
                  <IconOnlyLink
                    href="https://www.linkedin.com/company/innovation-infohub/"
                    label="Open company LinkedIn page"
                    icon={<Linkedin className="h-4 w-4" />}
                  />
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  Creator
                </p>
                <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">
                  Atul Hinge
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Founder and creator of Readative.
                </p>
                <div className="mt-4">
                  <IconOnlyLink
                    href="https://www.linkedin.com/in/atul-hinge-304aab155/"
                    label="Open creator LinkedIn profile"
                    icon={<Linkedin className="h-4 w-4" />}
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === "contact" && (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Contact Us
              </p>
              <a
                href="mailto:reader@readative.com"
                className="mt-4 flex items-center gap-3 rounded-2xl border border-white bg-white px-4 py-4 text-slate-900 transition-colors hover:border-emerald-200 hover:bg-emerald-50/70"
              >
                <span className="rounded-full bg-emerald-100 p-2 text-emerald-700">
                  <Mail className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold">reader@readative.com</span>
              </a>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Use this email for support, business questions, creator contact,
                or privacy requests.
              </p>
            </div>
          )}

          {activeSection === "privacy" && (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-emerald-100 p-2 text-emerald-700">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Privacy Policy
                  </p>
                  <p className="text-sm text-slate-600">
                    Key platform and advertising policies
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4 text-sm leading-6 text-slate-700">
                <PolicyBlock
                  title="Information we store"
                  body="Readative may store usernames, posts, comments, likes, notifications, and basic usage information needed to run the community experience."
                />
                <PolicyBlock
                  title="Google cookies for ads"
                  body="Readative uses Google cookies and related advertising technology for ads and monetization. Google and its partners may use cookies to serve and personalize ads based on your visits to this site and other websites."
                />
                <PolicyBlock
                  title="No copyrighted content without permission"
                  body="Users should only upload or publish content they own or have permission to share. Copyrighted material, spam, abusive content, and sexual content are not allowed on the platform."
                />
                <PolicyBlock
                  title="Third-party services"
                  body="When you open LinkedIn, Google, or other outside services from Readative, those services apply their own privacy practices and terms."
                />
                <PolicyBlock
                  title="Updates and contact"
                  body="These policies may be updated as Readative grows. For privacy or policy questions, contact reader@readative.com."
                />
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

interface NotificationsPanelProps {
  identity: KnowledgeIdentity | null;
  notifications: UserNotification[];
  unreadNotificationCount: number;
  notificationsError: string | null;
  onClose: () => void;
  onOpenProfile: (authorId: string) => void;
  onOpenEntry: (entryId: string) => void;
}

export function NotificationsPanel({
  identity,
  notifications,
  unreadNotificationCount,
  notificationsError,
  onClose,
  onOpenProfile,
  onOpenEntry,
}: NotificationsPanelProps) {
  const [panelError, setPanelError] = useState<string | null>(null);

  const openNotification = async (notification: UserNotification) => {
    setPanelError(null);

    try {
      if (!notification.read) {
        await markNotificationAsRead(notification.id);
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

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-950/20 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <aside
        onClick={(event) => event.stopPropagation()}
        className="absolute right-4 top-20 w-[min(92vw,390px)] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.16)]"
      >
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-emerald-900 to-teal-700 px-6 py-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-200">
                Realtime Alerts
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">
                Notifications
              </h2>
              <p className="mt-2 text-sm text-emerald-50">
                {identity
                  ? unreadNotificationCount === 0
                    ? `@${identity.displayName}, you are all caught up.`
                    : `@${identity.displayName}, ${unreadNotificationCount} unread updates are waiting.`
                  : "Choose a username once to start receiving alerts."}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full bg-white/10 p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {identity && notifications.length > 0 && (
            <button
              onClick={() => void markAllRead()}
              disabled={unreadNotificationCount === 0}
              className="mt-4 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white transition-colors hover:bg-white/15 disabled:opacity-40"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-[65vh] overflow-y-auto">
          {(notificationsError || panelError) && (
            <div className="border-b border-amber-100 bg-amber-50 px-6 py-4 text-sm text-amber-700">
              {panelError || notificationsError}
            </div>
          )}

          {!identity ? (
            <div className="px-6 py-8 text-sm text-slate-500">
              Post, like, or comment once with your username and your realtime
              notifications will appear here.
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-6 py-8 text-sm text-slate-500">
              No notifications yet. Likes, comments, and tags will appear here in
              realtime.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-start justify-between gap-4 px-6 py-4 transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-1 rounded-2xl p-2 ${
                        notification.type === "like"
                          ? "bg-rose-100 text-rose-600"
                          : notification.type === "comment"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-cyan-100 text-cyan-700"
                      }`}
                    >
                      {notification.type === "like" ? (
                        <Heart className="h-4 w-4" />
                      ) : notification.type === "comment" ? (
                        <MessageCircle className="h-4 w-4" />
                      ) : (
                        <AtSign className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => onOpenProfile(notification.actorAuthorId)}
                          className="text-sm font-bold text-slate-900 transition-colors hover:text-emerald-700"
                        >
                          @{notification.actorUsername}
                        </button>
                        {!notification.read && (
                          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                            New
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {notification.preview}
                      </p>
                      <p className="mt-2 text-xs text-slate-400">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => void openNotification(notification)}
                    className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 transition-colors hover:bg-emerald-50"
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function InfoSectionButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl px-3 py-3 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
        active
          ? "bg-white text-emerald-800"
          : "bg-white/10 text-white/85 hover:bg-white/20"
      }`}
    >
      {label}
    </button>
  );
}

function IconOnlyLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100"
    >
      {icon}
    </a>
  );
}

function PolicyBlock({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-white bg-white px-4 py-4">
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}
