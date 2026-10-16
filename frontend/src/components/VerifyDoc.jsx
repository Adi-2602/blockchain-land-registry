import { useState } from "react";
import api from "../api";
import { verifyOnChain, walletError } from "../wallet";

function VerifyDoc({ wallet }) {
  const [landId, setLandId] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // MetaMask se seedha blockchain par verify — document server par upload nahi hota
  const handleWalletVerify = async () => {
    if (!landId || !file) {
      setError("Land ID aur document dono chahiye");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult({ ...(await verifyOnChain(wallet, landId, file)), viaWallet: true });
    } catch (err) {
      setError(walletError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!landId || !file) {
      setError("Land ID aur document dono chahiye");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("landId", landId);
      formData.append("document", file);

      const res = await api.post("/land/verify", formData);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Verify Document</h2>
      <p className="subtitle">
        Document upload karo — system iska hash blockchain wale hash se compare karega
      </p>

      <div className="form">
        <input
          type="text"
          placeholder="Land ID (e.g. LAND101)"
          value={landId}
          onChange={(e) => setLandId(e.target.value)}
        />
        <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} />

        <button onClick={handleVerify} disabled={loading}>
          {loading ? "Verifying against blockchain..." : "Verify Document"}
        </button>
        {wallet && (
          <button className="wallet-verify" onClick={handleWalletVerify} disabled={loading}>
            🦊 Verify directly on blockchain (MetaMask)
          </button>
        )}
      </div>

      {error && <p className="error">❌ {error}</p>}

      {result && (
        <div className={result.verified ? "result-box verified" : "result-box tampered"}>
          {result.verified ? (
            <>
              <h3>✅ DOCUMENT VERIFIED</h3>
              <p>Ye document authentic hai — hash blockchain record se match karta hai.</p>
            </>
          ) : (
            <>
              <h3>❌ TAMPERED / INVALID DOCUMENT</h3>
              <p>Hash mismatch! Ye document original registered document nahi hai.</p>
            </>
          )}
          <p className="hash">Uploaded file hash: {result.uploadedHash}</p>
          {result.viaWallet && <p className="hash">Checked in your browser via MetaMask — document was not sent to the server.</p>}
        </div>
      )}
    </div>
  );
}

export default VerifyDoc;