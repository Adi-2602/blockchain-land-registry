# 🏛️ Blockchain Land Registry System

A tamper-proof land records management system using **Blockchain + Cloud Storage**. Land ownership records aur unke documents ke SHA-256 hashes blockchain par store hote hain, jisse koi bhi record tamper nahi kar sakta aur poori ownership history transparent rehti hai.

# Mini Project — Cloud Computing and Blockchain, M.Tech CSE, SRMIST

---

## 📌 Problem Statement

Land records managed through centralized systems face risks of unauthorized changes and ownership disputes. This project implements a blockchain-based system to record land ownership and transaction details securely, with supporting documents stored off-chain, providing a transparent and reliable ownership history.

---

## ✨ Features

- **Register Land** — Land details + ownership document upload; document ka SHA-256 hash blockchain par store hota hai
- **Ownership History** — Kisi bhi Land ID ki poori ownership timeline (sabhi past owners + timestamps), directly from blockchain
- **Transfer Ownership** — Ownership transfer with new sale deed; purana record history mein preserved rehta hai
- **Tamper Detection** — Koi bhi document upload karke verify kar sakte hain; hash mismatch = tampered document ❌

---

## 🏗️ Architecture

```
┌────────────────────┐   REST + JWT   ┌──────────────────────┐        ┌──────────────────┐
│ React 19 + Vite    │───────────────▶│ Express API          │───────▶│ Cloudinary       │
│ Axios, ethers.js   │                │ Multer · SHA-256     │        │ (PDF documents)  │
│                    │◀── docHash ────│ /prepare · /verify   │        └──────────────────┘
│ 🦊 MetaMask signer │                │ /history (read-only) │
└─────────┬──────────┘                └──────────┬───────────┘
          │ registerLand / transferOwnership      │ getHistory / verifyDocument
          ▼  (signed by registrar wallet)          ▼  (read-only provider)
     ┌─────────────────────────────────────────────────────────┐
     │ LandRegistry.sol — Ganache (local Ethereum)             │
     │ admin · registrars · lands · history[] · events         │
     └─────────────────────────────────────────────────────────┘
```

**Register / Transfer flow:** registrar logs in → uploads PDF → backend hashes it (SHA-256) and stores it on Cloudinary → returns `docHash` + `docUrl` → registrar signs `registerLand()` / `transferOwnership()` in **MetaMask** → UI shows the transaction hash.

**Verify flow (public, no login):** upload PDF → backend hashes it → `verifyDocument()` checks it against **every** record of that land → current deed ✅ / older genuine deed 🕘 / tampered ❌.

**Key Design Decisions**
- Documents blockchain par store NAHI hote (costly + inefficient) — sirf SHA-256 hash + cloud URL on-chain jaate hain (industry-standard hybrid pattern).
- Write access on-chain enforce hota hai: sirf `admin` dwara approved registrar wallets hi register/transfer kar sakte hain. Backend ke paas koi private key nahi hai.
- History append-only hai — purane owners kabhi overwrite nahi hote.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | Solidity ^0.8.19 |
| Blockchain (Local) | Ganache |
| Development Framework | Hardhat 2 |
| Chain Interaction | ethers.js v6 (backend read-only, frontend via MetaMask) |
| Wallet | MetaMask |
| Backend | Node.js + Express 5 |
| File Upload | Multer (PDF only, 10 MB) |
| Hashing | Node.js `crypto` (SHA-256) |
| Cloud Storage | Cloudinary |
| Auth | JWT + bcrypt, registrar allow-list |
| Frontend | React 19 + Vite |
| HTTP Client | Axios |

---

## 📁 Project Structure

```
blockchain-land-registry/
├── blockchain/
│   ├── contracts/LandRegistry.sol   # Smart contract (registrar roles + history)
│   ├── scripts/deploy.js            # Deploy + copy ABI to backend & frontend
│   ├── test/LandRegistry.js         # Contract tests
│   └── hardhat.config.cjs
├── backend/
│   ├── server.js                    # Express API
│   ├── auth.js                      # Signup/login, JWT, registrar allow-list
│   ├── contract.js                  # Read-only ethers.js connection
│   ├── cloudinary.js                # Cloud upload
│   ├── LandRegistry.json            # Contract ABI (written by deploy.js)
│   └── .env.example
└── frontend/
    ├── .env.example
    └── src/
        ├── App.jsx                  # Tabs + auth gate + wallet state
        ├── api.js                   # Axios instance (VITE_API_URL)
        ├── wallet.js                # MetaMask / ethers helpers
        ├── useWallet.js             # Wallet connection hook
        ├── landTx.js                # prepare → sign → wait flow
        ├── LandRegistry.json        # Contract ABI (written by deploy.js)
        └── components/
            ├── RegistryLand.jsx
            ├── SearchLand.jsx
            ├── TransferLand.jsx
            ├── VerifyDoc.jsx
            ├── WalletStatus.jsx
            ├── Login.jsx
            └── Signup.jsx
```

