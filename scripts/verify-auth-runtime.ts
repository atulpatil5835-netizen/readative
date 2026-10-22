import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import handler from "../api/auth.js";
import { getAuthOtpHttpError } from "../api/_authOtp.js";

// Vercel's CommonJS loader cannot rely on Node's require(ESM) support.
// Exercise the same Firebase Admin import that previously crashed production.
const runtime = spawnSync(process.execPath, [
  "--no-experimental-require-module",
  "-e",
  "require('firebase-admin/auth'); require('firebase-admin/firestore');",
], { encoding: "utf8" });
assert.equal(runtime.status, 0, runtime.stderr);

for (const action of ["request-otp", "verify-otp"]) {
  let status = 0;
  let body: unknown;
  const response = {
    setHeader() {},
    status(value: number) { status = value; return this; },
    json(value: unknown) { body = value; return this; },
  };
  await handler({
    method: "POST", query: { action }, headers: {}, body: {}, socket: {},
  } as any, response as any);
  assert.equal(status, 400, `${action} should validate requests without crashing`);
  assert.deepEqual(body, { error: "Please enter a valid email address." });
}

assert.deepEqual(
  getAuthOtpHttpError(
    new Error(
      "Firebase Admin Firestore access is disabled by READATIVE_FIRESTORE_DATA_ENABLED.",
    ),
  ),
  {
    statusCode: 503,
    body: {
      error:
        "Email verification is temporarily unavailable while server-side Firestore access is disabled.",
    },
  },
);
console.log("Auth runtime imports and both OTP endpoint validation checks passed.");
