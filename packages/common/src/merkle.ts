/**
 * Incremental Poseidon Merkle tree — the JS mirror of the on-chain commitment tree
 * (SPEC §3.6, §5). Must reproduce the contract's root exactly: same ZERO_VALUE, same
 * Poseidon(2), same `parent = hash(left, right)` ordering by index bit.
 */
import { getPoseidon, type Poseidon } from "./poseidon.js";
import { TREE_DEPTH } from "./constants.js";

export const DEFAULT_TREE_DEPTH = TREE_DEPTH;
export const ZERO_VALUE = 0n;

export interface MerkleProof {
  leaf: bigint;
  /** Sibling at each level, leaf -> root. */
  pathElements: bigint[];
  /** Position bit at each level: 0 = current node is left, 1 = right. */
  pathIndices: number[];
  root: bigint;
}

export class IncrementalMerkleTree {
  readonly depth: number;
  private readonly hasher: Poseidon;
  /** Precomputed all-zero subtree roots, `zeros[i]` = root of an empty depth-`i` subtree. */
  private readonly zeros: bigint[];
  /** layers[0] = leaves; layers[depth] = [root]. */
  private readonly layers: bigint[][];

  private constructor(depth: number, hasher: Poseidon) {
    this.depth = depth;
    this.hasher = hasher;
    this.zeros = [ZERO_VALUE];
    for (let i = 0; i < depth; i++) {
      const z = this.zeros[i]!;
      this.zeros.push(hasher.hash([z, z]));
    }
    this.layers = Array.from({ length: depth + 1 }, () => [] as bigint[]);
  }

  static async create(depth: number = DEFAULT_TREE_DEPTH): Promise<IncrementalMerkleTree> {
    return new IncrementalMerkleTree(depth, await getPoseidon());
  }

  get leafCount(): number {
    return this.layers[0]!.length;
  }

  get root(): bigint {
    const top = this.layers[this.depth]!;
    return top.length > 0 ? top[0]! : this.zeros[this.depth]!;
  }

  /** Append a leaf, returning its index. */
  insert(leaf: bigint): number {
    const index = this.layers[0]!.length;
    this.layers[0]!.push(leaf);
    this.recompute(index);
    return index;
  }

  private recompute(index: number): void {
    let idx = index;
    for (let level = 0; level < this.depth; level++) {
      const layer = this.layers[level]!;
      const isRight = idx & 1;
      const left = isRight ? layer[idx - 1]! : layer[idx]!;
      const right = isRight ? layer[idx]! : (layer[idx + 1] ?? this.zeros[level]!);
      const parentIdx = idx >> 1;
      this.layers[level + 1]![parentIdx] = this.hasher.hash([left, right]);
      idx = parentIdx;
    }
  }

  /** Inclusion proof for the leaf at `index`. */
  proof(index: number): MerkleProof {
    if (index < 0 || index >= this.leafCount) throw new RangeError("leaf index out of range");
    const pathElements: bigint[] = [];
    const pathIndices: number[] = [];
    let idx = index;
    for (let level = 0; level < this.depth; level++) {
      const layer = this.layers[level]!;
      const isRight = idx & 1;
      pathIndices.push(isRight);
      const siblingIdx = isRight ? idx - 1 : idx + 1;
      pathElements.push(layer[siblingIdx] ?? this.zeros[level]!);
      idx >>= 1;
    }
    return { leaf: this.layers[0]![index]!, pathElements, pathIndices, root: this.root };
  }

  /** Verify an inclusion proof against its embedded root. */
  static verify(hasher: Poseidon, proof: MerkleProof): boolean {
    let node = proof.leaf;
    for (let i = 0; i < proof.pathElements.length; i++) {
      const sibling = proof.pathElements[i]!;
      node = proof.pathIndices[i] ? hasher.hash([sibling, node]) : hasher.hash([node, sibling]);
    }
    return node === proof.root;
  }
}
