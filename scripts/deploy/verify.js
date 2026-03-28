const hre = require("hardhat");

async function main() {
  // Load deployment addresses from sepolia.json
  const deployments = require("./deployments/sepolia.json");
  
  // Define contract names and their constructor arguments (if any)
  // Based on the contracts we deployed: Registry, Vault, AccessControl, LiquidityManager, FeeDistributor, LiquidationEngine, PriceFeed, NFTFloorOracle
  const contractsToVerify = [
    {
      name: "AccessControl",
      address: deployments.AccessControl.address,
      args: [] // No constructor arguments
    },
    {
      name: "Registry",
      address: deployments.Registry.address,
      args: [] // No constructor arguments
    },
    {
      name: "Vault",
      address: deployments.Vault.address,
      args: [deployments.Registry.address, deployments.AccessControl.address] // Assuming Vault constructor takes (registry, accessControl)
    },
    {
      name: "LiquidityManager",
      address: deployments.LiquidityManager.address,
      args: [deployments.Vault.address, deployments.WETH9.address] // Assuming constructor takes (vault, token) - using WETH9 as example token
    },
    {
      name: "FeeDistributor",
      address: deployments.FeeDistributor.address,
      args: [deployments.USDC.address, deployments.STK.address] // Assuming constructor takes (rewardToken, stakingToken)
    },
    {
      name: "LiquidationEngine",
      address: deployments.LiquidationEngine.address,
      args: [deployments.Registry.address, deployments.AccessControl.address, deployments.PriceFeed.address] // Assuming constructor takes (registry, accessControl, priceFeed)
    },
    {
      name: "PriceFeed",
      address: deployments.PriceFeed.address,
      args: [deployments.ChainlinkETHUSD.address] // Assuming constructor takes (aggregator address)
    },
    {
      name: "NFTFloorOracle",
      address: deployments.NFTFloorOracle.address,
      args: [] // No constructor arguments in the snippet
    }
  ];

  for (const contract of contractsToVerify) {
    if (!contract.address) {
      console.log(`Skipping ${contract.name}: address not found in deployments`);
      continue;
    }

    try {
      console.log(`Verifying ${contract.name} at ${contract.address}`);
      await hre.run("verify:verify", {
        address: contract.address,
        constructorArguments: contract.args
      });
      console.log(`Successfully verified ${contract.name}`);
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log(`${contract.name} is already verified`);
      } else {
        console.error(`Failed to verify ${contract.name}:`, error.message);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });