import crypto from "crypto";
import nodemailer from "nodemailer";
import type { UserRecord } from "firebase-admin/auth";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "./_authAdmin.js";

export type EmailOtpPurpose = "signup" | "reset";

export interface RequestEmailOtpInput {
  email: string;
  purpose?: EmailOtpPurpose;
  ip?: string;
  userAgent?: string;
}

export interface VerifyEmailOtpInput {
  email: string;
  code: string;
  purpose?: EmailOtpPurpose;
  password?: string;
  displayName?: string;
}

interface EmailOtpDocument {
  codeHash?: string;
  createdAt?: number;
  email?: string;
  expiresAt?: number;
  attempts?: number;
  purpose?: EmailOtpPurpose;
  sendTimestamps?: number[];
}

export interface EmailOtpResponse {
  email: string;
  expiresInSeconds: number;
  resendCooldownSeconds: number;
}

export interface VerifyEmailOtpResponse {
  customToken: string;
  email: string;
  isNewUser: boolean;
}

export class AuthOtpError extends Error {
  statusCode: number;
  retryAfterSeconds?: number;

  constructor(message: string, statusCode = 400, retryAfterSeconds?: number) {
    super(message);
    this.name = "AuthOtpError";
    this.statusCode = statusCode;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const OTP_COLLECTION = "authEmailOtps";
const OTP_LENGTH = 6;
const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const SEND_WINDOW_MS = 60 * 60 * 1000;
const SEND_LIMIT_PER_WINDOW = 5;
const MAX_VERIFY_ATTEMPTS = 5;

function readEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function getOtpSecret() {
  const secret = readEnv("READATIVE_AUTH_OTP_SECRET") || readEnv("AUTH_OTP_SECRET");
  if (secret.length < 32) {
    throw new AuthOtpError(
      "Secure email verification is not configured yet. Set READATIVE_AUTH_OTP_SECRET to a long random value.",
      503,
    );
  }

  return secret;
}

function normalizeEmail(email: string) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new AuthOtpError("Please enter a valid email address.");
  }

  return cleanEmail;
}

function normalizePurpose(purpose: EmailOtpPurpose | undefined): EmailOtpPurpose {
  return purpose === "reset" ? "reset" : "signup";
}

function normalizeCode(code: string) {
  const cleanCode = String(code || "").replace(/\D/g, "");
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(cleanCode)) {
    throw new AuthOtpError(`Enter the ${OTP_LENGTH}-digit verification code.`);
  }

  return cleanCode;
}

function normalizeDisplayName(displayName?: string) {
  const cleanName = String(displayName || "").replace(/\s+/g, " ").trim();
  if (!cleanName) return "";
  if (cleanName.length < 2) {
    throw new AuthOtpError("Name must be at least 2 characters.");
  }
  if (cleanName.length > 64) {
    throw new AuthOtpError("Name must be 64 characters or less.");
  }

  return cleanName;
}

