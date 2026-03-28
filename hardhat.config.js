require("@nomicfoundation/hardhat-toolbox");
module.exports = {
  solidity: "0.8.24",
  networks: {
    sepolia: { url: process.env.SEPOLIA_RPC || "https://rpc.sepolia.org", accounts: process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [] },
    amoy: { url: process.env.AMOY_RPC || "https://rpc-amoy.polygon.technology", accounts: process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [] },
  }
};