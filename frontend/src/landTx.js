import api from "./api";
import { getSignedRegistry } from "./wallet";

// Register aur Transfer dono ka common flow:
// 1) backend PDF ka hash banata hai + cloud pe upload karta hai
// 2) registrar MetaMask mein transaction sign karta hai
// 3) block mine hone ka wait
export async function submitLandTransaction({ action, landId, file, onStage, send }) {
  onStage("Hashing and uploading document…");
  const formData = new FormData();
  formData.append("landId", landId);
  formData.append("action", action);
  formData.append("document", file);
  const { data } = await api.post("/land/prepare", formData);

  onStage("Confirm the transaction in MetaMask…");
  const registry = await getSignedRegistry();
  const tx = await send(registry, data);

  onStage("Waiting for the block to be mined…");
  const receipt = await tx.wait();

  return { ...data, txHash: tx.hash, blockNumber: receipt.blockNumber };
}
