import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  AtSign,
  Award,
  FileText,
  Linkedin,
  Mail,
  MessageCircle,
  Palette,
  Scale,
  ShieldCheck,
  ThumbsUp,
  Trophy,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { type UserNotification } from "../types";
import { type KnowledgeIdentity } from "../utils/knowledgeIdentity";
import {
  markNotificationAsRead,
  markNotificationsAsRead,
} from "../utils/notifications";

export type InfoSection =
  | "about"
  | "contact"
  | "privacy"
  | "terms"
  | "guidelines"
  | "disclaimer"
  | "appearance";

export function InfoPanel({
  onClose,
  initialSection = "about",
}: {
  onClose: () => void;
  initialSection?: InfoSection;
}) {
  const [activeSection, setActiveSection] =
    useState<InfoSection>(initialSection);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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
        aria-labelledby="readative-info-title"
        className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5rem)] top-[calc(env(safe-area-inset-top)+4.5rem)] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.16)] md:bottom-auto md:left-auto md:right-4 md:top-20 md:max-h-[min(78vh,720px)] md:w-[min(92vw,390px)] md:rounded-[28px]"
      >
        <div className="shrink-0 border-b border-slate-100 bg-gradient-to-r from-slate-950 via-emerald-900 to-teal-700 px-4 py-4 text-white sm:px-6 sm:py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-200">
                Readative Info
              </p>
              <h2 id="readative-info-title" className="mt-2 text-xl font-black tracking-tight sm:text-2xl">
                About, policies, and contact
              </h2>
              <p className="mt-1 text-xs leading-5 text-emerald-50 sm:mt-2 sm:text-sm">
                Open the section you need from the buttons below.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              aria-label="Close information panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:mt-5">
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
            <InfoSectionButton
              active={activeSection === "terms"}
              label="Terms"
              onClick={() => setActiveSection("terms")}
            />
            <InfoSectionButton
              active={activeSection === "guidelines"}
              label="Rules"
              onClick={() => setActiveSection("guidelines")}
            />
            <InfoSectionButton
              active={activeSection === "disclaimer"}
              label="Disclaimer"
              onClick={() => setActiveSection("disclaimer")}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-6">
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
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <p className="text-2xl font-black tracking-tight text-slate-950">
                    Atul Hinge
                  </p>
                  <a
                    href="https://razorpay.me/@atulsadanandhinge"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-full border border-amber-300 bg-amber-300 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-amber-950 transition-colors hover:border-amber-400 hover:bg-amber-400"
                  >
                    Buy Me a Coffee
                  </a>
                </div>
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
                  body="Readative may store usernames, posts, comments, helpful feedback, notifications, and basic usage information needed to run the community experience."
                />
                <PolicyBlock
                  title="Cookies and local preferences"
                  body="Readative may use local storage and cookies to keep you signed in, remember feed preferences, reduce repeated posts, and improve loading performance."
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

          {activeSection === "terms" && (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-sky-100 p-2 text-sky-700">
                  <FileText className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Terms of Use
                  </p>
                  <p className="text-sm text-slate-600">
                    Basic rules for using Readative
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4 text-sm leading-6 text-slate-700">
                <PolicyBlock
                  title="Use the platform responsibly"
                  body="You are responsible for the posts, comments, images, profile details, and links you publish on Readative."
                />
                <PolicyBlock
                  title="Respect ownership"
                  body="Only share content you created, have permission to use, or can legally quote or reference."
                />
                <PolicyBlock
                  title="Service changes"
                  body="Readative may improve, limit, remove, or update features to keep the platform useful, reliable, and safe."
                />
              </div>
            </div>
          )}

          {activeSection === "guidelines" && (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-emerald-100 p-2 text-emerald-700">
                  <Users className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Community Guidelines
                  </p>
                  <p className="text-sm text-slate-600">
                    Keep learning useful and respectful
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4 text-sm leading-6 text-slate-700">
                <PolicyBlock
                  title="Share practical knowledge"
                  body="Posts should help people learn, discover tools, understand ideas, or discuss useful questions."
                />
                <PolicyBlock
                  title="No spam or abuse"
                  body="Spam, harassment, impersonation, scams, hateful content, and sexual content are not allowed."
                />
                <PolicyBlock
                  title="Moderation"
                  body="Readative may block, hide, or remove content that harms the quality or safety of the community."
                />
              </div>
            </div>
          )}

          {activeSection === "disclaimer" && (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-amber-100 p-2 text-amber-700">
                  <Scale className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Disclaimer
                  </p>
                  <p className="text-sm text-slate-600">
                    Important limits on platform content
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4 text-sm leading-6 text-slate-700">
                <PolicyBlock
                  title="Educational content"
                  body="Readative posts are for general information and learning. They are not professional legal, medical, financial, or safety advice."
                />
                <PolicyBlock
                  title="User-created posts"
                  body="Creators are responsible for their own posts and comments. Readative does not guarantee that every user post is complete, current, or error-free."
                />
                <PolicyBlock
                  title="External links"
                  body="Links to external websites are provided for convenience. Those websites are controlled by their own owners and policies."
                />
              </div>
            </div>
          )}

          {activeSection === "appearance" && (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-indigo-100 p-2 text-indigo-700">
                  <Palette className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Appearance
                  </p>
                  <p className="text-sm text-slate-600">
                    Readative uses a compact system-friendly interface.
                  </p>
                </div>
              </div>
              <p className="mt-5 text-sm leading-6 text-slate-700">
                The app is tuned for mobile readability, subtle depth, and fast
                scrolling. More appearance controls can be added here without
                changing existing posts or profiles.
              </p>
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
        onOpenProfile(notification.targetAuthorId);
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
              onClick={() => onOpenProfile(actorProfileId)}
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
        className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5rem)] top-[calc(env(safe-area-inset-top)+4.5rem)] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.16)] md:bottom-auto md:left-auto md:right-3 md:top-16 md:max-h-[min(78vh,720px)] md:w-[min(94vw,380px)]"
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
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 rounded-xl px-2 py-2 text-[10px] font-bold uppercase tracking-[0.08em] transition-colors sm:rounded-2xl sm:px-3 sm:py-3 sm:text-xs sm:tracking-[0.14em] ${
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
