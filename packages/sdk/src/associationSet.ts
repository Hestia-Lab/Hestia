/**
 * Association set provider (SPEC §6). Spends prove their lineage label is in an ASP-approved
 * Merkle root. In production the route serves this; for self-hosting / tests it's local.
 */
import { IncrementalMerkleTree, type MerkleProof, TREE_DEPTH } from "@hestia/common";

export interface AssociationProvider {
  root(): bigint | Promise<bigint>;
  proof(label: bigint): MerkleProof | Promise<MerkleProof>;
}

// A local approved-label set: the ASP screens deposits and adds their labels here, then
// publishes root() to the AssociationSetRegistry on-chain.
export class AssociationSet implements AssociationProvider {
  private readonly tree: IncrementalMerkleTree;
  private readonly index = new Map<string, number>();

  private constructor(tree: IncrementalMerkleTree) {
    this.tree = tree;
  }

  static async create(depth: number = TREE_DEPTH): Promise<AssociationSet> {
    return new AssociationSet(await IncrementalMerkleTree.create(depth));
  }

  /** Approve a deposit's label (returns its index in the set). */
  add(label: bigint): number {
    const existing = this.index.get(label.toString());
    if (existing !== undefined) return existing;
    const i = this.tree.insert(label);
    this.index.set(label.toString(), i);
    return i;
  }

  root(): bigint {
    return this.tree.root;
  }

  proof(label: bigint): MerkleProof {
    const i = this.index.get(label.toString());
    if (i === undefined) throw new Error(`label ${label} is not in the association set`);
    return this.tree.proof(i);
  }
}
