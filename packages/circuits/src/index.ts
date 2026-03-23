/**
 * @hestia/circuits — browser-safe Groth16 prover + types for the `transaction` join-split.
 *
 * The proving artifacts (wasm/zkey) are loaded from caller-provided sources (file paths in
 * node, URLs in the browser), so this entry has no node-only dependencies and bundles for the
 * browser. The node-only harness (disk artifact resolution, witness building) lives in
 * `harness.ts` and is imported directly by node tooling/tests.
 */
export * from "./prover.js";
