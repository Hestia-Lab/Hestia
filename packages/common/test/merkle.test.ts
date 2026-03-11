import { describe, expect, it } from "vitest";
import { getPoseidon, IncrementalMerkleTree } from "../src/index.js";
import { COMMITMENT_FIXED, EMPTY_ROOT_32, ROOT_AFTER_3 } from "./fixtures.js";

describe("incremental merkle tree", () => {
  it("empty depth-32 root matches the fixture", async () => {
    const tree = await IncrementalMerkleTree.create(32);
    expect(tree.leafCount).toBe(0);
    expect(tree.root).toBe(EMPTY_ROOT_32);
  });

  it("root after inserts matches the fixture and every proof verifies", async () => {
    const tree = await IncrementalMerkleTree.create(32);
    for (const leaf of [COMMITMENT_FIXED, 111n, 222n]) tree.insert(leaf);
    expect(tree.leafCount).toBe(3);
    expect(tree.root).toBe(ROOT_AFTER_3);

    const hasher = await getPoseidon();
    for (let i = 0; i < 3; i++) {
      expect(IncrementalMerkleTree.verify(hasher, tree.proof(i))).toBe(true);
    }
  });

  it("a proof for the wrong leaf does not verify", async () => {
    const tree = await IncrementalMerkleTree.create(32);
    for (const leaf of [COMMITMENT_FIXED, 111n, 222n]) tree.insert(leaf);
    const hasher = await getPoseidon();
    const proof = tree.proof(0);
    expect(IncrementalMerkleTree.verify(hasher, { ...proof, leaf: 999n })).toBe(false);
  });

  it("rejects an out-of-range leaf index", async () => {
    const tree = await IncrementalMerkleTree.create(32);
    tree.insert(1n);
    expect(() => tree.proof(5)).toThrow();
  });
});
