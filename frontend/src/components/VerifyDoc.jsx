import { useState } from "react";
import api, { errorMessage } from "../api";

function VerifyDoc() {
  const [landId, setLandId] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    if (!landId || !file) {
      setError("Enter the Land ID and choose the PDF to verify.");
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
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Teen possible result: current deed, purana (valid) deed, ya tampered
  const outcome = !result ? null : !result.verified ? "tampered" : result.isCurrent ? "verified" : "older";

  return (
    <div className="card">
      <h2>Verify Document</h2>
      <p className="subtitle">
        Upload a land document — its SHA-256 hash is compared with every hash recorded on the blockchain for
        that land.
      </p>

      <div className="form">
        <input
          type="text"
          placeholder="Land ID (e.g. LAND101)"
          value={landId}
          onChange={(e) => setLandId(e.target.value.trim())}
        />
        <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} />

        <button onClick={handleVerify} disabled={loading}>
          {loading ? "Verifying against blockchain…" : "Verify Document"}
        </button>
      </div>

      {error && <p className="error">❌ {error}</p>}

      {outcome && (
        <div className={`result-box ${outcome}`}>
          {outcome === "verified" && (
            <>
              <h3>✅ DOCUMENT VERIFIED — CURRENT DEED</h3>
              <p>This document is authentic and belongs to the current owner (record #{result.version}).</p>
            </>
          )}
          {outcome === "older" && (
            <>
              <h3>🕘 AUTHENTIC — OLDER DEED</h3>
              <p>
                This document is genuine but matches record #{result.version}, not the latest one. Ownership has
                changed since — check the history.
              </p>
            </>
          )}
          {outcome === "tampered" && (
            <>
              <h3>❌ TAMPERED / INVALID DOCUMENT</h3>
              <p>No record for this land has this hash. The document was modified or never registered.</p>
            </>
          )}
          <p className="hash">Uploaded file hash: {result.uploadedHash}</p>
        </div>
      )}
    </div>
  );
}

export default VerifyDoc;
