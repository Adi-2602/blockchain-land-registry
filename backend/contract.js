require("dotenv").config({ quiet: true });
const { ethers } = require("ethers");
const artifact = require("./LandRegistry.json");

const provider = new ethers.JsonRpcProvider(process.env.GANACHE_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, artifact.abi, wallet);

// Write transactions ek-ek karke bhejo. ethers apna nonce ~250ms cache karta hai,
// isliye jaldi-jaldi do writes par "nonce too low" aata tha — nonce seedha node se lo.
// Ganache ka gas estimate bilkul exact hota hai (0 margin), jisse kabhi-kabhi
// out-of-gas revert hota tha — isliye 30% extra gas limit do.
let queue = Promise.resolve();
function sendWrite(method, ...args) {
  const run = queue.then(async () => {
    const nonce = Number(await provider.send("eth_getTransactionCount", [wallet.address, "pending"]));
    const estimate = await contract[method].estimateGas(...args);
    const tx = await contract[method](...args, { nonce, gasLimit: (estimate * 13n) / 10n });
    await tx.wait();
    return tx;
  });
  queue = run.catch(() => {});
  return run;
}

module.exports = { contract, sendWrite };
