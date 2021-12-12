//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// OpenZeppelin Contracts @ version 4.3.2
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract ClaimAgainstERC721 is Ownable {

    // Controlled variables
    using Counters for Counters.Counter;
    Counters.Counter private claimIdTracker; // First claim starts at 1 to simplify checking if a tokenId has a claim attached to it
    mapping(uint256 => uint256) public claimIdToTokenId;
    mapping(uint256 => uint256) public tokenIdToClaimId;
    mapping(uint256 => address) public claimIdToClaimant;
    mapping(address => uint256[]) public claimantToClaimIds;

    // Config variables
    ERC721 qualifyingToken;
    uint256 claimFee;
    uint256 public openingTimeUnix;
    uint256 public closingTimeUnix;

    constructor(
        address _qualifyingTokenAddress,
        uint256 _claimFee,
        uint256 _openingTimeUnix,
        uint256 _closingTimeUnix
    ) {
        qualifyingToken = ERC721(_qualifyingTokenAddress);
        claimFee = _claimFee;
        openingTimeUnix = _openingTimeUnix;
        closingTimeUnix = _closingTimeUnix;
    }

    function claimAgainstTokenIds(uint256[] memory _tokenIds) public payable {
        require(_tokenIds.length > 0, "ClaimAgainstERC721::claimAgainstTokenIds: no token IDs provided");
        require(block.timestamp >= openingTimeUnix, "ClaimAgainstERC721::claimAgainstTokenIds: claims have not yet opened");
        require(block.timestamp < closingTimeUnix, "ClaimAgainstERC721::claimAgainstTokenIds: claims have closed");
        require(msg.value == (claimFee * _tokenIds.length), "ClaimAgainstERC721::claimAgainstTokenIds: incorrect claim fee provided");
        for(uint256 i = 0; i < _tokenIds.length; i++) {
            uint256 tokenId = _tokenIds[i];
            require(qualifyingToken.ownerOf(tokenId) == msg.sender, "ClaimAgainstERC721::claimAgainstTokenIds: msg.sender does not own specified token");
            claimIdTracker.increment();
            uint256 claimId = claimIdTracker.current();
            claimIdToTokenId[claimId] = tokenId;
            tokenIdToClaimId[tokenId] = claimId;
            claimIdToClaimant[claimId] = msg.sender;
            claimantToClaimIds[msg.sender].push(claimId);
            // Do anything else that needs to happen for each tokenId here
        }
        // Do anything else that needs to happen once per collection of claim(s) here
    }

    function claimCount() public view returns(uint256) {
        return claimIdTracker.current();
    }

    function claimantClaimCount(address _claimant) public view returns(uint256) {
        return claimantToClaimIds[_claimant].length;
    }

}
