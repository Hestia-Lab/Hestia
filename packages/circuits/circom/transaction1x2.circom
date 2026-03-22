pragma circom 2.1.0;

include "transaction.circom";

// 1 input, 2 outputs, depth-32 trees. Simple send / unshield with change.
component main {public [root, associationRoot, withdrawAmount, token, recipient, feeAmount, relayer]} =
    Transaction(1, 2, 32);
