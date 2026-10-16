require("dotenv").config({ quiet: true });
const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const cors = require("cors");
const { contract, sendWrite } = require("./contract");
const { uploadDocument, signedUrl, usingS3 } = require("./storage");
const { saveDocument, listDocuments } = require("./db");
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

// Upload ke baad: file zaroori hai, aur kaam khatam hone par temp file delete
function requireDocument(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "Document (PDF) is required" });
  }
  res.on("finish", () => fs.unlink(req.file.path, () => {}));
  next();
}

// Helper: file ka SHA-256 hash
function hashFile(path) {
  const fileBuffer = fs.readFileSync(path);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

const notRegistered = (res, landId) =>
  res.status(404).json({ success: false, error: `Land ${landId} is not registered` });

app.get("/api/health", async (req, res) => {
  try {
    const block = await contract.runner.provider.getBlockNumber();
    res.json({ success: true, block, storage: usingS3 ? "s3" : "cloudinary" });
  } catch (err) {
    res.status(503).json({ success: false, error: err.message });
  }
});

// 1. Register land (document ke saath)
app.post("/api/land/register", authMiddleware, upload.single("document"), requireDocument, async (req, res) => {
  try {
    const { landId, ownerName, location } = req.body;
    if (!landId || !ownerName || !location) {
      return res.status(400).json({ success: false, error: "landId, ownerName and location are required" });
    }

    // Duplicate check — clean error message ke liye
    if (await contract.landExists(landId)) {
      return res.status(400).json({
        success: false,
        error: `Land ${landId} is already registered. Use Transfer to change ownership.`,
      });
    }

    const docHash = hashFile(req.file.path);
    const { key, url: docUrl } = await uploadDocument(req.file.path, landId);

    const tx = await sendWrite((o) => contract.registerLand(landId, ownerName, location, docHash, o));
    await saveDocument({ landId, s3Key: key, docHash, ownerName, action: "register", txHash: tx.hash, by: req.user.email });

    res.json({ success: true, landId, docHash, docUrl, txHash: tx.hash });
  } catch (err) {
    res.status(500).json({ success: false, error: err.reason || err.message });
  }
});

// 2. Transfer ownership (naye document ke saath)
app.post("/api/land/transfer", authMiddleware, upload.single("document"), requireDocument, async (req, res) => {
  try {
    const { landId, newOwner } = req.body;
    if (!landId || !newOwner) {
      return res.status(400).json({ success: false, error: "landId and newOwner are required" });
    }
    if (!(await contract.landExists(landId))) {
      return res.status(400).json({ success: false, error: `Land ${landId} is not registered yet.` });
    }

    const newDocHash = hashFile(req.file.path);
    const { key, url: docUrl } = await uploadDocument(req.file.path, landId);

    const tx = await sendWrite((o) => contract.transferOwnership(landId, newOwner, newDocHash, o));
    await saveDocument({ landId, s3Key: key, docHash: newDocHash, ownerName: newOwner, action: "transfer", txHash: tx.hash, by: req.user.email });

    res.json({ success: true, landId, newOwner, newDocHash, docUrl, txHash: tx.hash });
  } catch (err) {
    res.status(500).json({ success: false, error: err.reason || err.message });
  }
});

// 3. History dekho
app.get("/api/land/:id/history", async (req, res) => {
  try {
    if (!(await contract.landExists(req.params.id))) return notRegistered(res, req.params.id);
    const records = await contract.getHistory(req.params.id);
    const history = records.map((r) => ({
      landId: r.landId,
      ownerName: r.ownerName,
      location: r.location,
      docHash: r.docHash,
      timestamp: new Date(Number(r.timestamp) * 1000).toLocaleString(),
    }));
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.reason || err.message });
  }
});

// 4. Stored documents (S3 download links) for a land
app.get("/api/land/:id/documents", async (req, res) => {
  try {
    const items = await listDocuments(req.params.id);
    const documents = await Promise.all(items.map(async (d) => ({
      docHash: d.docHash,
      ownerName: d.ownerName,
      action: d.action,
      uploadedAt: d.uploadedAt,
      url: d.s3Key && usingS3 ? await signedUrl(d.s3Key) : null,
    })));
    res.json({ success: true, documents });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Verify document
app.post("/api/land/verify", upload.single("document"), requireDocument, async (req, res) => {
  try {
    const { landId } = req.body;
    if (!landId) return res.status(400).json({ success: false, error: "landId is required" });
    if (!(await contract.landExists(landId))) return notRegistered(res, landId);

    const uploadedHash = hashFile(req.file.path);
    const isValid = await contract.verifyHash(landId, uploadedHash);

    res.json({ success: true, verified: isValid, uploadedHash });
  } catch (err) {
    res.status(500).json({ success: false, error: err.reason || err.message });
  }
});

// Multer errors ko JSON mein convert karo
app.use((err, req, res, next) => {
  if (req.file) fs.unlink(req.file.path, () => {});
  res.status(400).json({ success: false, error: err.message });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT} (storage: ${usingS3 ? "S3" : "Cloudinary"})`));
