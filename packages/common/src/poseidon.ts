/** Poseidon hash over BN254, matching circomlib's `Poseidon(n)` template exactly. */
import { buildPoseidon } from "circomlibjs";

export interface Poseidon {
  /** Hash `inputs.length` field elements into one. Arity = inputs.length. */
  hash(inputs: bigint[]): bigint;
}

let cached: Promise<Poseidon> | undefined;

/** Lazily build (and cache) the Poseidon hasher. Safe to call concurrently. */
export function getPoseidon(): Promise<Poseidon> {
  if (!cached) {
    cached = buildPoseidon().then((p) => ({
      hash(inputs: bigint[]): bigint {
        return p.F.toObject(p(inputs));
      },
    }));
  }
  return cached;
}

/** One-shot Poseidon hash (awaits the cached hasher). */
export async function poseidon(inputs: bigint[]): Promise<bigint> {
  const h = await getPoseidon();
  return h.hash(inputs);
}
