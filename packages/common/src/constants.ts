/** Protocol-wide constants. Single source of truth for parameters in SPEC §12. */

export const HESTIA_PROTOCOL_VERSION = "0.1.0" as const;

/** Commitment / association Merkle tree depth (SPEC §12.2). */
export const TREE_DEPTH = 32;

/** On-chain rolling window of recent roots (SPEC §12.2). */
export const ROOT_HISTORY_SIZE = 64;

export const CHAIN_IDS = {
  base: 8453,
  baseSepolia: 84532,
} as const;

/** Native USDC (verify at deploy time — SPEC §5). */
export const USDC_ADDRESS = {
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
} as const;

/** Sentinel token address for native ETH inside the pool. */
export const NATIVE_ETH = "0x0000000000000000000000000000000000000000" as const;
