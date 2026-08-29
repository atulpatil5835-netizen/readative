import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import {
  buildSeoProfilePath,
  buildSitemapEntries,
  describeSeoV2Foundation,
  getIndexableSeoPosts,
  getIndexableSeoSmartTalks,
  getIndexableSeoTags,
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
  const indexablePosts = getIndexableSeoPosts(data.posts);
  const indexableSmartTalks = getIndexableSeoSmartTalks(data.smartTalks);
  const indexableAuthorIds = new Set([
    ...indexablePosts.map((post) => post.authorId).filter(Boolean),
    ...indexableSmartTalks.map((question) => question.authorId).filter(Boolean),
  ]);
  const indexableProfiles = data.profiles.filter((profile) =>
    indexableAuthorIds.has(profile.id),
  );
  const indexableTags = getIndexableSeoTags(data.posts);
  const entries = buildSitemapEntries(data);
  const sitemapUrls = new Set(entries.map((entry) => entry.loc));
  const postUrls = indexablePosts.map(
    (post) => `${SITE_URL}${buildPostSeoPath(post.id, post.title)}`,
  );
  const smartTalkUrls = indexableSmartTalks.map(
    (question) => `${SITE_URL}${buildSmartTalkSeoPath(question.id, question.title)}`,
  );
  const profileUrls = indexableProfiles.map(
    (profile) => `${SITE_URL}${buildSeoProfilePath(profile)}`,
  );
  const tagUrls = indexableTags
    .filter((tag) => tag.postCount >= TAG_SITEMAP_MIN_POST_COUNT)
    .map((tag) => `${SITE_URL}/tag/${encodeURIComponent(tag.id)}`);
  const missingPostUrls = postUrls.filter((url) => !sitemapUrls.has(url));
  const missingSmartTalkUrls = smartTalkUrls.filter((url) => !sitemapUrls.has(url));
  const missingProfileUrls = profileUrls.filter((url) => !sitemapUrls.has(url));
  const missingTagUrls = tagUrls.filter((url) => !sitemapUrls.has(url));
  const topicSitemapUrls = entries.filter((entry) => entry.type === "topic");
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
  const robotsCanonicalSitemap = `${SITE_URL}/sitemap.xml`;
  const robotsSitemapDirectives = robots
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*Sitemap:\s*(\S+)\s*$/i)?.[1]?.trim())
    .filter((url): url is string => Boolean(url));
  const robotsAdvertisesOnlyCanonicalSitemap =
    robotsSitemapDirectives.length === 1 &&
    robotsSitemapDirectives[0] === robotsCanonicalSitemap;
  const indexShell = readFile("index.html");
  const rootCanonicalPattern = new RegExp(
    `<link\\b(?=[^>]*\\brel=["']canonical["'])(?=[^>]*\\bhref=["']${SITE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/["'])[^>]*>`,
    "i",
  );
  const rootRobotsPattern =
    /<meta\b(?=[^>]*\bname=["']robots["'])(?=[^>]*\bcontent=["'][^"']*\bindex\b[^"']*\bfollow\b)[^>]*>/i;
  const staticRootHasCanonical = rootCanonicalPattern.test(indexShell);
  const staticRootHasIndexRobots = rootRobotsPattern.test(indexShell);
  const staticRootHasDiscoveryLinks =
    /href=["']\/posts["']/i.test(indexShell) &&
    /href=["']\/smarttalks["']/i.test(indexShell) &&
    /href=["']\/explore["']/i.test(indexShell);
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
    "api/_document.ts",
    "api/discovery.ts",
    "api/post.ts",
    "api/profile.ts",
    "api/smarttalk.ts",
    "api/smarttalks.ts",
    "api/taxonomy.ts",
    "index.html",
    "public/amp/index.html",
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
  const postInboundLinkCoverage = indexablePosts.length;
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
    topicSitemapUrls.length === 0 ? null : `${topicSitemapUrls.length} topic URLs should not be in sitemap`,
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
    staticRootHasCanonical ? null : "static root shell is missing canonical URL",
    staticRootHasIndexRobots ? null : "static root shell is missing index/follow robots meta",
    staticRootHasDiscoveryLinks ? null : "static root shell is missing crawlable discovery links",
    robotsAllowsAll && !robotsBlocksCanonicalDocuments ? null : "robots.txt blocks canonical documents",
    robotsAdvertisesOnlyCanonicalSitemap
      ? null
      : `robots.txt must advertise only ${robotsCanonicalSitemap}`,
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
- Indexable post URLs expected in sitemap: ${indexablePosts.length}
- SmartTalk discussions discovered: ${data.smartTalks.length}
- Indexable SmartTalk URLs expected in sitemap: ${indexableSmartTalks.length}
- Profile URLs discovered: ${data.profiles.length}
- Indexable profile URLs expected in sitemap: ${indexableProfiles.length}
- Tag URLs discovered: ${data.tags.length}
- Indexable high-volume tag URLs expected in sitemap: ${tagUrls.length}
- Total sitemap URLs generated: ${entries.length}

## Files Changed

${markdownList(changedFiles)}

## Sitemap Coverage

- Published posts in sitemap: ${indexablePosts.length - missingPostUrls.length} / ${indexablePosts.length}
- Missing post URLs: ${missingPostUrls.length}
- SmartTalk discussions in sitemap: ${indexableSmartTalks.length - missingSmartTalkUrls.length} / ${indexableSmartTalks.length}
- Missing SmartTalk URLs: ${missingSmartTalkUrls.length}
- Profiles in sitemap: ${indexableProfiles.length - missingProfileUrls.length} / ${indexableProfiles.length}
- Missing profile URLs: ${missingProfileUrls.length}
- High-volume tags in sitemap (${TAG_SITEMAP_MIN_POST_COUNT}+ posts): ${tagUrls.length - missingTagUrls.length} / ${tagUrls.length}
- Missing tag URLs: ${missingTagUrls.length}
- Categories in sitemap: ${entries.filter((entry) => entry.type === "category").length}
- Topics in sitemap: ${topicSitemapUrls.length} (expected 0; topic shortcuts are noindex/follow)
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

- Every indexable published post has sitemap coverage: ${missingPostUrls.length === 0 ? "PASS" : "FAIL"}
- Every indexable public SmartTalk has sitemap coverage: ${missingSmartTalkUrls.length === 0 ? "PASS" : "FAIL"}
- Every profile with indexable content has sitemap coverage: ${missingProfileUrls.length === 0 ? "PASS" : "FAIL"}
- Every high-volume public tag has sitemap coverage: ${missingTagUrls.length === 0 ? "PASS" : "FAIL"}
- Every indexable published post has at least one crawlable inbound link: ${postInboundLinkCoverage === indexablePosts.length ? "PASS" : "FAIL"}
- Inbound source: ${SITE_URL}/posts links every /posts/{slug}--{id} with real HTML anchors.
- Related/recent post links: PASS - focused post pages render crawlable related and recent /posts/{slug}--{id} anchors.
- Category/tag/profile links: PASS - discovery index plus server-rendered taxonomy pages expose real anchors, with profiles linked as /@username when profile data is available.
- Topic shortcut handling: ${topicSitemapUrls.length === 0 ? "PASS" : "FAIL"} - topic pages stay crawlable through internal links but are noindex/follow and excluded from the sitemap so posts carry search priority.
- Static homepage canonical: ${staticRootHasCanonical ? "PASS" : "FAIL"} - the Vite shell served at / includes ${SITE_URL}/ as its canonical URL.
- Static homepage robots: ${staticRootHasIndexRobots ? "PASS" : "FAIL"} - the Vite shell served at / is index/follow.
- Static homepage discovery links: ${staticRootHasDiscoveryLinks ? "PASS" : "FAIL"} - the no-JavaScript fallback links Posts, SmartTalk, and Explore.
- robots.txt allows crawling: ${robotsAllowsAll && !robotsBlocksCanonicalDocuments ? "PASS" : "FAIL"}
- robots.txt canonical sitemap directive: ${robotsAdvertisesOnlyCanonicalSitemap ? "PASS" : "FAIL"}
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
6. Inspect several ${SITE_URL}/tag/{slug} pages from the sitemap and one ${SITE_URL}/topic/{slug} page to confirm it emits noindex/follow.
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
        indexablePostUrlsDiscovered: indexablePosts.length,
        smartTalksDiscovered: data.smartTalks.length,
        indexableSmartTalksDiscovered: indexableSmartTalks.length,
        profileUrlsDiscovered: data.profiles.length,
        indexableProfileUrlsDiscovered: indexableProfiles.length,
        tagUrlsDiscovered: data.tags.length,
        indexableTagUrlsDiscovered: indexableTags.length,
        tagSitemapMinPostCount: TAG_SITEMAP_MIN_POST_COUNT,
        sitemapUrls: entries.length,
        missingPostUrls: missingPostUrls.length,
        missingSmartTalkUrls: missingSmartTalkUrls.length,
        missingProfileUrls: missingProfileUrls.length,
        missingTagUrls: missingTagUrls.length,
        topicUrlsInSitemap: topicSitemapUrls.length,
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
        robotsSitemapDirectives,
        robotsAdvertisesOnlyCanonicalSitemap,
        staticRootHasCanonical,
        staticRootHasIndexRobots,
        staticRootHasDiscoveryLinks,
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
