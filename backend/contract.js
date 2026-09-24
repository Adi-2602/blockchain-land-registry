require("dotenv").config();
const { ethers } = require("ethers");
const artifact = require("./LandRegistry.json");

// Backend ab sirf chain se READ karta hai (history, verify, duplicate check).
// Register/transfer ke transactions registrar khud MetaMask se sign karta hai,
// isliye yahan koi private key / wallet nahi chahiye.
const provider = new ethers.JsonRpcProvider(process.env.GANACHE_URL);

const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, artifact.abi, provider);

module.exports = contract;
