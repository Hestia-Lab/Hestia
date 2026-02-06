# Hestia — Build Plan

> The ordered, dependency-aware plan for building everything in [SPEC.md](./SPEC.md).
> Each step lists **deliverables**, **depends on**, and a **gate** (a verifiable condition that must pass before moving on). Build strictly top-to-bottom.

This refines SPEC §11. It inserts **P1 · crypto foundations** (the shared primitives SPEC folded into M1) as an explicit phase, because every other layer depends on it.

---

## Dependency graph (critical path)

```
P0 scaffold
   └─► P1 common (crypto foundations) ─┬─► P2 circuits ──► P3 contracts ─┐
                                       │                                 ├─► P4 route ─┐
                                       └─────────────────────────────────┘             ├─► P5 sdk ─► P6 harden
                                                  (circuit artifacts + ABI feed sdk) ───┘
```

`common` is the spine: its note/commitment/nullifier encoders must be **byte-identical** to what the circuits constrain and the contracts recompute. Build and freeze it first; circuits, contracts, and SDK all consume it.

---

## Tooling & versions

Pin exact versions at P0 via Context7 (`resolve-library-id` → `query-docs`) before writing manifests. Expected stack:

| Area | Tool |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Contracts | Foundry (forge/anvil/cast), Solidity ^0.8.24 |
| Circuits | Circom 2.x, circomlib, snarkjs (Groth16) |
| Crypto (JS) | circomlibjs (Poseidon), @noble/curves + libsodium (X25519/ChaCha20-Poly1305), bech32 |
| SDK / Route | TypeScript 5.x, viem 2.x, Next.js 16, Prisma 6 + PostgreSQL |
| Deploy | Base Sepolia (84532) → Base mainnet (8453); Railway for the route |

**Conventions:** all values are `bigint`; field element `r` = BN254 scalar field. USDC has 6 decimals. Every package ships unit tests; cross-package behavior is locked by fixtures in `common`. English only (code, comments, commits).

---

## P0 · Scaffold  *(SPEC M0)*

1. **Monorepo root** — `pnpm-workspace.yaml`, `turbo.json`, root `package.json` (scripts: `build`, `test`, `lint`, `typecheck`), `.gitignore`, `.editorconfig`, `tsconfig.base.json`, `README.md`. **Gate:** `pnpm install` clean.
2. **Package skeletons** — `packages/{common,circuits,contracts,route,sdk}` each with `package.json`, `tsconfig.json` (extends base), `src/index.ts` stub, `README.md`. Foundry init in `contracts` (`foundry.toml`, `lib/`). Circom dirs in `circuits` (`src/`, `build/`, `scripts/`). **Gate:** `pnpm -r build` + `pnpm -r typecheck` pass on stubs; `forge build` compiles an empty contract.
3. **CI skeleton** — a single workflow running `install → typecheck → build → test → forge test`. **Gate:** workflow green on the empty tree.

---

## P1 · Crypto foundations — `packages/common`  *(extracted from SPEC M1)*

The shared, test-locked primitives. **Nothing else starts until P1's gate passes.**

1. **Field & hashing** — Poseidon wrappers (circomlibjs) for arities used by notes/Merkle; field arithmetic helpers. **Gate:** Poseidon test vectors match circomlib reference.
2. **Note model** — `Note { value, token, owner(SK), label, randomness }`; `commitment(note)`, `nullifier(commitment, leafIndex, sk)` per SPEC §3.2. **Gate:** golden fixtures (frozen JSON) for commitment/nullifier; round-trip stable.
3. **Keys** — deterministic derivation from a signer signature → `sk`, `SK=poseidon(sk)`, X25519 `vk/VK` (SPEC §3.1). **Gate:** same signature → same keys across runs/platforms.
4. **Note encryption** — X25519 ECDH + ChaCha20-Poly1305 `crypto_box` encrypt/decrypt of `{value,token,label,randomness}`; trial-decrypt by AEAD tag (SPEC §3.3). **Gate:** encrypt→decrypt round-trips; wrong `vk` rejected.
5. **Meta-address** — Bech32m codec for `hestia:base:<SK>:<VK>`. **Gate:** encode/decode round-trip + malformed-input rejection.
6. **Merkle (JS mirror)** — incremental Poseidon Merkle tree (depth 32) + inclusion-path builder, matching the contract's tree exactly. **Gate:** JS tree root == a known reference root for a fixed leaf set.

> The fixtures created here become the **conformance suite** that circuits (P2) and contracts (P3) must satisfy.

---

## P2 · Circuits — `packages/circuits`  *(SPEC M1)*

**Depends on:** P1 (note/Merkle encoders, fixtures).

1. **Templates** — `commitment.circom`, `nullifier.circom`, `merkleInclusion.circom`, `association.circom` (single shared-label inclusion). **Gate:** each template's output matches P1 fixtures under `snarkjs` witness calc.
2. **`transaction.circom`** — join-split, parameterized `(nIns,nOuts)`; constraints 1–6 (SPEC §4); single-lineage label enforced. Build **1×2** and **2×2**. **Gate:** valid witness satisfies; each tampered constraint (bad nullifier, non-member label, value imbalance, mixed labels) fails.
3. **Ceremony** — fetch Powers-of-Tau, run Phase-2 per arity, export `*.zkey` + `*.vkey.json`. **Gate:** `snarkjs groth16 verify` passes; vkey hash recorded.
4. **Verifier export** — `snarkjs zkey export solidityverifier` → `TransactionVerifier1x2.sol`, `…2x2.sol` into `contracts`. **Gate:** `forge build` compiles the generated verifiers.
5. **Prove/verify harness** — JS helper that takes P1 notes → witness → proof; reused by SDK. **Gate:** end-to-end prove→verify on a fixture tx, both arities.

