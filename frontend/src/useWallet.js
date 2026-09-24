import { useCallback, useEffect, useState } from "react";
import { hasMetaMask, readWalletState, walletErrorMessage } from "./wallet";

// MetaMask connection ka state + account/network change par auto refresh
export default function useWallet() {
  const [wallet, setWallet] = useState(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async (requestAccess = false) => {
    if (!hasMetaMask()) return;
    try {
      setError("");
      setWallet(await readWalletState(requestAccess));
    } catch (err) {
      setError(walletErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    if (!hasMetaMask()) return;
    refresh(); // pehle se connected ho to bina popup ke state lo
    const onChange = () => refresh();
    window.ethereum.on("accountsChanged", onChange);
    window.ethereum.on("chainChanged", onChange);
    return () => {
      window.ethereum.removeListener("accountsChanged", onChange);
      window.ethereum.removeListener("chainChanged", onChange);
    };
  }, [refresh]);

  return { wallet, error, connect: () => refresh(true), installed: hasMetaMask() };
}
