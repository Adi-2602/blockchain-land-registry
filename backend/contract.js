require("dotenv").config({ quiet: true });
const { ethers } = require("ethers");
const artifact = require("./LandRegistry.json");

const provider = new ethers.JsonRpcProvider(process.env.GANACHE_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, artifact.abi, wallet);

// Write transactions ek-ek karke bhejo. ethers apna nonce ~250ms cache karta hai,
// isliye jaldi-jaldi do writes par "nonce too low" aata tha — nonce seedha node se lo.
let queue = Promise.resolve();
function sendWrite(buildTx) {
  const run = queue.then(async () => {
    const nonce = Number(await provider.send("eth_getTransactionCount", [wallet.address, "pending"]));
    const tx = await buildTx({ nonce });
    await tx.wait();
    return tx;
  });
  queue = run.catch(() => {});
  return run;
}

module.exports = { contract, sendWrite };
