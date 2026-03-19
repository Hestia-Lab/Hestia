pragma circom 2.1.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";
include "merkleInclusion.circom";

// The Hestia join-split (SPEC §4). Covers send (withdrawAmount = 0) and unshield
// (withdrawAmount > 0). Shield is proof-less (SPEC §5).
//
//   nIns  inputs spent, nOuts outputs created, Merkle trees of the given depth.
//   - ownership:        owner_i == poseidon([sk])
//   - nullifier:        nullifier_i = poseidon([commitment_i, leafIndex_i, sk])
//   - state membership: each input commitment is in the tree under `root`
//   - compliance:       the shared label is in the association set under `associationRoot`
//   - single-lineage:   every input shares one label; every output inherits it
//   - conservation:     Σ inValue == Σ outValue + withdrawAmount + feeAmount
template Transaction(nIns, nOuts, depth) {
    // ----- public inputs -----
    signal input root;
    signal input associationRoot;
    signal input withdrawAmount;
    signal input token;
    signal input recipient;
    signal input feeAmount;
    signal input relayer;

    // ----- private inputs -----
    signal input sk;
    signal input inValue[nIns];
    signal input inOwner[nIns];
    signal input inLabel[nIns];
    signal input inRandomness[nIns];
    signal input inLeafIndex[nIns];
    signal input inPathElements[nIns][depth];
    signal input inPathIndices[nIns][depth];
    signal input associationPathElements[depth];
    signal input associationPathIndices[depth];
    signal input outValue[nOuts];
    signal input outOwner[nOuts];
    signal input outRandomness[nOuts];

    // ----- public outputs -----
    signal output nullifiers[nIns];
    signal output outCommitments[nOuts];

    // SK = poseidon([sk]) — the public spending key the input notes are owned by.
    component skPub = Poseidon(1);
    skPub.inputs[0] <== sk;

    component inComm[nIns];
    component inMt[nIns];
    component nf[nIns];
    component inRange[nIns];

    var sumIn = 0;
    for (var i = 0; i < nIns; i++) {
        // ownership
        inOwner[i] === skPub.out;

        // value range (< 2^248) to keep the sum well below the field modulus
        inRange[i] = Num2Bits(248);
        inRange[i].in <== inValue[i];

        // commitment = poseidon([value, token, owner, label, randomness])
        inComm[i] = Poseidon(5);
        inComm[i].inputs[0] <== inValue[i];
        inComm[i].inputs[1] <== token;
        inComm[i].inputs[2] <== inOwner[i];
        inComm[i].inputs[3] <== inLabel[i];
        inComm[i].inputs[4] <== inRandomness[i];

        // state membership
        inMt[i] = MerkleInclusion(depth);
        inMt[i].leaf <== inComm[i].out;
        for (var d = 0; d < depth; d++) {
            inMt[i].pathElements[d] <== inPathElements[i][d];
            inMt[i].pathIndices[d] <== inPathIndices[i][d];
        }
        inMt[i].root === root;

        // nullifier = poseidon([commitment, leafIndex, sk])
        nf[i] = Poseidon(3);
        nf[i].inputs[0] <== inComm[i].out;
        nf[i].inputs[1] <== inLeafIndex[i];
        nf[i].inputs[2] <== sk;
        nullifiers[i] <== nf[i].out;

        // single-lineage: every input shares the first input's label
        inLabel[i] === inLabel[0];

        sumIn += inValue[i];
    }

    // compliance: the shared label is a member of the association set
    component assoc = MerkleInclusion(depth);
    assoc.leaf <== inLabel[0];
    for (var d = 0; d < depth; d++) {
        assoc.pathElements[d] <== associationPathElements[d];
        assoc.pathIndices[d] <== associationPathIndices[d];
    }
    assoc.root === associationRoot;

    // outputs inherit the shared label
    component outComm[nOuts];
    component outRange[nOuts];
    var sumOut = 0;
    for (var j = 0; j < nOuts; j++) {
        outRange[j] = Num2Bits(248);
        outRange[j].in <== outValue[j];

        outComm[j] = Poseidon(5);
        outComm[j].inputs[0] <== outValue[j];
        outComm[j].inputs[1] <== token;
        outComm[j].inputs[2] <== outOwner[j];
        outComm[j].inputs[3] <== inLabel[0];
        outComm[j].inputs[4] <== outRandomness[j];
        outCommitments[j] <== outComm[j].out;

        sumOut += outValue[j];
    }

    // range-check the public amounts
    component wRange = Num2Bits(248);
    wRange.in <== withdrawAmount;
    component fRange = Num2Bits(248);
    fRange.in <== feeAmount;

    // value conservation
    sumIn === sumOut + withdrawAmount;

    // bind otherwise-unused public inputs so they cannot be tampered post-proof
    signal recipientSq;
    recipientSq <== recipient * recipient;
    signal relayerSq;
    relayerSq <== relayer * relayer;
}