---

## 🔗 Smart Contract Functions

| Function | Access | Description |
|----------|--------|-------------|
| `registerLand(landId, ownerName, location, docHash, docUrl)` | registrar | Naya land record register (duplicate check ke saath) |
| `transferOwnership(landId, newOwner, newDocHash, newDocUrl)` | registrar | Ownership transfer; naya record history mein push |
| `addRegistrar(address)` / `removeRegistrar(address)` | admin | Registrar wallets manage karo |
| `getLand(landId)` | public | Current owner ka record |
| `getHistory(landId)` | public | Poori ownership timeline (docUrl + signer ke saath) |
| `verifyDocument(landId, hash)` | public | Hash ko poori history se match karo → `(found, isCurrent, version)` |
| `verifyHash(landId, hash)` | public | Sirf current deed ke against check |

---

## 🌐 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/signup` | – | Registrar account (sirf `REGISTRAR_EMAILS` wale emails) |
| POST | `/api/auth/login` | – | JWT token (24 h) |
| POST | `/api/land/prepare` | JWT | PDF hash + Cloudinary upload (`landId`, `action` = register/transfer, `document`) |
| GET | `/api/land/:id/history` | – | Ownership history |
| POST | `/api/land/verify` | – | Verify document against full history |

---

## 🚀 Setup & Run

### Prerequisites
- Node.js v18+
- npm
- MetaMask browser extension

### 1. Install dependencies

```bash
cd blockchain && npm install
cd ../backend && npm install
cd ../frontend && npm install
npm install -g ganache
```

### 2. Start Ganache (Terminal 1)

```bash
ganache --chain.chainId 1337
```

### 3. Deploy the contract (Terminal 2)

```bash
cd blockchain
npm test                                              # contract tests
REGISTRAR_ADDRESS=<your MetaMask address> npm run deploy
```

Deploy karne wala account (Ganache ka pehla account) **admin** banta hai. `REGISTRAR_ADDRESS` dene par woh wallet bhi registrar ban jaata hai. Script naya ABI `backend/` aur `frontend/src/` mein copy kar deti hai — printed **contract address** copy karo.

### 4. Configure

`backend/.env` (see `backend/.env.example`):

```
PORT=5001
GANACHE_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=<deployed_contract_address>
JWT_SECRET=<any long random string>
REGISTRAR_EMAILS=you@example.com
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

`frontend/.env` (see `frontend/.env.example`):

```
VITE_API_URL=http://localhost:5001/api
VITE_CONTRACT_ADDRESS=<deployed_contract_address>
VITE_CHAIN_ID=1337
```

### 5. Set up MetaMask

1. Add network → **RPC URL** `http://127.0.0.1:8545`, **Chain ID** `1337`, currency `ETH`.
2. Import account → paste a Ganache private key (the one whose address you passed as `REGISTRAR_ADDRESS`, or the first account = admin).

### 6. Start backend and frontend

```bash
cd backend && node server.js       # → http://localhost:5001
cd frontend && npm run dev         # → http://localhost:5173
```

> ⚠️ **Note:** Ganache restart karne par chain reset ho jaati hai — contract dobara deploy karke dono `.env` mein naya address daalna hoga. MetaMask mein Settings → Advanced → *Clear activity tab data* bhi karo.

---

## 🧪 Demo Flow

1. **Sign up / Login** as registrar → **Connect Wallet** (header shows `registrar` badge)
2. **Register** — LAND101 + owner + deed → MetaMask confirm → docHash & txHash
3. **Search** — LAND101 → ownership timeline with document links
4. **Transfer** — LAND101 → new owner + new deed → MetaMask confirm
5. **Search again** — 2 records (old + current owner)
6. **Verify** — new deed → ✅ CURRENT DEED
7. **Verify** — old deed → 🕘 AUTHENTIC — OLDER DEED
8. **Verify** — modified file → ❌ TAMPERED
9. Switch MetaMask to a non-registrar account → Register button disabled; direct contract call reverts

---

## 🔮 Future Scope

- Deployment on public testnet (Sepolia)
- Owner consent for transfers (seller signs with their own wallet)
- Firebase / AWS S3 as alternative cloud storage
- QR code generation for instant land record lookup

---

## 👥 Team

**[Team Name]** — M.Tech CSE, SRMIST Chennai
- Aditya Dhabhai — [implement]
- Ishan Roy Barman -[logical]

---

