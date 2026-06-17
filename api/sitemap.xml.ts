import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  buildSitemapEntries,
  buildSitemapXml,
  loadSeoData,
} from "./_seoData";

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

  try {
    const data = await loadSeoData();
    const entries = buildSitemapEntries(data);
    const xml = buildSitemapXml(entries);

    res.setHeader("X-Readative-SEO-Source", data.source);
    res.setHeader(
      "X-Readative-SEO-Post-Count",
      data.posts.length.toString(),
    );
    res.setHeader("X-Readative-SEO-URL-Count", entries.length.toString());

    if (req.method === "HEAD") {
      return res.status(200).end();
    }

    return res.status(200).send(xml);
  } catch (error) {
    console.error("Sitemap generation error:", error);
    return res.status(500).send(
      buildSitemapXml([
        {
          loc: "https://www.readative.com/",
          path: "/",
          lastmod: new Date().toISOString(),
          changefreq: "daily",
          priority: "1.0",
          type: "page",
        },
      ]),
    );
  }
}
