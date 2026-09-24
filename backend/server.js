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

// Helper: kaam ho jaane ke baad temp upload delete karo
function removeTempFile(file) {
  if (file) fs.promises.unlink(file.path).catch(() => {});
}

// 1. Prepare document (register ya transfer se pehle)
//    PDF ka hash banao + cloud pe upload karo. Blockchain transaction
//    registrar khud frontend se MetaMask ke through sign karta hai.
app.post("/api/land/prepare", authMiddleware, upload.single("document"), async (req, res) => {
  try {
    const { landId, action } = req.body || {};
    if (!landId || !req.file) {
      return res.status(400).json({ success: false, error: "Land ID and a PDF document are required" });
    }
    if (action !== "register" && action !== "transfer") {
      return res.status(400).json({ success: false, error: "action must be 'register' or 'transfer'" });
    }

    // Duplicate / existence check — MetaMask popup se pehle clean error ke liye
    const exists = await contract.landExists(landId);
    if (action === "register" && exists) {
      return res.status(400).json({
        success: false,
        error: `Land ${landId} is already registered. Use Transfer to change ownership.`,
      });
    }
    if (action === "transfer" && !exists) {
      return res.status(400).json({ success: false, error: `Land ${landId} is not registered yet.` });
    }

    const docHash = hashFile(req.file.path);
    const docUrl = await uploadToCloud(req.file.path, landId);

    res.json({ success: true, landId, docHash, docUrl });
  } catch (err) {
    res.status(500).json({ success: false, error: err.reason || err.message });
  } finally {
    removeTempFile(req.file);
  }
});

// 2. History dekho
app.get("/api/land/:id/history", async (req, res) => {
  try {
    const records = await contract.getHistory(req.params.id);
    const history = records.map((r, i) => ({
      version: i + 1,
      landId: r.landId,
      ownerName: r.ownerName,
      location: r.location,
      docHash: r.docHash,
      docUrl: r.docUrl,
      registeredBy: r.registeredBy,
      timestamp: Number(r.timestamp), // unix seconds — frontend format karega
    }));
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.reason || err.message });
  }
});

// 3. Verify document — poori history ke against
app.post("/api/land/verify", upload.single("document"), async (req, res) => {
  try {
    const { landId } = req.body || {};
    if (!landId || !req.file) {
      return res.status(400).json({ success: false, error: "Land ID and a PDF document are required" });
    }
    const uploadedHash = hashFile(req.file.path);
    const [found, isCurrent, version] = await contract.verifyDocument(landId, uploadedHash);

    res.json({
      success: true,
      verified: found,
      isCurrent,
      version: Number(version),
      uploadedHash,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.reason || err.message });
  } finally {
    removeTempFile(req.file);
  }
});

// Multer errors ko JSON mein convert karo
app.use((err, req, res, next) => {
  res.status(400).json({ success: false, error: err.message });
});
app.listen(process.env.PORT, () =>
  console.log(`Backend running on http://localhost:${process.env.PORT}`)
);
