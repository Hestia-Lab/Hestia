pragma circom 2.1.0;

include "circomlib/circuits/poseidon.circom";

// out = (s == 0) ? [in[0], in[1]] : [in[1], in[0]]. Also constrains s to be binary.
template DualMux() {
    signal input in[2];
    signal input s;
    signal output out[2];

    s * (1 - s) === 0;
    out[0] <== (in[1] - in[0]) * s + in[0];
    out[1] <== (in[0] - in[1]) * s + in[1];
}

// Recomputes the Merkle root from a leaf and its inclusion path.
// Ordering matches @hestia/common's IncrementalMerkleTree exactly:
//   pathIndices[i] == 0 -> current node is the left child  -> hash(node, sibling)
//   pathIndices[i] == 1 -> current node is the right child -> hash(sibling, node)
template MerkleInclusion(depth) {
    signal input leaf;
    signal input pathElements[depth];
    signal input pathIndices[depth];
    signal output root;

    component sel[depth];
    component h[depth];
    signal cur[depth + 1];

    cur[0] <== leaf;
    for (var i = 0; i < depth; i++) {
        sel[i] = DualMux();
        sel[i].in[0] <== cur[i];
        sel[i].in[1] <== pathElements[i];
        sel[i].s <== pathIndices[i];

        h[i] = Poseidon(2);
        h[i].inputs[0] <== sel[i].out[0];
        h[i].inputs[1] <== sel[i].out[1];
        cur[i + 1] <== h[i].out;
    }
    root <== cur[depth];
}
