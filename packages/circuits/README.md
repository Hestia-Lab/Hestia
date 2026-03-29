# @hestia/circuits

Circom/Groth16 circuits + the JS prove/verify harness (SPEC §4). **Status: built (P2).**

```
circom/
  merkleInclusion.circom   # DualMux + MerkleInclusion (matches @hestia/common's tree)
  transaction.circom       # the join-split: ownership, membership, association, conservation
  transaction1x2.circom     # main: 1 input, 2 outputs  (uint[10] public signals)
  transaction2x2.circom     # main: 2 inputs, 2 outputs (uint[11] public signals)
scripts/
  build.mjs                # compile circom -> r1cs/wasm/sym (skips if circom absent)
  ceremony.mjs             # Groth16 setup + export Solidity verifiers into ../contracts
src/harness.ts             # buildTransactionInput / proveTransaction / verifyTransaction
build/                     # generated artifacts (gitignored)
```

## Regenerate artifacts

```bash
pnpm --filter @hestia/circuits build      # compile circuits (needs circom 2.x on PATH)
pnpm --filter @hestia/circuits ceremony   # trusted setup -> zkeys, vkeys, verifiers
pnpm --filter @hestia/circuits test       # prove + verify + tamper-rejection (needs artifacts)
```

> ⚠️ The committed ceremony is a **DEV** ceremony with fixed local entropy — insecure, for
> testing only. Before mainnet (P6) it must be replaced by a real multi-party ceremony with a
> public transcript. Verifiers are exported to `../contracts/src/verifiers/` and embed the
> current (dev) verifying key, so they must be regenerated together with the zkeys.

## Constraints

| Circuit | non-linear | total | public signals |
|---|---|---|---|
| `transaction1x2` | 18,438 | ~38k | 10 |
| `transaction2x2` | 27,146 | ~56k | 11 |

Both fit a power-16 Powers of Tau.
