# @hestia/common

Shared cryptographic foundations — the spine every other package conforms to.

Built in **P1** (see [BUILD.md](../../BUILD.md)). Will provide:

- **Poseidon** hashing (via `circomlibjs`) for commitments / nullifiers / Merkle.
- **Note model** — `commitment(note)`, `nullifier(commitment, leafIndex, sk)` (SPEC §3.2).
- **Keys** — deterministic derivation from a signer → `sk`, `SK`, X25519 `vk`/`VK` (SPEC §3.1).
- **Note encryption** — X25519 ECDH + ChaCha20-Poly1305 (SPEC §3.3).
- **Meta-address** — Bech32m codec for `hestia:base:<SK>:<VK>`.
- **Merkle (JS mirror)** — incremental Poseidon tree (depth 32) matching the contract exactly.

The golden fixtures here are the **conformance suite** for circuits (P2) and contracts (P3).
