import { describe, expect, it } from "vitest";
import {
  addressToField,
  commitment,
  deriveKeysFromSeed,
  IncrementalMerkleTree,
  labelFromLeafIndex,
  nullifier,
  USDC_ADDRESS,
  type Note,
} from "@hestia/common";
import { buildTransactionInput, proveTransaction, verifyTransaction } from "../src/harness.js";

const token = addressToField(USDC_ADDRESS.baseSepolia);
const SOME_RECIPIENT = addressToField("0x1111111111111111111111111111111111111111");
const SOME_RELAYER = addressToField("0x2222222222222222222222222222222222222222");

async function sender() {
  return deriveKeysFromSeed(new Uint8Array(32).fill(7));
}
async function recipient() {
  return deriveKeysFromSeed(new Uint8Array(32).fill(9));
}

describe("transaction circuit — 1x2", () => {
  it("proves & verifies a send, and is conformant with @hestia/common", async () => {
    const s = await sender();
    const r = await recipient();
    const label = await labelFromLeafIndex(0);
    const value = 1_000_000n;

    const inNote: Note = { value, token, owner: s.SK, label, randomness: 12345n };
    const inCommit = await commitment(inNote);
    const tree = await IncrementalMerkleTree.create(32);
    tree.insert(inCommit);
    const assoc = await IncrementalMerkleTree.create(32);
    assoc.insert(label);

    const out0: Note = { value, token, owner: r.SK, label, randomness: 1n };
    const out1: Note = { value: 0n, token, owner: s.SK, label, randomness: 2n };

    const input = await buildTransactionInput({
      sk: s.sk,
      token,
      inputs: [{ note: inNote, leafIndex: 0 }],
      outputs: [out0, out1],
      withdrawAmount: 0n,
      feeAmount: 0n,
      recipient: 0n,
      relayer: 0n,
      commitmentTree: tree,
      associationTree: assoc,
      associationLeafIndex: 0,
    });

    const { proof, publicSignals } = await proveTransaction("1x2", input);
    expect(await verifyTransaction("1x2", publicSignals, proof)).toBe(true);

    // Conformance: the circuit's nullifier & output commitments equal common's.
    const nf = await nullifier(inCommit, 0, s.sk);
    const oc0 = await commitment(out0);
    const oc1 = await commitment(out1);
    for (const v of [nf, oc0, oc1]) expect(publicSignals).toContain(v.toString());
  });

  it("proves & verifies an unshield with a relayer fee (conservation holds)", async () => {
    const s = await sender();
    const label = await labelFromLeafIndex(0);
    const value = 1_000_000n;

    const inNote: Note = { value, token, owner: s.SK, label, randomness: 7n };
    const tree = await IncrementalMerkleTree.create(32);
    tree.insert(await commitment(inNote));
    const assoc = await IncrementalMerkleTree.create(32);
    assoc.insert(label);

    // 1_000_000 == change 190_000 + withdraw 800_000 + fee 10_000
    const change: Note = { value: 190_000n, token, owner: s.SK, label, randomness: 8n };
    const empty: Note = { value: 0n, token, owner: s.SK, label, randomness: 9n };

    const input = await buildTransactionInput({
      sk: s.sk,
      token,
      inputs: [{ note: inNote, leafIndex: 0 }],
      outputs: [change, empty],
      withdrawAmount: 800_000n,
      feeAmount: 10_000n,
      recipient: SOME_RECIPIENT,
      relayer: SOME_RELAYER,
      commitmentTree: tree,
      associationTree: assoc,
      associationLeafIndex: 0,
    });

    const { proof, publicSignals } = await proveTransaction("1x2", input);
    expect(await verifyTransaction("1x2", publicSignals, proof)).toBe(true);
  });

  it("rejects a label that is not in the association set", async () => {
    const s = await sender();
    const label = await labelFromLeafIndex(0);
    const inNote: Note = { value: 1_000_000n, token, owner: s.SK, label, randomness: 7n };
    const tree = await IncrementalMerkleTree.create(32);
    tree.insert(await commitment(inNote));
    const badAssoc = await IncrementalMerkleTree.create(32);
    badAssoc.insert(999n); // the label is NOT a member

    const input = await buildTransactionInput({
      sk: s.sk,
      token,
      inputs: [{ note: inNote, leafIndex: 0 }],
      outputs: [
        { value: 1_000_000n, token, owner: s.SK, label, randomness: 1n },
        { value: 0n, token, owner: s.SK, label, randomness: 2n },
      ],
      withdrawAmount: 0n,
      feeAmount: 0n,
      recipient: 0n,
      relayer: 0n,
      commitmentTree: tree,
      associationTree: badAssoc,
      associationLeafIndex: 0,
    });

    await expect(proveTransaction("1x2", input)).rejects.toThrow();
  });

  it("rejects value imbalance", async () => {
    const s = await sender();
    const label = await labelFromLeafIndex(0);
    const inNote: Note = { value: 1_000_000n, token, owner: s.SK, label, randomness: 7n };
    const tree = await IncrementalMerkleTree.create(32);
    tree.insert(await commitment(inNote));
    const assoc = await IncrementalMerkleTree.create(32);
    assoc.insert(label);

    const input = await buildTransactionInput({
      sk: s.sk,
      token,
      inputs: [{ note: inNote, leafIndex: 0 }],
      outputs: [
        { value: 1_000_001n, token, owner: s.SK, label, randomness: 1n }, // mints 1 extra
        { value: 0n, token, owner: s.SK, label, randomness: 2n },
      ],
      withdrawAmount: 0n,
      feeAmount: 0n,
      recipient: 0n,
      relayer: 0n,
      commitmentTree: tree,
      associationTree: assoc,
      associationLeafIndex: 0,
    });

    await expect(proveTransaction("1x2", input)).rejects.toThrow();
  });

  it("rejects a spender who does not own the note", async () => {
    const s = await sender();
    const wrong = await recipient(); // wrong sk
    const label = await labelFromLeafIndex(0);
    const inNote: Note = { value: 1_000_000n, token, owner: s.SK, label, randomness: 7n };
    const tree = await IncrementalMerkleTree.create(32);
    tree.insert(await commitment(inNote));
    const assoc = await IncrementalMerkleTree.create(32);
    assoc.insert(label);

    const input = await buildTransactionInput({
      sk: wrong.sk, // owner is s.SK, not poseidon(wrong.sk)
      token,
      inputs: [{ note: inNote, leafIndex: 0 }],
      outputs: [
        { value: 1_000_000n, token, owner: s.SK, label, randomness: 1n },
        { value: 0n, token, owner: s.SK, label, randomness: 2n },
      ],
      withdrawAmount: 0n,
      feeAmount: 0n,
      recipient: 0n,
      relayer: 0n,
      commitmentTree: tree,
      associationTree: assoc,
      associationLeafIndex: 0,
    });

    await expect(proveTransaction("1x2", input)).rejects.toThrow();
  });
});

