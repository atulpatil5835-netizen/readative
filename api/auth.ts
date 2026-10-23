import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getAuthOtpHttpError,
  requestEmailOtp,
  verifyEmailOtp,
} from "./_authOtp.js";

type AuthOtpAction = "request-otp" | "verify-otp";

const ALLOWED_AUTH_ORIGINS = new Set([
  "https://readative.com",
  "https://www.readative.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function setHeaders(
  req: VercelRequest,
  res: VercelResponse,
): boolean {
  const origin = getHeaderValue(req.headers.origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (origin && !ALLOWED_AUTH_ORIGINS.has(origin)) {
    res.status(403).json({ error: "This origin cannot access the auth endpoint." });
    return false;
  }

  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  return true;
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

function getAction(req: VercelRequest): AuthOtpAction | null {
  const action = getHeaderValue(req.query.action as string | string[] | undefined);
  if (action === "request-otp" || action === "verify-otp") return action;

  const [, routeAction] = (req.url || "").split("/api/auth/");
  const normalizedRouteAction = routeAction?.split(/[?#]/)[0];
  return normalizedRouteAction === "request-otp" ||
    normalizedRouteAction === "verify-otp"
    ? normalizedRouteAction
    : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!setHeaders(req, res)) return;

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const action = getAction(req);

  if (!action) {
    return res.status(404).json({ error: "Auth endpoint not found." });
  }

  try {
    if (action === "request-otp") {
      const result = await requestEmailOtp({
        email: req.body?.email,
        purpose: req.body?.purpose,
        ip: getRequestIp(req),
        userAgent: getHeaderValue(req.headers["user-agent"]),
      });
      return res.status(200).json(result);
    }

    const result = await verifyEmailOtp({
      email: req.body?.email,
      code: req.body?.code,
      purpose: req.body?.purpose,
      password: req.body?.password,
      displayName: req.body?.displayName,
    });
    return res.status(200).json(result);
  } catch (error) {
    const httpError = getAuthOtpHttpError(error);
    return res.status(httpError.statusCode).json(httpError.body);
  }
}
