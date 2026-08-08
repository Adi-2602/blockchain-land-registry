import { useState } from "react";
import RegistryLand from "./components/RegistryLand";
import SearchLand from "./components/SearchLand";
import TransferLand from "./components/TransferLand";
import VerifyDoc from "./components/VerifyDoc";
import Login from "./components/Login";
import Signup from "./components/Signup";
import "./index.css";

const TABS = [
  { id: "register", label: "📝 Register Land", protected: true },
  { id: "search", label: "🔍 Search / History", protected: false },
  { id: "transfer", label: "🔄 Transfer", protected: true },
  { id: "verify", label: "🛡️ Verify Document", protected: false },
];

function App() {
  const [activeTab, setActiveTab] = useState("search");
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [userName, setUserName] = useState(localStorage.getItem("userName"));
  const [authPage, setAuthPage] = useState("login"); // login | signup

  const handleLogin = (newToken, name) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("userName", name);
    setToken(newToken);
    setUserName(name);
    setActiveTab("register");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userName");
    setToken(null);
    setUserName(null);
    setActiveTab("search");
  };

  const currentTab = TABS.find((t) => t.id === activeTab);
  const needsAuth = currentTab?.protected && !token;

  return (
    <div className="app">
      <header>
        <h1>🏛️ Blockchain Land Registry</h1>
        <p>Tamper-proof land records — Cloud + Blockchain</p>

        {token && (
          <div className="user-bar">
            👤 {userName} · <span onClick={handleLogout}>Logout</span>
          </div>
        )}
      </header>

      <nav className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "tab active" : "tab"}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label} {tab.protected && !token ? "🔒" : ""}
          </button>
        ))}
      </nav>

      <main>
        {needsAuth ? (
          authPage === "login" ? (
            <Login onLogin={handleLogin} switchToSignup={() => setAuthPage("signup")} />
          ) : (
            <Signup switchToLogin={() => setAuthPage("login")} />
          )
        ) : (
          <>
            {activeTab === "register" && <RegistryLand />}
            {activeTab === "search" && <SearchLand />}
            {activeTab === "transfer" && <TransferLand />}
            {activeTab === "verify" && <VerifyDoc />}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
