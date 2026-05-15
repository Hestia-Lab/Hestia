# @hestia/sdk

The single surface an agent uses to move value privately on Base. **Status: built + live e2e (P5).**

```ts
import { Hestia, AssociationSet, deriveKeysFromSignature, NATIVE_ETH } from "@hestia/sdk";
import { base } from "viem/chains";

const hestia = await Hestia.create({
  chain: base, rpcUrl, pool, registry, usdc,
  account,                       // viem account (relayer / shield funder, pays gas)
  keys: await deriveKeysFromSignature(sig), // shielded identity from one signature
  association,                   // AssociationProvider (route API in prod)
});

await hestia.shield({ token: NATIVE_ETH, amount });        // deposit -> private balance
await hestia.send({ token: NATIVE_ETH, amount, to });      // private transfer (to = meta-address)
await hestia.unshield({ token: NATIVE_ETH, amount, to });  // withdraw to a clean address
const bal = await hestia.balance(NATIVE_ETH);
const vk  = hestia.exportViewingKey();                     // selective disclosure
```

- **Self-indexing**: scans pool events (reusing `@hestia/route`), rebuilds the tree, and finds
  the agent's notes by trial-decrypting ciphertexts with the viewing key.
- **Proofs**: builds the join-split witness from notes + Merkle proofs and proves via
  `@hestia/circuits` (snarkjs), then submits through the relayer (gas abstraction).
- **Agent tools**: `createHestiaTools(hestia)` exposes shield/send/unshield/balance as typed
  tools an LLM agent can call.

## End-to-end (live, against anvil)

```bash
anvil &                                   # fresh chain
forge build                               # in packages/contracts (artifacts for deploy)
pnpm --filter @hestia/sdk build
pnpm --filter @hestia/sdk e2e             # or HESTIA_E2E_RPC=http://127.0.0.1:8546 ...
```

`e2e/run.mjs` deploys the full stack, publishes an ASP root, then runs the headline flow with
**real Groth16 proofs**: Alice shields → sends privately to Bob → Bob unshields to a clean
address. (Run against a fresh anvil — the script deploys its own contracts.)