---

## P3 · Contracts — `packages/contracts`  *(SPEC M2)*

**Depends on:** P1 (encoders), P2 (verifiers).

1. **Libraries** — `PoseidonT*` (deploy or vendored), `IncrementalMerkleTree` (depth 32, 64-root window). **Gate:** on-chain insert reproduces P1's JS root.
2. **`AssociationSetRegistry.sol`** — multi-ASP roles, root history + `uri`, `isValidRoot`. **Gate:** publish/validate/expiry-window tests.
3. **`HestiaPool.sol`** — `shield` (proof-less, ETH + USDC vault), `transact` (verifier dispatch by arity, nullifier guard, root-window check, association-root check, fee→relayer, withdraw→recipient), events with note ciphertexts. **Gate:** Foundry unit tests for each path + reverts (double-spend, stale root, bad association, fee>inputs).
4. **End-to-end test** — generate a real proof via P2 harness, run `shield → transact(send) → transact(unshield)` in Foundry. **Gate:** balances and nullifier set correct with a genuine Groth16 proof.
5. **Deploy scripts** — deterministic deploy (verifiers → registry → pool) + address manifest emitted for route/sdk. **Gate:** deployed to **Base Sepolia**; manifest checked in.

---

## P4 · Route service — `packages/route`  *(SPEC M3)*

**Depends on:** P3 (deployed addresses, ABI), P1 (codecs).

1. **DB** — Prisma schema (SPEC §7) + migrations; Railway-friendly (`migrate deploy` at start, `PORT` injected). **Gate:** `migrate dev` clean; models match SPEC.
2. **Indexer** — subscribe to `Shield`/`Transact`, reconstruct the commitment tree, persist leaves/nullifiers/ciphertexts/ASP roots; resumable from last block. **Gate:** indexed tree root == on-chain root on Sepolia.
3. **Read endpoints** — `/pool/state`, `/tree/proof`, `/association/root`, `/association/proof`, `/notes/scan`, `/health`. **Gate:** returned Merkle/association paths verify against P1/P2.
4. **Relayer** — `/relay`: off-chain proof check → submit `transact` → reimburse via `feeAmount`; quote endpoint; rate-limit + fee-floor. **Gate:** relays a real `transact` to Sepolia; rejects an invalid proof without paying gas.
5. **Compliance** — `/compliance/viewkey` disclosure-receipt register/rotate. **Gate:** receipt persisted and retrievable.
6. **Auth** — API-key middleware, rate limits, per-key caps. **Gate:** unauthorized/over-limit requests rejected.

---

## P5 · SDK — `packages/sdk`  *(SPEC M4)*

**Depends on:** P1 (codecs/keys), P2 (prove harness + artifacts), P3 (ABI/addresses), P4 (API).

1. **Client + keys** — `Hestia.create(...)`, `keys.derive()` from signer. **Gate:** derives stable keys; loads chain config.
2. **Note sync** — `/notes/scan` → trial-decrypt with `vk` → local note store; balance per token (sum across labels). **Gate:** discovers notes sent to it on Sepolia.
3. **Coin selection** — label-bucketed selection honoring the single-lineage rule; multi-note/tx split when a payment spans lineages. **Gate:** unit tests over bucket scenarios.
4. **`shield`** — approve + deposit, build/store output note. **Gate:** shield reflected in balance after sync.
5. **`send` / `unshield`** — build inputs, fetch Merkle + association paths, generate proof (P2 harness, wasm), submit via `/relay`. **Gate:** send and unshield succeed on Sepolia.
6. **Disclosure + agent adapter** — `exportViewingKey()`; typed agent-tool schema (`shield/send/unshield/balance`) with structured errors. **Gate:** adapter callable as an LLM tool; errors typed.
7. **E2E** — two SDK instances: Agent A shields, sends to Agent B, B sees balance, B unshields to a clean address via relayer. **Gate:** ✅ full private payment between two agents on Base Sepolia.

---

## P6 · Harden & mainnet  *(SPEC M5)*

1. Threat-model review against SPEC §10; fuzz/invariant tests (Foundry) for the pool. **Gate:** invariants hold.
2. Docs site / SDK reference / quickstart; wire the `hestia/` marketing links to real docs. **Gate:** a new dev completes shield→send→unshield from docs alone.
3. Audit prep (frozen contracts + circuits + ceremony transcript) → **external audit**. **Gate:** audit findings resolved.
4. Mainnet deploy + ASP root publishing live. **Gate:** mainnet shield→send→unshield with default ASP.

---

## Working agreement

- One phase at a time, in order. A phase is "done" only when **every** gate in it is green.
- Before each phase, pull current library docs via Context7. After each phase, update SPEC if reality diverged.
- Keep changes surgical and tests-first where a gate is a behavior (write the failing check, then satisfy it).

*Next action: P0 · Scaffold.*
