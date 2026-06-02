export type SeoCategoryId =
  | "ai"
  | "technology"
  | "business"
  | "marketing"
  | "startup"
  | "productivity"
  | "development"
  | "cybersecurity";

export interface SeoCategoryDefinition {
  id: SeoCategoryId;
  label: string;
  path: string;
  description: string;
  what: string;
  why: string;
  who: string;
  benefits: string[];
  examples: string[];
  topicSlugs: string[];
  tagSlugs: string[];
  keywords: string[];
  aliases: string[];
}

export interface SeoTopicDefinition {
  id: string;
  label: string;
  categoryId: SeoCategoryId;
  path: string;
  collectionTitle: string;
  description: string;
  keywords: readonly string[];
  tagSlugs: string[];
  aliases: string[];
}

export interface SeoTagDefinition {
  id: string;
  label: string;
  path: string;
  description: string;
  categoryIds: SeoCategoryId[];
  aliases: string[];
}

export function normalizeSeoSlug(value: string | null | undefined) {
  const normalized = value
    ?.replace(/^#/, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || null;
}

export const SEO_CATEGORIES = [
  {
    id: "ai",
    label: "AI",
    path: "/category/ai",
    description:
      "AI knowledge for practical model use, assistants, agents, prompting, and automation.",
    what:
      "AI covers hands-on use of models, copilots, agents, prompt workflows, and AI tools.",
    why:
      "Readers need clear comparisons, examples, and use cases before adopting fast-moving AI products.",
    who:
      "Builders, marketers, founders, students, creators, and teams evaluating AI workflows.",
    benefits: [
      "Compare AI assistants and model ecosystems",
      "Find repeatable prompt and automation patterns",
      "Learn where AI tools fit into real work",
    ],
    examples: ["ChatGPT", "Claude", "Gemini", "AI tools", "prompt engineering"],
    topicSlugs: [
      "chatgpt",
      "claude",
      "gemini",
      "ai-tools",
      "prompt-engineering",
      "ai-automation",
    ],
    tagSlugs: ["ai-tools", "automation", "prompt-engineering", "free-tools"],
    keywords: [
      "ai",
      "artificial intelligence",
      "chatgpt",
      "claude",
      "gemini",
      "openai",
      "llm",
      "prompt",
      "prompting",
      "machine learning",
      "copilot",
      "agent",
      "automation",
    ],
    aliases: ["artificial-intelligence", "machine-learning", "llm"],
  },
  {
    id: "technology",
    label: "Technology",
    path: "/category/technology",
    description:
      "Technology coverage for platforms, apps, SaaS, technical trends, and useful products.",
    what:
      "Technology includes software platforms, apps, SaaS tools, product updates, and technical explainers.",
    why:
      "Readers need a durable place to compare technology choices without scattering posts into dozens of categories.",
    who:
      "Operators, students, creators, product teams, and professionals tracking modern software.",
    benefits: [
      "Discover useful tools and platforms",
      "Understand technology trends without hype",
      "Connect broad tech updates to practical workflows",
    ],
    examples: ["Vercel", "Supabase", "SaaS", "mobile apps", "technology guides"],
    topicSlugs: [
      "vercel",
      "supabase",
      "saas",
      "mobile-apps",
      "technology-guides",
      "software-tools",
    ],
    tagSlugs: ["tools", "saas", "free-tools", "platforms"],
    keywords: [
      "technology",
      "tech",
      "apps",
      "app",
      "software",
      "saas",
      "platform",
      "tools",
      "mobile",
      "ios",
      "android",
      "extension",
      "web app",
    ],
    aliases: ["tech", "apps", "tools", "software-tools"],
  },
  {
    id: "business",
    label: "Business",
    path: "/category/business",
    description:
      "Business knowledge for strategy, operations, monetization, teams, and market decisions.",
    what:
      "Business covers operating models, strategy, customer decisions, pricing, operations, and growth foundations.",
    why:
      "Business posts need a stable home even when they overlap with startup, marketing, or productivity content.",
    who:
      "Founders, operators, managers, students, and professionals improving how work creates value.",
    benefits: [
      "Frame decisions with clearer business context",
      "Connect tactics to operating outcomes",
      "Find evergreen playbooks for teams and markets",
    ],
    examples: ["business strategy", "operations", "SaaS", "pricing", "growth"],
    topicSlugs: ["business-strategy", "operations", "saas", "pricing", "growth"],
    tagSlugs: ["growth", "operations", "playbooks"],
    keywords: [
      "business",
      "strategy",
      "operations",
      "pricing",
      "revenue",
      "customer",
      "market",
      "sales",
      "team",
      "monetization",
      "growth",
    ],
    aliases: ["strategy", "operations"],
  },
  {
    id: "marketing",
    label: "Marketing",
    path: "/category/marketing",
    description:
      "Marketing knowledge for SEO, content, social media, campaigns, growth, and brand systems.",
    what:
      "Marketing includes acquisition, SEO, social media, content, email, brand, ads, and growth workflows.",
    why:
      "Marketing advice becomes useful when examples, metrics, and channel context are grouped together.",
    who:
      "Marketers, founders, creators, agencies, and teams building repeatable growth systems.",
    benefits: [
      "Compare channels and campaign tactics",
      "Find search and content workflows",
      "Turn marketing ideas into practical experiments",
    ],
    examples: ["SEO", "digital marketing", "social media", "content marketing", "marketing tools"],
    topicSlugs: [
      "seo",
      "digital-marketing",
      "social-media-marketing",
      "content-marketing",
      "email-marketing",
      "marketing-tools",
    ],
    tagSlugs: ["growth", "social-media", "seo", "content"],
    keywords: [
      "marketing",
      "seo",
      "growth",
      "ads",
      "advertising",
      "brand",
      "campaign",
      "content",
      "newsletter",
      "copywriting",
      "email marketing",
      "social media",
      "digital marketing",
    ],
    aliases: ["digital-marketing", "growth-marketing"],
  },
  {
    id: "startup",
    label: "Startup",
    path: "/category/startup",
    description:
      "Startup knowledge for founders, MVPs, launch strategy, fundraising, and early customer growth.",
    what:
      "Startup covers early company building, product validation, fundraising, launch, and founder workflows.",
    why:
      "Startup content needs one durable pillar instead of splitting into many temporary business subcategories.",
    who:
      "Founders, indie builders, product managers, operators, and students learning company building.",
    benefits: [
      "Find launch and MVP playbooks",
      "Connect tools to founder workflows",
      "Learn practical customer and fundraising lessons",
    ],
    examples: ["MVP", "fundraising", "startup tools", "product-market fit", "launch"],
    topicSlugs: [
      "startup-tools",
      "mvp",
      "fundraising",
      "product-market-fit",
      "founder-playbook",
    ],
    tagSlugs: ["startup", "growth", "tools", "playbooks"],
    keywords: [
      "startup",
      "startups",
      "founder",
      "mvp",
      "launch",
      "fundraising",
      "customer",
      "product market",
      "bootstrapping",
      "venture",
    ],
    aliases: ["startups", "founders"],
  },
  {
    id: "productivity",
    label: "Productivity",
    path: "/category/productivity",
    description:
      "Productivity knowledge for workflows, automation, focus systems, templates, and personal operating habits.",
    what:
      "Productivity includes workflows, focus, automation, templates, habits, and repeatable personal systems.",
    why:
      "Readers need practical systems that connect tools to better work, not scattered productivity tips.",
    who:
      "Students, creators, professionals, operators, and teams improving how work gets done.",
    benefits: [
      "Build repeatable workflows",
      "Find useful automation ideas",
      "Compare templates and systems",
    ],
    examples: ["automation", "Notion", "workflow systems", "templates", "focus"],
    topicSlugs: [
      "productivity-tools",
      "automation",
      "notion",
      "workflow-systems",
      "templates",
    ],
    tagSlugs: ["automation", "templates", "workflows", "free-tools"],
    keywords: [
      "productivity",
      "workflow",
      "automation",
      "focus",
      "habit",
      "time",
      "template",
      "templates",
      "notion",
      "calendar",
      "shortcut",
    ],
    aliases: ["learning", "workflow"],
  },
  {
    id: "development",
    label: "Development",
    path: "/category/development",
    description:
      "Development knowledge for programming, coding tools, APIs, frameworks, and technical implementation.",
    what:
      "Development covers programming languages, frameworks, APIs, coding tools, developer workflows, and implementation guides.",
    why:
      "Technical posts need a stable development pillar that can grow across languages and frameworks.",
    who:
      "Developers, students, technical founders, product engineers, and builders learning implementation patterns.",
    benefits: [
      "Find coding guides and examples",
      "Compare developer tools",
      "Connect programming resources to real projects",
    ],
    examples: ["Cursor", "React", "TypeScript", "Python", "programming resources"],
    topicSlugs: [
      "cursor",
      "react",
      "typescript",
      "python",
      "programming-resources",
      "api-development",
      "github",
    ],
    tagSlugs: ["coding", "developer-tools", "programming", "automation"],
    keywords: [
      "development",
      "developer",
      "programming",
      "coding",
      "code",
      "software engineering",
      "javascript",
      "typescript",
      "python",
      "react",
      "api",
      "github",
      "cursor",
    ],
    aliases: ["programming", "software", "coding"],
  },
  {
    id: "cybersecurity",
    label: "Cybersecurity",
    path: "/category/cybersecurity",
    description:
      "Cybersecurity knowledge for privacy, authentication, risk, secure tools, and safer digital workflows.",
    what:
      "Cybersecurity covers privacy, authentication, passwords, risk, security tools, and defensive workflows.",
    why:
      "Security content is high-trust content and should stay easy to find, compare, and update.",
    who:
      "Builders, operators, students, creators, and teams making safer technology decisions.",
    benefits: [
      "Understand practical security risks",
      "Compare safer tools and workflows",
      "Improve authentication and privacy habits",
    ],
    examples: ["privacy", "authentication", "passwords", "security tools", "risk management"],
    topicSlugs: [
      "privacy",
      "authentication",
      "passwords",
      "security-tools",
      "risk-management",
    ],
    tagSlugs: ["privacy", "security", "auth", "risk"],
    keywords: [
      "cybersecurity",
      "security",
      "privacy",
      "auth",
      "authentication",
      "password",
      "risk",
      "encryption",
      "secure",
      "threat",
    ],
    aliases: ["security", "privacy"],
  },
] as const satisfies readonly SeoCategoryDefinition[];

export const SEO_TOPICS = [
  topic("ai", "AI", "ai", "AI Essentials", "Practical artificial intelligence workflows, tools, models, and use cases.", [
    "ai",
    "artificial intelligence",
    "machine learning",
    "llm",
  ]),
  topic("chatgpt", "ChatGPT", "ai", "ChatGPT Guides", "ChatGPT examples, prompts, workflows, comparisons, and business use cases.", [
    "chatgpt",
    "openai",
    "gpt",
    "prompt",
  ]),
  topic("claude", "Claude", "ai", "Claude Guides", "Claude workflows, comparisons, prompts, and AI assistant use cases.", [
    "claude",
    "anthropic",
    "ai assistant",
  ]),
  topic("gemini", "Gemini", "ai", "Gemini Guides", "Gemini workflows, Google AI use cases, and model comparisons.", [
    "gemini",
    "google ai",
    "ai assistant",
  ]),
  topic("ai-tools", "AI Tools", "ai", "AI Tools Collection", "Useful AI products, free tools, assistant workflows, and automation ideas.", [
    "ai tools",
    "free ai",
    "ai app",
    "ai automation",
  ]),
  topic(
    "prompt-engineering",
    "Prompt Engineering",
    "ai",
    "Prompt Engineering Playbook",
    "Prompt patterns, examples, frameworks, and reusable AI instructions.",
    ["prompt engineering", "prompt", "prompts", "system prompt"],
  ),
  topic("ai-automation", "AI Automation", "ai", "AI Automation Workflows", "Automation patterns that combine AI tools, apps, and repeatable workflows.", [
    "ai automation",
    "automation",
    "agent",
    "workflow",
  ]),
  topic("vercel", "Vercel", "technology", "Vercel Guides", "Vercel deployment, frontend hosting, platform workflows, and app delivery.", [
    "vercel",
    "deployment",
    "hosting",
  ]),
  topic("supabase", "Supabase", "technology", "Supabase Guides", "Supabase databases, auth-adjacent platform use, APIs, and app workflows.", [
    "supabase",
    "database",
    "postgres",
  ]),
  topic("saas", "SaaS", "technology", "SaaS Guides", "Software-as-a-service products, business models, tools, and workflows.", [
    "saas",
    "software as a service",
    "subscription",
  ]),
  topic("mobile-apps", "Mobile Apps", "technology", "Mobile App Resources", "Mobile app tools, platforms, workflows, and practical comparisons.", [
    "mobile",
    "ios",
    "android",
    "app",
  ]),
  topic("technology-guides", "Technology Guides", "technology", "Technology Guides", "Evergreen explainers for apps, platforms, software, and technology choices.", [
    "technology guide",
    "tech guide",
    "platform",
  ]),
  topic("software-tools", "Software Tools", "technology", "Software Tools Collection", "Useful software products, app recommendations, platform comparisons, and workflows.", [
    "software tools",
    "tools",
    "apps",
  ]),
  topic("business-strategy", "Business Strategy", "business", "Business Strategy Guides", "Strategy, markets, decisions, and durable business operating principles.", [
    "business strategy",
    "strategy",
    "market",
  ]),
  topic("operations", "Operations", "business", "Operations Playbook", "Operational systems, processes, team workflows, and execution practices.", [
    "operations",
    "process",
    "workflow",
  ]),
  topic("pricing", "Pricing", "business", "Pricing Guides", "Pricing models, monetization, packaging, and customer value decisions.", [
    "pricing",
    "monetization",
    "revenue",
  ]),
  topic("growth", "Growth", "business", "Growth Playbook", "Growth strategy, experiments, channels, and practical expansion tactics.", [
    "growth",
    "growth hacking",
    "customer",
  ]),
  topic("seo", "SEO", "marketing", "SEO Guides", "Search optimization, technical SEO, content structure, indexing, and search visibility.", [
    "seo",
    "search engine optimization",
    "indexing",
  ]),
  topic("digital-marketing", "Digital Marketing", "marketing", "Digital Marketing Playbook", "Digital channels, campaigns, analytics, and growth workflows.", [
    "digital marketing",
    "campaign",
    "growth marketing",
  ]),
  topic("social-media-marketing", "Social Media Marketing", "marketing", "Social Media Marketing Guides", "Social content, platform strategy, creator growth, and campaign ideas.", [
    "social media",
    "social media marketing",
    "creator",
  ]),
  topic("content-marketing", "Content Marketing", "marketing", "Content Marketing Guides", "Content strategy, editorial systems, topic clusters, and publishing workflows.", [
    "content marketing",
    "content",
    "editorial",
  ]),
  topic("email-marketing", "Email Marketing", "marketing", "Email Marketing Guides", "Newsletter strategy, lifecycle campaigns, copywriting, and email growth.", [
    "email marketing",
    "newsletter",
    "email",
  ]),
  topic("marketing-tools", "Marketing Tools", "marketing", "Marketing Tools Collection", "Tools for SEO, content, ads, social, analytics, and marketing workflows.", [
    "marketing tools",
    "seo tools",
    "analytics",
  ]),
  topic("startup-tools", "Startup Tools", "startup", "Startup Tools Collection", "Founder tools for MVPs, launch, customer discovery, and early growth.", [
    "startup tools",
    "founder tools",
    "mvp tools",
  ]),
  topic("mvp", "MVP", "startup", "MVP Guides", "Minimum viable product strategy, validation, scope, and launch examples.", [
    "mvp",
    "minimum viable product",
    "prototype",
  ]),
  topic("fundraising", "Fundraising", "startup", "Fundraising Guides", "Fundraising preparation, pitch materials, investor process, and startup finance basics.", [
    "fundraising",
    "investor",
    "pitch",
  ]),
  topic("product-market-fit", "Product-Market Fit", "startup", "Product-Market Fit Guides", "Customer validation, traction signals, retention, and market fit examples.", [
    "product market fit",
    "pmf",
    "customer",
  ]),
  topic("founder-playbook", "Founder Playbook", "startup", "Founder Playbook", "Founder lessons, launch systems, startup decisions, and early operating habits.", [
    "founder",
    "startup",
    "launch",
  ]),
  topic("productivity-tools", "Productivity Tools", "productivity", "Productivity Tools Collection", "Tools for focus, work management, notes, automation, and repeatable workflows.", [
    "productivity tools",
    "workflow",
    "tools",
  ]),
  topic("automation", "Automation", "productivity", "Automation Guides", "Workflow automation, app integrations, shortcuts, and repeatable systems.", [
    "automation",
    "workflow",
    "shortcut",
  ]),
  topic("notion", "Notion", "productivity", "Notion Guides", "Notion templates, workflows, databases, and personal productivity systems.", [
    "notion",
    "template",
    "database",
  ]),
  topic("workflow-systems", "Workflow Systems", "productivity", "Workflow Systems", "Systems for organizing work, reducing repetition, and improving execution.", [
    "workflow system",
    "workflow",
    "process",
  ]),
  topic("templates", "Templates", "productivity", "Template Library", "Reusable templates for planning, marketing, operations, learning, and productivity.", [
    "template",
    "templates",
    "planner",
  ]),
  topic("cursor", "Cursor", "development", "Cursor Guides", "Cursor editor workflows, AI coding patterns, project setup, and developer productivity.", [
    "cursor",
    "ai coding",
    "developer tool",
  ]),
  topic("react", "React", "development", "React Guides", "React patterns, components, frontend architecture, and implementation examples.", [
    "react",
    "frontend",
    "component",
  ]),
  topic("typescript", "TypeScript", "development", "TypeScript Guides", "TypeScript patterns, typing strategies, frontend code, and developer workflows.", [
    "typescript",
    "javascript",
  ]),
  topic("python", "Python", "development", "Python Guides", "Python examples, automation scripts, programming basics, and technical workflows.", [
    "python",
    "programming",
    "script",
  ]),
  topic(
    "programming-resources",
    "Programming Resources",
    "development",
    "Programming Resources",
    "Coding guides, language resources, developer tools, and implementation examples.",
    ["programming", "coding", "developer", "software"],
    ["programming", "coding"],
  ),
  topic("api-development", "API Development", "development", "API Development Guides", "API design, integrations, implementation patterns, and developer workflows.", [
    "api",
    "api development",
    "integration",
  ]),
  topic("github", "GitHub", "development", "GitHub Guides", "GitHub workflows, repositories, collaboration, and developer tool usage.", [
    "github",
    "git",
    "repository",
  ]),
  topic("privacy", "Privacy", "cybersecurity", "Privacy Guides", "Privacy practices, safer tools, data exposure, and digital security habits.", [
    "privacy",
    "data privacy",
    "security",
  ]),
  topic("authentication", "Authentication", "cybersecurity", "Authentication Guides", "Authentication concepts, login security, account protection, and identity workflows.", [
    "authentication",
    "auth",
    "login",
  ]),
  topic("passwords", "Passwords", "cybersecurity", "Password Security Guides", "Password safety, passkeys, managers, account recovery, and security basics.", [
    "password",
    "passwords",
    "passkey",
  ]),
  topic("security-tools", "Security Tools", "cybersecurity", "Security Tools Collection", "Tools for safer accounts, privacy, monitoring, and security workflows.", [
    "security tools",
    "cybersecurity tools",
    "privacy tools",
  ]),
  topic("risk-management", "Risk Management", "cybersecurity", "Risk Management Guides", "Security risk decisions, threat awareness, and practical defensive planning.", [
    "risk",
    "risk management",
    "threat",
  ]),
] as const satisfies readonly SeoTopicDefinition[];

export const SEO_TAGS = [
  tag("free-tools", "Free Tools", "Free or low-cost tools that support practical work.", [
    "ai",
    "technology",
    "marketing",
    "productivity",
    "development",
  ]),
  tag("automation", "Automation", "Repeatable workflows, shortcuts, app integrations, and AI automation.", [
    "ai",
    "productivity",
    "development",
  ]),
  tag("growth", "Growth", "Business, startup, and marketing growth tactics.", [
    "business",
    "marketing",
    "startup",
  ]),
  tag("social-media", "Social Media", "Social media ideas, workflows, and campaigns.", ["marketing"]),
  tag("prompt-engineering", "Prompt Engineering", "Prompt patterns and AI instructions.", ["ai"]),
  tag("coding", "Coding", "Programming and implementation metadata.", ["development"]),
  tag("developer-tools", "Developer Tools", "Tools for software builders.", ["development"]),
  tag("templates", "Templates", "Reusable templates for work and learning.", ["productivity"]),
  tag("privacy", "Privacy", "Privacy and safer data practices.", ["cybersecurity"]),
  tag("security", "Security", "Security practices and defensive workflows.", ["cybersecurity"]),
  tag("seo", "SEO", "Search optimization and indexing metadata.", ["marketing"]),
  tag("content", "Content", "Content strategy, writing, and publishing metadata.", ["marketing"]),
  tag("tools", "Tools", "Useful tools and resources.", ["technology", "startup"]),
  tag("playbooks", "Playbooks", "Repeatable strategic and operating guides.", [
    "business",
    "startup",
  ]),
  tag("workflows", "Workflows", "Repeatable systems for work execution.", ["productivity"]),
] as const satisfies readonly SeoTagDefinition[];

const CATEGORY_LOOKUP = createLookup(SEO_CATEGORIES);
const TOPIC_LOOKUP = createLookup(SEO_TOPICS);
const TAG_LOOKUP = createLookup(SEO_TAGS);

export function getCategoryBySlug(value: string | null | undefined) {
  const slug = normalizeSeoSlug(value);
  return slug ? CATEGORY_LOOKUP.get(slug) || null : null;
}

export function getTopicBySlug(value: string | null | undefined) {
  const slug = normalizeSeoSlug(value);
  return slug ? TOPIC_LOOKUP.get(slug) || null : null;
}

export function getTagBySlug(value: string | null | undefined) {
  const slug = normalizeSeoSlug(value);
  return slug ? TAG_LOOKUP.get(slug) || null : null;
}

export function getTopicsForCategory(categoryId: SeoCategoryId) {
  return SEO_TOPICS.filter((topicDefinition) => topicDefinition.categoryId === categoryId);
}

export function getRelatedTopicsForCategory(categoryId: SeoCategoryId, limit = 6) {
  const category = getCategoryBySlug(categoryId);
  if (!category) return [];

  const preferredTopics = category.topicSlugs
    .map((slug) => getTopicBySlug(slug))
    .filter((topicDefinition): topicDefinition is SeoTopicDefinition =>
      Boolean(topicDefinition),
    );
  const remainingTopics = getTopicsForCategory(categoryId).filter(
    (topicDefinition) =>
      !preferredTopics.some((preferredTopic) => preferredTopic.id === topicDefinition.id),
  );

  return [...preferredTopics, ...remainingTopics].slice(0, limit);
}

export function getRelatedTagsForCategory(categoryId: SeoCategoryId, limit = 6) {
  return SEO_TAGS.filter((tagDefinition) =>
    tagDefinition.categoryIds.includes(categoryId),
  ).slice(0, limit);
}

export function getCategoryMatchValues(category: SeoCategoryDefinition) {
  return [
    category.id,
    category.label,
    ...category.aliases,
    ...category.keywords,
    ...category.examples,
    ...category.topicSlugs,
    ...category.tagSlugs,
  ];
}

export function getTopicMatchValues(topicDefinition: SeoTopicDefinition) {
  return [
    topicDefinition.id,
    topicDefinition.label,
    ...topicDefinition.aliases,
    ...topicDefinition.keywords,
    ...topicDefinition.tagSlugs,
  ];
}

export function getBestCategoryForText(title: string, content: string) {
  const text = `${title} ${content}`.toLowerCase();

  return (
    SEO_CATEGORIES.map((category) => ({
      category,
      score: getCategoryMatchValues(category).reduce((total, keyword) => {
        const normalizedKeyword = keyword.toLowerCase();
        return total + (text.includes(normalizedKeyword) ? 1 : 0);
      }, 0),
    }))
      .filter((item) => item.score > 0)
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.category.label.localeCompare(right.category.label),
      )[0]?.category || null
  );
}

