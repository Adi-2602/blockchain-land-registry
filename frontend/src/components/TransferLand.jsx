import { useState } from "react";
import api from "../api";
import { sendLandTx, walletError } from "../wallet";

function TransferLand({ wallet }) {
  const [landId, setLandId] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [useWallet, setUseWallet] = useState(false);

  const handleTransfer = async () => {
    if (!landId || !newOwner || !file) {
      setError("Land ID, naya owner aur naya document zaroori hai");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("landId", landId);
      formData.append("newOwner", newOwner);
      formData.append("document", file);

      if (useWallet && wallet) {
        // MetaMask: server document upload + hash kare, transaction registrar ka wallet sign kare
        formData.append("action", "transfer");
        formData.append("ownerName", newOwner);
        const prep = (await api.post("/land/prepare", formData)).data;
        const txHash = await sendLandTx(wallet, "transferOwnership", [landId, newOwner, prep.docHash]);
        const rec = (await api.post("/land/record", { action: "transfer", landId, ownerName: newOwner, docHash: prep.docHash, s3Key: prep.s3Key, txHash })).data;
        setResult({ landId, newOwner, newDocHash: prep.docHash, docUrl: prep.docUrl, txHash, signedBy: rec.signedBy });
      } else {
        const res = await api.post("/land/transfer", formData);
        setResult(res.data);
      }

      setLandId("");
      setNewOwner("");
      setFile(null);
    } catch (err) {
      setError(walletError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "500px", margin: "0 auto" }}>
      <h2>Transfer Ownership</h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <input
          type="text"
          placeholder="Land ID (e.g. LAND101)"
          value={landId}
          onChange={(e) => setLandId(e.target.value)}
        />
        <input
          type="text"
          placeholder="New Owner Name"
          value={newOwner}
          onChange={(e) => setNewOwner(e.target.value)}
        />
        <label style={{ fontSize: "14px", color: "#555" }}>
          New sale deed / transfer document:
        </label>
        <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} />

        {wallet && (
          <label className="wallet-toggle">
            <input type="checkbox" checked={useWallet} onChange={(e) => setUseWallet(e.target.checked)} />
            🦊 Sign with MetaMask ({wallet.address.slice(0, 6)}…)
          </label>
        )}

        <button onClick={handleTransfer} disabled={loading}>
          {loading ? "Transferring on blockchain..." : "Transfer Ownership"}
        </button>
      </div>

      {error && <p style={{ color: "red", marginTop: "12px" }}>❌ {error}</p>}

      {result && (
        <div
          style={{
            marginTop: "16px",
            padding: "12px",
            border: "1px solid green",
            borderRadius: "8px",
            wordBreak: "break-all",
          }}
        >
          <p>✅ <b>Ownership transferred!</b></p>
          <p><b>Land ID:</b> {result.landId}</p>
          <p><b>New Owner:</b> {result.newOwner}</p>
          <p><b>New Doc Hash:</b> {result.newDocHash}</p>
          <p><b>Transaction:</b> {result.txHash}</p>
          {result.signedBy && <p><b>Signed by (MetaMask):</b> {result.signedBy}</p>}
          {result.docUrl && (
            <p><a href={result.docUrl} target="_blank" rel="noreferrer">📄 View stored document</a></p>
          )}
        </div>
      )}
    </div>
  );
}

export default TransferLand;