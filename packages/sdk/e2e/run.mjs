#!/usr/bin/env node
/**
 * Live e2e against a local anvil: deploy the full stack, publish an ASP root, then run the
 * headline flow through @hestia/sdk with real Groth16 proofs:
 *   Alice shields  ->  Alice sends privately to Bob  ->  Bob unshields to a clean address.
 *
 * Prereqs: `anvil` running, `forge build` + circuit artifacts present.
 *   anvil &
 *   node packages/sdk/e2e/run.mjs            # or HESTIA_E2E_RPC=http://127.0.0.1:8546 node ...
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, formatEther, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { labelFromLeafIndex } from "@hestia/common";
import { AssociationSet, deriveKeysFromSeed, Hestia, NATIVE_ETH } from "../dist/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const contractsDir = path.resolve(here, "../../contracts");
const circuitsBuild = path.resolve(here, "../../circuits/build");
const RPC = process.env.HESTIA_E2E_RPC ?? "http://127.0.0.1:8545";

const artifacts = {
  "1x2": {
    wasm: path.join(circuitsBuild, "transaction1x2/transaction1x2_js/transaction1x2.wasm"),
    zkey: path.join(circuitsBuild, "transaction1x2/transaction1x2_final.zkey"),
  },
  "2x2": {
    wasm: path.join(circuitsBuild, "transaction2x2/transaction2x2_js/transaction2x2.wasm"),
    zkey: path.join(circuitsBuild, "transaction2x2/transaction2x2_final.zkey"),
  },
};

// anvil default accounts #0 (deployer / Alice) and #1 (Bob)
const deployer = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const bobAccount = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const publicClient = createPublicClient({ chain: foundry, transport: http(RPC) });
const wallet = createWalletClient({ account: deployer, chain: foundry, transport: http(RPC) });

const artifact = (name) =>
  JSON.parse(readFileSync(path.join(contractsDir, "out", `${name}.sol`, `${name}.json`), "utf8"));
const poseidonHex = (name) =>
  readFileSync(path.join(contractsDir, "test/fixtures", `${name}.hex`), "utf8").trim();

async function deployRaw(bytecode) {
  const hash = await wallet.sendTransaction({ data: bytecode });
  return (await publicClient.waitForTransactionReceipt({ hash })).contractAddress;
}
async function deploy(name, args = []) {
  const a = artifact(name);
  const hash = await wallet.deployContract({ abi: a.abi, bytecode: a.bytecode.object, args, account: deployer, chain: foundry });
  return (await publicClient.waitForTransactionReceipt({ hash })).contractAddress;
}

console.log("• deploying stack to anvil…");
const p1 = await deployRaw(poseidonHex("PoseidonT2"));
const p2 = await deployRaw(poseidonHex("PoseidonT3"));
const p5 = await deployRaw(poseidonHex("PoseidonT6"));
const v1 = await deploy("TransactionVerifier1x2");
const v2 = await deploy("TransactionVerifier2x2");
const registry = await deploy("AssociationSetRegistry", [deployer.address]);
const usdc = "0x0000000000000000000000000000000000000001"; // unused on the ETH path
const pool = await deploy("HestiaPool", [32n, p2, p1, p5, v1, v2, registry, usdc]);
console.log(`  pool=${pool} registry=${registry}`);

// ASP approves the deposit's lineage label (leafIndex 0) and publishes the root.
const regAbi = artifact("AssociationSetRegistry").abi;
const association = await AssociationSet.create();
association.add(await labelFromLeafIndex(0));
await wallet.writeContract({ address: registry, abi: regAbi, functionName: "setASP", args: [deployer.address, true], account: deployer, chain: foundry });
const pub = await wallet.writeContract({ address: registry, abi: regAbi, functionName: "publishRoot", args: [association.root(), "ipfs://dev-set"], account: deployer, chain: foundry });
await publicClient.waitForTransactionReceipt({ hash: pub });
console.log("• published association root");

const cfg = { chain: foundry, rpcUrl: RPC, pool, registry, usdc, association, artifacts };
const alice = await Hestia.create({ ...cfg, account: deployer, keys: await deriveKeysFromSeed(new Uint8Array(32).fill(7)) });
const bob = await Hestia.create({ ...cfg, account: bobAccount, keys: await deriveKeysFromSeed(new Uint8Array(32).fill(9)) });

const SHIELD = parseEther("0.001");
const SEND = parseEther("0.0006");
const WITHDRAW = parseEther("0.0005");
const FEE = parseEther("0.00001");

console.log("• Alice shields 0.001 ETH");
await alice.shield({ token: NATIVE_ETH, amount: SHIELD });
await alice.sync();
assert.equal(await alice.balance(NATIVE_ETH), SHIELD, "Alice shield balance");

console.log("• Alice sends 0.0006 ETH privately to Bob's meta-address");
await alice.send({ token: NATIVE_ETH, amount: SEND, to: bob.metaAddress });
await alice.sync();
await bob.sync();
const aliceChange = await alice.balance(NATIVE_ETH);
const bobBalance = await bob.balance(NATIVE_ETH);
console.log(`  Alice change = ${formatEther(aliceChange)} ETH, Bob received = ${formatEther(bobBalance)} ETH`);
assert.equal(bobBalance, SEND, "Bob received amount");
assert.equal(aliceChange, SHIELD - SEND, "Alice change");

const fresh = "0x00000000000000000000000000000000000000ff";
const before = await publicClient.getBalance({ address: fresh });
console.log("• Bob unshields 0.0005 ETH to a clean address (fee 0.00001)");
await bob.unshield({ token: NATIVE_ETH, amount: WITHDRAW, to: fresh, fee: FEE });
await bob.sync();
const after = await publicClient.getBalance({ address: fresh });
console.log(`  clean address received = ${formatEther(after - before)} ETH`);
console.log(`  Bob private balance (change) = ${formatEther(await bob.balance(NATIVE_ETH))} ETH`);
assert.equal(after - before, WITHDRAW, "withdraw amount");
assert.equal(await bob.balance(NATIVE_ETH), SEND - WITHDRAW - FEE, "Bob change");

console.log("\n✅ e2e passed: Alice shields → sends privately to Bob → Bob unshields, all with real Groth16 proofs on anvil.");
