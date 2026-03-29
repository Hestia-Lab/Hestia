// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Interfaces to the circomlib-generated Poseidon contracts (deployed from bytecode).
// Arities: 1 -> label, 2 -> Merkle parent, 5 -> commitment.
interface IPoseidon1 {
    function poseidon(uint256[1] calldata input) external view returns (uint256);
}

interface IPoseidon2 {
    function poseidon(uint256[2] calldata input) external view returns (uint256);
}

interface IPoseidon5 {
    function poseidon(uint256[5] calldata input) external view returns (uint256);
}
