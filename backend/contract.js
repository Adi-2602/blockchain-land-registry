require("dotenv").config();
const { ethers } = require("ethers");
const artifact = require("./LandRegistry.json");

// 1. Provider bana: new ethers.JsonRpcProvider(GANACHE_URL wala env)
const provider = new ethers.JsonRpcProvider(process.env.GANACHE_URL);

// 2. Wallet bana: new ethers.Wallet(PRIVATE_KEY, provider)
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// 3. Contract instance: new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, wallet)
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, artifact.abi, wallet);

// 4. module.exports = contract
module.exports = contract;