function validateSecurePassword(password?: string) {
  const cleanPassword = String(password || "");
  if (cleanPassword.length < 8) {
    throw new AuthOtpError("Password must be at least 8 characters.");
  }
  if (!/[A-Za-z]/.test(cleanPassword) || !/[0-9]/.test(cleanPassword)) {
    throw new AuthOtpError("Password must include at least one letter and one number.");
  }

  return cleanPassword;
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hashOtp(email: string, code: string, secret: string) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${email}:${code}`)
    .digest("hex");
}

function safeHashEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function createOtpCode() {
  const min = 10 ** (OTP_LENGTH - 1);
  const max = 10 ** OTP_LENGTH;
  return crypto.randomInt(min, max).toString();
}

export function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");
  const visiblePrefix = localPart.slice(0, 2);
  const visibleSuffix = localPart.length > 4 ? localPart.slice(-1) : "";
  return `${visiblePrefix}${"*".repeat(Math.max(3, localPart.length - visiblePrefix.length - visibleSuffix.length))}${visibleSuffix}@${domain}`;
}

function hasAdminErrorCode(error: unknown, codePart: string) {
  return (
    typeof error === "object" &&
    error &&
    "code" in error &&
    String((error as { code?: unknown }).code).includes(codePart)
  );
}

function getMailerConfig() {
  const host = readEnv("READATIVE_SMTP_HOST") || readEnv("SMTP_HOST");
  const port = Number(readEnv("READATIVE_SMTP_PORT") || readEnv("SMTP_PORT") || 587);
  const user = readEnv("READATIVE_SMTP_USER") || readEnv("SMTP_USER");
  const pass = readEnv("READATIVE_SMTP_PASS") || readEnv("SMTP_PASS");
  const from =
    readEnv("READATIVE_AUTH_EMAIL_FROM") ||
    readEnv("READATIVE_SMTP_FROM") ||
    readEnv("SMTP_FROM");

  if (!host || !from) {
    throw new AuthOtpError(
      "Email code delivery is not configured yet. Set the Readative SMTP environment variables.",
      503,
    );
  }

  return {
    host,
    port,
    secure:
      port === 465 ||
      readEnv("READATIVE_SMTP_SECURE").toLowerCase() === "true" ||
      readEnv("SMTP_SECURE").toLowerCase() === "true",
    auth: user && pass ? { user, pass } : undefined,
    from,
  };
}

type MailerConfig = ReturnType<typeof getMailerConfig>;

async function sendOtpEmail({
  email,
  code,
  purpose,
  config,
}: {
  email: string;
  code: string;
  purpose: EmailOtpPurpose;
  config: MailerConfig;
}) {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });
  const actionLabel =
    purpose === "signup"
      ? "create your Readative account"
      : "reset your Readative password";
  const subject = `Your Readative verification code is ${code}`;
  const text = [
    `Your Readative verification code is ${code}.`,
    "",
    `Use this code to ${actionLabel}. It expires in 10 minutes.`,
    "",
    "If you did not request this code, you can ignore this email.",
  ].join("\n");
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#0f172a">
      <p style="margin:0 0 12px">Use this verification code to ${actionLabel}:</p>
      <p style="margin:0 0 16px;font-size:32px;font-weight:800;letter-spacing:6px">${code}</p>
      <p style="margin:0;color:#475569">This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
    </div>
  `;

  await transporter.sendMail({
    from: config.from,
    to: email,
    subject,
    text,
    html,
  });
}

export async function requestEmailOtp(
  input: RequestEmailOtpInput,
): Promise<EmailOtpResponse> {
  const email = normalizeEmail(input.email);
  const purpose = normalizePurpose(input.purpose);
  const secret = getOtpSecret();
  const mailerConfig = getMailerConfig();
  const adminAuth = getFirebaseAdminAuth();

  if (purpose === "signup") {
    try {
      await adminAuth.getUserByEmail(email);
      throw new AuthOtpError(
        "An account with this email already exists. Sign in instead.",
        409,
      );
    } catch (error) {
      if (!hasAdminErrorCode(error, "user-not-found")) {
        throw error;
      }
    }
  }

  if (purpose === "reset") {
    try {
      await adminAuth.getUserByEmail(email);
    } catch (error) {
      if (hasAdminErrorCode(error, "user-not-found")) {
        return {
          email: maskEmail(email),
          expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
          resendCooldownSeconds: Math.floor(RESEND_COOLDOWN_MS / 1000),
        };
      }

      throw error;
    }
  }

  const code = createOtpCode();
  const codeHash = hashOtp(email, code, secret);
  const now = Date.now();
  const db = getFirebaseAdminDb();
  const reference = db.collection(OTP_COLLECTION).doc(sha256(email));

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const data = snapshot.exists
      ? (snapshot.data() as EmailOtpDocument)
      : undefined;
    const lastSentAt =
      typeof data?.createdAt === "number" ? data.createdAt : undefined;
    const recentSendTimestamps = (data?.sendTimestamps || []).filter(
      (timestamp) => now - timestamp < SEND_WINDOW_MS,
    );

    if (lastSentAt && now - lastSentAt < RESEND_COOLDOWN_MS) {
      throw new AuthOtpError(
        "Please wait before requesting another code.",
        429,
        Math.ceil((RESEND_COOLDOWN_MS - (now - lastSentAt)) / 1000),
      );
    }

    if (recentSendTimestamps.length >= SEND_LIMIT_PER_WINDOW) {
      throw new AuthOtpError(
        "Too many verification codes were requested. Please try again later.",
        429,
      );
    }

    transaction.set(reference, {
      codeHash,
      createdAt: now,
      email,
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
      purpose,
      sendTimestamps: [...recentSendTimestamps, now],
      ipHash: input.ip ? sha256(`${secret}:${input.ip}`) : "",
      userAgent: String(input.userAgent || "").slice(0, 180),
    });
  });

  try {
    await sendOtpEmail({ email, code, purpose, config: mailerConfig });
  } catch (error) {
    await reference.delete().catch(() => undefined);
    throw error;
  }

  return {
    email: maskEmail(email),
    expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
    resendCooldownSeconds: Math.floor(RESEND_COOLDOWN_MS / 1000),
  };
}

