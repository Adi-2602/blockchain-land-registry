require("dotenv").config();
const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const cors = require("cors");
const contract = require("./contract");
const { uploadToCloud } = require("./cloudinary");
const { router: authRouter, authMiddleware } = require("./auth");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRouter);

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }, // max 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

// Helper: file ka SHA-256 hash
function hashFile(path) {
  const fileBuffer = fs.readFileSync(path);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

// 1. Register land (document ke saath)
// 1. Register land (document ke saath)
app.post("/api/land/register", authMiddleware, upload.single("document"), async (req, res) => {
  try {
    const { landId, ownerName, location } = req.body;

    // Duplicate check — clean error message ke liye
    const exists = await contract.landExists(landId);
    if (exists) {
      return res.status(400).json({
        success: false,
        error: `Land ${landId} is already registered. Use Transfer to change ownership.`,
      });
    }

    const docHash = hashFile(req.file.path);

    // Cloud upload
    const docUrl = await uploadToCloud(req.file.path, landId);

    const tx = await contract.registerLand(landId, ownerName, location, docHash);
    await tx.wait();

    res.json({ success: true, landId, docHash, docUrl, txHash: tx.hash });
  } catch (err) {
    res.status(500).json({ success: false, error: err.reason || err.message });
  }
});

// 2. Transfer ownership (naye document ke saath)
app.post("/api/land/transfer",authMiddleware, upload.single("document"), async (req, res) => {
  try {
    const { landId, newOwner } = req.body;
    const exists = await contract.landExists(landId);

    if (!exists) {
       return res.status(400).json({
       success: false,
       error: `Land ${landId} is not registered yet.`,
    });
    }
    const newDocHash = hashFile(req.file.path);

    const docUrl = await uploadToCloud(req.file.path, landId);

    const tx = await contract.transferOwnership(landId, newOwner, newDocHash);
    await tx.wait();

    res.json({ success: true, landId, newOwner, newDocHash, docUrl, txHash: tx.hash });
  } catch (err) {
    res.status(500).json({ success: false, error: err.reason || err.message });
  }
});

// 3. History dekho
app.get("/api/land/:id/history", async (req, res) => {
  try {
    const records = await contract.getHistory(req.params.id);
    const history = records.map(r => ({
      landId: r.landId,
      ownerName: r.ownerName,
      location: r.location,
      docHash: r.docHash,
      timestamp: new Date(Number(r.timestamp) * 1000).toLocaleString()
    }));
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.reason || err.message });
  }
});

// 4. Verify document
app.post("/api/land/verify", upload.single("document"), async (req, res) => {
  try {
    const { landId } = req.body;
    const uploadedHash = hashFile(req.file.path);
    const isValid = await contract.verifyHash(landId, uploadedHash);

    res.json({ success: true, verified: isValid, uploadedHash });
  } catch (err) {
    res.status(500).json({ success: false, error: err.reason || err.message });
  }
});

// Multer errors ko JSON mein convert karo
app.use((err, req, res, next) => {
  res.status(400).json({ success: false, error: err.message });
});
app.listen(process.env.PORT, () =>
  console.log(`Backend running on http://localhost:${process.env.PORT}`)
);