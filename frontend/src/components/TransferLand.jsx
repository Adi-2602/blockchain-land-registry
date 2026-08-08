import { useState } from "react";
import api from "../api";

function TransferLand() {
  const [landId, setLandId] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

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

      const res = await api.post("/land/transfer", formData);
      setResult(res.data);

      setLandId("");
      setNewOwner("");
      setFile(null);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
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
        </div>
      )}
    </div>
  );
}

export default TransferLand;