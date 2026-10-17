import { useState } from "react";
import api from "../api";
import { sendLandTx, walletError } from "../wallet";

function RegisterLand({ wallet }) {
  const [landId, setLandId] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [location, setLocation] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [useWallet, setUseWallet] = useState(false);

  const handleSubmit = async () => {
    if (!landId || !ownerName || !location || !file) {
      setError("Saare fields aur document zaroori hain");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("landId", landId);
      formData.append("ownerName", ownerName);
      formData.append("location", location);
      formData.append("document", file);

      if (useWallet && wallet) {
        // MetaMask: server document upload + hash kare, transaction registrar ka wallet sign kare
        formData.append("action", "register");
        const prep = (await api.post("/land/prepare", formData)).data;
        const txHash = await sendLandTx(wallet, "registerLand", [landId, ownerName, location, prep.docHash]);
        const rec = (await api.post("/land/record", { action: "register", landId, ownerName, docHash: prep.docHash, s3Key: prep.s3Key, txHash })).data;
        setResult({ landId, docHash: prep.docHash, docUrl: prep.docUrl, txHash, signedBy: rec.signedBy });
      } else {
        const res = await api.post("/land/register", formData);
        setResult(res.data);
      }

      // Form clear kar do
      setLandId("");
      setOwnerName("");
      setLocation("");
      setFile(null);
    } catch (err) {
      setError(walletError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "500px", margin: "0 auto" }}>
      <h2>Register New Land</h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <input
          type="text"
          placeholder="Land ID (e.g. LAND101)"
          value={landId}
          onChange={(e) => setLandId(e.target.value)}
        />
        <input
          type="text"
          placeholder="Owner Name"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
       <input type="file"
        accept="application/pdf" 
        onChange={(e) => setFile(e.target.files[0])} />

        {wallet && (
          <label className="wallet-toggle">
            <input type="checkbox" checked={useWallet} onChange={(e) => setUseWallet(e.target.checked)} />
            🦊 Sign with MetaMask ({wallet.address.slice(0, 6)}…)
          </label>
        )}

        <button onClick={handleSubmit} disabled={loading}>
          {loading ? "Registering on blockchain..." : "Register Land"}
        </button>
      </div>

      {error && (
        <p style={{ color: "red", marginTop: "12px" }}>❌ {error}</p>
      )}

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
          <p>✅ <b>Land registered successfully!</b></p>
          <p><b>Land ID:</b> {result.landId}</p>
          <p><b>Document Hash:</b> {result.docHash}</p>
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

export default RegisterLand;