async function createOtpVerifiedUser({
  email,
  displayName,
  password,
}: {
  email: string;
  displayName: string;
  password?: string;
}): Promise<{ user: UserRecord; isNewUser: boolean }> {
  const adminAuth = getFirebaseAdminAuth();

  try {
    const user = await adminAuth.createUser({
      email,
      emailVerified: true,
      password: validateSecurePassword(password),
      displayName: displayName || undefined,
    });

    return { user, isNewUser: true };
  } catch (error) {
    if (hasAdminErrorCode(error, "email-already-exists")) {
      throw new AuthOtpError(
        "An account with this email already exists. Sign in instead.",
        409,
      );
    }

    throw error;
  }
}

async function resetOtpVerifiedPassword({
  email,
  password,
}: {
  email: string;
  password?: string;
}): Promise<{ user: UserRecord; isNewUser: boolean }> {
  const adminAuth = getFirebaseAdminAuth();

  try {
    const existingUser = await adminAuth.getUserByEmail(email);
    const user = await adminAuth.updateUser(existingUser.uid, {
      password: validateSecurePassword(password),
      emailVerified: true,
    });

    return { user, isNewUser: false };
  } catch (error) {
    if (hasAdminErrorCode(error, "user-not-found")) {
      throw new AuthOtpError(
        "This reset code is invalid or expired. Request a new code.",
      );
    }

    throw error;
  }
}

export async function verifyEmailOtp(
  input: VerifyEmailOtpInput,
): Promise<VerifyEmailOtpResponse> {
  const email = normalizeEmail(input.email);
  const code = normalizeCode(input.code);
  const purpose = normalizePurpose(input.purpose);
  const displayName = normalizeDisplayName(input.displayName);

  validateSecurePassword(input.password);

  const secret = getOtpSecret();
  const now = Date.now();
  const db = getFirebaseAdminDb();
  const reference = db.collection(OTP_COLLECTION).doc(sha256(email));

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const data = snapshot.exists
      ? (snapshot.data() as EmailOtpDocument)
      : undefined;

    if (!data?.codeHash || data.email !== email || data.purpose !== purpose) {
      throw new AuthOtpError("This verification code is invalid or expired.");
    }

    if (typeof data.expiresAt !== "number" || data.expiresAt < now) {
      transaction.delete(reference);
      throw new AuthOtpError("This verification code has expired. Request a new code.");
    }

    const attempts = typeof data.attempts === "number" ? data.attempts : 0;
    if (attempts >= MAX_VERIFY_ATTEMPTS) {
      transaction.delete(reference);
      throw new AuthOtpError("Too many incorrect attempts. Request a new code.", 429);
    }

    const nextHash = hashOtp(email, code, secret);
    if (!safeHashEqual(nextHash, data.codeHash)) {
      transaction.update(reference, { attempts: attempts + 1 });
      throw new AuthOtpError("That verification code is not correct.");
    }

    transaction.delete(reference);
  });

  const { user, isNewUser } =
    purpose === "signup"
      ? await createOtpVerifiedUser({
          email,
          displayName,
          password: input.password,
        })
      : await resetOtpVerifiedPassword({
          email,
          password: input.password,
        });
  const customToken = await getFirebaseAdminAuth().createCustomToken(user.uid, {
    email_verified_by_otp: true,
    readative_auth_method:
      purpose === "signup" ? "email_password_otp" : "password_reset_otp",
  });

  return {
    customToken,
    email,
    isNewUser,
  };
}

export function getAuthOtpHttpError(error: unknown) {
  if (error instanceof AuthOtpError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: error.message,
        ...(error.retryAfterSeconds
          ? { retryAfterSeconds: error.retryAfterSeconds }
          : {}),
      },
    };
  }

  if (
    error instanceof Error &&
    error.message.includes("Firebase Admin credentials are not configured")
  ) {
    return {
      statusCode: 503,
      body: {
        error:
          "Firebase Admin credentials are not configured. Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.",
      },
    };
  }

  console.error("Email verification auth error:", error);
  return {
    statusCode: 500,
    body: {
      error: "Secure email verification could not finish right now.",
    },
  };
}
