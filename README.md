# 🏛️ Blockchain Land Registry System

A tamper-proof land records management system using **Blockchain + Cloud (AWS)**. Land ownership records aur unke documents ke SHA-256 hashes Ethereum smart contract par store hote hain, documents **Amazon S3** mein, aur registrar accounts **DynamoDB** mein. Koi bhi record tamper nahi kar sakta aur poori ownership history transparent rehti hai.

**Mini Project — Cloud Computing and Blockchain, M.Tech CSE, SRMIST**
**Team BlockCodeM:** Aditya Dhabhai (RA2512055010013) · Ishan Roy Barman (RA2512055010018)

---

## 📌 Problem Statement

Land records managed through centralized systems face risks of unauthorized changes and ownership disputes. This project implements a blockchain-based system to record land ownership and transaction details securely, with supporting documents stored off-chain in the cloud, providing a transparent and reliable ownership history.

---

## ✨ Features

- **Register Land** — land details + PDF deed; deed ka SHA-256 hash blockchain par, file AWS S3 mein
- **Transfer Ownership** — naye deed ke saath transfer; purana record history mein preserved
- **Ownership History** — Land ID ki poori timeline (owners + timestamps) blockchain se, har deed ka S3 download link
- **Tamper Detection** — document upload karke verify; hash mismatch = ❌ TAMPERED
- **🦊 MetaMask**
  - Registrar apne wallet se register/transfer **sign** kar sakta hai (on-chain signer address dikhta hai)
  - **Verify directly on blockchain** — PDF ka hash browser mein banta hai, file server par nahi jaati
  - "Get test ETH" — logged-in registrar ke wallet ko gas ke liye test ETH
- **Auth** — registrar signup/login (bcrypt + JWT); search aur verify public

---

## 🏗️ Architecture

```
 Browser (React + Vite)  ── hosted on Amazon S3 (static website)
   │   ├── REST (JWT) ──┐
   │   └── MetaMask ────┴─► Amazon CloudFront (HTTPS) ─► Express API on Amazon EC2 (pm2)
   │        (/api/rpc, allowlisted)                         ├── Ganache (local Ethereum, chain id 2602)
   │                   (allowlisted)       │      └── LandRegistry.sol
   │                                       ├── Amazon S3 (private bucket: PDF deeds)
   │                                       └── Amazon DynamoDB (Users, LandDocuments)
   │
   IAM role on EC2 → S3 + DynamoDB access (no AWS keys in code)
```

**Key design decision:** documents blockchain par store nahi hote (costly). Sirf unke SHA-256 hashes on-chain jaate hain — files S3 mein. Ye industry-standard hybrid pattern hai.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart contract | Solidity ^0.8.19 |
| Blockchain | Ganache (on EC2), Hardhat 2 |
| Chain library | ethers.js v6 |
| Wallet | MetaMask |
| Backend | Node.js 22 + Express 5, Multer, bcryptjs, JWT |
| Hashing | Node.js `crypto` (SHA-256) |
| Cloud storage | Amazon S3 (pre-signed links) — Cloudinary fallback for local dev |
| Database | Amazon DynamoDB — `users.json` fallback for local dev |
| Hosting | Amazon EC2 (API + chain), Amazon S3 static website (frontend), Amazon CloudFront (HTTPS for API + MetaMask RPC) |
| Frontend | React 19 + Vite, Axios |

---

## 📁 Project Structure

```
blockchain-land-registry/
├── blockchain/            # Solidity contract + Hardhat config
│   └── contracts/LandRegistry.sol
├── backend/
│   ├── server.js          # REST API + MetaMask RPC gateway
│   ├── contract.js        # ethers.js: provider, wallet, write queue (nonce + gas buffer)
│   ├── storage.js         # S3 upload + pre-signed URLs
│   ├── db.js              # DynamoDB (Users, LandDocuments)
│   ├── auth.js            # signup / login / JWT middleware
│   └── scripts/deploy-local.js
├── frontend/src/
│   ├── App.jsx, api.js, wallet.js (MetaMask)
│   └── components/        # Register, Search, Transfer, Verify, Login, Signup, WalletBar
├── deploy/
│   ├── ec2-setup.sh       # one-command server setup (Ganache + API via pm2)
│   └── aws-setup.sh       # optional CloudShell script for S3/DynamoDB/IAM/EC2
└── docs/                  # report, PPT, screenshots, diagrams, sample deeds
```

---

## 🔗 Smart Contract Functions

