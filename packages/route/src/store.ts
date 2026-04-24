/**
 * In-memory index of pool state, reconstructed from chain events. The chain is the source
 * of truth; this is a cache that can be rebuilt by re-scanning. (Production persistence is
 * the Prisma/Postgres schema in prisma/schema.prisma — the store interface is the same shape.)
 */
import { IncrementalMerkleTree, type MerkleProof, TREE_DEPTH } from "@hestia/common";

export type Hex = `0x${string}`;

export interface IndexedNote {
  leafIndex: number;
  commitment: bigint;
  encryptedNote: Hex;
  blockNumber: bigint;
}

export class HestiaStore {
  private readonly tree: IncrementalMerkleTree;
  private readonly _notes: IndexedNote[] = [];
  private readonly nullifiers = new Set<string>();
  private readonly aspRoots = new Map<string, string>(); // root -> uri
  /** Highest block fully indexed (0 = nothing yet). */
  lastBlock = 0n;

  private constructor(tree: IncrementalMerkleTree) {
    this.tree = tree;
  }

  static async create(depth: number = TREE_DEPTH): Promise<HestiaStore> {
    return new HestiaStore(await IncrementalMerkleTree.create(depth));
  }

  /** Insert a leaf. Leaves must arrive in `leafIndex` order (the chain emits them sequentially). */
  applyCommitment(commitment: bigint, leafIndex: number, encryptedNote: Hex, blockNumber: bigint): void {
    this.tree.insert(commitment);
    this._notes.push({ leafIndex, commitment, encryptedNote, blockNumber });
  }

  applyNullifier(nullifier: bigint): void {
    this.nullifiers.add(nullifier.toString());
  }

  applyAspRoot(root: bigint, uri: string): void {
    this.aspRoots.set(root.toString(), uri);
  }

  revokeAspRoot(root: bigint): void {
    this.aspRoots.delete(root.toString());
  }

  get root(): bigint {
    return this.tree.root;
  }

  get leafCount(): number {
    return this.tree.leafCount;
  }

  proof(leafIndex: number): MerkleProof {
    return this.tree.proof(leafIndex);
  }

  isNullified(nullifier: bigint): boolean {
    return this.nullifiers.has(nullifier.toString());
  }

  isKnownAspRoot(root: bigint): boolean {
    return this.aspRoots.has(root.toString());
  }

  aspRootUri(root: bigint): string | undefined {
    return this.aspRoots.get(root.toString());
  }

  /** Encrypted note ciphertexts at or after `fromBlock` — the recipient trial-decrypts them. */
  notesSince(fromBlock: bigint): IndexedNote[] {
    return this._notes.filter((n) => n.blockNumber >= fromBlock);
  }
}
