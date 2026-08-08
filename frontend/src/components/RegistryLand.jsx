import { useState } from "react";
import api from "../api";

function RegisterLand() {
  const [landId, setLandId] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [location, setLocation] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

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

      const res = await api.post("/land/register", formData);
      setResult(res.data);

      // Form clear kar do
      setLandId("");
      setOwnerName("");
      setLocation("");
      setFile(null);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
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
        </div>
      )}
    </div>
  );
}

export default RegisterLand;