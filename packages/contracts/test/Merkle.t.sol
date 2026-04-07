// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./utils/Base.sol";
import {MerkleTreeWithHistory} from "../src/MerkleTreeWithHistory.sol";

// Exposes the internal _insert for testing.
contract MerkleHarness is MerkleTreeWithHistory {
    constructor(uint256 _levels, address _hasher) MerkleTreeWithHistory(_levels, _hasher) {}

    function insert(uint256 leaf) external returns (uint256) {
        return _insert(leaf);
    }
}

// The on-chain tree must reproduce @hestia/common's IncrementalMerkleTree (frozen fixtures).
contract MerkleTest is Base {
    uint256 constant COMMITMENT_FIXED =
        9152441458335379777787960014398893267669350046364461180425247781037444832192;
    uint256 constant EMPTY_ROOT_32 =
        21443572485391568159800782191812935835534334817699172242223315142338162256601;
    uint256 constant ROOT_AFTER_3 =
        11618927440053568898380639301824616197959519824639868298383077096496084375088;

    function _tree() internal returns (MerkleHarness) {
        return new MerkleHarness(32, deployPoseidon("PoseidonT3"));
    }

    function test_emptyRoot_matchesCommon() public {
        assertEq(_tree().getLastRoot(), EMPTY_ROOT_32);
    }

    function test_rootAfterInserts_matchesCommon() public {
        MerkleHarness t = _tree();
        t.insert(COMMITMENT_FIXED);
        t.insert(111);
        t.insert(222);
        assertEq(t.getLastRoot(), ROOT_AFTER_3);
        assertTrue(t.isKnownRoot(ROOT_AFTER_3));
        assertFalse(t.isKnownRoot(12345));
    }
}
