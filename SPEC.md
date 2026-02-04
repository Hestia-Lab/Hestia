# Hestia — Specification

> Programmable privacy layer for agents on Base.
> Shielded pools · compliant by construction · API + SDK that agents call whenever they touch Base.

**Status:** `v0.1 / draft` · **Chain:** Base (L2, OP-Stack) · **Audience:** autonomous agents and the developers who run them.

---

## 1. Problem & vision

AI agents that transact on Base — paying for services, settling between each other, managing a treasury — expose everything on a public ledger. Anyone can map an agent's wallet to its strategy, its counterparties, and its balances, then front-run it, copy it, or profile it. "Privacy by obscurity" (a fresh EOA per task) breaks the moment funds move between addresses.

Hestia is a **shielded value layer** that an agent reaches through one SDK call. An agent can:

- **shield** funds into a private pool (deposit USDC / ETH),
- **hold** a private balance and **send** to other agents/addresses with amounts and links hidden from the public,
- **unshield** to a clean address when it needs to act in the open,

while remaining **provably non-criminal**: every spend carries a zero-knowledge proof that the funds descend from a screened, approved deposit (Privacy Pools association sets), and every agent holds a **viewing key** it can hand to an auditor for selective disclosure of *its own* history — with no global backdoor and no custody of user funds.

### Design decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Pool model | **Persistent shielded account (UTXO / note based)** | Shield once, transact privately many times, arbitrary amounts. Matches "always-accessible privacy layer." Railgun/Aztec lineage. |
| ZK stack | **Circom + Groth16** | Battle-tested for exactly this (Tornado, Privacy Pools). Cheap on-chain verification (~230k gas), mature `snarkjs`. Cost: per-circuit trusted setup ceremony. |
| Compliance | **Privacy Pools (opt-in association sets) + viewing keys** | Non-custodial, no KYC. Honest agents prove dissociation from illicit funds; viewing key gives selective disclosure. Regulator-compatible per the Privacy Pools model (Buterin et al., 2023). |
| Assets (v1) | **USDC-first, native ETH second** | USDC is the de-facto agent payment asset on Base. ETH for gas/native value. |

---

## 2. Architecture

Four layers, mapping 1:1 to the public brand (`pool` · `circuits` · `route` · `sdk`):

```
            ┌──────────────────────────────────────────────────────────┐
  AGENT  →  │  L4 · SDK  @hestia/sdk                                     │
            │     keys · note store · proof gen (wasm) · relayer client  │
            └───────────────┬──────────────────────────────────────────-┘
                            │ HTTPS (API key)
            ┌───────────────▼──────────────────────────────────────────-┐
            │  L3 · ROUTE  (Next.js API + indexer + relayer + ASP feed)  │
            │     tree/proof · association/root · relay · pool/state     │
            │     compliance/viewkey · Postgres (Prisma) indexer state   │
            └───────────────┬──────────────────────────────────────────-┘
                            │ JSON-RPC / event logs
            ┌───────────────▼──────────────────────────────────────────-┐
            │  L1 · POOL  (Base)                                         │
            │     HestiaPool · AssociationSetRegistry · Groth16Verifier  │
            │     Poseidon commitment tree + nullifier set + token vault │
            └───────────────▲──────────────────────────────────────────-┘
                            │ verifies proofs from
            ┌───────────────┴──────────────────────────────────────────-┐
            │  L2 · CIRCUITS  (Circom / Groth16)                         │
            │     transaction (join-split) · merkle · nullifier · commit │
            └──────────────────────────────────────────────────────────-┘
```

**Trust model:** the on-chain pool is the only authority on funds and is non-custodial. The route service is **convenience, not trust** — it indexes public chain state, serves Merkle paths, relays transactions, and publishes association roots. A malicious route can withhold service or censor, but cannot steal funds, forge proofs, or deanonymize beyond what is public. Agents can run their own route.

---

## 3. Cryptographic design

All hashing snark-friendly over BN254 (alt_bn128). Field `F_r`. Poseidon for commitments/nullifiers/Merkle.

### 3.1 Keys (derived deterministically, agent never re-enters a seed)

```
seed            = keccak256( signer.sign("hestia.io/keys/v1") )      // one signature → all keys
spendingKey sk  = poseidon(seed, 0) mod r           // SECRET — authorizes spends, produces nullifiers
spendingPub  SK = poseidon(sk)                      // PUBLIC — note ownership; sender sets owner = recipient.SK
viewingKey  vk  = X25519 secret ← keccak(seed, 1)   // SECRET — decrypts incoming notes; unit of disclosure
viewingPub  VK  = X25519 pubkey(vk)                 // PUBLIC — note ciphertexts are encrypted to it
```

