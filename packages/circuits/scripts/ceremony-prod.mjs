#!/usr/bin/env node
/**
 * PRODUCTION Groth16 trusted setup for the transaction circuits.
 *
 * Unlike scripts/ceremony.mjs (the DEV ceremony, which uses fixed local entropy and is the
 * repo's reproducible open-source setup), this script runs a FRESH setup whose entropy is
 * drawn from crypto.randomBytes at runtime and is NEVER written to disk or logged — so the
 * toxic waste is discarded and unknown to anyone. A fresh Phase-1 (Powers of Tau) is required
 * because the DEV phase-1 entropy is public; reusing it would leave the setup forgeable.
 *
 * Single-contributor (not a public multi-party ceremony) but the secret is genuinely discarded
 * — this is what secures the Base mainnet deployment.
 *
 * Everything is written to build/prod/ (gitignored). The DEV verifiers in
 * ../contracts/src/verifiers and the DEV zkeys in build/<circuit> are left untouched.
 *
 * Usage:  node scripts/ceremony-prod.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POWER = 16; // 2^16 = 65536 >= 56382 (largest circuit, 2x2)
const CIRCUITS = ["transaction1x2", "transaction2x2"];

// Call the snarkjs CLI directly with node (no pnpm shim — robust on Windows).
// Resolve the package main (allowed by exports), then derive the sibling cli.cjs.
const snarkjsMain = createRequire(import.meta.url).resolve("snarkjs");
const SNARKJS_CLI = path.join(path.dirname(snarkjsMain), "cli.cjs");
const snarkjs = (args) => execFileSync(process.execPath, [SNARKJS_CLI, ...args], { stdio: "inherit", cwd: root });
const entropy = () => randomBytes(64).toString("hex"); // fresh, never persisted

const prodDir = path.join(root, "build", "prod");
const ptauDir = path.join(prodDir, "ptau");
mkdirSync(ptauDir, { recursive: true });

// --- Phase 1: fresh Powers of Tau (random contribution + public beacon to finalize) ---
console.log("[prod-ceremony] Phase 1: fresh Powers of Tau (entropy discarded)");
const p0 = path.join(ptauDir, `pot${POWER}_0000.ptau`);
const p1 = path.join(ptauDir, `pot${POWER}_0001.ptau`);
const pb = path.join(ptauDir, `pot${POWER}_beacon.ptau`);
const ptauFinal = path.join(ptauDir, `pot${POWER}_final.ptau`);
snarkjs(["powersoftau", "new", "bn128", String(POWER), p0]);
snarkjs(["powersoftau", "contribute", p0, p1, "--name=hestia-prod-phase1", `-e=${entropy()}`]);
snarkjs([
  "powersoftau", "beacon", p1, pb,
  "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20", "10",
  "--name=hestia-prod-beacon",
]);
snarkjs(["powersoftau", "prepare", "phase2", pb, ptauFinal]);

// --- Phase 2: per-circuit setup + verifier export ---
for (const c of CIRCUITS) {
  console.log(`[prod-ceremony] Phase 2: ${c}`);
  const srcDir = path.join(root, "build", c);
  const outDir = path.join(prodDir, c);
  mkdirSync(outDir, { recursive: true });
  const zkey0 = path.join(outDir, `${c}_0000.zkey`);
  const zkeyFinal = path.join(outDir, `${c}_final.zkey`);
  snarkjs(["groth16", "setup", path.join(srcDir, `${c}.r1cs`), ptauFinal, zkey0]);
  snarkjs(["zkey", "contribute", zkey0, zkeyFinal, "--name=hestia-prod", `-e=${entropy()}`]);
  snarkjs(["zkey", "export", "verificationkey", zkeyFinal, path.join(outDir, `${c}.vkey.json`)]);

  const arity = c.replace("transaction", ""); // "1x2" | "2x2"
  const genSol = path.join(outDir, `TransactionVerifier${arity}.sol`);
  snarkjs(["zkey", "export", "solidityverifier", zkeyFinal, genSol]);
  // snarkjs names every verifier `Groth16Verifier`; rename to match the pool's imports.
  const sol = readFileSync(genSol, "utf8").replace(
    "contract Groth16Verifier",
    `contract TransactionVerifier${arity}`,
  );
  writeFileSync(path.join(prodDir, `TransactionVerifier${arity}.sol`), sol);
  console.log(`[prod-ceremony] ${c}: final zkey + vkey + verifier ready`);
}

console.log("[prod-ceremony] done →", prodDir);
