#!/usr/bin/env node
/**
 * Generate a real Groth16 proof fixture for the contracts' e2e test:
 * an ETH unshield (1x2) with a relayer fee. Written to ../contracts/test/fixtures/.
 *
 * ETH is used so the note's `token` field is 0 (address(0)) — no dependency on a
 * dynamically-deployed token address. snarkjs.exportSolidityCallData gives the proof
 * points in the exact shape the generated verifier expects (pB coordinates swapped).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as snarkjs from "snarkjs";
import * as H from "@hestia/common";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.resolve(root, "..", "contracts", "test", "fixtures");
mkdirSync(outDir, { recursive: true });

const ETH = 0n; // token field for native ETH (address(0))
const s = await H.deriveKeysFromSeed(new Uint8Array(32).fill(7));
const label = await H.labelFromLeafIndex(0);

const value = 1_000_000n;
const withdraw = 800_000n;
const fee = 10_000n;
const change = 190_000n; // value == change + withdraw + fee
const randomness = 12345n;

const inNote = { value, token: ETH, owner: s.SK, label, randomness };
const inCommit = await H.commitment(inNote);

const tree = await H.IncrementalMerkleTree.create(32);
tree.insert(inCommit);
const assoc = await H.IncrementalMerkleTree.create(32);
assoc.insert(label);

const recipientAddr = "0x1111111111111111111111111111111111111111";
const relayerAddr = "0x2222222222222222222222222222222222222222";

const out0 = { value: change, token: ETH, owner: s.SK, label, randomness: 111n };
const out1 = { value: 0n, token: ETH, owner: s.SK, label, randomness: 222n };

const cp = tree.proof(0);
const ap = assoc.proof(0);

const input = {
  root: tree.root,
  associationRoot: assoc.root,
  withdrawAmount: withdraw,
  token: ETH,
  recipient: H.addressToField(recipientAddr),
  feeAmount: fee,
  relayer: H.addressToField(relayerAddr),
  sk: s.sk,
  inValue: [value],
  inOwner: [s.SK],
  inLabel: [label],
  inRandomness: [randomness],
  inLeafIndex: [0n],
  inPathElements: [cp.pathElements],
  inPathIndices: [cp.pathIndices],
  associationPathElements: ap.pathElements,
  associationPathIndices: ap.pathIndices,
  outValue: [change, 0n],
  outOwner: [s.SK, s.SK],
  outRandomness: [111n, 222n],
};

const wasm = path.join(root, "build/transaction1x2/transaction1x2_js/transaction1x2.wasm");
const zkey = path.join(root, "build/transaction1x2/transaction1x2_final.zkey");
const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasm, zkey);
const callData = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
const [a, b, c] = JSON.parse("[" + callData + "]");
const dec = (x) => BigInt(x).toString();

const fixture = {
  // shield params (the contract reproduces commitment + root from these)
  amount: value.toString(),
  ownerSK: s.SK.toString(),
  randomness: randomness.toString(),
  // public transaction params
  root: tree.root.toString(),
  associationRoot: assoc.root.toString(),
  withdrawAmount: withdraw.toString(),
  feeAmount: fee.toString(),
  recipient: recipientAddr,
  relayer: relayerAddr,
  // circuit public outputs
  nullifier0: (await H.nullifier(inCommit, 0, s.sk)).toString(),
  outCommitment0: (await H.commitment(out0)).toString(),
  outCommitment1: (await H.commitment(out1)).toString(),
  // groth16 proof points (verifier-ready)
  pA: [dec(a[0]), dec(a[1])],
  pB: [[dec(b[0][0]), dec(b[0][1])], [dec(b[1][0]), dec(b[1][1])]],
  pC: [dec(c[0]), dec(c[1])],
};

writeFileSync(path.join(outDir, "unshieldEth1x2.json"), JSON.stringify(fixture, null, 2));
console.log("wrote unshieldEth1x2.json; root =", fixture.root);
