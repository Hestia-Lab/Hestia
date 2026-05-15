/**
 * @hestia/sdk — the single surface an agent uses whenever it touches Base.
 *
 *   const hestia = await Hestia.create({ chain, rpcUrl, pool, registry, usdc, account, keys, association });
 *   await hestia.shield({ token, amount });
 *   await hestia.send({ token, amount, to });        // to = recipient meta-address
 *   await hestia.unshield({ token, amount, to });    // to = clean public address
 *   const bal = await hestia.balance(token);
 *
 * See SPEC §8.
 */
import { HESTIA_PROTOCOL_VERSION } from "@hestia/common";

export const SDK_VERSION = "0.1.0" as const;
export const PROTOCOL_VERSION = HESTIA_PROTOCOL_VERSION;

export { Hestia, InsufficientPrivateBalance, type HestiaConfig } from "./hestia.js";
export { AssociationSet, type AssociationProvider } from "./associationSet.js";
export { buildCircuitInput, proveTransactionWitness, type SpendInput, type TransactionWitness } from "./proof.js";
export { createHestiaTools, type AgentTool } from "./agentTool.js";
export {
  type Arity,
  type ArtifactsByArity,
  type CircuitArtifacts,
  type ContractProof,
} from "@hestia/circuits";

// Re-export the key/meta-address helpers an integrator needs.
export {
  deriveKeysFromSeed,
  deriveKeysFromSignature,
  encodeMetaAddress,
  decodeMetaAddress,
  NATIVE_ETH,
  USDC_ADDRESS,
  type Keys,
} from "@hestia/common";
