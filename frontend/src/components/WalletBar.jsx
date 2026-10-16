import { useEffect, useState } from "react";
import api from "../api";
import { connectWallet, refreshBalance, shortAddress, walletError, hasMetaMask } from "../wallet";

function WalletBar({ wallet, setWallet, loggedIn }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Account ya network badle to wallet disconnect karo (dobara connect karna hoga)
  useEffect(() => {
    if (!hasMetaMask()) return;
    const reset = () => setWallet(null);
    window.ethereum.on?.("accountsChanged", reset);
    window.ethereum.on?.("chainChanged", reset);
    return () => {
      window.ethereum.removeListener?.("accountsChanged", reset);
      window.ethereum.removeListener?.("chainChanged", reset);
    };
  }, [setWallet]);

  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(walletError(err));
    } finally {
      setBusy(false);
    }
  };

  const connect = () => run(async () => setWallet(await connectWallet()));

  const fund = () => run(async () => {
    await api.post("/wallet/fund", { address: wallet.address });
    setWallet({ ...wallet, balance: await refreshBalance(wallet) });
  });

  return (
    <div className="wallet-bar">
      {wallet ? (
        <>
          🦊 <b>{shortAddress(wallet.address)}</b> · {Number(wallet.balance).toFixed(2)} ETH
          {loggedIn && Number(wallet.balance) < 1 && (
            <button className="wallet-btn" onClick={fund} disabled={busy}>
              {busy ? "Sending..." : "Get test ETH"}
            </button>
          )}
        </>
      ) : (
        <button className="wallet-btn" onClick={connect} disabled={busy}>
          {busy ? "Connecting..." : "🦊 Connect MetaMask"}
        </button>
      )}
      {error && <span className="wallet-error">❌ {error}</span>}
    </div>
  );
}

export default WalletBar;
