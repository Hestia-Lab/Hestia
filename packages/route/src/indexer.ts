/**
 * Reads HestiaPool + AssociationSetRegistry events and applies them to a HestiaStore,
 * reconstructing the commitment tree, nullifier set, and approved ASP roots. The chain is
 * authoritative; calling sync() repeatedly keeps the store current.
 */
import type { Address, PublicClient } from "viem";
import { poolAbi, registryAbi } from "./abi.js";
import type { HestiaStore, Hex } from "./store.js";

interface LeafLog {
  leafIndex: number;
  commitment: bigint;
  encryptedNote: Hex;
  blockNumber: bigint;
  logIndex: number;
}

export class Indexer {
  constructor(
    private readonly client: PublicClient,
    private readonly poolAddress: Address,
    private readonly registryAddress: Address,
    readonly store: HestiaStore,
  ) {}

  /** Fetch and apply all events from the last indexed block to the chain head. */
  async sync(): Promise<void> {
    const head = await this.client.getBlockNumber();
    const fromBlock = this.store.lastBlock === 0n ? 0n : this.store.lastBlock + 1n;
    if (fromBlock > head) return;

    const [shields, commitments, nullifieds, rootsPublished, rootsRevoked] = await Promise.all([
      this.client.getContractEvents({ address: this.poolAddress, abi: poolAbi, eventName: "Shield", fromBlock, toBlock: head }),
      this.client.getContractEvents({ address: this.poolAddress, abi: poolAbi, eventName: "Commitment", fromBlock, toBlock: head }),
      this.client.getContractEvents({ address: this.poolAddress, abi: poolAbi, eventName: "Nullified", fromBlock, toBlock: head }),
      this.client.getContractEvents({ address: this.registryAddress, abi: registryAbi, eventName: "RootPublished", fromBlock, toBlock: head }),
      this.client.getContractEvents({ address: this.registryAddress, abi: registryAbi, eventName: "RootRevoked", fromBlock, toBlock: head }),
    ]);

    // Both Shield and Commitment insert a leaf; order them by leafIndex (= insertion order).
    const leaves: LeafLog[] = [];
    for (const e of shields) {
      leaves.push({
        leafIndex: Number(e.args.leafIndex),
        commitment: e.args.commitment as bigint,
        encryptedNote: e.args.encryptedNote as Hex,
        blockNumber: e.blockNumber ?? 0n,
        logIndex: e.logIndex ?? 0,
      });
    }
    for (const e of commitments) {
      leaves.push({
        leafIndex: Number(e.args.leafIndex),
        commitment: e.args.commitment as bigint,
        encryptedNote: e.args.encryptedNote as Hex,
        blockNumber: e.blockNumber ?? 0n,
        logIndex: e.logIndex ?? 0,
      });
    }
    leaves.sort((a, b) => a.leafIndex - b.leafIndex);
    for (const leaf of leaves) {
      this.store.applyCommitment(leaf.commitment, leaf.leafIndex, leaf.encryptedNote, leaf.blockNumber);
    }

    for (const e of nullifieds) this.store.applyNullifier(e.args.nullifier as bigint);
    for (const e of rootsPublished) this.store.applyAspRoot(e.args.root as bigint, (e.args.uri as string) ?? "");
    for (const e of rootsRevoked) this.store.revokeAspRoot(e.args.root as bigint);

    this.store.lastBlock = head;
  }
}
