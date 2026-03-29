// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Generated Groth16 verifiers (snarkjs). Public-signal counts: 1x2 -> 10, 2x2 -> 11.
interface ITransactionVerifier1x2 {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[10] calldata pubSignals
    ) external view returns (bool);
}

interface ITransactionVerifier2x2 {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[11] calldata pubSignals
    ) external view returns (bool);
}
