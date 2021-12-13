# Claim Against NFT

### WARNING: Unaudited Code

### IMPORTANT: Do not include the `updateFeePayoutScheme` function in `ClaimAgainstERC721WithFee.sol` unless all fee recipients trust the deployer (OpenZeppelin `owner`) of the contract.

These contracts enable arbitrary claims to be made against ERC721 tokens (by their owners), either with a fee (in ETH) or without a fee.

Claims are made against token IDs of the qualifying token address by virtue of ownership of the token ID being claimed against, the contracts do not move the NFT out of the claimant's wallet.

Only one claim can be made against each token ID, e.g. if a claim is made against token ID 10, and someone subsequently buys token ID 10 from the original claimant, the new owner will not be able to run a claim against token ID 10.

The fee variant supports having multiple addresses with different shares (denoted in basis points, i.e. 10000 = 100%) as fee recipients, for example, upon deployment, multiple addresses can be provided as fee recipients, each with their respective basis point denoted shares (e.g. with addresses [0x...1, 0x...2, 0x...3] and basis points [7000, 2000, 1000], address 0x...1 will receive 70% of the fees, address 0x...2 will receive 20% of fees and address 0x...3 will receive 10% of funds, upon initiation of fee distribution).

With the fee variant, only the original deployer of the contract (i.e. Owner), is capable of initiating the fee distribution process.

All logic should be fairly easy to adjust or repurpose for slightly different requirements, the underlying process shouldn't have to change much depending on requirements.