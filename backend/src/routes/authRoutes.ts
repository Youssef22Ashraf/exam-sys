import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env";
import { rateLimit } from "../middleware/rateLimit";
import { prisma } from "../config/db";
import { authenticateAdmin, AuthRequest } from "../middleware/auth";

const router = Router();

// POST /api/admin/login
router.post("/login", rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required." });
    }

    const admin = await prisma.adminUser.findUnique({
      where: { username: username.trim() },
    });

    if (!admin) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Internal server error during login." });
  }
});

// GET /api/admin/me
router.get("/me", authenticateAdmin, async (req: AuthRequest, res: Response) => {
  return res.json({ user: req.user });
});

// POST /api/admin/password - Change the signed-in admin's own password.
//
// There was previously no way to rotate a password at all: the initial one was
// a committed literal, identical on every deployment, and permanent.
router.post(
  "/password",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }),
  authenticateAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
        return res
          .status(400)
          .json({ error: "Current and new password are required." });
      }
      if (newPassword.length < 12) {
        return res
          .status(400)
          .json({ error: "The new password must be at least 12 characters." });
      }
      if (newPassword === currentPassword) {
        return res
          .status(400)
          .json({ error: "The new password must differ from the current one." });
      }

      const admin = await prisma.adminUser.findUnique({
        where: { id: req.user!.id },
      });
      if (!admin) {
        return res.status(401).json({ error: "Account no longer exists." });
      }

      const isMatch = await bcrypt.compare(currentPassword, admin.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ error: "Current password is incorrect." });
      }

      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { passwordHash: await bcrypt.hash(newPassword, 10) },
      });

      // Tokens already issued stay valid until they expire (24h). Revocation
      // needs a token store; see TODO.md.
      return res.json({ success: true, message: "Password updated." });
    } catch (error) {
      console.error("Password change error:", error);
      return res.status(500).json({ error: "Failed to update the password." });
    }
  }
);

export default router;

