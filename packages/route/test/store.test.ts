import { describe, expect, it } from "vitest";
import { HestiaStore } from "../src/store.js";

// The indexer's tree reconstruction must reproduce @hestia/common's frozen fixtures.
const COMMITMENT_FIXED =
  9152441458335379777787960014398893267669350046364461180425247781037444832192n;
const EMPTY_ROOT_32 =
  21443572485391568159800782191812935835534334817699172242223315142338162256601n;
const ROOT_AFTER_3 =
  11618927440053568898380639301824616197959519824639868298383077096496084375088n;

describe("HestiaStore (indexer reconstruction)", () => {
  it("empty root matches the common fixture", async () => {
    const s = await HestiaStore.create(32);
    expect(s.root).toBe(EMPTY_ROOT_32);
    expect(s.leafCount).toBe(0);
  });

  it("reconstructs the root from leaf events applied in order", async () => {
    const s = await HestiaStore.create(32);
    s.applyCommitment(COMMITMENT_FIXED, 0, "0x", 1n);
    s.applyCommitment(111n, 1, "0x", 1n);
    s.applyCommitment(222n, 2, "0x", 2n);
    expect(s.root).toBe(ROOT_AFTER_3);
    expect(s.leafCount).toBe(3);
  });

  it("rejects out-of-order leaves", async () => {
    const s = await HestiaStore.create(32);
    expect(() => s.applyCommitment(111n, 1, "0x", 1n)).toThrow();
  });
});
