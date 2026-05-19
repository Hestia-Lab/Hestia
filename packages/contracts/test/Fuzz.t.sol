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

