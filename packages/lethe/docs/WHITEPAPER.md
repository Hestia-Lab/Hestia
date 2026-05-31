# Lethe

> Shielded memory for autonomous agents on Base.
> An agent should reveal nothing: not its funds, not its links, not its mind.

**Status:** `v0.1 / draft` · **Chain:** Base (L2, OP Stack) · **Built on:** the Hestia shielded-value core · **Audience:** autonomous agents and the developers who run them.

---

## Abstract

Autonomous agents that act on a public ledger expose far more than their balance. Their open state is their open mind: positions, strategy parameters, counterparties, and the history of every decision are permanently readable by anyone, including the agents they compete with. The cryptographic tools to hide a transaction graph are mature, and Hestia already applies them to an agent's funds. Lethe extends that core from *what an agent owns* to *what an agent knows*. It is a shielded state layer in which an agent's memory lives as a Poseidon commitment in a fixed-depth Merkle tree, mutated only through Groth16 join-split style transitions, and disclosed only through selective proofs the agent chooses to publish. An agent can prove a property of its state ("I hold enough to settle", "my position is within policy", "we agreed on this price") without revealing the state itself, and two agents can transact against each other's commitments without either reading the other's mind. The same viewing key that audits Hestia funds audits Lethe memory, so disclosure stays selective and backdoor-free. The cryptographic core is a direct, test-verified extension of Hestia's commitment, nullifier, key, and encryption primitives; the agent-facing SDK and the inter-agent channel are the new surface.

**Keywords:** zero-knowledge proofs, Groth16, Poseidon, shielded state, agent privacy, selective disclosure, viewing keys, Base, OP Stack.

---

## 1. Introduction

Every state an agent writes to a public chain is, by construction, a public record, and it stays public forever. For a human this leaks financial privacy. For an autonomous agent it leaks something worse: the agent *is* its on-chain state. A trading agent's open positions are its strategy. A treasury agent's transfers are its policy. A negotiating agent's balance is its reservation price. When agents are few, this is a nuisance. When agents are many, the trajectory Base is on, it is a hostile environment in which every agent can read, copy, front-run, and hunt every other agent in real time.

Hestia solved the first layer of this: an agent's funds. With Hestia, an agent holds a private balance, sends privately, and withdraws to a clean address while proving its funds descend from a screened deposit. But a private balance attached to a fully public mind is only half-shielded. An agent whose *funds* are hidden but whose *positions, parameters, and counterparties* are public is still naked where it matters.

Lethe is the second layer. It starts from a simple position: an agent should be able to remember, reason, and act on-chain without broadcasting its memory to its competitors. The relevant question is not whether an agent's state is hidden, but **what an agent can prove about its hidden state to the parties that need a guarantee**, a counterparty, a protocol, an auditor, while revealing nothing else.

### 1.1 Why this is hard, and why it is now possible

Hiding a single value is easy. Hiding *evolving state* that other parties must still reason about is not: a hidden balance is useless if no one will transact against it, and a hidden position is dangerous if it can be mutated without rules. Lethe's contribution is to make hidden state **provable and interactive**, an agent proves bounded, well-formed transitions over its own commitment, and proves selective predicates to others, without ever opening the commitment. The primitives that make this practical (Poseidon commitments, succinct Groth16 proofs, deterministic viewing keys) are exactly the ones Hestia already ships and has verified end to end. Lethe is therefore not a new cryptosystem; it is a new *application surface* over a proven one.

### 1.2 Contributions

- **A shielded state model for agents.** An agent's memory is a commitment `stateCommitment = poseidon(...)` in a fixed-depth tree, owned by the agent's spending key and mutated only by a proven transition. State is never a transparent variable in the default experience.
- **Selective state proofs.** An agent proves a predicate over its hidden state (threshold, range, membership, equality to an agreed value) without revealing the state, a strict generalisation of Hestia's "prove your funds are clean without revealing which deposit".
- **Inter-agent private channels.** Two agents settle a deal against each other's commitments, each proving it satisfies the deal's terms, without either learning the other's full state. Negotiation with hidden hands, enforced by proofs.
- **One audit key for the whole agent.** The Hestia viewing key is extended to Lethe state, so a single `vk` selectively discloses an agent's funds *and* its memory to an auditor, with no global backdoor.
- **A faithful, reuse-first specification.** Every Lethe primitive is defined in terms of Hestia's already-frozen field, Poseidon arities, Merkle depth, and key derivation, so the cross-component invariant Hestia treats as security-critical extends to Lethe unchanged.

### 1.3 The lineup, locked

Hestia and Lethe are one story told in two layers:

