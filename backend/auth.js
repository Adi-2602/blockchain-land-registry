require("dotenv").config({ quiet: true });
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getUser, createUser } = require("./db");

const router = express.Router();

// SIGNUP
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: "All fields required" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const created = await createUser({ name, email, password: hashedPassword });
    if (!created) {
      return res.status(400).json({ success: false, error: "Email already registered" });
    }

    res.json({ success: true, message: "Signup successful! Please login." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password required" });
    }
    const user = await getUser(email);

    if (!user) {
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }

    const token = jwt.sign({ email: user.email, name: user.name }, process.env.JWT_SECRET, {
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
    next();
  } catch {
    res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
}

module.exports = { router, authMiddleware };
