/** Deterministic key derivation (SPEC §3.1): one signature -> all keys. */
import { keccak_256 } from "@noble/hashes/sha3.js";
import { concatBytes } from "@noble/hashes/utils.js";
import { x25519 } from "@noble/curves/ed25519.js";
import { poseidon } from "./poseidon.js";
import { toField } from "./field.js";

/** The fixed message an agent's signer signs to seed key derivation. */
export const KEY_DERIVATION_MESSAGE = "hestia.io/keys/v1";

export interface Keys {
  /** Secret spending scalar (field element). Never leaves the agent. */
  sk: bigint;
  /** Public spending key `SK = poseidon([sk])` — senders set a note's `owner` to this. */
  SK: bigint;
  /** X25519 secret — decrypts incoming notes; the unit of selective disclosure. */
  vk: Uint8Array;
  /** X25519 public — note ciphertexts are encrypted to this. */
  VK: Uint8Array;
}

/**
 * Derive the full key set from a 32-byte seed.
 *   sk = poseidon([toField(seed), 0])      SK = poseidon([sk])
 *   vk = keccak256(seed ‖ 0x01)            VK = X25519(vk)
 */
export async function deriveKeysFromSeed(seed: Uint8Array): Promise<Keys> {
  if (seed.length !== 32) throw new Error("seed must be exactly 32 bytes");
  const sk = await poseidon([toField(seed), 0n]);
  const SK = await poseidon([sk]);
  const vk = keccak_256(seed);
  const VK = x25519.getPublicKey(vk);
  return { sk, SK, vk, VK };
}

/** Derive keys from a raw signature: seed = keccak256(signature). */
export async function deriveKeysFromSignature(signature: Uint8Array): Promise<Keys> {
  return deriveKeysFromSeed(keccak_256(signature));
}
