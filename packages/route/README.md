# @hestia/route

The convenience layer — indexer + relayer + API logic. **Status: core built + tested (P4).**
Trust-minimized: it indexes public chain state and relays transactions; it cannot steal, forge,
or deanonymize beyond what is already public. Agents may self-host.

```
src/
  store.ts       # in-memory pool state, reconstructed from chain events (chain = source of truth)
  indexer.ts     # viem event scan (Shield/Commitment/Nullified/RootPublished) -> store
  chain.ts       # chain + contract config from env (base / baseSepolia / anvil)
  relayer.ts     # submit transact1x2/2x2 (gas abstraction); fee/recipient bound into the proof
  handlers.ts    # framework-agnostic API logic (SPEC §7), returns JSON-serializable objects
prisma/schema.prisma  # production persistence (Postgres / Railway)
test/store.test.ts    # reconstruction matches @hestia/common fixtures
```

The store reconstructs the commitment tree with `@hestia/common`'s `IncrementalMerkleTree`, so the
indexed root is byte-identical to the on-chain root and the SDK's local tree.

## Status / remaining

- ✅ indexer store, viem indexer, relayer, API handlers, deterministic reconstruction test
- ⏳ Next.js app shell (`app/api/v1/*/route.ts`) wrapping the handlers + relayer
- ⏳ Prisma-backed store for production persistence (Railway)
- ⏳ live anvil integration (covered by the SDK e2e in P5)

## Run (dev, against local anvil)

```bash
export HESTIA_CHAIN=anvil HESTIA_RPC_URL=http://127.0.0.1:8545
export HESTIA_POOL_ADDRESS=0x... HESTIA_REGISTRY_ADDRESS=0x...
pnpm --filter @hestia/route test
```
