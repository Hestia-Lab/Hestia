/** Bech32m meta-address codec (SPEC §3.1): the string an agent shares to receive notes. */
import { bech32m } from "bech32";
import { concatBytes } from "@noble/hashes/utils.js";
import { bigIntToBytes32BE, bytesToBigIntBE } from "./field.js";

export const META_ADDRESS_HRP = "hestia";
export const META_ADDRESS_VERSION = 1;

export const CHAIN_TAG = { base: 0, baseSepolia: 1 } as const;
export type ChainName = keyof typeof CHAIN_TAG;
const TAG_TO_CHAIN: Record<number, ChainName> = { 0: "base", 1: "baseSepolia" };

// Payload is 66 bytes; raise bech32's default 90-char cap accordingly.
const BECH32_LIMIT = 1023;
const PAYLOAD_BYTES = 66; // version(1) + chainTag(1) + SK(32) + VK(32)

export interface MetaAddress {
  chain: ChainName;
  SK: bigint;
  VK: Uint8Array;
}

export function encodeMetaAddress(m: MetaAddress): string {
  if (m.VK.length !== 32) throw new Error("VK must be 32 bytes");
  const payload = concatBytes(
    Uint8Array.of(META_ADDRESS_VERSION, CHAIN_TAG[m.chain]),
    bigIntToBytes32BE(m.SK),
    m.VK,
  );
  return bech32m.encode(META_ADDRESS_HRP, bech32m.toWords(payload), BECH32_LIMIT);
}

export function decodeMetaAddress(addr: string): MetaAddress {
  const { prefix, words } = bech32m.decode(addr, BECH32_LIMIT);
  if (prefix !== META_ADDRESS_HRP) throw new Error(`unexpected prefix: ${prefix}`);
  const bytes = Uint8Array.from(bech32m.fromWords(words));
  if (bytes.length !== PAYLOAD_BYTES) throw new Error(`bad meta-address length: ${bytes.length}`);
  const version = bytes[0]!;
  if (version !== META_ADDRESS_VERSION) throw new Error(`unsupported version: ${version}`);
  const chain = TAG_TO_CHAIN[bytes[1]!];
  if (!chain) throw new Error(`unknown chain tag: ${bytes[1]}`);
  return { chain, SK: bytesToBigIntBE(bytes.subarray(2, 34)), VK: bytes.slice(34, 66) };
}
