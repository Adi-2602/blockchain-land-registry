import { useState } from "react";
import api from "../api";

function SearchLand() {
  const [landId, setLandId] = useState("");
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!landId) {
      setError("Land ID daalo");
      return;
    }

    setLoading(true);
    setError("");
    setHistory(null);

    try {
      const res = await api.get(`/land/${landId}/history`);
      setHistory(res.data.history);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <h2>Search Land / Ownership History</h2>

      <div style={{ display: "flex", gap: "8px" }}>
        <input
          type="text"
          placeholder="Land ID (e.g. LAND101)"
          value={landId}
          onChange={(e) => setLandId(e.target.value)}
          style={{ flex: 1 }}
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {error && <p style={{ color: "red", marginTop: "12px" }}>❌ {error}</p>}

      {history && (
        <div style={{ marginTop: "20px" }}>
          <h3>Ownership Timeline ({history.length} record{history.length > 1 ? "s" : ""})</h3>

          {history.map((record, index) => (
            <div
              key={index}
              style={{
                borderLeft: "3px solid #4caf50",
                paddingLeft: "16px",
                marginBottom: "16px",
                position: "relative",
              }}
            >
              <p style={{ margin: "4px 0" }}>
                <b>
                  {index === history.length - 1
                    ? "🟢 Current Owner"
                    : `Owner #${index + 1}`}
                  : {record.ownerName}
                </b>
              </p>
              <p style={{ margin: "4px 0" }}>📍 {record.location}</p>
              <p style={{ margin: "4px 0" }}>🕒 {record.timestamp}</p>
              <p style={{ margin: "4px 0", wordBreak: "break-all", fontSize: "13px", color: "#666" }}>
                🔗 Hash: {record.docHash}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchLand;