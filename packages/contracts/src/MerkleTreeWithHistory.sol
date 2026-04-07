// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPoseidon2} from "./interfaces/IPoseidon.sol";

// Incremental Poseidon Merkle tree with a rolling root history. Reproduces
// @hestia/common's IncrementalMerkleTree exactly: ZERO_VALUE = 0, and at each level
// parent = poseidon([left, right]) with left/right ordered by the leaf's index bit.
contract MerkleTreeWithHistory {
    uint256 public constant ZERO_VALUE = 0;
    uint256 public constant ROOT_HISTORY_SIZE = 64;

    uint256 public immutable levels;
    IPoseidon2 public immutable hasher;

    mapping(uint256 => uint256) public filledSubtrees;
    mapping(uint256 => uint256) public zeros;
    uint256[ROOT_HISTORY_SIZE] public roots;
    uint256 public currentRootIndex;
    uint256 public nextLeafIndex;

    constructor(uint256 _levels, address _hasher) {
        require(_levels > 0, "levels out of range");
        levels = _levels;
        hasher = IPoseidon2(_hasher);

        uint256 currentZero = ZERO_VALUE;
        for (uint256 i = 0; i < _levels; i++) {
            zeros[i] = currentZero;
            filledSubtrees[i] = currentZero;
            currentZero = _hashLeftRight(currentZero, currentZero);
        }
        roots[0] = currentZero; // empty-tree root = zeros[levels]
    }

    function _hashLeftRight(uint256 left, uint256 right) internal view returns (uint256) {
        return hasher.poseidon([left, right]);
    }

    function _insert(uint256 leaf) internal returns (uint256 index) {
        index = nextLeafIndex;
        require(index < (uint256(1) << levels), "tree is full");

        uint256 currentIndex = index;
        uint256 currentHash = leaf;
        uint256 left;
        uint256 right;
        for (uint256 i = 0; i < levels; i++) {
            if (currentIndex % 2 == 0) {
                left = currentHash;
                right = zeros[i];
                filledSubtrees[i] = currentHash;
            } else {
                left = filledSubtrees[i];
                right = currentHash;
            }
            currentHash = _hashLeftRight(left, right);
            currentIndex /= 2;
        }

        uint256 newRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        currentRootIndex = newRootIndex;
        roots[newRootIndex] = currentHash;
        nextLeafIndex = index + 1;
    }

    // True if `root` is the current root or one of the last ROOT_HISTORY_SIZE roots.
    function isKnownRoot(uint256 root) public view returns (bool) {
        if (root == 0) return false;
        uint256 i = currentRootIndex;
        do {
            if (root == roots[i]) return true;
            if (i == 0) i = ROOT_HISTORY_SIZE;
            i--;
        } while (i != currentRootIndex);
        return false;
    }

    function getLastRoot() public view returns (uint256) {
        return roots[currentRootIndex];
    }
}