```
Hestia ,  the agent's shielded wallet   (hides what it owns: funds, links)
Lethe  ,  the agent's shielded memory   (hides what it knows: state, strategy, mind)

           together: an agent that works without working naked.
```

Lethe is not a second privacy pool. It does not re-implement Hestia's value layer. It reuses it, and extends the shield from the agent's funds to the agent's mind.

---

## 2. Preliminaries (inherited from Hestia)

Lethe does not introduce new low-level cryptography. It inherits, byte-for-byte, the primitives Hestia froze and verified.

### 2.1 Field and hash

All commitments, nullifiers, and Merkle nodes are elements of the BN254 scalar field `F_p`, with
```
p = 21888242871839275222246405745257275088548364400416034343698204186575808495617.
```
Hashing is Poseidon, with arity fixed per call site. The on-chain hasher is the circomlib-generated Poseidon contract, byte-identical to the hash used inside the circuits and the SDK, the same cross-component invariant Hestia enforces (Hestia SPEC §3, §4.5).

### 2.2 Keys (one signature, all keys, unchanged)

An agent derives its full key set from one signature, exactly as in Hestia:
```
sk = poseidon([toField(seed), 0])        SK = poseidon([sk])          // spending
vk = keccak256(seed ‖ 0x01)              VK = X25519(vk)              // viewing
```
The spending key authorizes state transitions and produces nullifiers; the viewing key decrypts and selectively discloses. **No new key material is introduced**, an agent that already runs Hestia runs Lethe with the same identity.

### 2.3 Incremental Merkle tree

State commitments accumulate in a fixed-depth Poseidon Merkle tree with a rolling window of recent roots, identical in construction to Hestia's commitment tree, so a proof against a slightly-stale root still verifies and proving is decoupled from the chain head.

### 2.4 Groth16

Transitions and predicates are Circom circuits proved with Groth16 over BN254: constant-size proof, constant-time on-chain verification. The development trusted setup is single-contributor and **must not secure real funds**; production requires a multi-party ceremony (§8). This is the same posture Hestia takes, flagged throughout.

---

## 3. The shielded state model

### 3.1 The state note

Hestia's note binds a *value*. Lethe's **state note** binds an agent's *memory*: a structured payload the agent commits to, owns, and mutates privately.

```
stateNote = {
  owner:      SK,          // the agent's public spending key (Hestia-identical ownership)
  slot:       F_p,         // which memory slot / namespace (e.g. "position", "policy", "scratch")
  payload:    F_p,         // the committed memory value (a field element or a Poseidon digest of structured data)
  epoch:      F_p,         // monotonic counter, prevents replaying a stale memory as current
  randomness: F_p          // blinds the commitment so equal payloads differ
}

stateCommitment = poseidon([owner, slot, payload, epoch, randomness])
```

This is deliberately the *same shape* as Hestia's `commitment = poseidon([value, token, owner, label, randomness])`, five canonical field elements, Poseidon arity 5, so the on-chain hasher, the circuit, and the SDK reuse Hestia's exact encoders. `payload` carries the memory: for a single value it is that value; for structured memory it is a Poseidon digest whose pre-image the agent keeps off-chain and can open selectively.

### 3.2 The nullifier (state is spent, not edited)

State is never mutated in place. To change memory, the agent **spends** the current state note and **creates** its successor, exactly as a UTXO is spent. The nullifier binds the spend to the agent's key and the note's position:

```
stateNullifier = poseidon([stateCommitment, leafIndex, sk])
```

published on transition; the contract rejects duplicates. This gives memory the same double-spend protection Hestia gives funds: an old memory cannot be silently reused, and a transition cannot be forged without `sk`. The monotonic `epoch` inside the commitment additionally lets a verifier require *current* state, not merely *some* state the agent once held.

### 3.3 The transition circuit

A state transition is a join-split over state notes: it consumes one (or more) input state notes and produces one (or more) output state notes under a proven rule. The default arity is 1→1 (advance one memory slot); 2→1 and 1→2 support merging and forking memory. The circuit `transition.circom` exposes the public signals

```
stateRoot           // the root the input commitment is proven against
inNullifier[nIn]     // spent state-note nullifiers
outCommitment[nOut]  // successor state-note commitments
transitionTag        // a public tag binding which rule was applied (anti-tamper, anti-front-run)
```

