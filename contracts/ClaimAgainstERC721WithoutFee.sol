//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// OpenZeppelin Contracts @ version 4.3.2
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract ClaimAgainstERC721WithoutFee {

    // Controlled variables
    uint256 private claimCountTracker;
    mapping(uint256 => uint256) public tokenIdToClaimId;
    mapping(uint256 => address) public tokenIdToClaimant;
    mapping(address => uint256[]) public claimantToTokenIds;

    event claimedAgainstTokenId(address indexed claimant, uint256 indexed tokenId, uint256 timestamp);

    // Config variables
    ERC721 qualifyingToken;
    uint256 public openingTimeUnix;
    uint256 public closingTimeUnix;

    constructor(
        address _qualifyingTokenAddress,
        uint256 _openingTimeUnix,
        uint256 _closingTimeUnix
    ) {
        qualifyingToken = ERC721(_qualifyingTokenAddress);
        openingTimeUnix = _openingTimeUnix;
        closingTimeUnix = _closingTimeUnix;
    }

    function claimAgainstTokenIds(uint256[] memory _tokenIds) public {
        require(_tokenIds.length > 0, "ClaimAgainstERC721::claimAgainstTokenIds: no token IDs provided");
        require(block.timestamp >= openingTimeUnix, "ClaimAgainstERC721::claimAgainstTokenIds: claims have not yet opened");
        require(block.timestamp < closingTimeUnix, "ClaimAgainstERC721::claimAgainstTokenIds: claims have closed");
        for(uint256 i = 0; i < _tokenIds.length; i++) {
            uint256 tokenId = _tokenIds[i];
            require(tokenIdToClaimant[tokenId] == address(0), "ClaimAgainstERC721::claimAgainstTokenIds: token with provided ID has already been claimed against");
            require(qualifyingToken.ownerOf(tokenId) == msg.sender, "ClaimAgainstERC721::claimAgainstTokenIds: msg.sender does not own specified token");
            tokenIdToClaimant[tokenId] = msg.sender;
            claimantToTokenIds[msg.sender].push(tokenId);
            emit claimedAgainstTokenId(msg.sender, tokenId, block.timestamp);
            // Do anything else that needs to happen for each tokenId here
        }
        claimCountTracker += _tokenIds.length;
        // Do anything else that needs to happen once per collection of claim(s) here
    }

    function claimCount() public view returns(uint256) {
        return claimCountTracker;
    }

    function claimantClaimCount(address _claimant) public view returns(uint256) {
        return claimantToTokenIds[_claimant].length;
    }

    function claimantToClaimedTokenIds(address _claimant) public view returns(uint256[] memory) {
        return claimantToTokenIds[_claimant];
    }

}
