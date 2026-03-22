pragma circom 2.1.0;

include "transaction.circom";

// 2 inputs, 2 outputs, depth-32 trees. Two-note consolidation + change.
component main {public [root, associationRoot, withdrawAmount, token, recipient, feeAmount, relayer]} =
    Transaction(2, 2, 32);
