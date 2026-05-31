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
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POWER = 16;
const CIRCUITS = ["transaction1x2", "transaction2x2"];
const force = process.argv.includes("--force");

// Call the snarkjs CLI installed in node_modules directly via node (no pnpm/npx resolution).
// snarkjs 0.7.6 blocks deep imports via "exports" and its main points at a nonexistent build/.
// Walk node_modules upward to find the real package root, then run its CLI (cli.js) directly.
function findSnarkjsCli(start) {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    for (const cand of [
      path.join(dir, "node_modules", "snarkjs", "cli.js"),
      path.join(dir, "node_modules", "snarkjs", "build", "cli.cjs"),
      path.join(dir, "node_modules", "snarkjs", "main.js"),
    ]) {
      if (existsSync(cand)) return cand;
    }
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  throw new Error("could not locate snarkjs CLI under node_modules");
}
const snarkjsCli = findSnarkjsCli(root);
const snarkjs = (args) => execFileSync(process.execPath, [snarkjsCli, ...args], { stdio: "inherit", cwd: root });

// --- Phase 1: Powers of Tau ---
const ptauDir = path.join(root, "build", "ptau");
const ptauFinal = path.join(ptauDir, `pot${POWER}_final.ptau`);
mkdirSync(ptauDir, { recursive: true });

if (force || !existsSync(ptauFinal)) {
  console.log("[ceremony] DEV Powers of Tau (insecure — regenerate for mainnet)");
  const p0 = path.join(ptauDir, `pot${POWER}_0000.ptau`);
  const p1 = path.join(ptauDir, `pot${POWER}_0001.ptau`);
  snarkjs(["powersoftau", "new", "bn128", String(POWER), p0]);
  snarkjs(["powersoftau", "contribute", p0, p1, "--name=hestia_dev", "-e=hestia_dev_entropy_phase1"]);
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
      `--name=hestia_dev_${c}`, `-e=hestia_dev_zkey_${c}`,
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
