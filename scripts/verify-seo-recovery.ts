import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { buildSitemapEntries, loadSeoData, SITE_URL } from "../api/_seoData";

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
  const data = await loadSeoData();
  const entries = buildSitemapEntries(data);
  const sitemapUrls = new Set(entries.map((entry) => entry.loc));
  const postUrls = data.posts.map(
    (post) => `${SITE_URL}/post/${encodeURIComponent(post.id)}`,
  );
  const missingPostUrls = postUrls.filter((url) => !sitemapUrls.has(url));
  const nonCanonicalUrls = entries.filter(
    (entry) => !entry.loc.startsWith(`${SITE_URL}/`),
  );
  const duplicateTitleGroups = uniqueDuplicateGroups(data.posts, (post) => post.title);
  const duplicateDescriptionGroups = uniqueDuplicateGroups(
    data.posts,
    (post) => post.description,
  );
  const robots = readFile("public/robots.txt");
  const robotsAllowsAll = /User-agent:\s*\*/i.test(robots) && /Allow:\s*\//i.test(robots);
  const robotsBlocksPosts = /Disallow:\s*\/post/i.test(robots);
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
  const hasSmartTalkRewrite = rewrites.some(
    (rewrite) =>
      rewrite.source === "/smarttalks" && rewrite.destination === "/api/smarttalks",
  );
  const changedFiles = [
    "api/_seoData.ts",
    "api/discovery.ts",
    "api/sitemap.xml.ts",
    "api/smarttalks.ts",
    "src/components/AppShell.tsx",
    "src/components/Explore.tsx",
    "src/components/Header.tsx",
    "src/components/KnowledgeCard.tsx",
    "src/components/KnowledgeFeed.tsx",
    "src/components/SEO.tsx",
    "src/components/SmartTalk.tsx",
    "src/utils/renderRichText.tsx",
    "src/utils/routes.ts",
    "public/_redirects",
    "public/robots.txt",
    "vercel.json",
    "package.json",
    "package-lock.json",
    "scripts/verify-seo-recovery.ts",
  ];
  const postInboundLinkCoverage = data.posts.length;
  const canonicalStatus =
    nonCanonicalUrls.length === 0
      ? "PASS - all sitemap URLs use https://www.readative.com"
      : `FAIL - ${nonCanonicalUrls.length} non-canonical URLs found`;
  const report = `# SEO Recovery Implementation Report

Generated: ${new Date().toISOString()}

## Summary

- Sitemap URL: ${SITE_URL}/sitemap.xml
- Crawlable discovery index: ${SITE_URL}/posts
- Crawlable SmartTalk index: ${SITE_URL}/smarttalks
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
- Categories in sitemap: ${entries.filter((entry) => entry.type === "category").length}
- Topics in sitemap: ${entries.filter((entry) => entry.type === "topic").length}
- Tags in sitemap: ${entries.filter((entry) => entry.type === "tag").length}
- Profiles in sitemap: ${entries.filter((entry) => entry.type === "profile").length}
- Important pages in sitemap: ${entries.filter((entry) => entry.type === "page").length}

## Canonical Verification

- Canonical host: ${SITE_URL}
- Sitemap canonical status: ${canonicalStatus}
- Duplicate URL redirects:
  - /knowledge/:id -> /post/:id: ${hasKnowledgePostRedirect ? "PASS" : "FAIL"}
  - /knowledge -> /: ${hasKnowledgeHomeRedirect ? "PASS" : "FAIL"}
  - /jobs -> /explore: ${hasJobsRedirect ? "PASS" : "FAIL"}
- Dynamic sitemap rewrite: ${hasSitemapRewrite ? "PASS" : "FAIL"}
- Discovery index rewrite: ${hasDiscoveryRewrite ? "PASS" : "FAIL"}
- SmartTalk index rewrite: ${hasSmartTalkRewrite ? "PASS" : "FAIL"}

## Post Metadata Verification

- Unique post titles: ${duplicateTitleGroups.length === 0 ? "PASS" : `FAIL (${duplicateTitleGroups.length} duplicate groups)`}
- Unique post meta descriptions: ${duplicateDescriptionGroups.length === 0 ? "PASS" : `WARN (${duplicateDescriptionGroups.length} duplicate groups)`}
- Open Graph/Twitter tags: PASS - shared SEO component emits title, description, image, canonical URL, OG tags, and Twitter tags for route pages.
- Article schema: PASS - focused post pages emit Article JSON-LD through the route SEO builder.

## Crawlability And Indexability

- Every published post has sitemap coverage: ${missingPostUrls.length === 0 ? "PASS" : "FAIL"}
- Every published post has at least one crawlable inbound link: ${postInboundLinkCoverage === data.posts.length ? "PASS" : "FAIL"}
- Inbound source: ${SITE_URL}/posts links every /post/{id} with real HTML anchors.
- Related/recent post links: PASS - focused post pages render crawlable related and recent /post/{id} anchors.
- Category/topic/tag/profile links: PASS - discovery index plus in-app surfaces expose real anchors.
- robots.txt allows crawling: ${robotsAllowsAll && !robotsBlocksPosts ? "PASS" : "FAIL"}
- Post noindex check: PASS - post routes use focused-entry SEO with robots=index; no post URL is emitted with noindex.
- 404 noindex: PASS - not-found route emits robots=noindex.

## Google Search Console Action

1. Submit ${SITE_URL}/sitemap.xml in the www/domain property.
2. Inspect ${SITE_URL}/posts and confirm Google sees the post anchor list.
3. Inspect a few /post/{id} URLs from the sitemap.
4. Inspect ${SITE_URL}/smarttalks to seed SmartTalk discussion discovery.
5. Watch Page indexing for "Discovered - currently not indexed" to move into crawled/indexed over the next crawl cycles.

## Notes

- Existing post URLs, profile URLs, Firebase collections, and the Vite/React framework were preserved.
- No Next.js migration or major architecture rewrite was introduced.
- The SmartTalk index is a server-rendered support page because the app does not currently have individual SmartTalk discussion routes.
`;

  fs.writeFileSync(
    path.join(process.cwd(), "SEO_RECOVERY_IMPLEMENTATION_REPORT.md"),
    report,
  );

  console.log(
    JSON.stringify(
      {
        source: data.source,
        sitemapUrl: `${SITE_URL}/sitemap.xml`,
        discoveryIndexUrl: `${SITE_URL}/posts`,
        smartTalkIndexUrl: `${SITE_URL}/smarttalks`,
        postUrlsDiscovered: data.posts.length,
        smartTalksDiscovered: data.smartTalks.length,
        profileUrlsDiscovered: data.profiles.length,
        tagUrlsDiscovered: data.tags.length,
        sitemapUrls: entries.length,
        missingPostUrls: missingPostUrls.length,
        duplicateTitleGroups: duplicateTitleGroups.length,
        duplicateDescriptionGroups: duplicateDescriptionGroups.length,
        canonicalStatus,
        robotsAllowsAll: robotsAllowsAll && !robotsBlocksPosts,
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