| Function | Description |
|----------|-------------|
| `registerLand(landId, ownerName, location, docHash)` | Naya land record (duplicate check) |
| `transferOwnership(landId, newOwner, newDocHash)` | Ownership transfer; purana record history mein |
| `getLand(landId)` / `getHistory(landId)` | Current record / poori timeline |
| `verifyHash(landId, hash)` | Document hash verification |

## 🌐 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/signup`, `/api/auth/login` | – | Registrar account / JWT |
| POST | `/api/land/register` | JWT | Register (multipart: details + PDF) |
| POST | `/api/land/transfer` | JWT | Transfer (multipart: new owner + PDF) |
| GET | `/api/land/:id/history` | – | Ownership history |
| GET | `/api/land/:id/documents` | – | S3 download links |
| POST | `/api/land/verify` | – | Verify document |
| GET | `/api/chain` | – | Chain id + contract address (MetaMask) |
| POST | `/api/rpc` | – | MetaMask JSON-RPC gateway (read + signed raw tx only) |
| POST | `/api/wallet/fund` | JWT | 5 test ETH to registrar wallet |
| POST | `/api/land/prepare`, `/api/land/record` | JWT | MetaMask-signed register/transfer |
| GET | `/api/health` | – | Status |

---

## ☁️ AWS Deployment (region ap-southeast-2)

1. **S3:** `blockcodem-land-docs-…` (private, versioning) for deeds; `blockcodem-land-web-…` (static website hosting, public read) for the React build
2. **DynamoDB:** `Users` (PK `email` String), `LandDocuments` (PK `landId` String, SK `uploadedAt` Number), on-demand
3. **IAM role** `LandRegistryEC2Role`: `s3:PutObject/GetObject` on the docs bucket, `dynamodb:GetItem/PutItem/Query` on both tables, plus `AmazonSSMManagedInstanceCore`
4. **EC2:** Ubuntu 24.04 t3.micro with the role; security group opens 22 and 5001 (Ganache 8545 stays closed); user data installs Node 22, pm2, ganache
5. On the server: `curl -sO https://raw.githubusercontent.com/adi-2602/blockchain-land-registry/main/deploy/ec2-setup.sh && BRANCH=main bash ec2-setup.sh`
6. **CloudFront:** distribution with the EC2 public DNS as origin (HTTP, port 5001), all HTTP methods allowed, cache policy `UseOriginCacheControlHeaders`, origin request policy `AllViewerExceptHostHeader`, viewer protocol "Redirect HTTP to HTTPS". MetaMask needs an HTTPS RPC URL, so the API is served as `https://<distribution>.cloudfront.net/api`
7. Frontend: `cd frontend && VITE_API_URL=https://<distribution>.cloudfront.net/api npm run build` → upload `dist/` contents to the root of the website bucket

---

## 🚀 Local Setup

```bash
cd backend && npm install
cd ../frontend && npm install
npm install -g ganache
```

```bash
# Terminal 1 — local chain
ganache --chain.chainId 2602 --wallet.accounts "0x<private_key>,1000000000000000000000"

# Terminal 2 — deploy contract + start API
cd backend
GANACHE_URL=http://127.0.0.1:8545 PRIVATE_KEY=0x<private_key> node scripts/deploy-local.js
# backend/.env:
#   CONTRACT_ADDRESS=<printed address>
#   GANACHE_URL=http://127.0.0.1:8545
#   PRIVATE_KEY=0x<private_key>
#   PORT=5001
#   JWT_SECRET=<any random string>
#   # AWS (optional): AWS_REGION, S3_BUCKET, USERS_TABLE, DOCS_TABLE
#   # without S3: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
node server.js

# Terminal 3 — frontend
cd frontend && npm run dev   # http://localhost:5173
```

---

## 🧪 Demo Flow

Sample deeds aur test plan: `docs/sample-deeds/` (fictitious, academic demo only).

1. **Register** LAND201 + sale deed → docHash & txHash on-chain, PDF in S3
2. **Transfer** LAND201 → new owner + transfer deed
3. **Search** LAND201 → 2 records, S3 links
4. **Verify** current deed → ✅ VERIFIED; old/edited deed → ❌ TAMPERED
5. **MetaMask:** Connect → Get test ETH → tick "Sign with MetaMask" → confirm in MetaMask; Verify via MetaMask

---

## 🔮 Future Scope

- `onlyRegistrar` role check in the contract (abhi koi bhi funded wallet write kar sakta hai)
- Public testnet (Sepolia) deployment
- Custom domain + HTTPS for the frontend (CloudFront in front of the website bucket)
- QR code on printed deeds for instant lookup
