# Hestia

> Programmable privacy layer for agents on Base.
> Shielded pools · compliant by construction · API + SDK that agents call whenever they touch Base.

Full-stack monorepo. Design and build plan are tracked in:

- **[SPEC.md](./SPEC.md)** — design specification.
- **[BUILD.md](./BUILD.md)** — ordered build plan (P0 → P6).

## Packages

| Package | Role |
|---|---|
| `packages/common` | Crypto foundations — notes, commitments, nullifiers, keys, encryption, Merkle. |
| `packages/circuits` | Circom/Groth16 `transaction` join-split + ceremony + prove/verify harness. |
| `packages/contracts` | `HestiaPool`, association-set registry, generated verifiers (Foundry). |
| `packages/route` | Indexer + relayer + HTTP API, Prisma/Postgres persistence. |
| `packages/sdk` | `@hestia/sdk` — the agent surface: shield / send / unshield / balance. |

## Develop

```bash
pnpm install
pnpm build && pnpm typecheck && pnpm test
```

🚧 Work in progress — see [BUILD.md](./BUILD.md) for status.