describe("transaction circuit — 2x2", () => {
  it("proves & verifies a two-note consolidation", async () => {
    const s = await sender();
    const r = await recipient();
    const label = await labelFromLeafIndex(0);

    const n0: Note = { value: 600_000n, token, owner: s.SK, label, randomness: 11n };
    const n1: Note = { value: 400_000n, token, owner: s.SK, label, randomness: 22n };
    const tree = await IncrementalMerkleTree.create(32);
    tree.insert(await commitment(n0));
    tree.insert(await commitment(n1));
    const assoc = await IncrementalMerkleTree.create(32);
    assoc.insert(label);

    const out0: Note = { value: 1_000_000n, token, owner: r.SK, label, randomness: 33n };
    const out1: Note = { value: 0n, token, owner: s.SK, label, randomness: 44n };

    const input = await buildTransactionInput({
      sk: s.sk,
      token,
      inputs: [
        { note: n0, leafIndex: 0 },
        { note: n1, leafIndex: 1 },
      ],
      outputs: [out0, out1],
      withdrawAmount: 0n,
      feeAmount: 0n,
      recipient: 0n,
      relayer: 0n,
      commitmentTree: tree,
      associationTree: assoc,
      associationLeafIndex: 0,
    });

    const { proof, publicSignals } = await proveTransaction("2x2", input);
    expect(await verifyTransaction("2x2", publicSignals, proof)).toBe(true);
  });

  it("rejects merging two different lineages (single-lineage rule)", async () => {
    const s = await sender();
    const label0 = await labelFromLeafIndex(0);
    const label1 = await labelFromLeafIndex(1); // different lineage

    const n0: Note = { value: 600_000n, token, owner: s.SK, label: label0, randomness: 11n };
    const n1: Note = { value: 400_000n, token, owner: s.SK, label: label1, randomness: 22n };
    const tree = await IncrementalMerkleTree.create(32);
    tree.insert(await commitment(n0));
    tree.insert(await commitment(n1));
    const assoc = await IncrementalMerkleTree.create(32);
    assoc.insert(label0);

    const input = await buildTransactionInput({
      sk: s.sk,
      token,
      inputs: [
        { note: n0, leafIndex: 0 },
        { note: n1, leafIndex: 1 },
      ],
      outputs: [
        { value: 1_000_000n, token, owner: s.SK, label: label0, randomness: 33n },
        { value: 0n, token, owner: s.SK, label: label0, randomness: 44n },
      ],
      withdrawAmount: 0n,
      feeAmount: 0n,
      recipient: 0n,
      relayer: 0n,
      commitmentTree: tree,
      associationTree: assoc,
      associationLeafIndex: 0,
    });

    await expect(proveTransaction("2x2", input)).rejects.toThrow();
  });
});
