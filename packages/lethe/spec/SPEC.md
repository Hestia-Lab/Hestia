# Lethe — Technical Specification

> Implementation-faithful spec for the Lethe shielded-state layer.
> Companion to the Whitepaper. This document is the source of truth where circuits, contracts, and SDK touch the same value.

**Built on:** `@hestia/common` (field, Poseidon, note encoders, keys, encryption, Merkle) — reused unchanged.
**Chain:** Base (OP Stack). **Proofs:** Circom + Groth16 / BN254. **Contracts:** Solidity ^0.8.24 (Foundry). **SDK:** TypeScript (isomorphic).

---

## 0. Reuse contract (what comes from Hestia, unchanged)

Lethe MUST NOT re-implement any of the following; it imports them from `@hestia/common` so the cross-component invariant holds:

| Primitive | Hestia source | Lethe use |
|---|---|---|
| `F_p`, `assertField`, `toField`, `randomFieldElement` | `field.ts` | all state-note fields |
| `poseidon([...])` (circomlib hasher, byte-identical on/off chain) | `poseidon.ts` | state commitment & nullifier |
| `deriveKeysFromSeed` → `{ sk, SK, vk, VK }` | `keys.ts` | agent identity, ownership, disclosure |
| `encryptNote` / `decryptNote` (X25519 + ChaCha20-Poly1305) | `encryption.ts` | state-note pre-image ciphertexts |
| `IncrementalMerkleTree` (fixed depth, rolling roots) | `merkle.ts` | the state tree |

**Invariant (security-critical):** Poseidon arity & constants, tree `LEVELS`, the `ZERO` leaf, node ordering, and public-signal order are identical across circuit, contract, and SDK. Any divergence is a soundness/liveness bug. Lethe extends Hestia's existing conformance fixtures rather than introducing its own constants.

---

## 1. State note

```
stateNote = { owner, slot, payload, epoch, randomness }    // all ∈ F_p

COMMITMENT_ARITY = 5    // identical to Hestia
stateCommitment = poseidon([owner, slot, payload, epoch, randomness])
```

- `owner`   = agent's public spending key `SK = poseidon([sk])`.
- `slot`    = namespace tag, e.g. `poseidon([utf8("position")])`. Lets one agent hold many independent memory slots in one tree.
- `payload` = the memory. For a scalar: the value itself. For structured memory: `payload = poseidon([f1, f2, ...])`, with the pre-image kept off-chain and openable selectively.
- `epoch`   = monotonic per-slot counter (starts at 0). A transition sets `epoch_out = epoch_in + 1`.
- `randomness` = fresh `randomFieldElement()` per note; blinds equal payloads.

```
NULLIFIER_ARITY = 3    // identical to Hestia
stateNullifier = poseidon([stateCommitment, leafIndex, sk])
```

A state note is **spent** (nullified) to be replaced; it is never edited in place.

---

## 2. Circuits

All circuits are Circom 2.x, proved with Groth16 (snarkjs), verifier exported to Solidity. Artifacts per circuit: `*.wasm`, `*.zkey`, `*.vkey.json`, `Verifier*.sol`.

### 2.1 `transition.circom` (default arity 1→1)

**Public signals (exact order — circuit, verifier, contract must agree):**
```
[ stateRoot, inNullifier, outCommitment, transitionTag ]
```
**Private witness:** `sk`; input note `(slot, payload_in, epoch_in, randomness_in, leafIndex)`; Merkle path of `inCommitment` to `stateRoot`; output note `(payload_out, randomness_out)`; rule parameters bound by `transitionTag`.

**Constraints:**
1. `owner_in == poseidon([sk])`.
2. `inCommitment == poseidon([owner_in, slot, payload_in, epoch_in, randomness_in])`.
3. Merkle inclusion of `inCommitment` under `stateRoot`.
4. `inNullifier == poseidon([inCommitment, leafIndex, sk])`.
5. `outCommitment == poseidon([owner_in, slot, payload_out, epoch_in + 1, randomness_out])` — same owner, same slot, epoch advanced by exactly 1.
6. **Transition rule R**: `R(payload_in, payload_out, params) == 1`, where R is selected and parameterised by `transitionTag` (see §2.3). Range-check any numeric payload to 248 bits (Hestia discipline) to prevent field overflow.
7. `transitionTag` is bound (squared) so a captured proof cannot be re-aimed at another rule/params.

Higher arities `2→1` (merge two slots) and `1→2` (fork a slot) follow the same template with per-input ownership/nullifier/inclusion and per-output well-formedness; merges require equal `slot`/`owner`, forks copy them.

### 2.2 Selective predicate circuits (`predicate/*.circom`)

Each takes public `[ stateRoot, predicateTag, claim ]` and private `(sk, slot, payload, epoch, randomness, leafIndex, merklePath)`, and proves `inclusion ∧ ownership ∧ P(payload, claim) == 1` for predicate `P`, revealing only that `P` holds:

| Circuit | P |
|---|---|
| `threshold.circom` | `payload ≥ claim` (248-bit range) |
| `range.circom` | `claim.lo ≤ payload ≤ claim.hi` |
| `membership.circom` | `payload ∈ set`, via Merkle inclusion of `payload` in an auxiliary set tree under `claim` (the set root) |
| `equality.circom` | `payload == claim` |
| `freshness.circom` | `epoch == claim` (prove current, not stale) |

