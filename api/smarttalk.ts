import type { VercelRequest, VercelResponse } from "@vercel/node";

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function buildDestination(req: VercelRequest) {
  const questionId =
    getQueryValue(req.query.id).trim() ||
    getQueryValue(req.query.question).trim();

  if (questionId) {
    return `/smarttalks/${encodeURIComponent(questionId)}`;
  }

  return "/smarttalks";
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).end();
  }

  res.setHeader("Location", buildDestination(req));
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=86400");
  return res.status(308).end();
}
