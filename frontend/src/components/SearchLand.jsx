import { useState } from "react";
import api, { errorMessage } from "../api";
import { shortAddress } from "../wallet";

function SearchLand() {
  const [landId, setLandId] = useState("");
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!landId) {
      setError("Enter a Land ID to search.");
      return;
    }

    setLoading(true);
    setError("");
    setHistory(null);

    try {
      const res = await api.get(`/land/${encodeURIComponent(landId)}/history`);
      setHistory(res.data.history);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Search Land / Ownership History</h2>
      <p className="subtitle">Public view — every record is read directly from the blockchain.</p>

      <div className="search-row">
        <input
          type="text"
          placeholder="Land ID (e.g. LAND101)"
          value={landId}
          onChange={(e) => setLandId(e.target.value.trim())}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {error && <p className="error">❌ {error}</p>}

      {history && (
        <div className="timeline">
          <h3>
            Ownership timeline ({history.length} record{history.length > 1 ? "s" : ""})
          </h3>

          {history.map((record, index) => {
            const isCurrent = index === history.length - 1;
            return (
              <div key={record.version} className={isCurrent ? "timeline-item current" : "timeline-item"}>
                <p className="owner">
                  {isCurrent ? "🟢 Current owner" : `Owner #${record.version}`}: <b>{record.ownerName}</b>
                </p>
                <p>📍 {record.location}</p>
                <p>🕒 {new Date(record.timestamp * 1000).toLocaleString()}</p>
                <p>
                  ✍️ Signed by registrar <code title={record.registeredBy}>{shortAddress(record.registeredBy)}</code>
                </p>
                <p className="hash">🔗 {record.docHash}</p>
                {record.docUrl && (
                  <p>
                    <a href={record.docUrl} target="_blank" rel="noreferrer">📄 View document</a>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SearchLand;
