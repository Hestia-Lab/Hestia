#!/usr/bin/env node
/**
 * Compile the circom circuits -> r1cs / wasm / sym into build/.
 * Skips gracefully if circom is not installed so `turbo run build` stays green in CI.
 * After compiling, run the ceremony to produce zkeys + verifiers:
 *   pnpm --filter @hestia/circuits ceremony
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CIRCUITS = ["transaction1x2", "transaction2x2"];

function hasCircom() {
  try {
    execFileSync("circom", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

if (!hasCircom()) {
  console.log("[circuits] circom not found on PATH — skipping compile (install circom 2.x to build).");
  process.exit(0);
}

for (const c of CIRCUITS) {
  const out = path.join(root, "build", c);
  mkdirSync(out, { recursive: true });
  console.log(`[circuits] compiling ${c}`);
  execFileSync(
    "circom",
    [
      path.join(root, "circom", `${c}.circom`),
      "--r1cs",
      "--wasm",
      "--sym",
      "-l",
      path.join(root, "node_modules"),
      "-o",
      out,
    ],
    { stdio: "inherit" },
  );
}
console.log("[circuits] compiled. Next: pnpm --filter @hestia/circuits ceremony");
