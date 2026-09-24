require("dotenv").config();
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");

const router = express.Router();
const USERS_FILE = "./users.json";

// Users file read/write helpers
function getUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Sirf .env ke REGISTRAR_EMAILS wale log registrar account bana/use kar sakte hain
function isRegistrarEmail(email) {
  const allowed = (process.env.REGISTRAR_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email);
}

// SIGNUP
router.post("/signup", async (req, res) => {
  try {
    const { name, password } = req.body || {};
    const email = (req.body?.email || "").trim().toLowerCase();
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: "All fields required" });
    }
    if (!isRegistrarEmail(email)) {
      return res.status(403).json({
        success: false,
        error: "This email is not an approved registrar. Ask the admin to add it to REGISTRAR_EMAILS.",
      });
    }

    const users = getUsers();
    if (users.find((u) => u.email === email)) {
      return res.status(400).json({ success: false, error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    users.push({ name, email, password: hashedPassword, role: "registrar" });
    saveUsers(users);

    res.json({ success: true, message: "Signup successful! Please login." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { password } = req.body || {};
    const email = (req.body?.email || "").trim().toLowerCase();
    const users = getUsers();
    const user = users.find((u) => u.email === email);

    if (!user) {
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }

    // Registrar list se hata diya gaya ho to login mat karne do
    if (!isRegistrarEmail(user.email)) {
      return res.status(403).json({ success: false, error: "Registrar access has been revoked" });
    }

    const token = jwt.sign({ email: user.email, name: user.name, role: "registrar" }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    res.json({ success: true, token, name: user.name });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Middleware — protected routes ke liye
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Login required" });
  }

  try {
    const token = authHeader.split(" ")[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    if (req.user.role !== "registrar" || !isRegistrarEmail(req.user.email)) {
      return res.status(403).json({ success: false, error: "Registrar access required" });
    }
    next();
  } catch {
    res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
}

module.exports = { router, authMiddleware };