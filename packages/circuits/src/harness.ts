/**
 * Node-only test/dev harness: resolves build artifacts from disk and wraps the browser-safe
 * prover. Used by the circuits tests and node tooling. NOT exported from the package index
 * (which stays browser-safe) — import it directly when running under node.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as snarkjs from "snarkjs";
import { IncrementalMerkleTree, type Note } from "@hestia/common";
import { type Arity, type ContractProof, proveForContractWith } from "./prover.js";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function artifactPaths(arity: Arity) {
  const name = `transaction${arity}`;
  const dir = path.join(PACKAGE_ROOT, "build", name);
  return {
    wasm: path.join(dir, `${name}_js`, `${name}.wasm`),
    zkey: path.join(dir, `${name}_final.zkey`),
    vkey: path.join(dir, `${name}.vkey.json`),
  };
}

export interface PositionedNote {
  note: Note;
  leafIndex: number;
}

export interface TransactionParams {
  sk: bigint;
  token: bigint;
  inputs: PositionedNote[];
  outputs: Note[];
  withdrawAmount: bigint;
  feeAmount: bigint;
  recipient: bigint;
  relayer: bigint;
  commitmentTree: IncrementalMerkleTree;
  associationTree: IncrementalMerkleTree;
  associationLeafIndex: number;
}

/** Assemble the circuit input object (signal names match transaction.circom exactly). */
export async function buildTransactionInput(p: TransactionParams): Promise<Record<string, unknown>> {
  const assocProof = p.associationTree.proof(p.associationLeafIndex);
  const inValue: bigint[] = [];
  const inOwner: bigint[] = [];
  const inLabel: bigint[] = [];
  const inRandomness: bigint[] = [];
  const inLeafIndex: bigint[] = [];
  const inPathElements: bigint[][] = [];
  const inPathIndices: number[][] = [];

  for (const { note, leafIndex } of p.inputs) {
    const proof = p.commitmentTree.proof(leafIndex);
    inValue.push(note.value);
    inOwner.push(note.owner);
    inLabel.push(note.label);
    inRandomness.push(note.randomness);
    inLeafIndex.push(BigInt(leafIndex));
    inPathElements.push(proof.pathElements);
    inPathIndices.push(proof.pathIndices);
  }

  return {
    root: p.commitmentTree.root,
    associationRoot: p.associationTree.root,
    withdrawAmount: p.withdrawAmount,
    token: p.token,
    recipient: p.recipient,
    feeAmount: p.feeAmount,
    relayer: p.relayer,
    sk: p.sk,
    inValue,
    inOwner,
    inLabel,
    inRandomness,
    inLeafIndex,
    inPathElements,
    inPathIndices,
    associationPathElements: assocProof.pathElements,
    associationPathIndices: assocProof.pathIndices,
    outValue: p.outputs.map((o) => o.value),
    outOwner: p.outputs.map((o) => o.owner),
    outRandomness: p.outputs.map((o) => o.randomness),
  };
}
