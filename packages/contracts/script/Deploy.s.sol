// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Vm} from "../test/utils/Vm.sol";
import {HestiaPool} from "../src/HestiaPool.sol";
import {AssociationSetRegistry} from "../src/AssociationSetRegistry.sol";
import {TransactionVerifier1x2} from "../src/verifiers/TransactionVerifier1x2.sol";
import {TransactionVerifier2x2} from "../src/verifiers/TransactionVerifier2x2.sol";

// Deterministic deploy: Poseidon (from circomlib bytecode) -> verifiers -> registry -> pool.
//   forge script script/Deploy.s.sol:Deploy                     # local simulation
//   forge script script/Deploy.s.sol:Deploy \
//     --rpc-url base_sepolia --broadcast --private-key $PK       # real deploy
// Env (optional): USDC_ADDRESS, OWNER. Defaults target Base Sepolia.
contract Deploy {
    Vm internal constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
    uint256 internal constant LEVELS = 32;
    address internal constant DEFAULT_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e; // Base Sepolia

    event Deployed(
        address poseidonT2,
        address poseidonT3,
        address poseidonT6,
        address verifier1x2,
        address verifier2x2,
        address registry,
        address pool
    );

    function _deployBytecode(bytes memory code) internal returns (address addr) {
        assembly {
            addr := create(0, add(code, 0x20), mload(code))
        }
        require(addr != address(0), "bytecode deploy failed");
    }

    function _poseidon(string memory name) internal returns (address) {
        return _deployBytecode(vm.parseBytes(vm.readFile(string.concat("test/fixtures/", name, ".hex"))));
    }

    function run() external {
        address usdc = vm.envOr("USDC_ADDRESS", DEFAULT_USDC);
        address owner = vm.envOr("OWNER", msg.sender);

        vm.startBroadcast();
        address p1 = _poseidon("PoseidonT2");
        address p2 = _poseidon("PoseidonT3");
        address p5 = _poseidon("PoseidonT6");
        address v1 = address(new TransactionVerifier1x2());
        address v2 = address(new TransactionVerifier2x2());
        AssociationSetRegistry registry = new AssociationSetRegistry(owner);
        HestiaPool pool =
            new HestiaPool(LEVELS, p2, p1, p5, v1, v2, address(registry), usdc);
        vm.stopBroadcast();

        emit Deployed(p1, p2, p5, v1, v2, address(registry), address(pool));
    }
}