`predicateTag` binds the verifier/context so a predicate proof cannot be replayed in a different setting.

### 2.3 Transition rules (R)

`transitionTag = poseidon([ruleId, param_1, ..., param_k])`. `ruleId` selects a constraint compiled into the circuit; v1 ships:
- `R_SET_DELTA`: `payload_out == payload_in + signedDelta` (param: `signedDelta`), 248-bit checked — the workhorse for balance/position memory.
- `R_BOUND`: `payload_out` only valid if `lo ≤ payload_out ≤ hi` (params: `lo, hi`) — enforce a policy bound on the new state.
- `R_FREEZE`: `payload_out == payload_in` (advance epoch without changing memory) — used to prove freshness or to checkpoint.

Applications compose these; new rules are added as new `ruleId`s with their own constraint and a regenerated verifier.

---

## 3. Contracts (Foundry)

### 3.1 `StateRegistry.sol` — the state tree

```solidity
function transition(Proof calldata p, TransitionData calldata d) external; // spend + insert successor
function isKnownStateRoot(uint256 root) external view returns (bool);
mapping(uint256 => bool) public stateNullifierSpent;
```
- Holds an incremental Poseidon Merkle tree (same `LEVELS` and rolling-root window as Hestia's commitment tree).
- `transition`: reconstructs the public signals `[stateRoot, inNullifier, outCommitment, transitionTag]`, verifies the Groth16 proof, checks `stateRoot` is a known recent root and `inNullifier` is unspent, marks it spent, inserts `outCommitment`, and emits the encrypted successor ciphertext for the agent's own re-sync. **Effects before interactions**; no value moves here.
- Non-custodial and self-contained: `StateRegistry` never holds funds. Value legs (if any) route through Hestia.

### 3.2 `PredicateVerifier.sol` (library / per-predicate verifiers)

Generated Groth16 verifiers for each predicate circuit; a consuming contract calls `verifyThreshold(proof, stateRoot, claim)` etc. and gates its own logic on the boolean.

### 3.3 `AgentChannel.sol` — two-agent settlement

```solidity
function settle(
  Proof calldata proofA, Proof calldata proofB,
  ChannelDeal calldata deal     // dealTag, agentA SK, agentB SK, terms, expiry, nonce
) external;
```
- Verifies **both** agents' proofs against the same `dealTag`, requires both state nullifiers unspent and both state roots known, then commits both successor states atomically. Reverts unless both sides prove their half of the deal. Optional value leg calls into Hestia's `transact` with the deal's amounts so funds and state move in one settlement.

---

## 4. SDK (`@lethe/sdk`)

Reuses `@hestia/common` and mirrors Hestia's SDK ergonomics.

```ts
const agent = await Lethe.create({ chain, rpcUrl, stateRegistry, channel, keys /* same Hestia keys */, artifacts });

// remember / update memory privately
await agent.write("position", value);                 // R_SET_DELTA / R_BOUND transition
const epoch = await agent.epoch("position");

// prove a property without revealing it
const proof = await agent.prove("position", { threshold: 1_000n });

// settle a hidden-hand deal with another agent
await agent.settle(otherMetaAddress, deal);           // both sides prove their half

// audit
const vk = agent.exportViewingKey();                  // same key audits Hestia funds + Lethe memory
```

Split browser-safe (Poseidon-lite, Web Crypto) / Node proving entries, identical to Hestia, so the same code runs in a Web Worker and on a server. Ships an **agent-tool adapter** (typed `write / prove / settle / read` tools) so an LLM agent calls Lethe as tools, mirroring Hestia's adapter.

---

## 5. Cross-component invariants (the checklist)

- Poseidon arity (5 for commitment, 3 for nullifier) and constants identical in circuit, on-chain hasher, SDK.
- `LEVELS`, `ZERO` leaf, node ordering identical in circuit, `StateRegistry`, SDK.
- Public-signal order (`transition`: `[stateRoot, inNullifier, outCommitment, transitionTag]`; predicates: `[stateRoot, predicateTag, claim]`) identical in circuit, exported verifier, contract call site.
- `epoch_out == epoch_in + 1` enforced in-circuit and respected by the SDK.
- 248-bit numeric-payload range enforced in-circuit and by the SDK.
- Lethe extends Hestia's conformance fixtures; it introduces no new field/hash constants.

---

## 6. Verification gate (target — mirrors Hestia)

| Suite | Coverage | Gate |
|---|---|---|
| SDK | state-note commitment/nullifier match circuit & contract; epoch monotonicity; predicate vectors | green |
| Circuits | valid transition proves & verifies; out-of-rule / forged / stale transition fails; each predicate proves & rejects | green |
| Contracts | transition → nullify → insert; double-spend rejected; predicate gating; channel requires both proofs; stale-root rejected | green |
| Live e2e (local) | two agents settle a hidden-hand deal: each proves its half, neither reads the other's payload, both states advance | green |

---

*Lethe SPEC v0.1 · built on the Hestia core · subject to change before audit.*
