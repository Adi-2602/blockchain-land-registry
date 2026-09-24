import { useState } from "react";
import { errorMessage } from "../api";
import { submitLandTransaction } from "../landTx";
import { walletErrorMessage } from "../wallet";
import WalletStatus from "./WalletStatus";

function RegisterLand({ walletState }) {
  const [landId, setLandId] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [location, setLocation] = useState("");
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0); // file input reset karne ke liye
  const [stage, setStage] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const { wallet } = walletState;
  const canSign = wallet && !wallet.wrongNetwork && wallet.isRegistrar;

  const handleSubmit = async () => {
    if (!landId || !ownerName || !location || !file) {
      setError("All fields and the sale deed PDF are required.");
      return;
    }

    setError("");
    setResult(null);

    try {
      const res = await submitLandTransaction({
        action: "register",
        landId,
        file,
        onStage: setStage,
        send: (registry, doc) => registry.registerLand(landId, ownerName, location, doc.docHash, doc.docUrl),
      });
      setResult(res);

      // Form clear kar do
      setLandId("");
      setOwnerName("");
      setLocation("");
      setFile(null);
      setFileKey((k) => k + 1);
    } catch (err) {
      setError(err.response ? errorMessage(err) : walletErrorMessage(err));
    } finally {
      setStage("");
    }
  };

  return (
    <div className="card">
      <h2>Register New Land</h2>
      <p className="subtitle">Record a new parcel and anchor its sale deed hash on the blockchain.</p>

      <WalletStatus {...walletState} />

      <div className="form">
        <input
          type="text"
          placeholder="Land ID (e.g. LAND101)"
          value={landId}
          onChange={(e) => setLandId(e.target.value.trim())}
        />
        <input
          type="text"
          placeholder="Owner name"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <label className="field-label">Sale deed / registry document (PDF, max 10 MB)</label>
        <input key={fileKey} type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} />

        <button onClick={handleSubmit} disabled={!!stage || !canSign}>
          {stage || "Register Land"}
        </button>
      </div>

      {error && <p className="error">❌ {error}</p>}

      {result && (
        <div className="result-box verified">
          <h3>✅ Land registered on the blockchain</h3>
          <p><b>Land ID:</b> {result.landId}</p>
          <p className="hash"><b>Document hash:</b> {result.docHash}</p>
          <p className="hash"><b>Transaction:</b> {result.txHash} (block {result.blockNumber})</p>
          <p><a href={result.docUrl} target="_blank" rel="noreferrer">📄 View stored document</a></p>
        </div>
      )}
    </div>
  );
}

export default RegisterLand;
