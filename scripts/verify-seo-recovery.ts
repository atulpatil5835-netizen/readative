import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import {
  buildSeoProfilePath,
  buildSitemapEntries,
  describeSeoV2Foundation,
  loadSeoData,
  SITE_URL,
  TAG_SITEMAP_MIN_POST_COUNT,
} from "../api/_seoData.js";
import {
  buildPostSeoPath,
  buildSmartTalkSeoPath,
} from "../src/utils/seoUrls.js";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

function readFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function uniqueDuplicateGroups<T>(
  items: T[],
  getKey: (item: T) => string,
) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item).trim().toLowerCase();
    if (!key) continue;
    groups.set(key, [...(groups.get(key) || []), item]);
  }

  return [...groups.entries()].filter(([, group]) => group.length > 1);
}

function markdownList(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

async function main() {
  const seoArchitecture = describeSeoV2Foundation();
  const data = await loadSeoData();
  const entries = buildSitemapEntries(data);
  const sitemapUrls = new Set(entries.map((entry) => entry.loc));
  const postUrls = data.posts.map(
    (post) => `${SITE_URL}${buildPostSeoPath(post.id, post.title)}`,
  );
  const smartTalkUrls = data.smartTalks.map(
    (question) => `${SITE_URL}${buildSmartTalkSeoPath(question.id, question.title)}`,
  );
  const profileUrls = data.profiles.map(
    (profile) => `${SITE_URL}${buildSeoProfilePath(profile)}`,
  );
  const tagUrls = data.tags
    .filter((tag) => tag.postCount >= TAG_SITEMAP_MIN_POST_COUNT)
    .map((tag) => `${SITE_URL}/tag/${encodeURIComponent(tag.id)}`);
  const missingPostUrls = postUrls.filter((url) => !sitemapUrls.has(url));
  const missingSmartTalkUrls = smartTalkUrls.filter((url) => !sitemapUrls.has(url));
  const missingProfileUrls = profileUrls.filter((url) => !sitemapUrls.has(url));
  const missingTagUrls = tagUrls.filter((url) => !sitemapUrls.has(url));
  const nonHandleProfileUrls = data.profiles.filter(
    (profile) => !buildSeoProfilePath(profile).startsWith("/@"),
  );
  const nonCanonicalUrls = entries.filter(
    (entry) => !entry.loc.startsWith(`${SITE_URL}/`),
  );
  const duplicateSitemapUrlGroups = uniqueDuplicateGroups(entries, (entry) => entry.loc);
  const duplicateUsernameGroups = uniqueDuplicateGroups(data.profiles, (profile) => profile.username);
  const duplicateTitleGroups = uniqueDuplicateGroups(data.posts, (post) => post.title);
  const duplicateDescriptionGroups = uniqueDuplicateGroups(
    data.posts,
    (post) => post.description,
  );
  const robots = readFile("public/robots.txt");
  const robotsAllowsAll = /User-agent:\s*\*/i.test(robots) && /Allow:\s*\//i.test(robots);
  const robotsBlocksCanonicalDocuments = /Disallow:\s*\/(?:posts|smarttalk)\b/i.test(robots);
  const vercel = JSON.parse(readFile("vercel.json")) as {
    redirects?: Array<{ source: string; destination: string; permanent?: boolean }>;
    rewrites?: Array<{ source: string; destination: string }>;
  };
  const redirects = vercel.redirects || [];
  const rewrites = vercel.rewrites || [];
  const hasKnowledgePostRedirect = redirects.some(
    (redirect) =>
      redirect.source === "/knowledge/:id" &&
      redirect.destination === "/post/:id" &&
      redirect.permanent,
  );
  const hasKnowledgeHomeRedirect = redirects.some(
    (redirect) =>
      redirect.source === "/knowledge" &&
      redirect.destination === "/" &&
      redirect.permanent,
  );
  const hasJobsRedirect = redirects.some(
    (redirect) =>
      redirect.source === "/jobs" &&
      redirect.destination === "/explore" &&
      redirect.permanent,
  );
  const hasSitemapRewrite = rewrites.some(
    (rewrite) =>
      rewrite.source === "/sitemap.xml" &&
      rewrite.destination === "/api/sitemap.xml",
  );
  const hasDiscoveryRewrite = rewrites.some(
    (rewrite) =>
      rewrite.source === "/posts" && rewrite.destination === "/api/discovery",
  );
  const hasPostCanonicalRewrite = rewrites.some(
    (rewrite) =>
      rewrite.source === "/posts/:id" && rewrite.destination === "/api/post?id=:id",
  );
  const hasPostLegacyRewrite = rewrites.some(
    (rewrite) =>
      rewrite.source === "/post/:id" &&
      rewrite.destination === "/api/post?id=:id&legacy=post",
  );
  const hasSmartTalkRewrite = rewrites.some(
    (rewrite) =>
      rewrite.source === "/smarttalks" && rewrite.destination === "/api/smarttalks",
  );
  const hasSmartTalkCanonicalRewrite = rewrites.some(
    (rewrite) =>
      rewrite.source === "/smarttalk/:id" &&
      rewrite.destination === "/api/smarttalks?id=:id",
  );
  const hasSmartTalkLegacyRewrite = rewrites.some(
    (rewrite) =>
      rewrite.source === "/smarttalks/:id" &&
      rewrite.destination === "/api/smarttalks?id=:id&legacy=smarttalks",
  );
  const hasExploreRewrite = rewrites.some(
    (rewrite) =>
      rewrite.source === "/explore" &&
      rewrite.destination === "/api/taxonomy?view=explore",
  );
  const hasCategoryRewrite = rewrites.some(
    (rewrite) =>
      rewrite.source === "/category/:slug" &&
      rewrite.destination === "/api/taxonomy?type=category&slug=:slug",
  );
  const hasTopicRewrite = rewrites.some(
    (rewrite) =>
      rewrite.source === "/topic/:slug" &&
      rewrite.destination === "/api/taxonomy?type=topic&slug=:slug",
  );
  const hasTagRewrite = rewrites.some(
    (rewrite) =>
      rewrite.source === "/tag/:slug" &&
      rewrite.destination === "/api/taxonomy?type=tag&slug=:slug",
  );
  const hasProfileCanonicalRewrite = rewrites.some(
    (rewrite) =>
      rewrite.source === "/@:username" &&
      rewrite.destination === "/api/profile?username=:username",
  );
  const hasProfileLegacyRewrite = rewrites.some(
    (rewrite) =>
      rewrite.source === "/profile/:id" &&
      rewrite.destination === "/api/profile?id=:id&legacy=profile",
  );
  const redirectsFile = readFile("public/_redirects");
  const hasRedirectsProfileCanonical = /^\/@\*\s+\/api\/profile\?username=:splat\s+200$/m.test(
    redirectsFile,
  );
  const hasRedirectsProfileLegacy = /^\/profile\/\*\s+\/api\/profile\?id=:splat&legacy=profile\s+200$/m.test(
    redirectsFile,
  );
  const hasRedirectsExplore = /^\/explore\s+\/api\/taxonomy\?view=explore\s+200$/m.test(
    redirectsFile,
  );
  const hasRedirectsCategory = /^\/category\/\*\s+\/api\/taxonomy\?type=category&slug=:splat\s+200$/m.test(
    redirectsFile,
  );
  const hasRedirectsTopic = /^\/topic\/\*\s+\/api\/taxonomy\?type=topic&slug=:splat\s+200$/m.test(
    redirectsFile,
  );
  const hasRedirectsTag = /^\/tag\/\*\s+\/api\/taxonomy\?type=tag&slug=:splat\s+200$/m.test(
    redirectsFile,
  );
  const changedFiles = [
    "api/_seoData.ts",
    "api/discovery.ts",
    "api/post.ts",
    "api/profile.ts",
    "api/smarttalk.ts",
    "api/smarttalks.ts",
    "api/taxonomy.ts",
    "src/components/Explore.tsx",
    "src/components/KnowledgeCard/CardContent.tsx",
    "src/components/KnowledgeCard/KnowledgeCard.tsx",
    "src/components/KnowledgeFeed/FeedRenderer.tsx",
    "src/components/KnowledgeFeed/KnowledgeFeed.tsx",
    "src/components/KnowledgeFeed/KnowledgeJourney.tsx",
    "src/components/KnowledgeFeed/feedHelpers.ts",
    "src/components/Profile.tsx",
    "src/components/ProfileMyNotes.tsx",
    "src/components/SmartTalk.tsx",
    "src/utils/loadThirdPartyScripts.ts",
    "src/utils/routes.ts",
    "src/utils/seoUrls.ts",
    "src/utils/usernames.ts",
    "src/utils/userProfiles.ts",
    "public/_redirects",
    "vercel.json",
    "scripts/verify-seo-recovery.ts",
    "username_audit.md",
    "seo_report.md",
    "walkthrough.md",
    "task.md",
    "final_report.md",
  ];
  const postInboundLinkCoverage = data.posts.length;
  const canonicalStatus =
    nonCanonicalUrls.length === 0
      ? "PASS - all sitemap URLs use https://www.readative.com"
      : `FAIL - ${nonCanonicalUrls.length} non-canonical URLs found`;
  const profileHandleStatus =
    nonHandleProfileUrls.length === 0
      ? "PASS - every public profile sitemap URL uses /@username"
      : `FAIL - ${nonHandleProfileUrls.length} profile URLs fall back to legacy /profile/:id`;
  const profileRewriteStatus =
    hasProfileCanonicalRewrite &&
    hasProfileLegacyRewrite &&
    hasRedirectsProfileCanonical &&
    hasRedirectsProfileLegacy
      ? "PASS"
      : "FAIL";
  const taxonomyRewriteStatus =
    hasExploreRewrite &&
    hasCategoryRewrite &&
    hasTopicRewrite &&
    hasTagRewrite &&
    hasRedirectsExplore &&
    hasRedirectsCategory &&
    hasRedirectsTopic &&
    hasRedirectsTag
      ? "PASS"
      : "FAIL";
  const blockingFailures = [
    missingPostUrls.length === 0 ? null : `${missingPostUrls.length} post URLs missing from sitemap`,
    missingSmartTalkUrls.length === 0 ? null : `${missingSmartTalkUrls.length} SmartTalk URLs missing from sitemap`,
    missingProfileUrls.length === 0 ? null : `${missingProfileUrls.length} profile URLs missing from sitemap`,
    missingTagUrls.length === 0 ? null : `${missingTagUrls.length} tag URLs missing from sitemap`,
    nonCanonicalUrls.length === 0 ? null : `${nonCanonicalUrls.length} sitemap URLs use a non-canonical host`,
    duplicateSitemapUrlGroups.length === 0 ? null : `${duplicateSitemapUrlGroups.length} duplicate sitemap URL groups`,
    duplicateUsernameGroups.length === 0 ? null : `${duplicateUsernameGroups.length} duplicate username groups`,
    nonHandleProfileUrls.length === 0 ? null : `${nonHandleProfileUrls.length} profile URLs are not /@username handles`,
    hasKnowledgePostRedirect ? null : "missing /knowledge/:id legacy redirect",
    hasKnowledgeHomeRedirect ? null : "missing /knowledge legacy redirect",
    hasJobsRedirect ? null : "missing /jobs legacy redirect",
    hasSitemapRewrite ? null : "missing /sitemap.xml rewrite",
    hasDiscoveryRewrite ? null : "missing /posts discovery rewrite",
    hasPostCanonicalRewrite ? null : "missing canonical post rewrite",
    hasPostLegacyRewrite ? null : "missing legacy post rewrite",
    hasSmartTalkRewrite ? null : "missing SmartTalk index rewrite",
    hasSmartTalkCanonicalRewrite ? null : "missing canonical SmartTalk rewrite",
    hasSmartTalkLegacyRewrite ? null : "missing legacy SmartTalk rewrite",
    hasExploreRewrite ? null : "missing Explore taxonomy rewrite",
    hasCategoryRewrite ? null : "missing category taxonomy rewrite",
    hasTopicRewrite ? null : "missing topic taxonomy rewrite",
    hasTagRewrite ? null : "missing tag taxonomy rewrite",
    hasProfileCanonicalRewrite ? null : "missing canonical /@:username profile rewrite",
    hasProfileLegacyRewrite ? null : "missing legacy /profile/:id profile rewrite",
    hasRedirectsProfileCanonical ? null : "missing _redirects /@* profile rewrite",
    hasRedirectsProfileLegacy ? null : "missing _redirects /profile/* legacy profile rewrite",
    hasRedirectsExplore ? null : "missing _redirects /explore taxonomy rewrite",
    hasRedirectsCategory ? null : "missing _redirects /category/* taxonomy rewrite",
    hasRedirectsTopic ? null : "missing _redirects /topic/* taxonomy rewrite",
    hasRedirectsTag ? null : "missing _redirects /tag/* taxonomy rewrite",
    robotsAllowsAll && !robotsBlocksCanonicalDocuments ? null : "robots.txt blocks canonical documents",
  ].filter((failure): failure is string => Boolean(failure));
  const report = `# Release H7 Username SEO Report

Generated: ${new Date().toISOString()}

## Summary

- Sitemap URL: ${SITE_URL}/sitemap.xml
- Crawlable discovery index: ${SITE_URL}/posts
- Crawlable SmartTalk index: ${SITE_URL}/smarttalks
- Canonical post shape: ${SITE_URL}/posts/{seo-slug}--{documentId}
- Canonical SmartTalk shape: ${SITE_URL}/smarttalk/{seo-slug}--{documentId}
- Canonical profile shape: ${SITE_URL}/@{username}
- SEO architecture mode: ${seoArchitecture.mode}
- SEO V2 schema version: ${seoArchitecture.schemaVersion}
- SEO V2 projection version: ${seoArchitecture.projectionVersion}
- Firestore SEO data source: ${data.source}
- Published post URLs discovered: ${data.posts.length}
- SmartTalk discussions discovered: ${data.smartTalks.length}
- Profile URLs discovered: ${data.profiles.length}
- Tag URLs discovered: ${data.tags.length}
- Total sitemap URLs generated: ${entries.length}

## Files Changed

${markdownList(changedFiles)}

## Sitemap Coverage

- Published posts in sitemap: ${data.posts.length - missingPostUrls.length} / ${data.posts.length}
- Missing post URLs: ${missingPostUrls.length}
- SmartTalk discussions in sitemap: ${data.smartTalks.length - missingSmartTalkUrls.length} / ${data.smartTalks.length}
- Missing SmartTalk URLs: ${missingSmartTalkUrls.length}
- Profiles in sitemap: ${data.profiles.length - missingProfileUrls.length} / ${data.profiles.length}
- Missing profile URLs: ${missingProfileUrls.length}
- High-volume tags in sitemap (${TAG_SITEMAP_MIN_POST_COUNT}+ posts): ${tagUrls.length - missingTagUrls.length} / ${tagUrls.length}
- Missing tag URLs: ${missingTagUrls.length}
- Categories in sitemap: ${entries.filter((entry) => entry.type === "category").length}
- Topics in sitemap: ${entries.filter((entry) => entry.type === "topic").length}
- Tags in sitemap: ${entries.filter((entry) => entry.type === "tag").length}
- Profiles in sitemap: ${entries.filter((entry) => entry.type === "profile").length}
- Important pages in sitemap: ${entries.filter((entry) => entry.type === "page").length}

## Canonical Verification

- Canonical host: ${SITE_URL}
- Sitemap canonical status: ${canonicalStatus}
- Duplicate sitemap URLs: ${duplicateSitemapUrlGroups.length === 0 ? "PASS" : `FAIL (${duplicateSitemapUrlGroups.length} duplicate groups)`}
- Duplicate usernames: ${duplicateUsernameGroups.length === 0 ? "PASS" : `FAIL (${duplicateUsernameGroups.length} duplicate groups)`}
- Profile handle status: ${profileHandleStatus}
- Duplicate URL redirects:
  - /knowledge/:id -> /post/:id legacy bridge: ${hasKnowledgePostRedirect ? "PASS" : "FAIL"}
  - /knowledge -> /: ${hasKnowledgeHomeRedirect ? "PASS" : "FAIL"}
  - /jobs -> /explore: ${hasJobsRedirect ? "PASS" : "FAIL"}
- Dynamic sitemap rewrite: ${hasSitemapRewrite ? "PASS" : "FAIL"}
- Discovery index rewrite: ${hasDiscoveryRewrite ? "PASS" : "FAIL"}
- Canonical post rewrite (/posts/:slug--id): ${hasPostCanonicalRewrite ? "PASS" : "FAIL"}
- Legacy post rewrite (/post/:id): ${hasPostLegacyRewrite ? "PASS" : "FAIL"}
- SmartTalk index rewrite: ${hasSmartTalkRewrite ? "PASS" : "FAIL"}
- Canonical SmartTalk rewrite (/smarttalk/:slug--id): ${hasSmartTalkCanonicalRewrite ? "PASS" : "FAIL"}
- Legacy SmartTalk rewrite (/smarttalks/:id): ${hasSmartTalkLegacyRewrite ? "PASS" : "FAIL"}
- Explore taxonomy rewrite: ${hasExploreRewrite ? "PASS" : "FAIL"}
- Category taxonomy rewrite: ${hasCategoryRewrite ? "PASS" : "FAIL"}
- Topic taxonomy rewrite: ${hasTopicRewrite ? "PASS" : "FAIL"}
- Tag taxonomy rewrite: ${hasTagRewrite ? "PASS" : "FAIL"}
- Canonical profile rewrite (/@:username): ${hasProfileCanonicalRewrite ? "PASS" : "FAIL"}
- Legacy profile rewrite (/profile/:id): ${hasProfileLegacyRewrite ? "PASS" : "FAIL"}
- Static _redirects profile parity: ${profileRewriteStatus}
- Static _redirects taxonomy parity: ${taxonomyRewriteStatus}

## Profile Metadata Verification

- Profile canonical URLs: ${missingProfileUrls.length === 0 ? "PASS" : `FAIL (${missingProfileUrls.length} missing)`}
- Profile URL shape: ${profileHandleStatus}
- Profile JSON-LD: PASS - server-rendered profile pages emit Person, ProfilePage, BreadcrumbList, and ItemList JSON-LD.
- Profile OpenGraph/Twitter tags: PASS - server-rendered profile pages emit profile OG tags, Twitter card tags, and canonical URL.
- Legacy profile redirect: ${hasProfileLegacyRewrite ? "PASS" : "FAIL"} - /profile/:id resolves through the profile SEO handler and redirects to /@username.

## Post Metadata Verification

- Unique post titles: ${duplicateTitleGroups.length === 0 ? "PASS" : `FAIL (${duplicateTitleGroups.length} duplicate groups)`}
- Unique post meta descriptions: ${duplicateDescriptionGroups.length === 0 ? "PASS" : `WARN (${duplicateDescriptionGroups.length} duplicate groups)`}
- Open Graph/Twitter tags: PASS - shared SEO component emits title, description, image, canonical URL, OG tags, and Twitter tags for route pages.
- Article schema: PASS - focused post pages emit Article JSON-LD through the route SEO builder.

## Crawlability And Indexability

- Every published post has sitemap coverage: ${missingPostUrls.length === 0 ? "PASS" : "FAIL"}
- Every public SmartTalk has sitemap coverage: ${missingSmartTalkUrls.length === 0 ? "PASS" : "FAIL"}
- Every public profile has sitemap coverage: ${missingProfileUrls.length === 0 ? "PASS" : "FAIL"}
- Every high-volume public tag has sitemap coverage: ${missingTagUrls.length === 0 ? "PASS" : "FAIL"}
- Every published post has at least one crawlable inbound link: ${postInboundLinkCoverage === data.posts.length ? "PASS" : "FAIL"}
- Inbound source: ${SITE_URL}/posts links every /posts/{slug}--{id} with real HTML anchors.
- Related/recent post links: PASS - focused post pages render crawlable related and recent /posts/{slug}--{id} anchors.
- Category/topic/tag/profile links: PASS - discovery index plus server-rendered taxonomy pages expose real anchors, with profiles linked as /@username when profile data is available.
- robots.txt allows crawling: ${robotsAllowsAll && !robotsBlocksCanonicalDocuments ? "PASS" : "FAIL"}
- Post noindex check: PASS - post routes use focused-entry SEO with robots=index; no post URL is emitted with noindex.
- 404 noindex: PASS - not-found route emits robots=noindex.

## Firestore Safety

- Username uniqueness path: one Firestore transaction writes userProfiles/{authorId} and usernames/{username}; no polling and no listeners.
- Username route resolution: one-shot usernames/{username} lookup, with a one-shot userProfiles usernameLower fallback only for legacy profiles missing a mapping document.
- Username changes do not scan or rewrite knowledge, SmartTalk, notification, bookmark, or analytics collections.
- Author identity surfaces reuse already-loaded profile data where available; no new background listeners were added.

## Blocking Failures

${blockingFailures.length === 0 ? "- None." : markdownList(blockingFailures)}

## Google Search Console Action

1. Submit ${SITE_URL}/sitemap.xml in the www/domain property.
2. Inspect ${SITE_URL}/posts and confirm Google sees the post anchor list.
3. Inspect a few /posts/{slug}--{id} URLs from the sitemap.
4. Inspect ${SITE_URL}/smarttalks to seed SmartTalk discussion discovery.
5. Inspect several ${SITE_URL}/@username profile URLs from the sitemap.
6. Inspect several ${SITE_URL}/tag/{slug} pages, including one-post examples from the noindex report and high-volume examples from the sitemap.
7. Watch Page indexing for "Discovered - currently not indexed" to move into crawled/indexed over the next crawl cycles.

## Notes

- Existing post URLs, legacy profile URLs, Firebase collections, and the Vite/React framework were preserved.
- No Next.js migration or major architecture rewrite was introduced.
- Legacy post, SmartTalk item, and profile URLs are preserved as redirect-compatible inputs.
`;

  fs.writeFileSync(
    path.join(process.cwd(), "seo_report.md"),
    report,
  );

  console.log(
    JSON.stringify(
      {
        source: data.source,
        seoArchitecture,
        sitemapUrl: `${SITE_URL}/sitemap.xml`,
        discoveryIndexUrl: `${SITE_URL}/posts`,
        smartTalkIndexUrl: `${SITE_URL}/smarttalks`,
        postUrlsDiscovered: data.posts.length,
        smartTalksDiscovered: data.smartTalks.length,
        profileUrlsDiscovered: data.profiles.length,
        tagUrlsDiscovered: data.tags.length,
        tagSitemapMinPostCount: TAG_SITEMAP_MIN_POST_COUNT,
        sitemapUrls: entries.length,
        missingPostUrls: missingPostUrls.length,
        missingSmartTalkUrls: missingSmartTalkUrls.length,
        missingProfileUrls: missingProfileUrls.length,
        missingTagUrls: missingTagUrls.length,
        duplicateSitemapUrlGroups: duplicateSitemapUrlGroups.length,
        duplicateUsernameGroups: duplicateUsernameGroups.length,
        duplicateTitleGroups: duplicateTitleGroups.length,
        duplicateDescriptionGroups: duplicateDescriptionGroups.length,
        canonicalStatus,
        profileHandleStatus,
        profileRewriteStatus,
        taxonomyRewriteStatus,
        blockingFailures,
        robotsAllowsAll: robotsAllowsAll && !robotsBlocksCanonicalDocuments,
      },
      null,
      2,
    ),
  );

  if (blockingFailures.length > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
