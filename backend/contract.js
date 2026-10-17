require("dotenv").config({ quiet: true });
const { ethers } = require("ethers");
const artifact = require("./LandRegistry.json");

const provider = new ethers.JsonRpcProvider(process.env.GANACHE_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, artifact.abi, wallet);

// Server wallet ke transactions ek-ek karke bhejo. ethers apna nonce ~250ms cache karta hai,
// isliye jaldi-jaldi do writes par "nonce too low" aata tha — nonce seedha node se lo.
let queue = Promise.resolve();
function enqueue(work) {
  const run = queue.then(async () => {
    const nonce = Number(await provider.send("eth_getTransactionCount", [wallet.address, "pending"]));
    const tx = await work(nonce);
    await tx.wait();
    return tx;
  });
  queue = run.catch(() => {});
  return run;
}

// Ganache ka gas estimate bilkul exact hota hai (0 margin), jisse kabhi-kabhi
// out-of-gas revert hota tha — isliye 30% extra gas limit do.
function sendWrite(method, ...args) {
  return enqueue(async (nonce) => {
    const estimate = await contract[method].estimateGas(...args);
    return contract[method](...args, { nonce, gasLimit: (estimate * 13n) / 10n });
  });
}

// Registrar ke MetaMask wallet ko test ETH (gas ke liye)
function sendEth(to, amountEth) {
  return enqueue((nonce) => wallet.sendTransaction({ to, value: ethers.parseEther(amountEth), nonce }));
}

module.exports = { contract, provider, wallet, sendWrite, sendEth };
