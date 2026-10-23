import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirebaseAdminTechNewsDb } from "./_authAdmin.js";
import { escapeXml } from "./_seoData.js";
import {
  buildSitemapEntries,
  buildSitemapXml,
  getIndexableSeoPosts,
  getIndexableTechNews,
  getIndexableSeoSmartTalks,
  loadSeoData,
} from "./_seoData.js";

const NEWS_WINDOW_MS = 48 * 60 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  );

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).end();
  }

  const sitemapType = Array.isArray(req.query.type) ? req.query.type[0] : req.query.type;
  if (sitemapType === "news") {
    try {
      const cutoff = Date.now() - NEWS_WINDOW_MS;
      const snapshot = await getFirebaseAdminTechNewsDb().collection("knowledge")
        .where("contentKind", "==", "news")
        .limit(1000)
        .get();
      const urls = snapshot.docs.map((item) => {
        const entry = item.data();
        if (entry.visibility !== "public" || String(entry.authorEmail || "").trim().toLowerCase() !== "atulpatil5835@gmail.com") return "";
        const rawDate = entry.createdAt;
        const createdAt = typeof rawDate === "number" ? rawDate : rawDate && typeof rawDate.toMillis === "function" ? rawDate.toMillis() : 0;
        if (!createdAt || createdAt < cutoff) return "";
        const loc = `https://www.readative.com/tech-news/article/${encodeURIComponent(item.id)}`;
        const title = escapeXml(typeof entry.title === "string" ? entry.title : "Technology News");
        return `  <url><loc>${loc}</loc><news:news><news:publication><news:name>Readative Tech News</news:name><news:language>en</news:language></news:publication><news:publication_date>${new Date(createdAt).toISOString()}</news:publication_date><news:title>${title}</news:title></news:news></url>`;
      }).filter(Boolean);
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${urls.join("\n")}\n</urlset>`;
      res.setHeader("X-Readative-Tech-News-Count", urls.length.toString());
      if (req.method === "HEAD") return res.status(200).end();
      return res.status(200).send(xml);
    } catch (error) {
      console.error("News sitemap generation error:", error);
      res.setHeader("Cache-Control", "no-store");
      return res.status(503).send('<?xml version="1.0" encoding="UTF-8"?><error>News sitemap is temporarily unavailable.</error>');
    }
  }

  try {
    const data = await loadSeoData();
    if (data.source === "static") {
      console.error(
        "Sitemap dynamic SEO data unavailable:",
        data.errors,
      );
      res.setHeader("Cache-Control", "no-store");
    }
    const entries = buildSitemapEntries(data);
    const xml = buildSitemapXml(entries);
    const posts = getIndexableSeoPosts(data.posts);
    const techNews = getIndexableTechNews(data.posts);
    const smartTalks = getIndexableSeoSmartTalks(data.smartTalks);

    res.setHeader("X-Readative-SEO-Source", data.source);
    res.setHeader(
      "X-Readative-SEO-Post-Count",
      posts.length.toString(),
    );
    res.setHeader("X-Readative-SEO-Tech-News-Count", techNews.length.toString());
    res.setHeader("X-Readative-SEO-URL-Count", entries.length.toString());
    res.setHeader(
      "X-Readative-SEO-SmartTalk-Count",
      smartTalks.length.toString(),
    );

    if (req.method === "HEAD") {
      return res.status(200).end();
    }

    return res.status(200).send(xml);
  } catch (error) {
    console.error("Sitemap generation error:", error);
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).send(
      '<?xml version="1.0" encoding="UTF-8"?>\n<error>Sitemap data is temporarily unavailable.</error>',
    );
  }
}
