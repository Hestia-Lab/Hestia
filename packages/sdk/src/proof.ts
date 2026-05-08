/** Build the join-split circuit witness from notes + Merkle proofs, then prove. */
import type { MerkleProof, Note } from "@hestia/common";
import { type Arity, type ArtifactsByArity, type ContractProof, proveForContractWith } from "@hestia/circuits";

export interface SpendInput {
  note: Note;
  leafIndex: number;
  merkleProof: MerkleProof; // inclusion in the commitment tree
}

export interface TransactionWitness {
  sk: bigint;
  token: bigint;
  inputs: SpendInput[];
  outputs: Note[]; // length 2 (1x2 / 2x2)
  withdrawAmount: bigint;
  feeAmount: bigint;
  recipient: bigint; // field (address as uint160), 0 for internal send
  relayer: bigint; // field (the submitting account)
  associationRoot: bigint;
  associationProof: MerkleProof;
}

export function buildCircuitInput(w: TransactionWitness): Record<string, unknown> {
  const root = w.inputs[0]!.merkleProof.root;
  return {
    root,
    associationRoot: w.associationRoot,
    withdrawAmount: w.withdrawAmount,
    token: w.token,
    recipient: w.recipient,
    feeAmount: w.feeAmount,
    relayer: w.relayer,
    sk: w.sk,
    inValue: w.inputs.map((i) => i.note.value),
    inOwner: w.inputs.map((i) => i.note.owner),
    inLabel: w.inputs.map((i) => i.note.label),
    inRandomness: w.inputs.map((i) => i.note.randomness),
    inLeafIndex: w.inputs.map((i) => BigInt(i.leafIndex)),
    inPathElements: w.inputs.map((i) => i.merkleProof.pathElements),
    inPathIndices: w.inputs.map((i) => i.merkleProof.pathIndices),
    associationPathElements: w.associationProof.pathElements,
    associationPathIndices: w.associationProof.pathIndices,
    outValue: w.outputs.map((o) => o.value),
    outOwner: w.outputs.map((o) => o.owner),
    outRandomness: w.outputs.map((o) => o.randomness),
  };
}

