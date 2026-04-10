// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Association Set Providers (ASPs) publish Merkle roots of screened, approved deposit
// labels (SPEC §6). A spend proves its lineage label is in one of these roots. The
// registry only governs which association roots are accepted — it never touches funds.
contract AssociationSetRegistry {
    address public owner;
    mapping(address => bool) public isASP;
    // A root is valid once published by an ASP, until explicitly revoked (append-only set).
    mapping(uint256 => bool) public validRoot;

    event OwnerChanged(address indexed previousOwner, address indexed newOwner);
    event ASPSet(address indexed asp, bool allowed);
    event RootPublished(address indexed asp, uint256 indexed root, string uri);
    event RootRevoked(address indexed by, uint256 indexed root);

    error NotOwner();
    error NotASP();
    error ZeroRoot();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyASP() {
        if (!isASP[msg.sender]) revert NotASP();
        _;
    }

    constructor(address _owner) {
        owner = _owner;
        emit OwnerChanged(address(0), _owner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        emit OwnerChanged(owner, newOwner);
        owner = newOwner;
    }

    function setASP(address asp, bool allowed) external onlyOwner {
        isASP[asp] = allowed;
        emit ASPSet(asp, allowed);
    }

    function publishRoot(uint256 root, string calldata uri) external onlyASP {
        if (root == 0) revert ZeroRoot();
        validRoot[root] = true;
        emit RootPublished(msg.sender, root, uri);
    }

    function revokeRoot(uint256 root) external onlyOwner {
        validRoot[root] = false;
        emit RootRevoked(msg.sender, root);
    }

    function isValidRoot(uint256 root) external view returns (bool) {
        return root != 0 && validRoot[root];
    }
}