- **Spending key** never leaves the agent and is required to produce nullifiers (i.e. to spend). Ownership is verified **in-circuit with Poseidon only** (`SK = poseidon(sk)`) — no elliptic-curve ops in the circuit.
- **Viewing key** is an **X25519** keypair used *off-circuit* (encryption is never proven, so it need not be snark-friendly). `vk` decrypts the note ciphertexts addressed to the agent (so it can *find* and *value* its notes) and is the unit of **selective disclosure** — handing `vk` to an auditor reveals all of the agent's notes and *only* the agent's notes.
- `sk`/`vk` are secret; `SK`/`VK` are public. A **meta-address** — a Bech32m string `hestia1…` encoding `(chain, SK, VK)` — is what one agent shares so others can pay it: senders set `owner = SK` and encrypt the note to `VK`.

### 3.2 Note (the UTXO)

```
note = { value: uint, token: address, owner: SK, label: F_r, randomness: F_r }
commitment = poseidon(value, token, owner, label, randomness)        // leaf in the commitment tree
nullifier  = poseidon(commitment, leafIndex, sk)                     // published on spend
```

- `commitment` is inserted as a leaf into the on-chain **incremental Merkle tree** (depth 32).
- `nullifier` is revealed when the note is spent; the contract rejects duplicates → no double-spend. The nullifier is unlinkable to the commitment without `sk`.
- `label` ties a note to the **deposit it descends from** (see §6). On `shield`, the contract sets `label = poseidon(leafIndex)` (public, unique). In every `transact`, **all inputs share one label and every output inherits that same label** (the single-lineage rule, §6) — so a single association proof per tx certifies the whole spend, and lineage stays provable across chains of private transfers.
- `randomness` blinds the commitment so equal-value notes differ.

### 3.3 Note transmission (so agents can receive without coordination)

When a note is created for a recipient, the sender encrypts `{ value, token, label, randomness }` to the recipient's `VK` with **X25519 ECDH + ChaCha20-Poly1305** (libsodium `crypto_box`; off-circuit) and emits the ciphertext on-chain as calldata/event. The recipient scans new ciphertexts with `vk`, trial-decrypts (the AEAD tag identifies which ones are his), and learns its incoming notes. This is what makes the layer *receive-capable*, not just a mixer.

---

## 4. Circuits (L2)

The `transaction` circuit covers **send and unshield** as a **join-split** with `nIns` inputs and `nOuts` outputs. (Shield is **proof-less** — see §5.) v1 builds two arities: **1×2** (simple send / unshield with change) and **2×2** (two-note consolidation + change). 4×4 is deferred to v2; a spend needing >2 inputs is handled by chaining 2×2 transactions.

### `transaction.circom`

**Public signals**
```
merkleRoot          // commitment-tree root the inputs are proven against
associationRoot     // ASP-approved root (compliance)
nullifiers[nIns]    // spent-note nullifiers
outCommitments[nOuts]
publicAmount        // ≤ 0 :  0 = internal send, <0 = unshield (withdraw). Deposits use shield (§5).
token               // single token per tx
recipient           // public address for unshield (else 0)
feeAmount, relayer  // relayer reimbursement, bound into the proof (anti-tamper)
```

**Private signals (witness)**: input notes (value, owner, label, randomness, leafIndex), Merkle paths to `merkleRoot`, one association path for the shared `label` to `associationRoot`, `sk`, output note fields.

