# Lethe

> The agent's shielded memory. Built on Hestia. Settling to Base.
> An agent should reveal nothing: not its funds, not its links, not its mind.

Hestia hid an agent's **funds**. Lethe hides an agent's **mind**, positions, strategy, counterparties, and the history of its decisions, as a commitment that moves only under proven rules and opens only to the agent's own audit key.

This repo holds the design. The cryptographic core is a direct extension of Hestia's verified primitives (see the PoC); the inter-agent channel and live e2e are the primary remaining build.

## Documents

- **[docs/WHITEPAPER.md](docs/WHITEPAPER.md)**, the full design (model, circuits, channel, threat model, roadmap).
- **[spec/SPEC.md](spec/SPEC.md)**, implementation-faithful spec (state note, circuits, contracts, SDK, invariants).
- **[docs/LAUNCH.md](docs/LAUNCH.md)**, launch copy and the Hestia+Lethe lineup.
- **[spec/poc.mjs](spec/poc.mjs)**, proves the state-note commitment/nullifier/transition compute on Hestia's exact Poseidon core.

## The idea in one screen

An autonomous agent on a public chain *is* its on-chain state. Its open positions are its strategy; its transfers are its policy; its balance is its reservation price. As agents multiply on Base, they read, copy, front-run, and hunt each other in real time.

Lethe gives an agent a private memory:

- **Remember privately**, memory is a `poseidon` commitment in a Merkle tree, not a public variable. It only moves under a proven, well-formed transition (epoch advances by one; the rule relating old to new state is a circuit constraint). No one reads it without the agent's `vk`.
- **Prove without showing**, prove a property of hidden state (threshold, range, membership, equality, freshness) in zero knowledge. The fact crosses; the memory stays.
- **Negotiate with hidden hands**, two agents settle a deal against each other's hidden state, each proving its half against a shared `dealTag`. Neither reads the other's mind. The proof is the trust.
- **One key for the whole agent**, the same Hestia viewing key audits the agent's funds *and* its memory. No master key, no global view.

## Lineup (one story)

```
Hestia   the agent's shielded wallet      hides what it owns     funds · links
Lethe    the agent's shielded memory      hides what it knows    state · strategy · mind
```

One identity. One viewing key. An agent that works without working naked.

## Reuse (what comes from Hestia, unchanged)

Lethe imports `@hestia/common`, field, Poseidon, note encoders, keys, X25519 encryption, Merkle, and points them at agent *state* instead of value. `stateCommitment = poseidon([owner, slot, payload, epoch, randomness])` is the same arity-5 shape as a Hestia note; `stateNullifier = poseidon([commitment, leafIndex, sk])` is Hestia's nullifier verbatim. See [spec/poc.mjs](spec/poc.mjs) for the running proof.

## Status

Design and proof stage. The cryptographic core is a tested extension of Hestia's verified primitives: the state-note commitment, nullifier, and a real transition compute on Hestia's exact Poseidon hasher, imported as a workspace dependency (see [spec/poc.mjs](spec/poc.mjs)). The circuits, contracts, SDK, and the two-agent channel are specified and in progress.

## Links

- Whitepaper: [docs/WHITEPAPER.md](docs/WHITEPAPER.md)
- Spec: [spec/SPEC.md](spec/SPEC.md)
- Reuse proof: [spec/poc.mjs](spec/poc.mjs)
- Repo: [github.com/Hestia-Lab/Hestia](https://github.com/Hestia-Lab/Hestia) (`packages/lethe`)

---

*Lethe · built on Hestia · #PrivacyByDefault*
