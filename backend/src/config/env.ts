const FALLBACK_JWT_SECRET = "super_secret_exam_jwt_key_default";

/**
 * Secrets that have appeared in this repository at some point — README,
 * docker-compose, or this file. Any of them is public knowledge, so a JWT
 * signed with one is not authentication. The previous guard only rejected
 * FALLBACK_JWT_SECRET, while README and docker-compose told operators to use
 * `..._production_2026_x89`, which sailed through it.
 */
const PUBLISHED_SECRETS = new Set([
  FALLBACK_JWT_SECRET,
  "super_secret_exam_jwt_key_production_2026_x89",
]);

const MIN_SECRET_LENGTH = 32;

const isProduction = () => process.env.NODE_ENV === "production";

/**
 * Dev falls back to a public secret so `npm run dev` works with no .env.
 * Production refuses to boot on it: a JWT signed with a secret that is in
 * git is no auth at all.
 */
export function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET || FALLBACK_JWT_SECRET;

  if (isProduction()) {
    if (PUBLISHED_SECRETS.has(secret)) {
      throw new Error(
        "JWT_SECRET is a value published in this repository. Generate a private one: `openssl rand -base64 48`."
      );
    }
    if (secret.length < MIN_SECRET_LENGTH) {
      throw new Error(
        `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production. Generate one: \`openssl rand -base64 48\`.`
      );
    }
  }

  return secret;
}

export const JWT_SECRET = resolveJwtSecret();

/**
 * Password for the admin accounts created on an empty database.
 *
 * Production must supply it. It used to be the string literal
 * "Mofarreh@2026" in `config/bootstrap.ts` and `prisma/seed.ts` — committed,
 * printed to stdout by the seed, and identical on every deployment, with no
 * UI to change it afterwards.
 */
export function resolveAdminInitialPassword(): string {
  const password = process.env.ADMIN_INITIAL_PASSWORD;

  if (isProduction()) {
    if (!password) {
      throw new Error(
        "ADMIN_INITIAL_PASSWORD is unset. Set it before the first production boot, then change it in the admin portal."
      );
    }
    if (password.length < 12) {
      throw new Error("ADMIN_INITIAL_PASSWORD must be at least 12 characters.");
    }
    return password;
  }

  // 12+ chars so the dev default satisfies the same rule POST /api/admin/password enforces.
  return password || "devadmin1234";
}

/** CORS_ORIGIN unset → "*" (dev). Set → comma-separated exact origins. */
export const CORS_ORIGIN: string | string[] = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)
  : "*";
