import { BrowserProvider, Contract, formatEther, sha256 } from "ethers";
import api from "./api";

// Sirf wahi functions jo browser se call hote hain
const ABI = [
  "function registerLand(string landId, string ownerName, string location, string docHash)",
  "function transferOwnership(string landId, string newOwner, string newDocHash)",
  "function verifyHash(string landId, string hash) view returns (bool)",
  "function landExists(string landId) view returns (bool)",
];

export const hasMetaMask = () => typeof window !== "undefined" && Boolean(window.ethereum);

let chainInfo;
async function getChainInfo() {
  if (!chainInfo) chainInfo = (await api.get("/chain")).data;
  return chainInfo;
}

// MetaMask connect + "BlockCodeM Land Chain" network par switch (pehli baar add bhi)
export async function connectWallet() {
  if (!hasMetaMask()) throw new Error("MetaMask installed nahi hai — metamask.io se extension install karo");
  const { chainId, chainName } = await getChainInfo();
  const hexChainId = "0x" + chainId.toString(16);

  await window.ethereum.request({ method: "eth_requestAccounts" });
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexChainId }] });
  } catch (err) {
    const code = err.code ?? err.data?.originalError?.code;
    if (code !== 4902) throw err;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: hexChainId,
        chainName,
        rpcUrls: [new URL("rpc", api.defaults.baseURL.replace(/\/?$/, "/")).toString()],
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      }],
    });
  }

  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  return { provider, signer, address, balance: formatEther(await provider.getBalance(address)) };
}

export async function refreshBalance(wallet) {
  return formatEther(await wallet.provider.getBalance(wallet.address));
}

async function landContract(runner) {
  const { contractAddress } = await getChainInfo();
  return new Contract(contractAddress, ABI, runner);
}

// MetaMask popup se transaction sign karwao; Ganache ke exact gas estimate par 30% buffer
export async function sendLandTx(wallet, method, args) {
  const contract = await landContract(wallet.signer);
  const estimate = await contract[method].estimateGas(...args);
  const tx = await contract[method](...args, { gasLimit: (estimate * 13n) / 10n });
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error("Transaction failed on chain");
  return tx.hash;
}

// Document ka hash browser mein hi banao aur seedha blockchain se compare karo — file server par nahi jaati
export async function verifyOnChain(wallet, landId, file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const uploadedHash = sha256(bytes).slice(2);
  const contract = await landContract(wallet.provider);
  if (!(await contract.landExists(landId))) throw new Error(`Land ${landId} is not registered`);
  return { verified: await contract.verifyHash(landId, uploadedHash), uploadedHash };
}

export function walletError(err) {
  if (err?.code === "ACTION_REJECTED" || err?.code === 4001) return "MetaMask mein request reject kar di gayi";
  return err?.response?.data?.error || err?.shortMessage || err?.message || "Something went wrong";
}

export const shortAddress = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
