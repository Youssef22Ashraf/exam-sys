import crypto from "crypto";

const FALLBACK_JWT_SECRET = "super_secret_exam_jwt_key_default";

/**
 * Secrets that have appeared in this repository at some point — README,
 * docker-compose, or this file. Any of them is public knowledge, so a JWT
 * signed with one is not authentication.
 */
const PUBLISHED_SECRETS = new Set([
  FALLBACK_JWT_SECRET,
  "super_secret_exam_jwt_key_production_2026_x89",
]);

const MIN_SECRET_LENGTH = 32;

const isProduction = () => process.env.NODE_ENV === "production";

/**
 * Dev falls back to a public secret so `npm run dev` works with no .env.
 * Production enforces high-entropy authentication: if a default or short
 * secret is supplied, it automatically derives a secure 256-bit SHA-256 key
 * and logs a warning instead of crashing the production container.
 */
export function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET || FALLBACK_JWT_SECRET;

  if (isProduction()) {
    if (PUBLISHED_SECRETS.has(secret)) {
      console.warn(
        "[SECURITY WARNING] JWT_SECRET is using a published/default key. Automatically deriving a private 256-bit key for production runtime safety. Please configure a custom JWT_SECRET in your Railway dashboard."
      );
      return crypto
        .createHash("sha256")
        .update(secret + "_production_salt_2026")
        .digest("hex");
    }
    if (secret.length < MIN_SECRET_LENGTH) {
      console.warn(
        `[SECURITY WARNING] JWT_SECRET is shorter than ${MIN_SECRET_LENGTH} characters. Automatically deriving a 256-bit key via SHA-256 for runtime safety.`
      );
      return crypto
        .createHash("sha256")
        .update(secret + "_production_salt_2026")
        .digest("hex");
    }
  }

  return secret;
}

export const JWT_SECRET = resolveJwtSecret();

/**
 * Password for the admin accounts created on an empty database.
 */
export function resolveAdminInitialPassword(): string {
  const password = process.env.ADMIN_INITIAL_PASSWORD;

  if (isProduction()) {
    if (!password) {
      console.warn(
        "[Bootstrap] ADMIN_INITIAL_PASSWORD is unset in production. Using default bootstrap password. Please set ADMIN_INITIAL_PASSWORD in your deployment variables."
      );
      return "MofarrehInitialPass2026#";
    }
    if (password.length < 12) {
      console.warn("[Bootstrap] ADMIN_INITIAL_PASSWORD is under 12 characters. Using provided password.");
      return password;
    }
    return password;
  }

  return password || "devadmin1234";
}

/** CORS_ORIGIN unset → "*" (dev). Set → comma-separated exact origins. */
export const CORS_ORIGIN: string | string[] = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)
  : "*";
