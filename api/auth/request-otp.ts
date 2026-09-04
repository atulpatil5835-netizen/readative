import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthOtpHttpError, requestEmailOtp } from "../_authOtp.js";

function setHeaders(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function getRequestIp(req: VercelRequest) {
  return (
    getHeaderValue(req.headers["x-forwarded-for"]).split(",")[0]?.trim() ||
    getHeaderValue(req.headers["x-real-ip"]) ||
    req.socket.remoteAddress ||
    ""
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const result = await requestEmailOtp({
      email: req.body?.email,
      purpose: req.body?.purpose,
      ip: getRequestIp(req),
      userAgent: getHeaderValue(req.headers["user-agent"]),
    });
    return res.status(200).json(result);
  } catch (error) {
    const httpError = getAuthOtpHttpError(error);
    return res.status(httpError.statusCode).json(httpError.body);
  }
}
