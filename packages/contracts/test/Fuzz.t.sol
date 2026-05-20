// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./utils/Base.sol";
import {MerkleTreeWithHistory} from "../src/MerkleTreeWithHistory.sol";

contract MerkleFuzzHarness is MerkleTreeWithHistory {
    constructor(uint256 _levels, address _hasher) MerkleTreeWithHistory(_levels, _hasher) {}

    function insert(uint256 leaf) external returns (uint256) {
        return _insert(leaf);
    }
}

contract FuzzTest is Base {
    address hasher;

    function setUp() public {
        hasher = deployPoseidon("PoseidonT3");
    }

    // Whatever leaves are inserted, the resulting root is always a known root and the
    // leaf count advances by one each time.
    function testFuzz_rootKnownAfterInserts(uint128 a, uint128 b, uint128 c) public {
        MerkleFuzzHarness t = new MerkleFuzzHarness(16, hasher);
        t.insert(a);
        t.insert(b);
        t.insert(c);
        assertEq(t.nextLeafIndex(), 3);
        assertTrue(t.isKnownRoot(t.getLastRoot()));
    }

    // Distinct leaf sequences (almost always) produce distinct roots, and an arbitrary value
    // is not mistaken for a known root.
    function testFuzz_unknownRootRejected(uint128 a, uint256 notARoot) public {
        MerkleFuzzHarness t = new MerkleFuzzHarness(16, hasher);
        t.insert(a);
        // Exclude the two genuinely-known roots (empty tree + after the insert) and zero.
        vm.assume(notARoot != 0 && notARoot != t.roots(0) && notARoot != t.getLastRoot());
        assertFalse(t.isKnownRoot(notARoot));
    }
}
