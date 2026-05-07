import { type ReactNode } from "react";
import {
  BookOpenText,
  CheckCircle2,
  ExternalLink,
  FileText,
  Info,
  Linkedin,
  Mail,
  Scale,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { SEO } from "./SEO";
import {
  buildAbsoluteRouteUrl,
  buildPublicPath,
  type AppTab,
  type StaticAppTab,
} from "../utils/routes";

const contactEmail = "reader@readative.com";
const siteUrl = "https://readative.com";
const lastUpdated = "May 7, 2026";

const pageMeta: Record<
  StaticAppTab,
  {
    title: string;
    eyebrow: string;
    heading: string;
    description: string;
    keywords: string[];
    icon: ReactNode;
  }
> = {
  about: {
    title: "About Readative",
    eyebrow: "About",
    heading: "A knowledge-first community for useful learning posts.",
    description:
      "Learn about Readative, a knowledge sharing community built for educational posts, practical ideas, and respectful discussion.",
    keywords: ["about readative", "educational community", "knowledge platform"],
    icon: <Info className="h-5 w-5" />,
  },
  contact: {
    title: "Contact Readative",
    eyebrow: "Contact",
    heading: "Reach the Readative team for support, privacy, or business questions.",
    description:
      "Contact Readative for support, privacy requests, copyright concerns, business questions, and creator communication.",
    keywords: ["contact readative", "support", "privacy contact"],
    icon: <Mail className="h-5 w-5" />,
  },
  privacy: {
    title: "Privacy Policy",
    eyebrow: "Privacy",
    heading: "Privacy practices for accounts, community activity, ads, and cookies.",
    description:
      "Readative Privacy Policy covering account information, user posts, comments, likes, notifications, cookies, Google advertising, and user choices.",
    keywords: ["privacy policy", "cookies", "google advertising", "user data"],
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  terms: {
    title: "Terms & Conditions",
    eyebrow: "Terms",
    heading: "Clear rules for using Readative responsibly.",
    description:
      "Readative Terms and Conditions covering community rules, user content, prohibited activity, moderation, copyright, ads, and third-party links.",
    keywords: ["terms and conditions", "community rules", "user content"],
    icon: <Scale className="h-5 w-5" />,
  },
  author: {
    title: "Author Identity",
    eyebrow: "Author Identity",
    heading: "Readative is created and maintained by Atul Hinge.",
    description:
      "Author identity and editorial responsibility for Readative, including creator information, contact details, and official profile links.",
    keywords: ["author identity", "Atul Hinge", "Readative creator"],
    icon: <UserRound className="h-5 w-5" />,
  },
};

interface StaticPageProps {
  page: StaticAppTab;
  onNavigate: (tab: AppTab) => void;
}

export function StaticPage({ page, onNavigate }: StaticPageProps) {
  const meta = pageMeta[page];
  const schema = createSchema(page);

  return (
    <article className="space-y-8">
      <SEO
        title={meta.title}
        description={meta.description}
        keywords={meta.keywords}
        url={buildAbsoluteRouteUrl(page)}
        type={page === "author" ? "profile" : "website"}
        schema={schema}
      />

      <section className="border-b border-slate-200 pb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
          {meta.icon}
          {meta.eyebrow}
        </div>
        <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          {meta.heading}
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          {meta.description}
        </p>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
          Last updated: {lastUpdated}
        </p>
      </section>

      {page === "about" && <AboutContent onNavigate={onNavigate} />}
      {page === "contact" && <ContactContent />}
      {page === "privacy" && <PrivacyContent onNavigate={onNavigate} />}
      {page === "terms" && <TermsContent onNavigate={onNavigate} />}
      {page === "author" && <AuthorContent />}
    </article>
  );
}

function AboutContent({ onNavigate }: { onNavigate: (tab: AppTab) => void }) {
  return (
    <>
      <Section
        icon={<BookOpenText className="h-5 w-5" />}
        title="What Readative Does"
      >
        <p>
          Readative helps people share short educational posts, practical lessons,
          useful references, and thoughtful discussion. The product is built
          around a knowledge feed and SmartTalk conversations, with a focus on
          learning value over empty engagement.
        </p>
        <p>
          Posts should be original, helpful, and safe for a broad audience. The
          platform discourages spam, copied content, misleading information,
          harassment, adult content, and anything that harms trust in the
          community.
        </p>
      </Section>

      <Section
        icon={<CheckCircle2 className="h-5 w-5" />}
        title="Quality Standards"
      >
        <QualityList
          items={[
            "Educational or practical posts are prioritized for readers.",
            "Community activity should be respectful and relevant.",
            "Copyrighted material should only be shared with permission.",
            "Low-value spam, scams, and harmful content can be removed.",
          ]}
        />
      </Section>

      <Callout
        title="Need help or policy details?"
        body="Use the contact page for support, privacy requests, copyright concerns, and business questions."
        action={<InternalPageLink tab="contact" onNavigate={onNavigate} />}
      />
    </>
  );
}

function ContactContent() {
  return (
    <>
      <Section icon={<Mail className="h-5 w-5" />} title="Official Contact">
        <p>
          Use this email for account help, privacy requests, copyright concerns,
          reporting unsafe content, business inquiries, and general Readative
          support.
        </p>
        <a
          href={`mailto:${contactEmail}`}
          className="mt-5 inline-flex items-center gap-3 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
        >
          <Mail className="h-4 w-4" />
          {contactEmail}
        </a>
      </Section>

      <Section
        icon={<Linkedin className="h-5 w-5" />}
        title="Official Profiles"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <ExternalProfileLink
            href="https://www.linkedin.com/company/innovation-infohub/"
            label="Innovation InfoHub"
            detail="Company LinkedIn"
          />
          <ExternalProfileLink
            href="https://www.linkedin.com/in/atul-hinge-304aab155/"
            label="Atul Hinge"
            detail="Creator LinkedIn"
          />
        </div>
      </Section>
    </>
  );
}

function PrivacyContent({ onNavigate }: { onNavigate: (tab: AppTab) => void }) {
  return (
    <>
      <Section icon={<ShieldCheck className="h-5 w-5" />} title="Information We Use">
        <PolicyList
          items={[
            {
              title: "Account and profile details",
              body: "If you sign in or create a profile, Readative may store your display name, author ID, avatar choice, and related profile information needed to run your account.",
            },
            {
              title: "Community activity",
              body: "Posts, comments, likes, ratings, shares, notifications, reports, and similar actions may be stored so the feed, profiles, and community features work properly.",
            },
            {
              title: "Personalized feed signals",
              body: "Readative may use your liked topics, engagement patterns, and local app signals to rank educational posts for your account or current browser.",
            },
            {
              title: "Technical information",
              body: "The app and hosting providers may process basic technical data such as device, browser, pages visited, referrer, approximate region, and error information for security and performance.",
            },
          ]}
        />
      </Section>

      <Section icon={<FileText className="h-5 w-5" />} title="Cookies, Ads, and Analytics">
        <p>
          Readative may use cookies, local storage, analytics, and advertising
          technology to remember preferences, measure site performance, protect
          the platform, and support monetization.
        </p>
        <p>
          If Google ads are shown, Google and its partners may use cookies or
          similar technologies to serve ads based on a user's prior visits to
          Readative or other websites. These cookies can also help limit ad
          frequency, measure ad performance, and personalize ads where allowed by
          law and user consent.
        </p>
        <p>
          Third-party vendors and ad networks may place or read cookies, use web
          beacons, or collect technical signals as part of ad serving. Users can
          manage some ad personalization settings through Google Ads Settings and
          can also control cookies in their browser settings.
        </p>
        <a
          href="https://adssettings.google.com/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 font-bold text-emerald-700 transition-colors hover:text-emerald-800"
        >
          Manage Google ad personalization
          <ExternalLink className="h-4 w-4" />
        </a>
        <a
          href="https://policies.google.com/technologies/partner-sites"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 font-bold text-emerald-700 transition-colors hover:text-emerald-800"
        >
          How Google uses data on partner sites
          <ExternalLink className="h-4 w-4" />
        </a>
      </Section>

      <Section icon={<UserRound className="h-5 w-5" />} title="Your Choices">
        <QualityList
          items={[
            `Contact ${contactEmail} for privacy, deletion, or correction requests.`,
            "Use browser controls to delete cookies or local storage.",
            "Only publish content you are comfortable making visible to other users.",
            "Open the Terms page to understand community content rules.",
          ]}
        />
      </Section>

      <Callout
        title="Questions about privacy?"
        body="The contact page has the official support address for privacy and policy requests."
        action={<InternalPageLink tab="contact" onNavigate={onNavigate} />}
      />
    </>
  );
}

function TermsContent({ onNavigate }: { onNavigate: (tab: AppTab) => void }) {
  return (
    <>
      <Section icon={<Scale className="h-5 w-5" />} title="Using Readative">
        <p>
          By using Readative, you agree to use the platform lawfully, respectfully,
          and in a way that supports an educational community. You are responsible
          for the content you publish and the activity connected to your account.
        </p>
      </Section>

      <Section icon={<FileText className="h-5 w-5" />} title="User Content">
        <PolicyList
          items={[
            {
              title: "Ownership",
              body: "You keep ownership of content you create, but you allow Readative to display, distribute, and format that content inside the service.",
            },
            {
              title: "Originality and permission",
              body: "Do not post copyrighted, copied, private, or third-party material unless you have the right to share it.",
            },
            {
              title: "Moderation",
              body: "Readative may remove content, restrict access, or limit accounts that create legal risk, violate these terms, or harm community trust.",
            },
          ]}
        />
      </Section>

      <Section icon={<ShieldCheck className="h-5 w-5" />} title="Not Allowed">
        <QualityList
          items={[
            "Spam, scams, deceptive behavior, or artificial engagement.",
            "Harassment, hate, threats, exploitation, or unsafe behavior.",
            "Adult, shocking, violent, illegal, or otherwise harmful content.",
            "Malware, phishing, scraping abuse, or attempts to disrupt the app.",
            "Content that infringes copyright, trademarks, privacy, or publicity rights.",
          ]}
        />
      </Section>

      <Section icon={<ExternalLink className="h-5 w-5" />} title="Ads and Third-Party Links">
        <p>
          Readative may show advertising or link to external websites. Third-party
          sites, services, and advertisers are responsible for their own content,
          terms, and privacy practices.
        </p>
      </Section>

      <Callout
        title="Need to report a terms issue?"
        body="Send policy, copyright, or safety concerns through the official contact address."
        action={<InternalPageLink tab="contact" onNavigate={onNavigate} />}
      />
    </>
  );
}

function AuthorContent() {
  return (
    <>
      <Section icon={<UserRound className="h-5 w-5" />} title="Creator">
        <p className="text-xl font-black tracking-tight text-slate-950">
          Atul Hinge
        </p>
        <p>
          Atul Hinge is the founder and creator of Readative. The platform is
          built to help readers discover practical knowledge posts and take part
          in useful, respectful learning conversations.
        </p>
      </Section>

      <Section icon={<CheckCircle2 className="h-5 w-5" />} title="Editorial Responsibility">
        <p>
          Readative is designed as a community platform, so user posts may come
          from many authors. The creator identity page provides transparency about
          who maintains the product, while individual users remain responsible for
          the posts and comments they publish.
        </p>
        <QualityList
          items={[
            "Community rules favor useful, educational, and original content.",
            "Unsafe, copied, misleading, or abusive content can be removed.",
            "Users can contact Readative for privacy, policy, copyright, or support questions.",
          ]}
        />
      </Section>

      <Section
        icon={<Linkedin className="h-5 w-5" />}
        title="Identity Links"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <ExternalProfileLink
            href="https://www.linkedin.com/in/atul-hinge-304aab155/"
            label="Atul Hinge"
            detail="Creator LinkedIn"
          />
          <ExternalProfileLink
            href="https://www.linkedin.com/company/innovation-infohub/"
            label="Innovation InfoHub"
            detail="Company LinkedIn"
          />
        </div>
      </Section>
    </>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white px-5 py-6 shadow-sm sm:px-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          {icon}
        </span>
        <h2 className="text-xl font-black tracking-tight text-slate-950">
          {title}
        </h2>
      </div>
      <div className="space-y-4 text-sm leading-7 text-slate-600">{children}</div>
    </section>
  );
}

function PolicyList({
  items,
}: {
  items: Array<{ title: string; body: string }>;
}) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.title} className="border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
          <h3 className="text-sm font-black text-slate-900">{item.title}</h3>
          <p className="mt-1 text-sm leading-7 text-slate-600">{item.body}</p>
        </div>
      ))}
    </div>
  );
}

