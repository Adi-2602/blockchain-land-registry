import { EXPECTED_CHAIN_ID, shortAddress } from "../wallet";

// Register/Transfer form ke upar: wallet connected + registrar hai ya nahi
function WalletStatus({ wallet, installed, error, connect, switchNetwork }) {
  if (!installed) {
    return (
      <p className="notice warn">
        🦊 MetaMask is required to sign land transactions.{" "}
        <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">Install MetaMask</a>
      </p>
    );
  }

  if (!wallet) {
    return (
      <div className="notice">
        <span>🦊 Connect your registrar wallet to sign transactions.</span>
        <button className="btn-small" onClick={connect}>Connect Wallet</button>
        {error && <p className="error">❌ {error}</p>}
      </div>
    );
  }

  if (wallet.wrongNetwork) {
    return (
      <div className="notice warn">
        <span>
          ⚠️ MetaMask is on chain {wallet.chainId.toString()}. Switch to the Ganache network (chain ID{" "}
          {EXPECTED_CHAIN_ID.toString()}).
        </span>
        <button className="btn-small" onClick={switchNetwork}>Switch to Ganache</button>
        {error && <p className="error">❌ {error}</p>}
      </div>
    );
  }

  return wallet.isRegistrar ? (
    <p className="notice ok">✅ Signing as approved registrar <code>{shortAddress(wallet.address)}</code></p>
  ) : (
    <p className="notice warn">
      ⛔ <code>{shortAddress(wallet.address)}</code> is not an approved registrar. Ask the admin to call
      addRegistrar() for this address.
    </p>
  );
}

export default WalletStatus;
