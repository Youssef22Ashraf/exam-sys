import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env";
import { prisma } from "../config/db";
import { authenticateAdmin, AuthRequest } from "../middleware/auth";

const router = Router();

// POST /api/admin/login
router.post("/login", async (req: Request, res: Response) => {
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

export default router;

