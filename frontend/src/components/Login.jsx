import { useState } from "react";
import api from "../api";

function Login({ onLogin, switchToSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Email aur password dono chahiye");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await api.post("/auth/login", { email, password });
      onLogin(res.data.token, res.data.name);
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card auth-card">
      <h2>🔐 Login</h2>
      <p className="subtitle">Registrar access — register & transfer lands</p>

      <div className="form">
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
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
        />
        <button onClick={handleLogin} disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </div>

      {error && <p className="error">❌ {error}</p>}

      <p className="switch-auth">
        Account nahi hai?{" "}
        <span onClick={switchToSignup}>Signup karo</span>
      </p>
    </div>
  );
}

export default Login;