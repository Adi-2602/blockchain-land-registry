require("dotenv").config({ quiet: true });
const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const cors = require("cors");
const { ethers } = require("ethers");
const { contract, provider, sendWrite, sendEth } = require("./contract");
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

// Blockchain write ho chuka hai — DynamoDB index fail ho to request fail mat karo, sirf log karo
async function recordDocument(doc) {
  try {
    await saveDocument(doc);
    return undefined;
  } catch (err) {
    console.error("DynamoDB saveDocument failed:", err.name, err.message, JSON.stringify(doc));
    return `Recorded on blockchain, but document index not saved: ${err.message}`;
  }
}

// ethers ke lambe errors ko ek line mein
const chainError = (err) => err.reason || err.shortMessage || err.message;

const notRegistered = (res, landId) =>
  res.status(404).json({ success: false, error: `Land ${landId} is not registered` });

app.get("/api/health", async (req, res) => {
  try {
    const block = await provider.getBlockNumber();
    res.json({ success: true, block, storage: usingS3 ? "s3" : "cloudinary" });
  } catch (err) {
    res.status(503).json({ success: false, error: err.message });
  }
});

// ---------------- MetaMask support ----------------
const CHAIN_NAME = "BlockCodeM Land Chain";

// Frontend ko network + contract details (MetaMask mein network add karne ke liye)
app.get("/api/chain", async (req, res) => {
  try {
    const { chainId } = await provider.getNetwork();
    res.json({ success: true, chainId: Number(chainId), chainName: CHAIN_NAME, contractAddress: await contract.getAddress() });
  } catch (err) {
    res.status(503).json({ success: false, error: err.message });
  }
});

// MetaMask ka RPC gateway. Ganache ka port public nahi hai; yahan sirf safe methods aage jaate hain.
// eth_sendTransaction / eth_sign BLOCK hain — warna koi bhi server wallet se sign karwa leta.
// eth_sendRawTransaction allowed hai: wo pehle se user ke apne wallet se signed hota hai.
const RPC_ALLOWED = new Set([
  "eth_chainId", "net_version", "web3_clientVersion", "eth_blockNumber", "eth_syncing",
  "eth_call", "eth_estimateGas", "eth_gasPrice", "eth_maxPriorityFeePerGas", "eth_feeHistory",
  "eth_getBalance", "eth_getCode", "eth_getTransactionCount", "eth_getTransactionByHash",
  "eth_getTransactionReceipt", "eth_getBlockByNumber", "eth_getBlockByHash", "eth_getLogs",
  "eth_sendRawTransaction",
]);
app.post("/api/rpc", async (req, res) => {
  const calls = Array.isArray(req.body) ? req.body : [req.body];
  const blocked = calls.find((c) => !c || !RPC_ALLOWED.has(c.method));
  if (blocked) {
    return res.json({ jsonrpc: "2.0", id: blocked?.id ?? null, error: { code: -32601, message: `Method ${blocked?.method} not allowed` } });
  }
  try {
    const upstream = await fetch(process.env.GANACHE_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req.body),
    });
    res.status(upstream.status).type("application/json").send(await upstream.text());
  } catch (err) {
    res.status(502).json({ jsonrpc: "2.0", id: calls[0]?.id ?? null, error: { code: -32603, message: err.message } });
  }
});

// Logged-in registrar ke MetaMask wallet ko gas ke liye test ETH
app.post("/api/wallet/fund", authMiddleware, async (req, res) => {
  try {
    const { address } = req.body;
    if (!ethers.isAddress(address)) return res.status(400).json({ success: false, error: "Invalid wallet address" });
    const balance = await provider.getBalance(address);
    if (balance >= ethers.parseEther("1")) {
      return res.json({ success: true, funded: false, balance: ethers.formatEther(balance) });
    }
    const tx = await sendEth(address, "5");
    res.json({ success: true, funded: true, txHash: tx.hash, balance: ethers.formatEther(await provider.getBalance(address)) });
  } catch (err) {
    res.status(500).json({ success: false, error: chainError(err) });
  }
});

// MetaMask flow step 1: document check + hash + S3 upload (transaction browser se sign hoga)
app.post("/api/land/prepare", authMiddleware, upload.single("document"), requireDocument, async (req, res) => {
  try {
    const { action, landId, ownerName, location } = req.body;
    if (!landId || !ownerName || (action === "register" && !location)) {
      return res.status(400).json({ success: false, error: "All fields are required" });
    }
    const exists = await contract.landExists(landId);
    if (action === "register" && exists) {
      return res.status(400).json({ success: false, error: `Land ${landId} is already registered. Use Transfer to change ownership.` });
    }
    if (action === "transfer" && !exists) {
      return res.status(400).json({ success: false, error: `Land ${landId} is not registered yet.` });
    }
    const docHash = hashFile(req.file.path);
    const { key, url } = await uploadDocument(req.file.path, landId);
    res.json({ success: true, docHash, s3Key: key, docUrl: url });
  } catch (err) {
    res.status(500).json({ success: false, error: chainError(err) });
  }
});

// MetaMask flow step 2: mined transaction ko chain par check karke DynamoDB mein index karo
app.post("/api/land/record", authMiddleware, async (req, res) => {
  try {
    const { action, landId, ownerName, docHash, s3Key, txHash } = req.body;
    const receipt = await provider.getTransactionReceipt(txHash);
    const contractAddress = (await contract.getAddress()).toLowerCase();
    if (!receipt || receipt.status !== 1 || receipt.to?.toLowerCase() !== contractAddress) {
      return res.status(400).json({ success: false, error: "Transaction not found or failed on chain" });
    }
    const land = await contract.getLand(landId);
    if (land.docHash !== docHash || land.ownerName !== ownerName) {
      return res.status(400).json({ success: false, error: "On-chain record does not match this document" });
    }
    const warning = await recordDocument({
      landId, s3Key, docHash, ownerName, action, txHash, by: req.user.email, signedBy: receipt.from, via: "metamask",
    });
    res.json({ success: true, txHash, signedBy: receipt.from, warning });
  } catch (err) {
    res.status(500).json({ success: false, error: chainError(err) });
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

    const tx = await sendWrite("registerLand", landId, ownerName, location, docHash);
    const warning = await recordDocument({ landId, s3Key: key, docHash, ownerName, action: "register", txHash: tx.hash, by: req.user.email });

    res.json({ success: true, landId, docHash, docUrl, txHash: tx.hash, warning });
  } catch (err) {
    res.status(500).json({ success: false, error: chainError(err) });
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

    const tx = await sendWrite("transferOwnership", landId, newOwner, newDocHash);
    const warning = await recordDocument({ landId, s3Key: key, docHash: newDocHash, ownerName: newOwner, action: "transfer", txHash: tx.hash, by: req.user.email });

    res.json({ success: true, landId, newOwner, newDocHash, docUrl, txHash: tx.hash, warning });
  } catch (err) {
    res.status(500).json({ success: false, error: chainError(err) });
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
    res.status(500).json({ success: false, error: chainError(err) });
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
    res.status(500).json({ success: false, error: chainError(err) });
  }
});

// Multer errors ko JSON mein convert karo
app.use((err, req, res, next) => {
  if (req.file) fs.unlink(req.file.path, () => {});
  res.status(400).json({ success: false, error: err.message });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT} (storage: ${usingS3 ? "S3" : "Cloudinary"})`));
