import { BrowserProvider, Contract } from "ethers";
import artifact from "./LandRegistry.json";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
// Ganache ka default chain ID 1337 hai
export const EXPECTED_CHAIN_ID = BigInt(import.meta.env.VITE_CHAIN_ID || 1337);

export const hasMetaMask = () => typeof window !== "undefined" && !!window.ethereum;

function getProvider() {
  if (!hasMetaMask()) throw new Error("MetaMask is not installed");
  return new BrowserProvider(window.ethereum);
}

// Wallet ka current state: address, network sahi hai ya nahi, registrar hai ya nahi
export async function readWalletState(requestAccess = false) {
  const provider = getProvider();
  const accounts = requestAccess
    ? await provider.send("eth_requestAccounts", [])
    : await provider.send("eth_accounts", []);
  if (accounts.length === 0) return null;

  const address = accounts[0];
  const { chainId } = await provider.getNetwork();
  const wrongNetwork = chainId !== EXPECTED_CHAIN_ID;

  let isRegistrar = false;
  if (!wrongNetwork && CONTRACT_ADDRESS) {
    const registry = new Contract(CONTRACT_ADDRESS, artifact.abi, provider);
    isRegistrar = await registry.registrars(address);
  }
  return { address, chainId, wrongNetwork, isRegistrar };
}

const RPC_URL = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545";

// MetaMask ko Ganache network par switch karo; network add nahi hai to pehle add karo
export async function switchToGanache() {
  if (!hasMetaMask()) throw new Error("MetaMask is not installed");
  const chainId = "0x" + EXPECTED_CHAIN_ID.toString(16);
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (err) {
    // 4902 = MetaMask ko ye chain pata hi nahi
    const code = err.code ?? err.data?.originalError?.code;
    if (code !== 4902) throw err;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: "Ganache Local",
          rpcUrls: [RPC_URL],
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        },
      ],
    });
  }
}

// Transaction sign karne ke liye signer wala contract
export async function getSignedRegistry() {
  if (!CONTRACT_ADDRESS) throw new Error("VITE_CONTRACT_ADDRESS is not set in frontend/.env");
  const signer = await getProvider().getSigner();
  return new Contract(CONTRACT_ADDRESS, artifact.abi, signer);
}

// MetaMask / contract errors ko readable message mein badlo
export function walletErrorMessage(err) {
  if (err.code === "ACTION_REJECTED" || err.code === 4001) return "Request was rejected in MetaMask.";
  return err.reason || err.shortMessage || err.message || "Transaction failed";
}

export const shortAddress = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
