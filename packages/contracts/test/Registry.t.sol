// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./utils/Base.sol";
import {AssociationSetRegistry} from "../src/AssociationSetRegistry.sol";

contract RegistryTest is Base {
    AssociationSetRegistry reg;
    address owner = address(0xA11CE);
    address asp = address(0xA59);

    function setUp() public {
        reg = new AssociationSetRegistry(owner);
    }

    function test_onlyOwnerCanSetAsp() public {
        vm.expectRevert(AssociationSetRegistry.NotOwner.selector);
        reg.setASP(asp, true);
    }

    function test_aspPublishesAndRootValidates() public {
        vm.prank(owner);
        reg.setASP(asp, true);
        vm.prank(asp);
        reg.publishRoot(123, "ipfs://set");
        assertTrue(reg.isValidRoot(123));
        assertFalse(reg.isValidRoot(456));
    }

    function test_nonAspCannotPublish() public {
        vm.expectRevert(AssociationSetRegistry.NotASP.selector);
        reg.publishRoot(1, "x");
    }

    function test_zeroRootRejected() public {
        vm.prank(owner);
        reg.setASP(asp, true);
        vm.prank(asp);
        vm.expectRevert(AssociationSetRegistry.ZeroRoot.selector);
        reg.publishRoot(0, "x");
    }

    function test_ownerCanRevoke() public {
        vm.prank(owner);
        reg.setASP(asp, true);
        vm.prank(asp);
        reg.publishRoot(7, "x");
        assertTrue(reg.isValidRoot(7));
        vm.prank(owner);
        reg.revokeRoot(7);
        assertFalse(reg.isValidRoot(7));
    }
}
