# Hestia

> Programmable privacy layer for agents on Base.
> Shielded pools · compliant by construction · API + SDK that agents call whenever they touch Base.

Full-stack monorepo. The marketing site lives separately in `../hestia`.

- **[SPEC.md](./SPEC.md)** — design specification (architecture, cryptography, contracts, compliance).
- **[BUILD.md](./BUILD.md)** — ordered build plan (P0 → P6, with verifiable gates).

CA : 0x1bf2e83c7bc58b5b1aef3d6c953424c2361f8ba3

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

## Develop

```bash
pnpm install
pnpm build && pnpm typecheck && pnpm test     # JS workspace (turbo)

# Contracts (Foundry — installs to ~/.foundry/bin)
curl -L https://foundry.paradigm.xyz | bash && ~/.foundry/bin/foundryup
pnpm --filter @hestia/contracts gen:poseidon  # Poseidon bytecode (circomlibjs)
cd packages/contracts && forge test           # 18 tests

# Circuits (compile + dev ceremony) — needs circom 2.x + snarkjs
pnpm --filter @hestia/circuits build:circuits
pnpm --filter @hestia/circuits ceremony

# Live end-to-end (fresh anvil)
anvil & ; cd packages/contracts && forge build
pnpm --filter @hestia/sdk build && pnpm --filter @hestia/sdk e2e
```

## Remaining external ops (P6)

These require resources outside this repo and are intentionally not automated:

1. **Trusted setup** — replace the committed *dev* ceremony with a real multi-party ceremony (public transcript), then regenerate verifiers.
2. **Audit** — independent review of contracts + circuits (a mainnet gate).
3. **Deploy** — `forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --private-key $PK` (needs a funded key); then mainnet.
4. **Persistence** — wire the Prisma/Postgres store + Railway for the route service (schema in `packages/route/prisma`).

#PrivacyByDefault · always stay private.
