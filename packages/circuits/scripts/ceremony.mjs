#!/usr/bin/env node
/**
 * Groth16 trusted setup for the transaction circuits, then export Solidity verifiers
 * into ../contracts/src/verifiers.
 *
 * ⚠️ This is a DEV ceremony — the Powers of Tau and the per-circuit contributions use
 * fixed local entropy and are NOT secure. Before mainnet (P6), replace with a real,
 * multi-party ceremony with a public transcript.
 *
 * Usage:
 *   pnpm --filter @hestia/circuits ceremony           # generate what is missing
 *   pnpm --filter @hestia/circuits ceremony -- --force # regenerate everything
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POWER = 16;
const CIRCUITS = ["transaction1x2", "transaction2x2"];
const force = process.argv.includes("--force");

const snarkjs = (args) => execFileSync("pnpm", ["exec", "snarkjs", ...args], { stdio: "inherit", cwd: root });

// --- Phase 1: Powers of Tau ---
const ptauDir = path.join(root, "build", "ptau");
const ptauFinal = path.join(ptauDir, `pot${POWER}_final.ptau`);
mkdirSync(ptauDir, { recursive: true });

if (force || !existsSync(ptauFinal)) {
  console.log("[ceremony] DEV Powers of Tau (insecure — regenerate for mainnet)");
  const p0 = path.join(ptauDir, `pot${POWER}_0000.ptau`);
  const p1 = path.join(ptauDir, `pot${POWER}_0001.ptau`);
  snarkjs(["powersoftau", "new", "bn128", String(POWER), p0]);
  snarkjs(["powersoftau", "contribute", p0, p1, "--name=hestia dev", "-e=hestia dev entropy phase1"]);
  snarkjs(["powersoftau", "prepare", "phase2", p1, ptauFinal]);
}

// --- Phase 2: per-circuit setup + verifier export ---
const verifiersDir = path.join(root, "..", "contracts", "src", "verifiers");
mkdirSync(verifiersDir, { recursive: true });

for (const c of CIRCUITS) {
  const dir = path.join(root, "build", c);
  const finalZkey = path.join(dir, `${c}_final.zkey`);
  if (force || !existsSync(finalZkey)) {
    snarkjs(["groth16", "setup", path.join(dir, `${c}.r1cs`), ptauFinal, path.join(dir, `${c}_0000.zkey`)]);
    snarkjs([
      "zkey", "contribute",
      path.join(dir, `${c}_0000.zkey`), finalZkey,
      `--name=hestia dev ${c}`, `-e=hestia dev zkey ${c}`,
    ]);
  }
  snarkjs(["zkey", "export", "verificationkey", finalZkey, path.join(dir, `${c}.vkey.json`)]);

  const arity = c.replace("transaction", ""); // "1x2" | "2x2"
  const genSol = path.join(dir, `TransactionVerifier${arity}.sol`);
  snarkjs(["zkey", "export", "solidityverifier", finalZkey, genSol]);

  // Rename the contract (snarkjs names them all `Groth16Verifier`) and copy into contracts.
  const src = readFileSync(genSol, "utf8").replace(
    "contract Groth16Verifier",
    `contract TransactionVerifier${arity}`,
  );
  writeFileSync(path.join(verifiersDir, `TransactionVerifier${arity}.sol`), src);
  console.log(`[ceremony] ${c}: zkey + vkey + verifier exported`);
}

console.log("[ceremony] done. Verifiers copied to packages/contracts/src/verifiers/");
