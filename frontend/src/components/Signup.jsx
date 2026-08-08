import { useState } from "react";
import api from "../api";

function Signup({ switchToLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSignup = async () => {
    if (!name || !email || !password) {
      setError("Saare fields zaroori hain");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await api.post("/auth/signup", { name, email, password });
      setSuccess(res.data.message);
      setTimeout(switchToLogin, 1500); // 1.5 sec baad login pe bhej do
    } catch (err) {
      setError(err.response?.data?.error || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card auth-card">
      <h2>📝 Signup</h2>
      <p className="subtitle">Create registrar account</p>

      <div className="form">
        <input
          type="text"
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={handleSignup} disabled={loading}>
          {loading ? "Creating account..." : "Signup"}
        </button>
      </div>

      {error && <p className="error">❌ {error}</p>}
      {success && <p className="success">✅ {success}</p>}

      <p className="switch-auth">
        Already registered?{" "}
        <span onClick={switchToLogin}>Login karo</span>
      </p>
    </div>
  );
}

export default Signup;