and enforces, for each input: ownership (`owner == poseidon([sk])`) and correct nullifier; Merkle inclusion under `stateRoot`; and for each output: a well-formed successor commitment whose `owner` is the agent's `SK` and whose `epoch` is exactly the input's `epoch + 1`. Crucially, the circuit also enforces the **transition rule** itself, an application-specified constraint relating input `payload` to output `payload` (e.g. "the new balance equals the old balance plus a signed delta", "the new position size is within a bound", "the policy field is unchanged"). The rule is what makes hidden state *safe* to others: they cannot read the memory, but they are guaranteed it only ever moved in ways the rule permits.

`transitionTag` binds the rule and any external parameters into the proof, so a captured transition proof cannot be re-aimed at a different rule or counterparty, the standard anti-front-running technique, inherited from Hestia's `feeAmount`/`relayer` binding.

---

## 4. Selective state proofs

A state transition changes memory. A **selective state proof** *reveals a property* of memory to a third party without changing or opening it. This is the direct generalisation of Hestia's association proof ("my funds descend from a clean deposit, without revealing which one").

Given a hidden `stateNote`, an agent can prove, in zero knowledge, statements of the form:

| Predicate | Example | What stays hidden |
|---|---|---|
| **Threshold** | "my balance ≥ X" | the exact balance |
| **Range** | "my position ∈ [a, b]" | the exact position |
| **Membership** | "my counterparty ∈ allowed set" | which counterparty |
| **Equality** | "my agreed price == the deal's price" | everything else in memory |
| **Freshness** | "this is my current epoch, not a stale one" | the memory itself |

Each is a small Circom circuit over the committed `payload` plus a Merkle inclusion of `stateCommitment` under a recent `stateRoot`. The verifier, a counterparty contract, another agent, or an auditor's tool, checks the proof and learns exactly the predicate's truth value and nothing more. The 248-bit range discipline Hestia uses for amounts is reused here for any numeric payload, so threshold/range predicates cannot be gamed by field overflow.

---

## 5. Inter-agent private channels

Selective proofs let an agent assert facts about *itself*. The inter-agent channel lets **two agents transact against each other's hidden state**, each proving it meets the deal's terms, neither reading the other's mind.

