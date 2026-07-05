import { LEGAL_PAGE_SLUGS, type LegalSlug } from "./legalRoutes.js";

export type { LegalSlug } from "./legalRoutes.js";

export interface LegalLink {
  label: string;
  href: string;
  description?: string;
}

export interface LegalOfficialLink {
  label: string;
  name: string;
  href: string;
  kind: "linkedin" | "email";
}

export interface LegalOfficialLinks {
  heading: string;
  links: LegalOfficialLink[];
  support: {
    title: string;
    description: string;
    label: string;
    href: string;
  };
}

export interface LegalSection {
  id?: string;
  title: string;
  paragraphs?: string[];
  items?: string[];
  links?: LegalLink[];
  officialLinks?: LegalOfficialLinks;
}

export interface InnovationProject {
  name: string;
  description: string;
  status: "Live" | "Research" | "Planning" | "Prototype" | "Experimental" | "Completed" | "Archived";
  category: string;
  currentStage: string;
}

export interface LegalPage {
  slug: LegalSlug;
  title: string;
  eyebrow: string;
  description: string;
  schemaType: "AboutPage" | "ContactPage" | "WebPage";
  sections: LegalSection[];
  projects?: InnovationProject[];
}

export const EFFECTIVE_DATE = "July 4, 2026";
export const CONTACT_EMAIL = "reader@readative.com";
export const GITHUB_URL = "https://github.com/atulpatil5835-netizen/readative";
export const PERSONAL_LINKEDIN_URL = "https://www.linkedin.com/in/atul-hinge-304aab155";
export const COMPANY_LINKEDIN_URL = "https://www.linkedin.com/company/infohubinnovations";
export const READATIVE_LINKEDIN_URL = "https://www.linkedin.com/company/innovation-infohub/";
export const SUPPORT_READATIVE_URL = "https://razorpay.me/@atulsadanandhinge";

export const PROJECTS: InnovationProject[] = [
  {
    name: "Readative",
    description: "A live public knowledge platform for practical posts, SmartTalk Q&A, creator profiles, and reader-first discovery.",
    status: "Live",
    category: "Knowledge Platform",
    currentStage: "Production foundation and trust platform expansion",
  },
  {
    name: "Autonomous Water Cleanup System",
    description: "Researching robotic technologies capable of assisting future environmental cleanup.",
    status: "Research",
    category: "Environmental Robotics",
    currentStage: "Problem research, feasibility mapping, and concept validation",
  },
  {
    name: "Environmental Robotics",
    description: "Exploring responsible robotics concepts for sustainability, monitoring, and environmental support workflows.",
    status: "Research",
    category: "Sustainability Technology",
    currentStage: "Research notebook and early opportunity mapping",
  },
  {
    name: "Education AI",
    description: "Planning AI-assisted learning utilities that help people understand, practice, and organize knowledge without replacing human judgment.",
    status: "Planning",
    category: "Education Technology",
    currentStage: "Use-case planning and safety boundaries",
  },
  {
    name: "Future AI Utilities",
    description: "Researching small public tools that may support writing, learning, accessibility, and practical decision support.",
    status: "Research",
    category: "AI Utilities",
    currentStage: "Idea screening and responsible experimentation",
  },
];

export const LEGAL_PAGES: Record<LegalSlug, LegalPage> = {
  about: {
    slug: "about",
    title: "About Readative",
    eyebrow: "First public project",
    description: "Learn how Readative fits into Info Hub's independent innovation platform, product philosophy, mission, values, and roadmap.",
    schemaType: "AboutPage",
    sections: [
      {
        title: "Mission",
        paragraphs: [
          "Readative is the first public product from Info Hub's long-term independent innovation platform. Its mission is to make practical knowledge easier to publish, discover, question, and revisit.",
          "The platform combines creator-published posts, SmartTalk questions, trust signals, profiles, and reader tools so useful knowledge can stay connected to context instead of disappearing into a feed.",
        ],
      },
      {
        title: "Creator & Official Links",
        paragraphs: [
          "Readative is an independent knowledge platform created and maintained by Atul Hinge.",
          "Our goal is to build practical technology products that help people learn, solve problems, and explore new ideas.",
        ],
        officialLinks: {
          heading: "Official Links",
          links: [
            {
              label: "Creator",
              name: "Atul Hinge",
              href: PERSONAL_LINKEDIN_URL,
              kind: "linkedin",
            },
            {
              label: "Readative",
              name: "Readative",
              href: READATIVE_LINKEDIN_URL,
              kind: "linkedin",
            },
            {
              label: "Email",
              name: CONTACT_EMAIL,
              href: `mailto:${CONTACT_EMAIL}`,
              kind: "email",
            },
          ],
          support: {
            title: "Support Independent Innovation",
            description: "Help us build Readative and future technology projects.",
            label: "Support Readative",
            href: SUPPORT_READATIVE_URL,
          },
        },
      },
      {
        title: "Vision",
        paragraphs: [
          "The long-term vision is to build a small portfolio of public technology projects across knowledge, AI, education, environment, and sustainability. Readative is the live foundation, while future projects remain clearly labeled by lifecycle stage.",
          "Info Hub is not presenting research ideas as completed products. Projects in research, planning, prototype, experimental, completed, or archived stages are labeled transparently on the Projects page.",
        ],
        links: [
          { label: "View Projects", href: "/projects", description: "See live and future project stages." },
          { label: "Read the Mission", href: "/mission", description: "Understand the long-term platform direction." },
        ],
      },
      {
        title: "Core values",
        items: [
          "Practical usefulness over noise.",
          "Transparent lifecycle labels for future projects.",
          "Human accountability for published content and product decisions.",
          "Reader safety, context, and correction paths.",
          "Responsible experimentation instead of exaggerated technology claims.",
        ],
      },
      {
        title: "Technology philosophy",
        paragraphs: [
          "Products are built in small production-safe releases. The priority is useful public infrastructure, clear user paths, reliable crawlability, and maintainable architecture before flashy features.",
          "Readative uses AI-aware workflows and trust signals carefully. The platform does not claim that automation replaces human judgment, expertise, or verification.",
        ],
      },
      {
        title: "How products are built",
        items: [
          "Start with a real public need and a small deployable release.",
          "Keep production routes crawlable and transparent.",
          "Use policy, editorial, and correction pages as part of the product foundation.",
          "Keep future project ideas visibly separated from live products.",
          "Avoid changing data structures or core product behavior without a scoped architecture review.",
        ],
      },
      {
        title: "Open innovation approach",
        paragraphs: [
          "Open innovation here means documenting the direction, inviting useful feedback, and making project stages understandable. It does not mean every idea is finished, funded, or guaranteed to launch.",
        ],
      },
      {
        title: "Roadmap summary",
        paragraphs: [
          "Readative remains the live knowledge platform. Future work may explore education AI, environmental robotics, sustainability tools, and small AI utilities, each with realistic lifecycle labels and no promise of guaranteed outcomes.",
        ],
      },
    ],
  },
  contact: {
    slug: "contact",
    title: "Contact Readative",
    eyebrow: "We're listening",
    description: "Contact Readative for support, privacy, policy, copyright, corrections, safety, or business questions.",
    schemaType: "ContactPage",
    sections: [
      {
        title: "Official contact",
        paragraphs: [
          `Email Readative at ${CONTACT_EMAIL}. Include the relevant post, SmartTalk question, profile, project, or page URL when your request concerns specific content or platform policy.`,
        ],
        links: [
          { label: "Email Readative", href: `mailto:${CONTACT_EMAIL}`, description: "Official support, policy, privacy, correction, and business contact." },
          { label: "GitHub", href: GITHUB_URL, description: "Official Readative repository when reviewing public project code." },
          { label: "Personal LinkedIn", href: PERSONAL_LINKEDIN_URL, description: "Atul Hinge's professional profile." },
          { label: "Company LinkedIn", href: COMPANY_LINKEDIN_URL, description: "Info Hub / Infohub Innovations company presence." },
        ],
      },
      {
        title: "What to include",
        items: [
          "Support: the feature, browser, device, and a concise description of the problem.",
          "Privacy: the account email or profile identifier and the action you are requesting.",
          "Corrections: the disputed statement, supporting source, and requested correction.",
          "Copyright or safety: the exact URL, the protected work or policy concern, and your relationship to it.",
          "Business: organization, purpose, and a reliable reply address.",
        ],
      },
      {
        title: "Project and platform links",
        links: [
          { label: "Support Independent Innovation", href: "/support", description: "Support maintenance, prototypes, research, infrastructure, and free tools." },
          { label: "Projects", href: "/projects", description: "See current and future projects by lifecycle stage." },
          { label: "Mission", href: "/mission", description: "Learn why Info Hub exists and where the platform is headed." },
        ],
      },
      {
        title: "Urgent matters",
        paragraphs: [
          "Readative is not an emergency service. If someone is in immediate danger, contact the appropriate local emergency service. Legal notices should clearly identify the sender and the authority or right relied upon.",
        ],
      },
    ],
  },
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    eyebrow: "Your data, explained",
    description: "Readative's privacy policy explains account, content, device, analytics, advertising, storage, and privacy-request practices.",
    schemaType: "WebPage",
    sections: [
      {
        title: "Scope",
        paragraphs: [
          "This policy describes information processed when people browse Readative, sign in, publish content, participate in SmartTalk, react, comment, save preferences, or contact the platform.",
        ],
      },
      {
        title: "Information Readative processes",
        items: [
          "Account information provided through Google sign-in, such as an account identifier, name, email address, and profile image when available.",
          "Public contributions such as profile details, posts, images, comments, reactions, questions, answers, categories, tags, and trust signals.",
          "Private or device-local information used for Notebook features, guest identity, feed preferences, seen-item history, saved state, and performance caches where the product indicates that storage location.",
          "Technical and usage information such as page views, browser or device characteristics, referrers, and diagnostic events.",
          "Messages and supporting information sent to the contact address.",
        ],
      },
      {
        title: "Why information is used",
        items: [
          "Provide authentication, profiles, publishing, discussion, moderation, notification, personalization, and support features.",
          "Protect the service, enforce community rules, investigate abuse, and correct technical problems.",
          "Measure usage and improve reliability, navigation, and content discovery.",
          "Display and measure advertising and comply with legal obligations where applicable.",
        ],
      },
      {
        title: "Public content",
        paragraphs: [
          "Content and profile information published as public may be visible to anyone, linked by other users, included in search-engine indexes, and retained in third-party caches. Do not publish personal information you do not want publicly associated with you.",
        ],
      },
      {
        title: "Cookies, local storage, analytics, and advertising",
        paragraphs: [
          "Readative uses browser storage for sign-in persistence, guest identity, preferences, feed state, performance, and other requested features. Google Analytics is used to understand site usage. Google advertising technology may use cookies or similar identifiers to deliver and measure ads, subject to Google's controls and applicable consent requirements.",
        ],
      },
      {
        title: "Service providers and external services",
        paragraphs: [
          "Readative relies on service providers including Firebase and Google services for hosting, authentication, database, analytics, and advertising capabilities. External links, including LinkedIn and payment or support links, are governed by the destination's own policies.",
        ],
      },
      {
        title: "Retention, security, and requests",
        paragraphs: [
          "Information is retained for as long as reasonably needed to operate the service, preserve security and integrity, meet legal obligations, resolve disputes, and enforce policies. No internet service can guarantee absolute security.",
          `To request access, correction, deletion, or another privacy action, email ${CONTACT_EMAIL}. Readative may need to verify the request and may retain information where law, safety, fraud prevention, or recordkeeping requires it.`,
        ],
      },
      {
        title: "Children and changes",
        paragraphs: [
          "Readative is a general-audience knowledge service and is not directed to children under 13. If you believe a child provided personal information without appropriate permission, contact Readative.",
          `This policy is effective ${EFFECTIVE_DATE}. Material updates will be reflected on this page with a revised effective date.`,
        ],
      },
    ],
  },
  terms: {
    slug: "terms",
    title: "Terms of Use",
    eyebrow: "Use Readative responsibly",
    description: "Readative's terms cover accounts, user content, acceptable use, moderation, intellectual property, and service limitations.",
    schemaType: "WebPage",
    sections: [
      {
        title: "Acceptance and eligibility",
        paragraphs: [
          "By accessing or using Readative, you agree to these Terms and the Community Guidelines. If you do not agree, do not use the service. You must be legally able to enter this agreement and meet any minimum age required where you live.",
        ],
      },
      {
        title: "Accounts",
        paragraphs: [
          "You are responsible for activity under your account, the accuracy of information you provide, and keeping access to your sign-in provider secure. Do not impersonate another person or misrepresent your affiliation.",
        ],
      },
      {
        title: "Your content and the platform license",
        paragraphs: [
          "You retain ownership of content you create. By publishing content on Readative, you grant Readative a non-exclusive, worldwide, royalty-free license to host, store, reproduce, format, display, distribute, and make that content available as needed to operate, promote, secure, and improve the service. This license ends when content is removed, except for reasonable backups, legal records, and copies already shared or cached by others.",
          "You confirm that you have the rights and permissions needed for everything you publish and that your content does not violate law, privacy, intellectual property, or these policies.",
        ],
      },
      {
        title: "Prohibited use",
        items: [
          "Illegal, fraudulent, deceptive, abusive, hateful, sexually exploitative, or dangerous activity.",
          "Spam, scams, manipulation, impersonation, malware, unauthorized scraping, or interference with the service.",
          "Publishing private information, infringing content, or material you do not have permission to share.",
          "Attempting to bypass security, access controls, moderation, rate limits, or account restrictions.",
        ],
      },
      {
        title: "Moderation and termination",
        paragraphs: [
          "Readative may review, limit, label, hide, remove, or preserve content and may restrict or terminate access when reasonably necessary for policy enforcement, safety, legal compliance, or service integrity. Contact Readative if you believe an enforcement decision was made in error.",
        ],
      },
      {
        title: "Intellectual property and reports",
        paragraphs: [
          `Readative's software, branding, and original site materials are protected by applicable rights. To report copyright or other rights concerns, email ${CONTACT_EMAIL} with the exact URL, identification of the protected work, your contact information, and a good-faith explanation of the issue.`,
        ],
      },
      {
        title: "Service and liability limits",
        paragraphs: [
          "Readative is provided on an as-available basis. Features may change, be interrupted, or be discontinued. User-created content may be inaccurate or incomplete and does not constitute professional advice.",
          "To the maximum extent permitted by applicable law, Readative and its creator are not liable for indirect, incidental, special, consequential, or punitive losses arising from use of the service or reliance on user content. Nothing in these Terms excludes rights or liability that cannot legally be excluded.",
        ],
      },
      {
        title: "Changes and contact",
        paragraphs: [
          `These Terms are effective ${EFFECTIVE_DATE}. Continued use after a material update means you accept the revised Terms. Questions may be sent to ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  disclaimer: {
    slug: "disclaimer",
    title: "Disclaimer",
    eyebrow: "Important limits",
    description: "Important limits concerning Readative's educational, user-created, AI-assisted, external, and advertising content.",
    schemaType: "WebPage",
    sections: [
      {
        title: "Educational information only",
        paragraphs: [
          "Readative provides general information and learning material. It is not a substitute for legal, medical, financial, mental-health, safety, or other professional advice. Consult an appropriately qualified professional for decisions that carry significant risk.",
        ],
      },
      {
        title: "User-created and AI-assisted content",
        paragraphs: [
          "Creators are responsible for their posts, questions, answers, comments, and sources. Some material may be prepared with AI assistance. Readative does not guarantee that every contribution is accurate, complete, current, original, or suitable for a particular purpose. Verify important claims independently.",
        ],
      },
      {
        title: "Trust signals and recommendations",
        paragraphs: [
          "Reactions, badges, answer labels, rankings, recommendations, and related-content links are contextual product signals. They are not professional endorsements and should not be treated as proof that a claim is correct.",
        ],
      },
      {
        title: "External links, advertising, and support",
        paragraphs: [
          "External websites control their own content and practices. Readative may display advertising and may link to payment, donation, or other commercial services. The presence of a link or advertisement does not guarantee or endorse the destination, product, or claim unless expressly stated.",
        ],
      },
      {
        title: "Updates",
        paragraphs: [
          `Content may change without notice as authors revise work or the service evolves. This disclaimer is effective ${EFFECTIVE_DATE}. Report a material concern to ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  community: {
    slug: "community",
    title: "Community Guidelines",
    eyebrow: "Learn generously",
    description: "Readative's community guidelines explain participation, prohibited content, attribution, moderation, reporting, and appeals.",
    schemaType: "WebPage",
    sections: [
      {
        title: "Share useful knowledge",
        items: [
          "Make posts and answers relevant, understandable, and genuinely useful to readers.",
          "Distinguish evidence, personal experience, opinion, and uncertainty.",
          "Credit sources and creators, and disclose material sponsorship, affiliation, or AI assistance when it affects reader understanding.",
          "Correct meaningful errors when they are identified.",
        ],
      },
      {
        title: "Treat people with respect",
        paragraphs: [
          "Challenge ideas without attacking people. Harassment, threats, hateful conduct, sexual exploitation, targeted humiliation, stalking, and unwanted disclosure of personal information are not allowed.",
        ],
      },
      {
        title: "Keep the platform safe and authentic",
        items: [
          "No impersonation, coordinated deception, scams, spam, malware, manipulated engagement, or fraudulent credentials.",
          "No instructions intended to facilitate serious harm, illegal access, exploitation, or evasion of safety controls.",
          "Do not present dangerous, medical, legal, or financial claims as certain when qualified context is necessary.",
          "Do not upload copyrighted, private, or confidential material without permission or another lawful basis.",
        ],
      },
      {
        title: "Commercial content",
        paragraphs: [
          "Relevant commercial references may be allowed when transparent and useful. Repetitive promotion, undisclosed affiliate interests, deceptive claims, and link spam are not allowed.",
        ],
      },
      {
        title: "Enforcement, reporting, and appeals",
        paragraphs: [
          "Readative may warn, label, reduce distribution, hide, remove, or preserve content, and may restrict accounts based on severity, context, history, and risk. Repeated or severe violations may lead to permanent restrictions.",
          `Report concerns or appeal a decision at ${CONTACT_EMAIL}. Include the exact URL, the rule or right involved, relevant evidence, and why you believe action is needed or should be reconsidered.`,
        ],
      },
      {
        title: "Policy date",
        paragraphs: [`These guidelines are effective ${EFFECTIVE_DATE}.`],
      },
    ],
  },
  support: {
    slug: "support",
    title: "Support Independent Innovation",
    eyebrow: "Build responsibly",
    description: "Support Readative and Info Hub's independent innovation work across maintenance, prototypes, research, infrastructure, and free public tools.",
    schemaType: "WebPage",
    sections: [
      {
        title: "Support independent innovation",
        paragraphs: [
          "Support helps maintain Readative and gives the broader Info Hub innovation platform more room to research, prototype, and improve public technology tools.",
          "Support is not presented as charity, nonprofit giving, investment, or a promise of guaranteed outcomes. It helps fund responsible experimentation and ongoing product maintenance.",
        ],
      },
      {
        title: "Support helps us",
        items: [
          "Maintain public products such as Readative.",
          "Build prototypes for future technology projects.",
          "Research new technology directions.",
          "Improve infrastructure, reliability, and crawlability.",
          "Create free public tools where practical.",
          "Experiment responsibly with clear lifecycle labels.",
        ],
      },
      {
        id: "faq",
        title: "FAQ",
        items: [
          "Is this a nonprofit? No. Support is for independent product and research work and is not represented as tax-deductible charitable giving.",
          "Does support guarantee a project will launch? No. Research and planning projects may change, pause, or be archived.",
          "Does support buy editorial influence? No. Editorial, content, correction, and copyright policies remain separate from support.",
        ],
      },
      {
        title: "Related pages",
        links: [
          { label: "Projects", href: "/projects", description: "See what is live, in research, planning, prototype, or archived." },
          { label: "Mission", href: "/mission", description: "Read the long-term direction for Info Hub." },
          { label: "Contact", href: "/contact", description: "Ask about support, policy, or project questions." },
        ],
      },
    ],
  },
  projects: {
    slug: "projects",
    title: "Projects",
    eyebrow: "Innovation platform",
    description: "Explore Readative and future Info Hub technology projects with transparent lifecycle stages such as Live, Research, Planning, Prototype, Experimental, Completed, or Archived.",
    schemaType: "WebPage",
    projects: PROJECTS,
    sections: [
      {
        title: "Project lifecycle transparency",
        paragraphs: [
          "Every project listed here has a visible lifecycle stage. Readative is live. Future technology ideas are not presented as finished products unless they actually reach that stage.",
          "Research and planning projects may evolve, pause, merge, or be archived as the work becomes clearer.",
        ],
      },
    ],
  },
  mission: {
    slug: "mission",
    title: "Mission",
    eyebrow: "Why Info Hub exists",
    description: "Info Hub exists to build practical technology projects across knowledge, AI, education, environment, and sustainability with realistic public transparency.",
    schemaType: "AboutPage",
    sections: [
      {
        title: "Why Info Hub exists",
        paragraphs: [
          "Info Hub exists to explore useful technology in public, starting with products that help people learn, organize, and apply knowledge.",
          "Readative was created first because knowledge infrastructure is a practical base for future work: it gives creators a place to publish, readers a way to discover context, and the platform a way to document ideas responsibly.",
        ],
      },
      {
        title: "Long-term vision",
        paragraphs: [
          "The long-term direction includes knowledge platforms, responsible AI utilities, education tools, environmental technology research, and sustainability-focused experiments.",
          "The mission is intentionally realistic: build small, useful systems; learn from public feedback; label project maturity honestly; and avoid exaggerated promises.",
        ],
      },
      {
        title: "Technology directions",
        items: [
          "Knowledge: better publishing, discovery, questions, and saved learning.",
          "AI: practical utilities that support people without replacing judgment.",
          "Environment: early research into tools that may assist monitoring or cleanup workflows.",
          "Education: learning tools that improve understanding, practice, and accessibility.",
          "Sustainability: projects that make responsible experimentation easier to evaluate.",
        ],
      },
    ],
  },
  "editorial-policy": {
    slug: "editorial-policy",
    title: "Editorial Policy",
    eyebrow: "Publishing standards",
    description: "Readative's editorial policy explains attribution, accuracy, independence, AI assistance, sources, and review expectations.",
    schemaType: "WebPage",
    sections: [
      {
        title: "Editorial purpose",
        paragraphs: [
          "Readative is designed for practical learning and public knowledge sharing. Editorial standards prioritize clarity, usefulness, attribution, transparency, and correction paths.",
        ],
      },
      {
        title: "Author responsibility",
        items: [
          "Authors are responsible for their posts, questions, answers, comments, and sources.",
          "Claims should distinguish evidence, experience, opinion, and uncertainty.",
          "AI assistance should not be used to mislead readers about authorship, expertise, or evidence.",
          "Sponsored, affiliate, or materially connected recommendations should be disclosed where they affect reader trust.",
        ],
      },
      {
        title: "Platform review",
        paragraphs: [
          "Readative may review or limit content for policy, safety, copyright, privacy, spam, quality, or legal reasons. Review decisions do not create a guarantee that all remaining content is accurate or complete.",
        ],
      },
    ],
  },
  "content-policy": {
    slug: "content-policy",
    title: "Content Policy",
    eyebrow: "What belongs here",
    description: "Readative's content policy defines permitted and prohibited content, safety limits, authenticity expectations, and moderation actions.",
    schemaType: "WebPage",
    sections: [
      {
        title: "Allowed content",
        paragraphs: [
          "Readative welcomes practical learning posts, thoughtful explanations, SmartTalk questions, grounded answers, project notes, tools, examples, and constructive discussion.",
        ],
      },
      {
        title: "Not allowed",
        items: [
          "Illegal activity, exploitation, threats, harassment, hate, sexual exploitation, or targeted abuse.",
          "Private information, doxxing, impersonation, scams, malware, spam, or manipulated engagement.",
          "Copyrighted, confidential, or private material shared without permission or another lawful basis.",
          "Dangerous instructions or unsupported high-risk claims presented without necessary context.",
          "Deceptive AI-generated content, fake credentials, or undisclosed material conflicts of interest.",
        ],
      },
      {
        title: "Moderation actions",
        paragraphs: [
          "Readative may label, reduce distribution, hide, remove, preserve, or restrict content and accounts based on severity, context, history, and risk.",
        ],
      },
    ],
  },
  "corrections-policy": {
    slug: "corrections-policy",
    title: "Corrections Policy",
    eyebrow: "Fix meaningful errors",
    description: "Readative's corrections policy explains how readers can report factual, policy, attribution, copyright, or safety concerns.",
    schemaType: "WebPage",
    sections: [
      {
        title: "Correction requests",
        paragraphs: [
          `Send correction requests to ${CONTACT_EMAIL}. Include the exact URL, the disputed statement, supporting source or context, and the correction you believe is needed.`,
        ],
      },
      {
        title: "Review outcomes",
        items: [
          "No change if the concern cannot be verified or does not materially affect readers.",
          "Author update or visible correction when a meaningful error is confirmed.",
          "Reduced visibility, labeling, or removal when content creates policy, safety, privacy, or legal risk.",
          "Escalation to copyright or DMCA review when the issue concerns protected works.",
        ],
      },
      {
        title: "Limits",
        paragraphs: [
          "Corrections are handled in proportion to the issue. Readative cannot guarantee immediate review, agreement with every request, or correction of copies cached by third parties.",
        ],
      },
    ],
  },
  cookies: {
    slug: "cookies",
    title: "Cookie Policy",
    eyebrow: "Browser storage",
    description: "Readative's cookie policy explains essential cookies, preference storage, future analytics or advertising use, authentication persistence, and user controls.",
    schemaType: "WebPage",
    sections: [
      {
        title: "Essential Cookies",
        paragraphs: [
          "Readative uses essential browser storage to keep the service reliable, remember consent, support sign-in, protect sessions, and keep reading tools working.",
        ],
        items: [
          "Authentication and session persistence through Google/Firebase services.",
          "Security, abuse prevention, and basic platform reliability.",
          "Consent version storage so the first-visit notice does not interrupt reading again.",
        ],
      },
      {
        title: "Preference Storage",
        paragraphs: [
          "Readative may use local storage, session storage, IndexedDB, and similar browser technologies to remember choices you make in the product.",
        ],
        items: [
          "Guest identity, profile preferences, saved reading state, and feed convenience state.",
          "Notebook-related local behavior and performance caches needed for a smoother reading experience.",
          "Browser notification permission status when you choose whether to enable notifications.",
        ],
      },
      {
        title: "Future Analytics",
        paragraphs: [
          "Readative may add privacy-conscious analytics in the future to understand reliability and improve the service. If analytics storage is not essential, Readative will explain the purpose and use consent controls where required.",
        ],
      },
      {
        title: "Future Advertising",
        paragraphs: [
          "Readative may support advertising in the future. If advertising cookies or similar identifiers are used, Readative will explain the purpose, respect applicable consent requirements, and provide clear controls.",
        ],
      },
      {
        title: "Controls",
        paragraphs: [
          "You can adjust browser settings, clear site data, use platform privacy controls, or manage Google-related ad and analytics preferences. Some features may not work correctly if required storage is disabled.",
        ],
      },
    ],
  },
  copyright: {
    slug: "copyright",
    title: "Copyright Policy",
    eyebrow: "Respect creative work",
    description: "Readative's copyright policy explains creator rights, user responsibilities, reporting requirements, and platform review actions.",
    schemaType: "WebPage",
    sections: [
      {
        title: "Creator rights",
        paragraphs: [
          "Authors retain ownership of content they create and grant Readative the license described in the Terms so the service can host, display, secure, and improve the platform.",
        ],
      },
      {
        title: "User responsibilities",
        items: [
          "Only publish material you created, have permission to use, or can lawfully share.",
          "Credit sources and creators where attribution is required or important for reader understanding.",
          "Do not remove rights notices or present someone else's work as your own.",
        ],
      },
      {
        title: "Report a concern",
        paragraphs: [
          `Email ${CONTACT_EMAIL} with the exact URL, identification of the protected work, your contact information, and a good-faith explanation of the issue.`,
        ],
        links: [
          { label: "DMCA Policy", href: "/dmca", description: "See the specific notice and counter-notice process." },
          { label: "Contact", href: "/contact", description: "Use the official contact page for rights questions." },
        ],
      },
    ],
  },
  dmca: {
    slug: "dmca",
    title: "DMCA Policy",
    eyebrow: "Copyright notices",
    description: "Readative's DMCA policy explains copyright takedown notices, counter-notices, repeat infringement handling, and contact requirements.",
    schemaType: "WebPage",
    sections: [
      {
        title: "Takedown notices",
        paragraphs: [
          `To submit a DMCA-style notice, email ${CONTACT_EMAIL}. Include the copyrighted work, the exact Readative URL, your contact information, a good-faith statement, an accuracy statement, and an electronic or physical signature.`,
        ],
      },
      {
        title: "Counter-notices",
        paragraphs: [
          "If your content was removed and you believe it was removed by mistake or misidentification, you may send a counter-notice with the removed URL, your contact information, a good-faith statement, consent to appropriate jurisdiction where required, and your signature.",
        ],
      },
      {
        title: "Repeat infringement and records",
        paragraphs: [
          "Readative may remove or disable access to allegedly infringing material and may restrict accounts that repeatedly violate copyright. Notices may be preserved for legal, security, and abuse-prevention purposes.",
        ],
      },
    ],
  },
};

export const PAGE_ORDER: LegalSlug[] = [...LEGAL_PAGE_SLUGS];
