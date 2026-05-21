# Hestia

> Programmable privacy layer for agents on Base.
> Shielded pools · compliant by construction · API + SDK that agents call whenever they touch Base.

Full-stack monorepo. The marketing site lives separately in `../hestia`.

- **[SPEC.md](./SPEC.md)** — design specification (architecture, cryptography, contracts, compliance).
- **[BUILD.md](./BUILD.md)** — ordered build plan (P0 → P6, with verifiable gates).

## Status

| Phase | Package(s) | State | Gate |
|---|---|---|---|
| P0 Scaffold | — | ✅ | monorepo builds |
| P1 Crypto foundations | `common` | ✅ | 19 tests, golden fixtures frozen |
| P2 Circuits | `circuits` | ✅ | 7 tests, real Groth16 proofs |
| P3 Contracts | `contracts` | ✅ | 18 Foundry tests, real-proof shield→unshield e2e |
| P4 Route backend | `route` | ✅ | indexer reconstruction test + HTTP API + relayer |
| P5 SDK | `sdk` | ✅ | **live anvil e2e**: Alice shields → sends to Bob → Bob unshields |
| P6 Harden | — | tests + docs ✅ | fuzz + access-control; audit / real ceremony / mainnet are external ops |

**Tests:** 31 JS (vitest: common 19, circuits 7, route 5) + 18 Solidity (Foundry) — all green.

## Packages

| Package | Role |
|---|---|
| `packages/common` | Crypto spine — notes, commitments, nullifiers, keys, X25519 encryption, meta-address, Merkle. |
| `packages/circuits` | Circom/Groth16 `transaction` join-split (1x2, 2x2) + ceremony + prove/verify harness. |
| `packages/contracts` | `HestiaPool`, `AssociationSetRegistry`, on-chain Poseidon, generated verifiers (Foundry). |
| `packages/route` | Indexer + relayer + HTTP API (`node:http`), Prisma/Postgres persistence schema. |
| `packages/sdk` | `@hestia/sdk` — the agent surface: shield / send / unshield / balance + agent-tool adapter. |

