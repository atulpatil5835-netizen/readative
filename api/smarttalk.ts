import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadSeoData } from "./_seoData.js";
import {
  buildSmartTalkSeoPath,
  extractSeoDocumentId,
} from "../src/utils/seoUrls.js";

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

async function buildDestination(req: VercelRequest) {
  const questionId =
    extractSeoDocumentId(getQueryValue(req.query.id).trim()) ||
    extractSeoDocumentId(getQueryValue(req.query.question).trim());

  if (questionId) {
    const data = await loadSeoData();
    const question = data.smartTalks.find((candidate) => candidate.id === questionId);
    return question
      ? buildSmartTalkSeoPath(question.id, question.title)
      : buildSmartTalkSeoPath(questionId);
  }

  return "/smarttalks";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).end();
  }

  res.setHeader("Location", await buildDestination(req));
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=86400");
  return res.status(301).end();
}
