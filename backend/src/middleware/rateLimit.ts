import { Request, Response, NextFunction } from "express";

// ponytail: in-memory per-IP window. Single process, resets on restart —
// enough to stop a credential-stuffing loop against one admin account.
// Move to express-rate-limit + a store if the app ever runs two instances.
//
// Requires `app.set("trust proxy", ...)` to be configured, or req.ip is the
// reverse proxy's address and every client shares one bucket.
export function rateLimit(opts: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  // Entries were only reclaimed when the same key was hit again after expiry,
  // so every one-shot IP stayed in the map for the life of the process.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, opts.windowMs);
  // Do not hold the event loop open on shutdown.
  sweep.unref();

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