**Constraints**
1. **Ownership + nullifier** — for each input: `owner == poseidon(sk)`, `nullifier_i == poseidon(commitment_i, leafIndex_i, sk)`.
2. **Membership (state)** — each input commitment is in the commitment tree under `merkleRoot` (Merkle inclusion).
3. **Compliance (association)** — all inputs carry the **same** `label` (single-lineage rule); the circuit proves that one shared `label` is in the association tree under `associationRoot` (a single Merkle inclusion). *This is the Privacy Pools dissociation proof.*
4. **Value conservation** — `Σ inputs.value == Σ outputs.value + withdrawAmount + feeAmount`, where `withdrawAmount = -publicAmount ≥ 0`; all notes share one `token`.
5. **Well-formed outputs** — each `outCommitment_j == poseidon(value_j, token, owner_j, label, randomness_j)`, with every output assigned the inputs' shared `label` and `owner_j` set to the recipient's (or, for change, the agent's own) public spending key `SK`.
6. **Range checks** — values < 2^248 to prevent field overflow; `feeAmount ≤ Σ inputs`; `withdrawAmount ≥ 0`.

**Tooling:** Circom 2.x, `circomlib` (Poseidon, Merkle, comparators), `snarkjs` (Groth16). Powers-of-Tau (reuse Hermez/`ptau` up to required constraints) + a per-circuit Phase-2 ceremony. Verifier contract exported via `snarkjs zkey export solidityverifier`.

**Artifacts per arity:** `transaction_NxM.wasm`, `transaction_NxM.zkey`, `transaction_NxM.vkey.json`, `TransactionVerifierNxM.sol`.

---

## 5. Contracts (L1)

Foundry. Solidity ^0.8.24. Target Base Sepolia (84532) → Base mainnet (8453).

### `HestiaPool.sol` — entry point & vault
```solidity
function shield(ShieldRequest calldata r) external payable;     // deposit USDC/ETH, insert commitment(s), emit encrypted note
function transact(Proof calldata p, TxData calldata d) external; // send + unshield via join-split
```
- **Proof-less shield:** `shield` reveals `(token, amount, ownerSK, randomness)`; the contract assigns `label = poseidon(leafIndex)`, recomputes `commitment = poseidon(amount, token, ownerSK, label, randomness)`, pulls the funds, inserts the leaf, and emits the encrypted note. No ZK is needed — a deposit is already public; privacy begins when the note is *spent* via `transact`, which hides which commitment is consumed (the nullifier needs `sk`, so the shield→spend link is unprovable to observers).
- Holds an **incremental Merkle tree** of commitments (Poseidon, depth 32) with a rolling window of recent roots (last 64) so proofs against a slightly-stale root still verify.
- `mapping(bytes32 => bool) nullifierSpent` — double-spend guard.
- **Vault:** ETH balance + `USDC.safeTransferFrom`/`safeTransfer`. `shield` pulls funds in; `transact` with `publicAmount<0` releases to `recipient`; `feeAmount` pays `relayer`.
- On every state change: inserts `outCommitments`, marks `nullifiers`, emits `Shield` / `Transact` events carrying encrypted note ciphertexts for the indexer/recipients.
- **Non-custodial invariant:** no function lets any role move user funds; admin can only set the verifier address and ASP registry (behind timelock), never touch the vault.

### `AssociationSetRegistry.sol` — compliance feed
```solidity
function publishRoot(bytes32 root, string calldata uri) external onlyASP; // new approved set
function isValidRoot(bytes32 root) external view returns (bool);          // root + history window
```
- Stores a history of ASP-published roots (with off-chain `uri` to the set contents). `HestiaPool.transact` requires `associationRoot` to be a valid (recent) ASP root.
- Multiple ASPs supported via roles → agents/policies can choose which association set to prove against. Default ASP root = "all deposits screened clean by Hestia Labs' default provider."

### `TransactionVerifierNxM.sol` — generated Groth16 verifiers
- One per circuit arity; `HestiaPool` dispatches by `(nIns,nOuts)`.

### Constants
- USDC (Base mainnet): `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- USDC (Base Sepolia): `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- *(verify at deploy time)*

---

## 6. Compliance model (Privacy Pools + viewing keys)

Two independent, non-custodial mechanisms — no KYC, no backdoor.

**(a) Association sets (opt-in dissociation proof).**
Every `shield` is public (deposits are visible). An **Association Set Provider (ASP)** screens deposits (e.g. against sanctioned/illicit clusters) and publishes a Merkle root of the *approved* deposit `label`s. When an agent spends, the `transaction` circuit proves its notes' `label` is in that approved set — i.e. the spent value descends from a clean deposit — **without revealing which one**. An honest agent always can; funds tainted at the source cannot produce the proof. `label` inheritance (§3.2) keeps this provable across chains of private transfers.

**(b) Viewing-key selective disclosure.**
Each agent's `vk` decrypts exactly its own notes. To satisfy an audit, the agent (or a court order served on the agent) discloses `vk`, revealing its full shielded history — and nothing about anyone else. Optional **disclosure receipts**: a signed statement binding `vk` to a time range, posted to `/compliance/viewkey`.

**Policy knobs (route layer, off-chain):** per-API-key deposit/withdraw limits, jurisdiction allowlists, choice of ASP. These never gate the contract — they're operator policy on the convenience layer.

---

## 7. Route service (L3) — API + indexer + relayer

Next.js (route handlers) + a background indexer. Postgres via Prisma. Deployed on Railway (`prisma migrate deploy` at start, not build; `PORT` injected). Auth: per-agent API keys (`Authorization: Bearer`), rate-limited.

### Indexer
Subscribes to `HestiaPool` events → reconstructs the commitment tree, stores leaves + nullifiers + encrypted note ciphertexts, mirrors ASP roots. Source of truth is always the chain; the DB is a cache/index.

### Endpoints (`/api/v1`)
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/pool/state` | tree root(s), depth, leaf count, fees, supported tokens, verifier addrs |
| `GET` | `/tree/proof?leaf=<index>` | Merkle path to a commitment (for proof gen) |
| `GET` | `/association/root?asp=<id>` | current approved root + metadata |
| `GET` | `/association/proof?label=<l>&asp=<id>` | membership path for a label |
| `GET` | `/notes/scan?since=<block>` | encrypted note ciphertexts since a block (client trial-decrypts) |
| `POST` | `/relay` | submit a signed `transact` (gas abstraction → privacy); relayer pays gas, reimbursed via `feeAmount` |
| `POST` | `/compliance/viewkey` | register/rotate a disclosure receipt |
| `GET` | `/health` | liveness + last-indexed block |

### Prisma schema (sketch)
```prisma
model Commitment   { id Int @id, leafIndex Int @unique, commitment String, block Int, txHash String, cipher Bytes }
model Nullifier    { hash String @id, block Int, txHash String }
model AspRoot      { id Int @id, asp String, root String, uri String, block Int }
model Agent        { id String @id, apiKeyHash String @unique, createdAt DateTime }
model RelayJob     { id String @id, status String, txHash String?, error String?, createdAt DateTime }
```

### Relayer
Holds a hot wallet, submits `transact` on the agent's behalf so the **recipient/withdrawal address has no gas-funding history** (the classic deanonymization vector). Reimbursed in-token via the proof-bound `feeAmount`. Alternative path: ERC-4337 + paymaster (Coinbase Smart Wallet) — noted for v2.

---

## 8. SDK (L4) — `@hestia/sdk`

TypeScript-first, `viem`-based. The single surface an agent uses whenever it touches Base.

```ts
import { Hestia } from "@hestia/sdk";
import { base } from "viem/chains";

const hestia = await Hestia.create({
  apiUrl: "https://route.hestia.xyz",
  apiKey: process.env.HESTIA_KEY,
  chain: base,
  signer,                      // viem WalletClient / account
});

await hestia.keys.derive();                               // one signature → spending + viewing keys
await hestia.shield({ token: "USDC", amount: 100_000000n });        // deposit, create note
await hestia.send({ token: "USDC", amount: 25_000000n, to });      // private transfer (to = meta-address)
await hestia.unshield({ token: "USDC", amount: 50_000000n, to: cleanAddr }); // withdraw via relayer
const bal = await hestia.balance({ token: "USDC" });               // scan + decrypt notes, sum
const vk  = hestia.exportViewingKey();                             // selective disclosure
```

**Internals:** key derivation (§3.1) → note sync (`/notes/scan` + trial-decrypt with `vk`) → coin selection → fetch Merkle + association paths → generate Groth16 proof with `snarkjs` wasm (in-process; Web/Node/edge builds) → submit via `/relay` (or direct `transact` if the agent pays its own gas).

**Agent ergonomics:** ships an optional **agent-tool adapter** (a typed tool/function schema) so an LLM agent can call `shield/send/unshield/balance` as tools. Errors are structured (`InsufficientPrivateBalance`, `AssociationProofUnavailable`, `RelayRejected`).

---

## 9. Repository layout (monorepo)

`hestia-build/` as a pnpm + Turborepo monorepo; contracts via Foundry.

```
hestia-build/
├─ packages/
│  ├─ contracts/        # Foundry — HestiaPool, AssociationSetRegistry, verifiers, tests, deploy scripts
│  ├─ circuits/         # Circom sources, build pipeline, ptau/zkey ceremony, artifacts, JS witness gen
│  ├─ sdk/              # @hestia/sdk — keys, notes, proof gen, relayer client, agent-tool adapter
│  ├─ route/            # Next.js API + indexer + relayer (Prisma/Postgres, Railway)
│  └─ common/           # shared TS — note codec, poseidon, types, meta-address (Bech32m)
├─ SPEC.md              # this document
├─ pnpm-workspace.yaml
├─ turbo.json
└─ package.json
```

*(The existing `hestia/` Next.js app is the marketing site and stays separate.)*

---

## 10. Security & threat model

| Threat | Mitigation |
|---|---|
| Double-spend | On-chain nullifier set; circuit binds nullifier to `sk` + commitment + leafIndex. |
| Forged proof | Groth16 soundness; verifier auto-generated from audited circuit; trusted-setup ceremony with public transcript. |
| Fund theft | Non-custodial contract; no admin path to the vault; verifier/ASP changes timelocked. |
| Deanonymization via gas | Relayer (or 4337 paymaster) funds withdrawal-address gas; SDK warns on self-paid withdrawals to fresh addresses. |
| Note loss | Notes recoverable from chain via `vk` (deterministic from signer); no separate backup needed. |
| Malicious route | Convenience-only; cannot steal/forge/deanonymize. Agents may self-host. Roots/paths verifiable against chain. |
| Front-run / tx malleability | `feeAmount`, `relayer`, `recipient` bound as public signals → relayer can't redirect/inflate. |
| Compliance evasion | Spends require association membership; tainted-origin funds cannot prove it. Viewing-key disclosure for audit. |
| Label → origin linkage (residual) | A note carries its deposit's `label = poseidon(leafIndex)`; a payment recipient who decrypts the note learns the public deposit it descends from. Accepted for v1 (the deposit is already public). v2: re-randomizable / nullifier-derived lineage to sever this. |
| Merge-laundering | Prevented by the single-lineage rule — a `transact` cannot combine notes from different deposits, so an unscreened deposit's value can never inherit an approved label. |

Independent audit (contracts + circuits) is a **mainnet gate**.

---

## 11. Roadmap

| Milestone | Deliverable | Done = |
|---|---|---|
| **M0** Spec & scaffold | This doc + monorepo skeleton | repo builds, packages wired |
| **M1** Circuits | `transaction.circom` (1×2, 2×2), tests, ceremony, exported verifiers | snarkjs proves/verifies; `vkey` stable |
| **M2** Contracts | HestiaPool, tree, nullifiers, vault (ETH+USDC), ASP registry; Foundry tests; Base Sepolia deploy | shield→transact→unshield passes on testnet |
| **M3** Route | Indexer → Postgres, tree/association/scan/relay endpoints, relayer | SDK can sync + relay end-to-end |
| **M4** SDK | keys, note sync/decrypt, balance, shield/send/unshield, proof gen, agent-tool adapter | e2e private payment between two agents on Base Sepolia |
| **M5** Harden | Audit, viewing-key disclosure flow, docs, mainnet | external audit clean; mainnet deploy |

**Out of scope for v1** (roadmap, not now): private *contract* interaction / private swaps, multi-asset beyond USDC+ETH, ERC-4337 paymaster path, cross-chain shielding.

---

## 12. Resolved design parameters

These were the design forks; all are now locked for v1.

| # | Parameter | Decision |
|---|---|---|
| 1 | **Label propagation** | **Single-lineage rule.** Every input of a `transact` shares one `label`; every output inherits it. No cross-deposit consolidation in v1 (the SDK hides this with label-bucketed coin selection; a payment drawing on multiple lineages is split into multiple notes/txs). Guarantees sound, one-proof-per-tx association and blocks merge-laundering. |
| 2 | **Tree depth / root window** | Commitment tree **depth 32** (≈4.3B leaves); association tree depth 32. On-chain **rolling window of 64** recent roots for each. |
| 3 | **ASP governance** | At launch **Hestia Labs runs the default ASP**, screening public `shield` events (OFAC SDN + illicit-cluster heuristics) and publishing an approved-`label` Merkle root **≥ daily and shortly after new deposits**. Registry is role-based and **multi-ASP**: third parties may publish alternative sets; agents/policies choose which `associationRoot` to prove against. Each root carries a `uri` to the published set (IPFS/HTTPS). |
| 4 | **Relayer economics** | Fee denominated in the **transacted token** (USDC or ETH), bound into the proof as `feeAmount`. `/relay` quotes `gas-in-token (oracle) + bps service fee`; the agent bakes the quote into its proof so the relayer cannot inflate or redirect. DoS protection: per-API-key rate limits + concurrent-job caps + fee floor; the relayer verifies proofs off-chain before paying gas. |
| 5 | **Circuit arities** | v1 ships **1×2** and **2×2**. `>2` inputs handled by chaining 2×2 txs. **4×4** deferred to v2. |
| 6 | **Note encryption** | **X25519 ECDH + ChaCha20-Poly1305** (libsodium `crypto_box`), off-circuit. Spending ownership stays Poseidon-only in-circuit (no EC). |

**Residual research (v2, not blocking v1):** re-randomizable lineage labels (sever the label→origin link, §10); cross-lineage consolidation with set-membership proofs; 4×4 arity; ERC-4337 paymaster path; private contract interaction / swaps; multi-asset beyond USDC + ETH.

---

*© Hestia Labs · #PrivacyByDefault · always stay private.*
