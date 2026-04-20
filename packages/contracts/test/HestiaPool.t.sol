// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./utils/Base.sol";
import {MockERC20} from "./utils/MockERC20.sol";
import {HestiaPool} from "../src/HestiaPool.sol";
import {AssociationSetRegistry} from "../src/AssociationSetRegistry.sol";
import {TransactionVerifier1x2} from "../src/verifiers/TransactionVerifier1x2.sol";
import {TransactionVerifier2x2} from "../src/verifiers/TransactionVerifier2x2.sol";

// End-to-end: a real ETH shield reproduces the off-chain root, and a real Groth16 proof
// drives an unshield (withdraw + relayer fee). Plus the compliance / safety reverts.
contract HestiaPoolTest is Base {
    HestiaPool pool;
    AssociationSetRegistry registry;
    MockERC20 usdc;
    address constant ETH = address(0);

    // fixture
    uint256 amount;
    uint256 ownerSK;
    uint256 randomness;
    uint256 fxRoot;
    uint256 assocRoot;
    uint256 withdrawAmount;
    uint256 feeAmount;
    address recipient;
    address relayer;
    uint256 nullifier0;
    uint256 outC0;
    uint256 outC1;
    uint256[2] pA;
    uint256[2][2] pB;
    uint256[2] pC;

    function setUp() public {
        address p1 = deployPoseidon("PoseidonT2");
        address p2 = deployPoseidon("PoseidonT3");
        address p5 = deployPoseidon("PoseidonT6");
        TransactionVerifier1x2 v1 = new TransactionVerifier1x2();
        TransactionVerifier2x2 v2 = new TransactionVerifier2x2();
        registry = new AssociationSetRegistry(address(this));
        usdc = new MockERC20();
        pool = new HestiaPool(32, p2, p1, p5, address(v1), address(v2), address(registry), address(usdc));

        string memory json = vm.readFile("test/fixtures/unshieldEth1x2.json");
        amount = vm.parseJsonUint(json, ".amount");
        ownerSK = vm.parseJsonUint(json, ".ownerSK");
        randomness = vm.parseJsonUint(json, ".randomness");
        fxRoot = vm.parseJsonUint(json, ".root");
        assocRoot = vm.parseJsonUint(json, ".associationRoot");
        withdrawAmount = vm.parseJsonUint(json, ".withdrawAmount");
        feeAmount = vm.parseJsonUint(json, ".feeAmount");
        recipient = vm.parseJsonAddress(json, ".recipient");
        relayer = vm.parseJsonAddress(json, ".relayer");
        nullifier0 = vm.parseJsonUint(json, ".nullifier0");
        outC0 = vm.parseJsonUint(json, ".outCommitment0");
        outC1 = vm.parseJsonUint(json, ".outCommitment1");

        uint256[] memory a = vm.parseJsonUintArray(json, ".pA");
        uint256[] memory b0 = vm.parseJsonUintArray(json, ".pB[0]");
        uint256[] memory b1 = vm.parseJsonUintArray(json, ".pB[1]");
        uint256[] memory c = vm.parseJsonUintArray(json, ".pC");
        pA = [a[0], a[1]];
        pB = [[b0[0], b0[1]], [b1[0], b1[1]]];
        pC = [c[0], c[1]];
    }

    function _shieldEth() internal {
        vm.deal(address(this), amount);
        pool.shield{value: amount}(ETH, amount, ownerSK, randomness, "");
    }
    // The on-chain shield must reproduce @hestia/common's commitment + Merkle root.
    function test_shieldEth_reproducesOffchainRoot() public {
        _shieldEth();
        assertEq(pool.getLastRoot(), fxRoot);
        assertEq(pool.nextLeafIndex(), 1);
        assertEq(address(pool).balance, amount);
    }
    function test_shieldUsdc_pullsFunds() public {
        usdc.mint(address(this), 5_000_000);
        usdc.approve(address(pool), 5_000_000);
        (uint256 leafIndex,) = pool.shield(address(usdc), 5_000_000, ownerSK, randomness, "");
        assertEq(leafIndex, 0);
        assertEq(usdc.balanceOf(address(pool)), 5_000_000);
        assertEq(pool.nextLeafIndex(), 1);
    }
}