function QualityList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Callout({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-6 shadow-sm sm:px-6">
      <h2 className="text-xl font-black tracking-tight text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
      <div className="mt-5">{action}</div>
    </section>
  );
}

function InternalPageLink({
  tab,
  onNavigate,
}: {
  tab: AppTab;
  onNavigate: (tab: AppTab) => void;
}) {
  return (
    <a
      href={buildPublicPath(tab)}
      onClick={(event) => {
        event.preventDefault();
        onNavigate(tab);
      }}
      className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
    >
      Open {pageLabel(tab)}
      <ExternalLink className="h-4 w-4" />
    </a>
  );
}

function ExternalProfileLink({
  href,
  label,
  detail,
}: {
  href: string;
  label: string;
  detail: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-900 transition-colors hover:border-emerald-200 hover:bg-emerald-50"
    >
      <span>
        <span className="block text-sm font-black">{label}</span>
        <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          {detail}
        </span>
      </span>
      <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
    </a>
  );
}

function pageLabel(tab: AppTab) {
  const labels: Record<AppTab, string> = {
    knowledge: "Home",
    smarttalk: "SmartTalk",
    profile: "Profile",
    about: "About",
    contact: "Contact",
    privacy: "Privacy Policy",
    terms: "Terms & Conditions",
    author: "Author Identity",
  };

  return labels[tab];
}

