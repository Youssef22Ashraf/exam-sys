import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env";

export interface AdminClaims {
  id: string;
  username: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: AdminClaims;
}

/**
 * Bearer header is the normal path. `?token=` exists only because <video src>
 * and download links cannot set headers; the token is the same JWT.
 */
function readToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  return typeof req.query.token === "string" ? req.query.token : undefined;
}

/** Verified claims, or null when the token is absent, malformed or expired. */
function verifyToken(token: string | undefined): AdminClaims | null {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as AdminClaims;
  } catch {
    return null;
  }
}

/** Rejects the request unless it carries a valid admin JWT. */
export const authenticateAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = readToken(req);
  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  const claims = verifyToken(token);
  if (!claims) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }

  req.user = claims;
  next();
};

/**
 * Sets `req.user` when a valid admin token is present and continues either
 * way. For endpoints candidates must reach but whose response should be
 * richer for an admin — see `GET /api/questions`, which withholds
 * `correctAnswer` from anyone who is not one.
 */
export const optionalAdmin = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const claims = verifyToken(readToken(req));
  if (claims) {
    req.user = claims;
  }
  next();
};

/**
 * Gate a route on the caller's role. `role` has been signed into the JWT and
 * set on `req.user` since the start, but nothing ever read it — SUPERADMIN and
 * ADMIN were functionally identical, so destructive routes such as
 * `POST /api/questions/reset` were open to any admin.
 *
 * Must be mounted after `authenticateAdmin`.
 */
export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Insufficient privileges for this action.",
      });
    }
    next();
  };
};