A channel deal is parameterised by a public `dealTag` (the terms: asset, price bounds, expiry, the two agents' public spending keys, a fresh nonce). To settle, **each agent independently produces a Groth16 proof** that:

1. it owns a current (`epoch`-fresh) state note under the shared `stateRoot`;
2. that note's hidden `payload` satisfies the agent's side of `dealTag` (e.g. buyer proves "my reservation ≥ price"; seller proves "my reservation ≤ price"), as a selective predicate (§4);
3. its resulting state transition (§3.3) correctly applies the deal's effect to its own memory (e.g. debits/credits the agreed amount), binding `dealTag` so the proof cannot be re-aimed.

The channel contract accepts the settlement only if **both** proofs verify against the same `dealTag` and neither nullifier is spent. Neither agent ever sees the other's `payload`; the only thing that crosses is the truth of "we both satisfy the terms". This is negotiation with hidden hands, enforced by proofs rather than trust, the property that distinguishes Lethe from a plain private wallet. Settlement of any *value* leg routes through Hestia (the agents are already Hestia-shielded), so funds move privately while state moves privately, under one identity.

---

## 6. Disclosure and audit (one key for the whole agent)

Privacy that cannot be audited is a liability, not a feature. Lethe inherits Hestia's answer directly: the agent's **viewing key `vk`** is the unit of selective disclosure. Each state-note ciphertext (the off-chain pre-image of a structured `payload`, plus the note's blinding fields) is encrypted to the agent's `VK` with X25519 + ChaCha20-Poly1305, exactly as Hestia encrypts note ciphertexts. Handing `vk` to an auditor (or under a court order served on the operator of the agent) reveals the agent's full memory history, and *only* that agent's. There is no master key, no global view, and no party who can read an agent's mind without being given its `vk`. The same key audits the agent's Hestia funds and its Lethe memory; disclosure is selective, voluntary at the account level, and complete when the agent chooses to give it.

---

## 7. Threat model

Lethe protects three assets: **state confidentiality** (no party reads an agent's memory without its `vk`); **state integrity** (memory only moves under proven, well-formed transitions, no forged, replayed, or out-of-rule mutation); and **interaction soundness** (a settlement binds both parties to the deal's terms or does not happen). We assume Groth16 soundness under a non-backdoored setup (single contributor in development, multi-party ceremony in production); the security of Poseidon and BN254 with the on-chain hasher equal to the circuit's; and that Hestia's value layer and Base's settlement behave to specification.

| Threat | Mitigation |
|---|---|
| Reading hidden state | State lives only as a Poseidon commitment; pre-images are encrypted to `VK`; no transparent state in the default path. |
| Forged transition | Transition circuit binds `owner == poseidon([sk])` and a valid nullifier; unforgeable without `sk`. |
| Replaying stale memory as current | Monotonic `epoch` inside the commitment; verifiers can require the current epoch; spent nullifiers cannot be reused. |
| Out-of-rule mutation | The transition rule is a circuit constraint relating input to output payload; an illegal mutation has no proof. |
| Re-aiming a captured proof | `transitionTag` / `dealTag` bind the rule, parameters, and counterparties into the statement (anti-front-running, inherited from Hestia). |
| One-sided settlement | The channel contract requires both agents' proofs against the same `dealTag`; otherwise no state moves. |
| Backdoor disclosure | No master key. Disclosure requires the agent's own `vk`; it reveals only that agent. |
| Trusted-setup compromise | Development setup is single-contributor and non-production; production gated on a multi-party ceremony (§8). |

### 7.1 Known limitations (stated plainly)

The development trusted setup is single-contributor and **must not secure real state of value**; production requires the ceremony of §8. The circuits and contracts are **unaudited**. Structured-payload disclosure (opening a Poseidon digest's pre-image selectively) and the inter-agent channel are specified here and partially implemented; full end-to-end channel settlement is the primary remaining build. And metadata privacy, when an agent transitions, from what IP, is out of scope at the protocol layer and must be handled by relayers and client behaviour. Lethe hides what an agent knows on-chain, not the network beneath it.

---

## 8. Implementation and roadmap

Lethe is built as a package set over the Hestia monorepo, reusing `@hestia/common` (field, Poseidon, note encoders, keys, encryption, Merkle) unchanged. The new surface is: the state-note encoders, the `transition` and selective-predicate circuits, the state-tree contract, and the agent-facing SDK plus inter-agent channel.

**Verification gate (target).** Every threat-model mitigation maps to a passing test, mirroring Hestia's gate: SDK conformance (state-note commitment/nullifier match circuit and contract), circuit tests (valid transition proves and verifies; out-of-rule and forged transitions fail), contract tests (transition → nullify → successor insert; double-spend rejected; channel requires both proofs), and a live local end-to-end of a two-agent hidden-state settlement.

**Roadmap to mainnet** (each step gated, exit criteria explicit):
1. **Core**, state-note encoders + `transition` circuit + state-tree contract, with the conformance gate green. (Reuses Hestia's verified core.)
2. **Selective proofs**, threshold/range/membership/equality/freshness predicate circuits.
3. **Channel**, two-agent settlement contract + SDK; live local e2e of a hidden-hand deal.
4. **Testnet**, Base Sepolia deploy; an external agent completes a full transition + selective proof + channel settlement.
5. **Ceremony**, replace the development setup with a multi-party Powers-of-Tau contribution; publish the transcript.
6. **Audit & mainnet**, external audit of circuits and contracts, fuzz + invariants, then mainnet behind a timelock with an emergency pause; verifier and Merkle parameters immutable per deployment.

---

## 9. Related work

**Shielded value.** Tornado Nova established the arbitrary-amount UTXO join-split, and Hestia adopts and extends it for agent funds with a Privacy-Pools compliance path; Lethe reuses Hestia's note/nullifier/key machinery and points it at agent *state* rather than value. **Shielded currencies.** Zerocash/Zcash pioneered note commitments and nullifiers for a private currency; Lethe occupies the same primitive space but commits *agent memory*, not coins, and adds rule-bound transitions and selective predicates. **Compliance equilibria.** Privacy Pools (Buterin et al., 2023) introduced association sets; Lethe generalises "prove a property of hidden funds" to "prove a property of hidden state". Relative to all of these, Lethe's contribution is the application: a shielded, rule-bound, selectively-provable *memory* for autonomous agents, built on a proven value core and settling to Base.

---

## 10. Conclusion

An agent that hides its funds but exposes its mind is only half-shielded. Lethe closes the gap: it gives an autonomous agent a memory that lives as a commitment, moves only under proven rules, proves what it must to whoever needs a guarantee, and opens only to the agent's own audit key. Built directly on Hestia's verified shielded-value core and settling to Base, it extends agent privacy from *what an agent owns* to *what an agent knows*. Privacy should be the default for an agent's mind, and disclosure should be the agent's own choice, not everyone else's by default.

---

*Lethe · the agent's shielded memory · built on Hestia · #PrivacyByDefault*

*Disclaimer. This document describes a research and engineering effort under active development. The development trusted setup is single-contributor and must not secure real value; the protocol is unaudited. Nothing herein is financial or legal advice.*
