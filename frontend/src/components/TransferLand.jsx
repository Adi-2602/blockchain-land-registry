import { useState } from "react";
import { errorMessage } from "../api";
import { submitLandTransaction } from "../landTx";
import { walletErrorMessage } from "../wallet";
import WalletStatus from "./WalletStatus";

function TransferLand({ walletState }) {
  const [landId, setLandId] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [stage, setStage] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const { wallet } = walletState;
  const canSign = wallet && !wallet.wrongNetwork && wallet.isRegistrar;

  const handleTransfer = async () => {
    if (!landId || !newOwner || !file) {
      setError("Land ID, new owner and the new sale deed PDF are required.");
      return;
    }

    setError("");
    setResult(null);

    try {
      const res = await submitLandTransaction({
        action: "transfer",
        landId,
        file,
        onStage: setStage,
        send: (registry, doc) => registry.transferOwnership(landId, newOwner, doc.docHash, doc.docUrl),
      });
      setResult({ ...res, newOwner });

      setLandId("");
      setNewOwner("");
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
      <h2>Transfer Ownership</h2>
      <p className="subtitle">The previous owner stays in the on-chain history; only a new record is added.</p>

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
          placeholder="New owner name"
          value={newOwner}
          onChange={(e) => setNewOwner(e.target.value)}
        />
        <label className="field-label">New sale deed / transfer document (PDF, max 10 MB)</label>
        <input key={fileKey} type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} />

        <button onClick={handleTransfer} disabled={!!stage || !canSign}>
          {stage || "Transfer Ownership"}
        </button>
      </div>

      {error && <p className="error">❌ {error}</p>}

      {result && (
        <div className="result-box verified">
          <h3>✅ Ownership transferred</h3>
          <p><b>Land ID:</b> {result.landId}</p>
          <p><b>New owner:</b> {result.newOwner}</p>
          <p className="hash"><b>New document hash:</b> {result.docHash}</p>
          <p className="hash"><b>Transaction:</b> {result.txHash} (block {result.blockNumber})</p>
          <p><a href={result.docUrl} target="_blank" rel="noreferrer">📄 View stored document</a></p>
        </div>
      )}
    </div>
  );
}

export default TransferLand;
