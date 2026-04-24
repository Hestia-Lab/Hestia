/** Chain + contract configuration, resolved from the environment. */
import { createPublicClient, http, type Address, type Chain } from "viem";
import { base, baseSepolia, foundry } from "viem/chains";

const CHAINS: Record<string, Chain> = {
  base,
  baseSepolia,
  anvil: foundry,
  foundry,
};

export interface HestiaChainConfig {
  chain: Chain;
  rpcUrl: string;
  poolAddress: Address;
  registryAddress: Address;
}

export function loadChainConfig(env: NodeJS.ProcessEnv = process.env): HestiaChainConfig {
  const name = env.HESTIA_CHAIN ?? "anvil";
  const chain = CHAINS[name];
  if (!chain) throw new Error(`unknown HESTIA_CHAIN: ${name}`);
  const rpcUrl = env.HESTIA_RPC_URL ?? "http://127.0.0.1:8545";
  const poolAddress = env.HESTIA_POOL_ADDRESS as Address | undefined;
  const registryAddress = env.HESTIA_REGISTRY_ADDRESS as Address | undefined;
  if (!poolAddress || !registryAddress) {
    throw new Error("HESTIA_POOL_ADDRESS and HESTIA_REGISTRY_ADDRESS must be set");
  }
  return { chain, rpcUrl, poolAddress, registryAddress };
}

export function makePublicClient(config: HestiaChainConfig) {
  return createPublicClient({ chain: config.chain, transport: http(config.rpcUrl) });
}