function createLookup<T extends { id: string; aliases: readonly string[] }>(
  definitions: readonly T[],
) {
  const lookup = new Map<string, T>();

  definitions.forEach((definition) => {
    [definition.id, ...definition.aliases]
      .map((value) => normalizeSeoSlug(value))
      .filter((value): value is string => Boolean(value))
      .forEach((slug) => lookup.set(slug, definition));
  });

  return lookup;
}

function topic(
  id: string,
  label: string,
  categoryId: SeoCategoryId,
  collectionTitle: string,
  description: string,
  keywords: readonly string[],
  aliases: readonly string[] = [],
  tagSlugs: readonly string[] = [],
): SeoTopicDefinition {
  const slug = normalizeSeoSlug(id) || id;

  return {
    id: slug,
    label,
    categoryId,
    path: `/topic/${slug}`,
    collectionTitle,
    description,
    keywords,
    tagSlugs: [...tagSlugs],
    aliases: [...aliases],
  };
}

function tag(
  id: string,
  label: string,
  description: string,
  categoryIds: readonly SeoCategoryId[],
  aliases: readonly string[] = [],
): SeoTagDefinition {
  const slug = normalizeSeoSlug(id) || id;

  return {
    id: slug,
    label,
    path: `/tag/${slug}`,
    description,
    categoryIds: [...categoryIds],
    aliases: [...aliases],
  };
}
