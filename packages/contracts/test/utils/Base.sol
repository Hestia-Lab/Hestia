// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Vm} from "./Vm.sol";

// Tiny test base: the Vm cheatcode handle, a few asserts, and helpers to deploy the
// circomlib-generated Poseidon bytecode from test/fixtures/*.hex via CREATE.
contract Base {
    Vm internal constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    function assertEq(uint256 a, uint256 b) internal pure {
        require(a == b, "assertEq(uint256) failed");
    }

    function assertEq(bytes32 a, bytes32 b) internal pure {
        require(a == b, "assertEq(bytes32) failed");
    }

    function assertEq(address a, address b) internal pure {
        require(a == b, "assertEq(address) failed");
    }

    function assertTrue(bool c) internal pure {
        require(c, "assertTrue failed");
    }

    function assertFalse(bool c) internal pure {
        require(!c, "assertFalse failed");
    }

    function deployBytecode(bytes memory code) internal returns (address addr) {
        assembly {
            addr := create(0, add(code, 0x20), mload(code))
        }
        require(addr != address(0), "bytecode deploy failed");
    }

    function deployPoseidon(string memory name) internal returns (address) {
        string memory hexStr = vm.readFile(string.concat("test/fixtures/", name, ".hex"));
        return deployBytecode(vm.parseBytes(hexStr));
    }
}
