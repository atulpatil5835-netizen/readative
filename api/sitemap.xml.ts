import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  buildSitemapEntries,
  buildSitemapXml,
  loadSeoData,
} from "./_seoData.js";

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
    if (data.source === "static") {
      console.error(
        "Sitemap dynamic SEO data unavailable:",
        data.errors,
      );
      res.setHeader("Cache-Control", "no-store");
    }
    const entries = buildSitemapEntries(data);
    const xml = buildSitemapXml(entries);

    res.setHeader("X-Readative-SEO-Source", data.source);
    res.setHeader(
      "X-Readative-SEO-Post-Count",
      data.posts.length.toString(),
    );
    res.setHeader("X-Readative-SEO-URL-Count", entries.length.toString());
    res.setHeader(
      "X-Readative-SEO-SmartTalk-Count",
      data.smartTalks.length.toString(),
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
