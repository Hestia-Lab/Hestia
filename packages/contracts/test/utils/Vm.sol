// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Minimal Foundry cheatcode interface — only what these tests use. Avoids a forge-std
/// dependency (the soldeer/git registries are unreachable in this environment).
interface Vm {
    function readFile(string calldata path) external view returns (string memory);
    function parseBytes(string calldata data) external pure returns (bytes memory);
    function parseJsonUint(string calldata json, string calldata key) external pure returns (uint256);
    function parseJsonUintArray(string calldata json, string calldata key) external pure returns (uint256[] memory);
    function parseJsonAddress(string calldata json, string calldata key) external pure returns (address);
    function assume(bool condition) external pure;
    function expectRevert() external;
    function expectRevert(bytes4 revertData) external;
    function prank(address sender) external;
    function startPrank(address sender) external;
    function stopPrank() external;
    function deal(address to, uint256 give) external;
    function addr(uint256 privateKey) external pure returns (address);
    function label(address account, string calldata newLabel) external;
    function startBroadcast() external;
    function startBroadcast(address signer) external;
    function stopBroadcast() external;
    function envOr(string calldata name, address defaultValue) external view returns (address);
}
