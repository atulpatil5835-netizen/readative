import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthOtpHttpError, verifyEmailOtp } from "../_authOtp.js";

function setHeaders(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
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
