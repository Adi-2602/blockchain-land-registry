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


┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│ React (UI) │─────▶│ Express API │─────▶│ Ganache (Local │
│ Vite, Axios │ │ + Multer │ │ Ethereum Chain) │
└──────────────┘ └──────┬───────┘ │ LandRegistry.sol │
│ └──────────────────┘
▼
┌──────────────┐
│ File Storage │
│ + SHA-256 │
│ Hashing │
└──────────────┘





**Flow:** Document upload → SHA-256 hash generate → hash + land details smart contract mein → verification par fresh hash compute karke chain wale hash se compare.

**Key Design Decision:** Documents blockchain par store NahI hote (costly + inefficient). Sirf unke cryptographic hashes chain par jaate hain — documents off-chain storage mein rehte hain. Ye industry-standard hybrid pattern hai.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | Solidity ^0.8.19 |
| Blockchain (Local) | Ganache |
| Development Framework | Hardhat 2 |
| Chain Interaction | ethers.js v6 |
| Backend | Node.js + Express |
| File Upload | Multer |
| Hashing | Node.js `crypto` (SHA-256) |
| Frontend | React 18 + Vite |
| HTTP Client | Axios |

---

## 📁 Project Structure


andrecords/
├── blockchain/
│ ├── contracts/LandRegistry.sol # Smart contract
│ ├── scripts/deploy.js # Deployment script
│ └── hardhat.config.cjs
├── backend/
│ ├── server.js # Express API (4 endpoints)
│ ├── contract.js # ethers.js chain connection
│ ├── LandRegistry.json # Contract ABI
│ ├── uploads/ # Uploaded documents
│ └── .env # Config (not committed)
└── frontend/
└── src/
├── App.jsx # Tabbed UI
├── api.js # Axios instance
└── components/
├── RegisterLand.jsx
├── SearchLand.jsx
├── TransferLand.jsx
└── VerifyDoc.jsx

---

## 🔗 Smart Contract Functions

| Function | Description |
|----------|-------------|
| `registerLand(landId, ownerName, location, docHash)` | Naya land record register (duplicate check ke saath) |
| `transferOwnership(landId, newOwner, newDocHash)` | Ownership transfer; purana record history mein push |
| `getLand(landId)` | Current owner ka record |
| `getHistory(landId)` | Poori ownership timeline |
| `verifyHash(landId, hash)` | Document hash verification (tamper detection) |

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/land/register` | Register land (multipart: details + document) |
| POST | `/api/land/transfer` | Transfer ownership (multipart: new owner + document) |
| GET | `/api/land/:id/history` | Ownership history |
| POST | `/api/land/verify` | Verify document authenticity |

---

## 🚀 Setup & Run

### Prerequisites
- Node.js v18+
- npm

### 1. Install dependencies

```bash
# Blockchain
cd blockchain && npm install

# Backend
cd ../backend && npm install

# Frontend
cd ../frontend && npm install

# Ganache (global)
npm install -g ganache
```

### 2. Start Ganache (Terminal 1)

```bash
ganache
```

Copy any one **private key** from the output.

### 3. Configure & Deploy Contract (Terminal 2)

`blockchain/hardhat.config.cjs` mein Ganache network + private key set karo, phir:

```bash
cd blockchain
npx hardhat compile
npx hardhat run scripts/deploy.js --network ganache
```

Printed **contract address** copy karo.

### 4. Configure Backend

`backend/.env` banao:

CONTRACT_ADDRESS=<deployed_contract_address>
GANACHE_URL=http://127.0.0.1:8545
PRIVATE_KEY=<ganache_private_key>
PORT=5001





### 5. Start Backend (Terminal 2)

```bash
cd backend
node server.js
# → Backend running on http://localhost:5001
```

### 6. Start Frontend (Terminal 3)

```bash
cd frontend
npm run dev
# → http://localhost:5173
```

> ⚠️ **Note:** Ganache restart karne par chain reset ho jaati hai — contract dobara deploy karke `.env` mein naya address daalna hoga.

---

## 🧪 Demo Flow

1. **Register** — LAND101 + owner + document → docHash & txHash on-chain
2. **Search** — LAND101 → ownership timeline
3. **Transfer** — LAND101 → new owner + new deed
4. **Search again** — timeline mein 2 records (old + current owner)
5. **Verify** — original document → ✅ VERIFIED
6. **Verify** — modified/different file → ❌ TAMPERED

---

## 🔮 Future Scope

- Firebase / AWS S3 integration for cloud document storage
- MetaMask integration — users apne wallets se transactions sign karein
- Deployment on public testnet (Sepolia)
- Role-based access (Registrar / Owner / Verifier)
- QR code generation for instant land record lookup

---

## 👥 Team

**[Team Name]** — M.Tech CSE, SRMIST Chennai
- Aditya Dhabhai — [implement]
- Ishan Roy Barman -[logical]

---

