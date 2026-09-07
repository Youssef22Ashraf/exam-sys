import { describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";
import type { Response, NextFunction } from "express";
import {
  authenticateAdmin,
  optionalAdmin,
  requireRole,
  type AuthRequest,
} from "../src/middleware/auth";
import { JWT_SECRET } from "../src/config/env";

function mockRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: any };
}

const req = (over: Partial<AuthRequest> = {}) =>
  ({ headers: {}, query: {}, ...over }) as AuthRequest;

const sign = (claims: object, opts: jwt.SignOptions = {}) =>
  jwt.sign(claims, JWT_SECRET, opts);

describe("authenticateAdmin", () => {
  it("rejects a request with no token", () => {
    const res = mockRes();
    const next = vi.fn();
    authenticateAdmin(req(), res, next as unknown as NextFunction);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a malformed token", () => {
    const res = mockRes();
    const next = vi.fn();
    authenticateAdmin(
      req({ headers: { authorization: "Bearer not-a-jwt" } }),
      res,
      next as unknown as NextFunction
    );
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an expired token", () => {
    const res = mockRes();
    const next = vi.fn();
    const expired = sign({ id: "a", username: "admin", role: "ADMIN" }, { expiresIn: "-1s" });
    authenticateAdmin(
      req({ headers: { authorization: `Bearer ${expired}` } }),
      res,
      next as unknown as NextFunction
    );
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a token signed with a different secret", () => {
    const res = mockRes();
    const next = vi.fn();
    const foreign = jwt.sign({ id: "a", username: "admin", role: "ADMIN" }, "some-other-secret");
    authenticateAdmin(
      req({ headers: { authorization: `Bearer ${foreign}` } }),
      res,
      next as unknown as NextFunction
    );
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts a valid token and populates req.user", () => {
    const res = mockRes();
    const next = vi.fn();
    const r = req({
      headers: { authorization: `Bearer ${sign({ id: "a", username: "admin", role: "ADMIN" })}` },
    });
    authenticateAdmin(r, res, next as unknown as NextFunction);
    expect(next).toHaveBeenCalled();
    expect(r.user?.username).toBe("admin");
  });

  it("accepts ?token= for <video src>, which cannot set a header", () => {
    const res = mockRes();
    const next = vi.fn();
    const r = req({ query: { token: sign({ id: "a", username: "admin", role: "ADMIN" }) } });
    authenticateAdmin(r, res, next as unknown as NextFunction);
    expect(next).toHaveBeenCalled();
  });
});

describe("optionalAdmin", () => {
  it("continues without a token and leaves req.user unset", () => {
    const next = vi.fn();
    const r = req();
    optionalAdmin(r, mockRes(), next as unknown as NextFunction);
    expect(next).toHaveBeenCalled();
    expect(r.user).toBeUndefined();
  });

  it("continues on an invalid token rather than rejecting", () => {
    const next = vi.fn();
    const r = req({ headers: { authorization: "Bearer nonsense" } });
    optionalAdmin(r, mockRes(), next as unknown as NextFunction);
    expect(next).toHaveBeenCalled();
    expect(r.user).toBeUndefined();
  });

  it("populates req.user for a valid token", () => {
    const next = vi.fn();
    const r = req({
      headers: { authorization: `Bearer ${sign({ id: "a", username: "root", role: "SUPERADMIN" })}` },
    });
    optionalAdmin(r, mockRes(), next as unknown as NextFunction);
    expect(r.user?.role).toBe("SUPERADMIN");
  });
});

describe("requireRole", () => {
  it("refuses a role that is not listed", () => {
    const res = mockRes();
    const next = vi.fn();
    const r = req();
    r.user = { id: "a", username: "admin", role: "ADMIN" };
    requireRole("SUPERADMIN")(r, res, next as unknown as NextFunction);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows a listed role", () => {
    const next = vi.fn();
    const r = req();
    r.user = { id: "a", username: "root", role: "SUPERADMIN" };
    requireRole("SUPERADMIN")(r, mockRes(), next as unknown as NextFunction);
    expect(next).toHaveBeenCalled();
  });

  it("refuses when there is no authenticated user at all", () => {
    const res = mockRes();
    const next = vi.fn();
    requireRole("ADMIN")(req(), res, next as unknown as NextFunction);
    expect(res.statusCode).toBe(403);
  });
});