function createSchema(page: StaticAppTab) {
  const meta = pageMeta[page];
  const url = `${siteUrl}${buildPublicPath(page)}`;
  const baseOrganization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Readative",
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    founder: {
      "@type": "Person",
      name: "Atul Hinge",
      sameAs: ["https://www.linkedin.com/in/atul-hinge-304aab155/"],
    },
    contactPoint: {
      "@type": "ContactPoint",
      email: contactEmail,
      contactType: "customer support",
    },
    sameAs: ["https://www.linkedin.com/company/innovation-infohub/"],
  };

  if (page === "author") {
    return [
      baseOrganization,
      {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        name: meta.title,
        description: meta.description,
        url,
        mainEntity: {
          "@type": "Person",
          name: "Atul Hinge",
          jobTitle: "Founder and creator of Readative",
          email: contactEmail,
          sameAs: [
            "https://www.linkedin.com/in/atul-hinge-304aab155/",
            "https://www.linkedin.com/company/innovation-infohub/",
          ],
        },
      },
    ];
  }

  return [
    baseOrganization,
    {
      "@context": "https://schema.org",
      "@type":
        page === "about"
          ? "AboutPage"
          : page === "contact"
          ? "ContactPage"
          : "WebPage",
      name: meta.title,
      description: meta.description,
      url,
      publisher: baseOrganization,
      dateModified: "2026-05-07",
    },
  ];
}
