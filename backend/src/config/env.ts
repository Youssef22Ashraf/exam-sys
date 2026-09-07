const FALLBACK_JWT_SECRET = "super_secret_exam_jwt_key_default";

/**
 * Dev falls back to a public secret so `npm run dev` works with no .env.
 * Production refuses to boot on it: a JWT signed with a secret that is in
 * git is no auth at all.
 */
export function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET || FALLBACK_JWT_SECRET;
  if (process.env.NODE_ENV === "production" && secret === FALLBACK_JWT_SECRET) {
    throw new Error(
      "JWT_SECRET is unset or still the dev fallback. Set a random secret before running in production."
    );
  }
  return secret;
}

export const JWT_SECRET = resolveJwtSecret();

/** CORS_ORIGIN unset → "*" (dev). Set → comma-separated exact origins. */
export const CORS_ORIGIN: string | string[] = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)
  : "*";
