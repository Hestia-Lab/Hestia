#!/usr/bin/env node
/**
 * Generate EVM creation bytecode for Poseidon (arities 1, 2, 5) from circomlibjs —
 * the SAME library that produced the circuit constants and @hestia/common's fixtures,
 * so the on-chain hash is guaranteed to match the circuit and the SDK.
 *
 * Writes hex bytecode to test/fixtures/PoseidonT{2,3,6}.hex, deployed in tests via CREATE.
 *   arity 1 -> PoseidonT2 (label = poseidon([leafIndex]))
 *   arity 2 -> PoseidonT3 (Merkle parent)
 *   arity 5 -> PoseidonT6 (commitment)
 */
import { poseidonContract } from "circomlibjs";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "test", "fixtures");
mkdirSync(outDir, { recursive: true });

const arities = { 1: "PoseidonT2", 2: "PoseidonT3", 5: "PoseidonT6" };

for (const [n, name] of Object.entries(arities)) {
  const raw = poseidonContract.createCode(Number(n));
  const hex = raw.startsWith("0x") ? raw : "0x" + raw;
  writeFileSync(path.join(outDir, `${name}.hex`), hex);
  console.log(`${name} (arity ${n}): ${(hex.length - 2) / 2} bytes`);
}

// Print one ABI so we know the exact function signature to call from Solidity.
console.log("ABI(arity 2):", JSON.stringify(poseidonContract.generateABI(2)));
