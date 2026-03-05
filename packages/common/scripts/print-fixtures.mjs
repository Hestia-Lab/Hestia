#!/usr/bin/env node
/**
 * Regenerate the frozen conformance vectors in test/fixtures.ts.
 * Run via `pnpm --filter @hestia/common fixtures` (builds first, then prints).
 * Only update test/fixtures.ts from this output after a deliberate, reviewed change.
 */
import * as H from "../dist/index.js";

const seed = new Uint8Array(32).fill(7);
const keys = await H.deriveKeysFromSeed(seed);
const label0 = await H.labelFromLeafIndex(0);
const note = {
  value: 1000000n,
  token: H.addressToField(H.USDC_ADDRESS.baseSepolia),
  owner: keys.SK,
  label: label0,
  randomness: 12345n,
};
const commitment = await H.commitment(note);
const nullifier = await H.nullifier(commitment, 0, keys.sk);

const tree = await H.IncrementalMerkleTree.create(32);
const emptyRoot = tree.root;
for (const leaf of [commitment, 111n, 222n]) tree.insert(leaf);

console.log("SK_7           =", keys.SK + "n");
console.log("VK_7_PREFIX    =", JSON.stringify(Array.from(keys.VK.slice(0, 4))));
console.log("LABEL_0        =", label0 + "n");
console.log("COMMITMENT_FIXED =", commitment + "n");
console.log("NULLIFIER_FIXED  =", nullifier + "n");
console.log("EMPTY_ROOT_32  =", emptyRoot + "n");
console.log("ROOT_AFTER_3   =", tree.root + "n");
