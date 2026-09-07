import { Request, Response, NextFunction } from "express";

// ponytail: in-memory per-IP window. Single process, resets on restart —
// enough to stop a credential-stuffing loop against one admin account.
// Move to express-rate-limit + a store if the app ever runs two instances.
export function rateLimit(opts: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || "unknown";
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > opts.max) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ error: "Too many attempts. Try again later." });
    }
    return next();
  };
}
