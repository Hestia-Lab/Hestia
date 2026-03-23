/**
 * Browser-safe Groth16 prover. Pure snarkjs — no node:fs — so the SDK that imports it bundles
 * for the browser. Artifact sources are file paths (node) or URLs (browser); snarkjs handles both.
 */
import * as snarkjs from "snarkjs";

export const CIRCUIT_ARITIES = ["1x2", "2x2"] as const;
export type Arity = (typeof CIRCUIT_ARITIES)[number];

export interface ContractProof {
  a: [bigint, bigint];
  b: [[bigint, bigint], [bigint, bigint]];
  c: [bigint, bigint];
  publicSignals: string[];
}

/** Where to load a circuit's proving artifacts from (path in node, URL in browser). */
export interface CircuitArtifacts {
  wasm: string;
  zkey: string;
}

export type ArtifactsByArity = Record<Arity, CircuitArtifacts>;

/** Prove and return the points in the exact shape the generated verifier expects. */
export async function proveForContractWith(
  input: Record<string, unknown>,
  artifacts: CircuitArtifacts,
): Promise<ContractProof> {
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, artifacts.wasm, artifacts.zkey);
  const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  const [a, b, c] = JSON.parse("[" + calldata + "]") as [string[], string[][], string[], string[]];
  return {
    a: [BigInt(a[0]!), BigInt(a[1]!)],
    b: [
      [BigInt(b[0]![0]!), BigInt(b[0]![1]!)],
      [BigInt(b[1]![0]!), BigInt(b[1]![1]!)],
    ],
    c: [BigInt(c[0]!), BigInt(c[1]!)],
    publicSignals,
  };
}
