/** BN254 scalar field arithmetic and byte <-> field conversions. */
import { randomBytes } from "@noble/hashes/utils.js";

/** The BN254 (alt_bn128) scalar field modulus `r` — the field all snark values live in. */
export const FIELD_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/** Largest value permitted in a note (SPEC §4, constraint 6: < 2^248). */
export const MAX_VALUE = 1n << 248n;

export function mod(x: bigint, m: bigint = FIELD_MODULUS): bigint {
  const r = x % m;
  return r >= 0n ? r : r + m;
}

/** True iff `x` is a canonical field element in `[0, r)`. */
export function isField(x: bigint): boolean {
  return x >= 0n && x < FIELD_MODULUS;
}

export function assertField(x: bigint, name = "value"): bigint {
  if (!isField(x)) throw new RangeError(`${name} is not a canonical field element`);
  return x;
}

export function bytesToBigIntBE(bytes: Uint8Array): bigint {
  let x = 0n;
  for (const b of bytes) x = (x << 8n) | BigInt(b);
  return x;
}

/** Encode a non-negative bigint as 32-byte big-endian. Throws if it overflows 32 bytes. */
export function bigIntToBytes32BE(x: bigint): Uint8Array {
  if (x < 0n) throw new RangeError("cannot encode a negative bigint");
  const out = new Uint8Array(32);
  let v = x;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

/** Reduce arbitrary bytes into a canonical field element. */
export function toField(bytes: Uint8Array): bigint {
  return mod(bytesToBigIntBE(bytes));
}

/** A uniformly random field element (rejection sampling — unbiased). */
export function randomFieldElement(): bigint {
  for (;;) {
    const x = bytesToBigIntBE(randomBytes(32));
    if (x < FIELD_MODULUS) return x;
  }
}

/** Convert an EVM address (0x-hex) into a field element. */
export function addressToField(address: string): bigint {
  const hex = address.startsWith("0x") ? address.slice(2) : address;
  if (!/^[0-9a-fA-F]{40}$/.test(hex)) throw new Error(`invalid EVM address: ${address}`);
  return BigInt("0x" + hex);
}
