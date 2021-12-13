const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require('@openzeppelin/test-helpers');

describe("ClaimAgainstERC721", function () {
  let mockERC721;
  let claimAgainstERC721WithFee;
  let claimAgainstERC721WithoutFee;
  let startTime;
  let endTime;
  let fee;
  let block;
  let blockNumber;
  let incorrectFeeTooHigh;
  let incorrectFeeTooLow;
  let lastAccountBalance;
  let payoutAddresses;
  let payoutAddressBasisPoints;
  let mockRejectETH;
  beforeEach(async () => {
    // Deploy mock ERC721
    const MockERC721 = await ethers.getContractFactory("MockERC721");
    mockERC721 = await MockERC721.deploy("MOCK", "MK");
    await mockERC721.deployed();

    // Deploy mockRejectETH, an address that will reject ETH payments (so we can get 100% test coverage)
    // this allows us to test the `require(feeCutDeliverySuccess, "Fee cut delivery unsuccessful.")` line of the distributeFees function in ClaimAgainstERC721WithFee.sol
    const MockRejectETH = await ethers.getContractFactory("MockRejectETH");
    mockRejectETH = await MockRejectETH.deploy();
    await mockRejectETH.deployed();

    // Populate accounts with tokens
    let lastAccountMintQuantity = 10;
    lastAccountBalance = lastAccountMintQuantity;
    let accountCount = 0;
    const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
    for(let account of accounts) {
      accountCount++;
      if(accountCount === 100) {
        for(let i = 0; i < lastAccountMintQuantity; i++) {
          await mockERC721.connect(owner).mint(account.address);
        }
      } else {
        await mockERC721.connect(owner).mint(account.address);
      }
    }
  })
  describe("ClaimAgainstERC721WithFee", function () {
    beforeEach(async () => {
      // Deploy ClaimAgainstERC721WithFee
      try {
        const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
        blockNumber = await ethers.provider.getBlockNumber();
        block = await ethers.provider.getBlock(blockNumber);
        startTime = ethers.BigNumber.from(block.timestamp).add('900').toString(); // Adds 15 minutes to current time
        endTime = ethers.BigNumber.from(startTime).add(60 * 60 * 24).toString(); // Adds 24 hours to start time
        fee = ethers.utils.parseUnits("0.2", "ether"); // 0.2 ETH fee in wei
        multiTokenClaimFee = ethers.BigNumber.from(ethers.utils.parseUnits("0.2", "ether")).mul(lastAccountBalance); // 0.2 * lastAccountBalance ETH fee in wei
        incorrectFeeTooHigh = ethers.utils.parseUnits("0.4", "ether"); // 0.4 ETH fee in wei
        incorrectFeeTooLow = ethers.utils.parseUnits("0.1", "ether"); // 0.1 ETH fee in wei
        const ClaimAgainstERC721WithFee = await ethers.getContractFactory("ClaimAgainstERC721WithFee");
        payoutAddresses = [firstParty.address, thirdParty.address];
        payoutAddressBasisPoints = [9000, 1000]; // 90%, 10%
        claimAgainstERC721WithFee = await ClaimAgainstERC721WithFee.deploy(mockERC721.address, startTime, endTime, fee, payoutAddresses, payoutAddressBasisPoints);
        await claimAgainstERC721WithFee.deployed();
      } catch(e) {
        console.log("Error", e)
      }
    })
    context("deployment", async function () {
      it("Should revert if payoutAddresses length is zero", async function () {
        const ClaimAgainstERC721WithFee = await ethers.getContractFactory("ClaimAgainstERC721WithFee");
        await expect(ClaimAgainstERC721WithFee.deploy(mockERC721.address, startTime, endTime, fee, [], payoutAddressBasisPoints)).to.be.revertedWith("ClaimAgainstERC721::constructor: _payoutAddresses must contain at least one entry");
      });
      it("Should revert if payoutAddresses length is not equal to payoutAddressBasisPoints", async function () {
        const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
        const ClaimAgainstERC721WithFee = await ethers.getContractFactory("ClaimAgainstERC721WithFee");
        await expect(ClaimAgainstERC721WithFee.deploy(mockERC721.address, startTime, endTime, fee, [firstParty.address], payoutAddressBasisPoints)).to.be.revertedWith("ClaimAgainstERC721::constructor: each payout address must have a corresponding basis point share");
      });
      it("Should revert if individual payoutAddressBasisPoints value exceeds 10000", async function () {
        const ClaimAgainstERC721WithFee = await ethers.getContractFactory("ClaimAgainstERC721WithFee");
        await expect(ClaimAgainstERC721WithFee.deploy(mockERC721.address, startTime, endTime, fee, payoutAddresses, [10001, 0])).to.be.revertedWith("ClaimAgainstERC721::constructor: _payoutAddressBasisPoints may not contain values of 0 and may not exceed 10000 (100%)");
      });
      it("Should revert if individual payoutAddressBasisPoints value is 0", async function () {
        const ClaimAgainstERC721WithFee = await ethers.getContractFactory("ClaimAgainstERC721WithFee");
        await expect(ClaimAgainstERC721WithFee.deploy(mockERC721.address, startTime, endTime, fee, payoutAddresses, [0, 0])).to.be.revertedWith("ClaimAgainstERC721::constructor: _payoutAddressBasisPoints may not contain values of 0 and may not exceed 10000 (100%)");
      });
      it("Should revert if combined payoutAddressBasisPoints exceeds 10000", async function () {
        const ClaimAgainstERC721WithFee = await ethers.getContractFactory("ClaimAgainstERC721WithFee");
        await expect(ClaimAgainstERC721WithFee.deploy(mockERC721.address, startTime, endTime, fee, payoutAddresses, [9000, 1001])).to.be.revertedWith("ClaimAgainstERC721::constructor: _payoutAddressBasisPoints must add up to 10000 together");
      });
    });
    context("claimAgainstTokenIds(uint256[] memory _tokenIds)", async function () {
      context("revert reasons", async function () {
        it("Should not allow claims to be made before opening time", async function () {
          const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            // Check that claim was successful
            await expect(claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([tokenId], {value: fee})).to.be.revertedWith("ClaimAgainstERC721::claimAgainstTokenIds: claims have not yet opened");
          }
        })
        it("Should not allow claims to be made after end time", async function () {
          const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
          // Increase to end time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(endTime)],
          });
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            // Check that claim was successful
            await expect(claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([tokenId], {value: fee})).to.be.revertedWith("ClaimAgainstERC721::claimAgainstTokenIds: claims have closed");
          }
        })
        it("Should not allow claims to be made with no token IDs provided", async function () {
          const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            // Check that claim was successful
            await expect(claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([], {value: fee})).to.be.revertedWith("ClaimAgainstERC721::claimAgainstTokenIds: no token IDs provided");
          }
        })
        it("Should not allow claims to be made without a fee", async function () {
          const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            // Check that claim was successful
            await expect(claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([tokenId])).to.be.revertedWith("ClaimAgainstERC721::claimAgainstTokenIds: incorrect claim fee provided");
          }
        })
        it("Should not allow claims to be made with a fee that is too high", async function () {
          const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            // Check that claim was successful
            await expect(claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([tokenId], {value: incorrectFeeTooHigh})).to.be.revertedWith("ClaimAgainstERC721::claimAgainstTokenIds: incorrect claim fee provided");
          }
        })
        it("Should not allow claims to be made with a fee that is too low", async function () {
          const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            // Check that claim was successful
            await expect(claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([tokenId], {value: incorrectFeeTooLow})).to.be.revertedWith("ClaimAgainstERC721::claimAgainstTokenIds: incorrect claim fee provided");
          }
        })
        it("Should not allow claims to be made against a token ID that has already been claimed against", async function () {
          const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            await claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([tokenId], {value: fee});
            // Check that claim was successful
            expect(await claimAgainstERC721WithFee.tokenIdToClaimant(tokenId)).to.equal(account.address);
            // Try to claim against token ID again
            await expect(claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([tokenId], {value: fee})).to.be.revertedWith("ClaimAgainstERC721::claimAgainstTokenIds: token with provided ID has already been claimed against");
          }
        });
        it("Should not allow claims to be made against a token ID that isn't owned by the msg.sender", async function () {
          const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let tokenId = 101;
          for(let account of accounts) {
            tokenId--;
            // Try to claim against unowned token ID
            await expect(claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([tokenId], {value: fee})).to.be.revertedWith("ClaimAgainstERC721::claimAgainstTokenIds: msg.sender does not own specified token");
          }
        });
      });
      context("happy path", async function () {
        it("Should allow each NFT holder to claim against their NFTs", async function () {
          const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            await claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([tokenId], {value: fee});
            // Check that claim was successful
            expect(await claimAgainstERC721WithFee.tokenIdToClaimant(tokenId)).to.equal(account.address);
          }
        });
        it("Should allow each NFT holder to claim against multiple NFTs within one transaction", async function () {
          const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            if(tokenId === 100) {
              let tokenIds = [];
              for(let i = 0; i < lastAccountBalance; i++) {
                tokenIds.push(tokenId + i);
              }
              await claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds(tokenIds, {value: multiTokenClaimFee});
              // Check that claim was successful
              for(let i = 0; i < lastAccountBalance; i++) {
                expect(await claimAgainstERC721WithFee.tokenIdToClaimant(tokenId + i)).to.equal(account.address);
              }
            }
          }
        });
      });
    });
    context("claimCount()", async function () {
      it("Should start at zero", async function () {
        const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
        // Increase to opening time
        await hre.network.provider.request({
          method: "evm_setNextBlockTimestamp",
          params: [Number(startTime)],
        });
        let claimCountExpected = 0;
        expect(await claimAgainstERC721WithFee.claimCount()).to.equal(claimCountExpected);
      });
      it("Should update the claim count after each successful claim", async function () {
        const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
        // Increase to opening time
        await hre.network.provider.request({
          method: "evm_setNextBlockTimestamp",
          params: [Number(startTime)],
        });
        let tokenId = 0;
        for(let account of accounts) {
          tokenId++;
          await claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([tokenId], {value: fee});
          // Check that claim was successful
          expect(await claimAgainstERC721WithFee.tokenIdToClaimant(tokenId)).to.equal(account.address);
          expect(await claimAgainstERC721WithFee.claimCount()).to.equal(tokenId);
        }
      });
    })
    context("claimantClaimCount(address _claimant)", async function () {
      it("Should be zero for a claimant that has not claimed against any tokens", async function () {
        const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let expectedClaimCount = 0;
          for(let account of accounts) {
            expect(await claimAgainstERC721WithFee.claimantClaimCount(account.address)).to.equal(expectedClaimCount);
          }
      });
      it("Should correctly update the claimed token IDs count after claims", async function () {
        const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
        // Increase to opening time
        await hre.network.provider.request({
          method: "evm_setNextBlockTimestamp",
          params: [Number(startTime)],
        });
        let tokenId = 0;
        for(let account of accounts) {
          tokenId++;
          if(tokenId === 100) {
            let tokenIds = [];
            for(let i = 0; i < lastAccountBalance; i++) {
              tokenIds.push(tokenId + i);
            }
            await claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds(tokenIds, {value: multiTokenClaimFee});
            // Check that claim was successful
            for(let i = 0; i < lastAccountBalance; i++) {
              expect(await claimAgainstERC721WithFee.tokenIdToClaimant(tokenId + i)).to.equal(account.address);
            }
            expect(await claimAgainstERC721WithFee.claimantClaimCount(account.address)).to.equal(lastAccountBalance);
          } else {
            await claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([tokenId], {value: fee});
            expect(await claimAgainstERC721WithFee.claimantClaimCount(account.address)).to.equal(1);
          }
        }
      });
    });
    context("claimantToClaimedTokenIds(address _claimant)", async function () {
      it("Should be an empty array for a claimant that has not claimed against any tokens", async function () {
        const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let expectedClaimCount = 0;
          for(let account of accounts) {
            let result = await claimAgainstERC721WithFee.claimantToClaimedTokenIds(account.address);
            expect(result.length).to.equal(expectedClaimCount);
          }
      });
      it("Should correctly update the claimed token IDs after claims", async function () {
        const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
        // Increase to opening time
        await hre.network.provider.request({
          method: "evm_setNextBlockTimestamp",
          params: [Number(startTime)],
        });
        let tokenId = 0;
        for(let account of accounts) {
          tokenId++;
          if(tokenId === 100) {
            let tokenIds = [];
            for(let i = 0; i < lastAccountBalance; i++) {
              tokenIds.push(tokenId + i);
            }
            await claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds(tokenIds, {value: multiTokenClaimFee});
            // Check that claim was successful
            let result = await claimAgainstERC721WithFee.claimantToClaimedTokenIds(account.address);
            for(let i = 0; i < lastAccountBalance; i++) {
              expect(await claimAgainstERC721WithFee.tokenIdToClaimant(tokenId + i)).to.equal(account.address);
              expect(result[i]).to.equal(tokenId + i);
            }
            expect(await claimAgainstERC721WithFee.claimantClaimCount(account.address)).to.equal(lastAccountBalance);
          } else {
            await claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([tokenId], {value: fee});
            expect(await claimAgainstERC721WithFee.claimantClaimCount(account.address)).to.equal(1);
            let result = await claimAgainstERC721WithFee.claimantToClaimedTokenIds(account.address);
            expect(result[0]).to.equal(tokenId);
          }
        }
      });
    });
    context("distributeFees()", async function () {
      it("Should distribute funds according to the payoutAddresses & payoutAddressBasisPoints", async function () {
        const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
        // Increase to opening time
        await hre.network.provider.request({
          method: "evm_setNextBlockTimestamp",
          params: [Number(startTime)],
        });
        let tokenId = 0;
        for(let account of accounts) {
          tokenId++;
          await claimAgainstERC721WithFee.connect(account).claimAgainstTokenIds([tokenId], {value: fee});
          // Check that claim was successful
          expect(await claimAgainstERC721WithFee.tokenIdToClaimant(tokenId)).to.equal(account.address);
        }
        // Check balance of claimAgainstERC721WithFee
        let balanceOfClaimContractBeforeDistribution = await ethers.provider.getBalance(claimAgainstERC721WithFee.address);
        let balanceOfFirstPartyBeforeDistribution = await ethers.provider.getBalance(firstParty.address);
        let balanceOfThirdPartyBeforeDistribution = await ethers.provider.getBalance(thirdParty.address);
        // Run distribution
        await claimAgainstERC721WithFee.connect(owner).distributeFees();
        // Check that balance of contract is zero after distribution
        expect(await ethers.provider.getBalance(claimAgainstERC721WithFee.address)).to.equal(0);
        for(let [indexString, feeRecipient] of Object.entries(payoutAddresses)) {
          let expectedBasisPoints = payoutAddressBasisPoints[Number(indexString)];
          let expectedFeeValueForRecipient = ethers.BigNumber.from(balanceOfClaimContractBeforeDistribution).mul(expectedBasisPoints).div(10000);
          if(Number(indexString) === 0) {
            expect(await ethers.provider.getBalance(feeRecipient)).to.equal(balanceOfFirstPartyBeforeDistribution.add(expectedFeeValueForRecipient));
          } else if (Number(indexString) === 1) {
            expect(await ethers.provider.getBalance(feeRecipient)).to.equal(balanceOfThirdPartyBeforeDistribution.add(expectedFeeValueForRecipient));
          }
        }
      });
      it("Should revert if a fee cut delivery is unsuccessful", async function () {
        const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
        const ClaimAgainstERC721WithFee = await ethers.getContractFactory("ClaimAgainstERC721WithFee");
        const claimAgainstERC721WithFeeDeliveryFailure = await ClaimAgainstERC721WithFee.deploy(mockERC721.address, startTime, endTime, fee, [firstParty.address, mockRejectETH.address], payoutAddressBasisPoints);
        await claimAgainstERC721WithFeeDeliveryFailure.deployed();
        // Increase to opening time
        await hre.network.provider.request({
          method: "evm_setNextBlockTimestamp",
          params: [Number(startTime)],
        });
        let tokenId = 0;
        for(let account of accounts) {
          tokenId++;
          await claimAgainstERC721WithFeeDeliveryFailure.connect(account).claimAgainstTokenIds([tokenId], {value: fee});
          // Check that claim was successful
          expect(await claimAgainstERC721WithFeeDeliveryFailure.tokenIdToClaimant(tokenId)).to.equal(account.address);
        }
        // Run distribution
        await expect(claimAgainstERC721WithFeeDeliveryFailure.connect(owner).distributeFees()).to.be.revertedWith("ClaimAgainstERC721::distributeFees: Fee cut delivery unsuccessful");
      });
    });
    context("updateFeePayoutScheme", async function () {
      it("Should revert if payoutAddresses length is zero", async function () {
        const ClaimAgainstERC721WithFee = await ethers.getContractFactory("ClaimAgainstERC721WithFee");
        const claimAgainstERC721WithFeeUpdatePayoutScheme = await ClaimAgainstERC721WithFee.deploy(mockERC721.address, startTime, endTime, fee, payoutAddresses, payoutAddressBasisPoints);
        await claimAgainstERC721WithFeeUpdatePayoutScheme.deployed();
        await expect(claimAgainstERC721WithFeeUpdatePayoutScheme.updateFeePayoutScheme([], payoutAddressBasisPoints)).to.be.revertedWith("laimAgainstERC721::updateFeePayoutScheme: _payoutAddresses must contain at least one entry");
      });
      it("Should revert if payoutAddresses length is not equal to payoutAddressBasisPoints", async function () {
        const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
        const ClaimAgainstERC721WithFee = await ethers.getContractFactory("ClaimAgainstERC721WithFee");
        const claimAgainstERC721WithFeeUpdatePayoutScheme = await ClaimAgainstERC721WithFee.deploy(mockERC721.address, startTime, endTime, fee, payoutAddresses, payoutAddressBasisPoints);
        await claimAgainstERC721WithFeeUpdatePayoutScheme.deployed();
        await expect(claimAgainstERC721WithFeeUpdatePayoutScheme.updateFeePayoutScheme([firstParty.address], payoutAddressBasisPoints)).to.be.revertedWith("ClaimAgainstERC721::updateFeePayoutScheme: each payout address must have a corresponding basis point share");
      });
      it("Should revert if individual payoutAddressBasisPoints value exceeds 10000", async function () {
        const ClaimAgainstERC721WithFee = await ethers.getContractFactory("ClaimAgainstERC721WithFee");
        const claimAgainstERC721WithFeeUpdatePayoutScheme = await ClaimAgainstERC721WithFee.deploy(mockERC721.address, startTime, endTime, fee, payoutAddresses, payoutAddressBasisPoints);
        await claimAgainstERC721WithFeeUpdatePayoutScheme.deployed();
        await expect(claimAgainstERC721WithFeeUpdatePayoutScheme.updateFeePayoutScheme(payoutAddresses, [10001, 0])).to.be.revertedWith("ClaimAgainstERC721::updateFeePayoutScheme: _payoutAddressBasisPoints may not contain values of 0 and may not exceed 10000 (100%)");
      });
      it("Should revert if individual payoutAddressBasisPoints value is 0", async function () {
        const ClaimAgainstERC721WithFee = await ethers.getContractFactory("ClaimAgainstERC721WithFee");
        const claimAgainstERC721WithFeeUpdatePayoutScheme = await ClaimAgainstERC721WithFee.deploy(mockERC721.address, startTime, endTime, fee, payoutAddresses, payoutAddressBasisPoints);
        await claimAgainstERC721WithFeeUpdatePayoutScheme.deployed();
        await expect(claimAgainstERC721WithFeeUpdatePayoutScheme.updateFeePayoutScheme(payoutAddresses, [0, 0])).to.be.revertedWith("ClaimAgainstERC721::updateFeePayoutScheme: _payoutAddressBasisPoints may not contain values of 0 and may not exceed 10000 (100%)");
      });
      it("Should revert if combined payoutAddressBasisPoints exceeds 10000", async function () {
        const ClaimAgainstERC721WithFee = await ethers.getContractFactory("ClaimAgainstERC721WithFee");
        const claimAgainstERC721WithFeeUpdatePayoutScheme = await ClaimAgainstERC721WithFee.deploy(mockERC721.address, startTime, endTime, fee, payoutAddresses, payoutAddressBasisPoints);
        await claimAgainstERC721WithFeeUpdatePayoutScheme.deployed();
        await expect(claimAgainstERC721WithFeeUpdatePayoutScheme.updateFeePayoutScheme(payoutAddresses, [9000, 1001])).to.be.revertedWith("ClaimAgainstERC721::updateFeePayoutScheme: _payoutAddressBasisPoints must add up to 10000 together");
      });
      it("Should update payout scheme when provided valid values", async function () {
        const [owner, firstParty, thirdParty, newPayoutAddress1, newPayoutAddress2, ...accounts] = await ethers.getSigners();
        const ClaimAgainstERC721WithFee = await ethers.getContractFactory("ClaimAgainstERC721WithFee");
        const claimAgainstERC721WithFeeUpdatePayoutScheme = await ClaimAgainstERC721WithFee.deploy(mockERC721.address, startTime, endTime, fee, payoutAddresses, payoutAddressBasisPoints);
        await claimAgainstERC721WithFeeUpdatePayoutScheme.deployed();
        await expect(claimAgainstERC721WithFeeUpdatePayoutScheme.updateFeePayoutScheme([owner.address, firstParty.address, newPayoutAddress1.address, newPayoutAddress2.address], [8000, 1000, 500, 500])).to.emit(claimAgainstERC721WithFeeUpdatePayoutScheme, "UpdatedPayoutScheme");
      });
    });
  });
  describe("ClaimAgainstERC721WithoutFee", function () {
    beforeEach(async () => {
      // Deploy ClaimAgainstERC721WithoutFee
      try {
        const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
        blockNumber = await ethers.provider.getBlockNumber();
        block = await ethers.provider.getBlock(blockNumber);
        startTime = ethers.BigNumber.from(block.timestamp).add('900').toString(); // Adds 15 minutes to current time
        endTime = ethers.BigNumber.from(startTime).add(60 * 60 * 24).toString(); // Adds 24 hours to start time
        const ClaimAgainstERC721WithoutFee = await ethers.getContractFactory("ClaimAgainstERC721WithoutFee");
        claimAgainstERC721WithoutFee = await ClaimAgainstERC721WithoutFee.deploy(mockERC721.address, startTime, endTime);
        await claimAgainstERC721WithoutFee.deployed();
      } catch(e) {
        console.log("Error", e)
      }
    })
    context("claimAgainstTokenIds(uint256[] memory _tokenIds)", async function () {
      context("revert reasons", async function () {
        it("Should not allow claims to be made before opening time", async function () {
          const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            // Check that claim was successful
            await expect(claimAgainstERC721WithoutFee.connect(account).claimAgainstTokenIds([tokenId])).to.be.revertedWith("ClaimAgainstERC721::claimAgainstTokenIds: claims have not yet opened");
          }
        })
        it("Should not allow claims to be made after end time", async function () {
          const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
          // Increase to end time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(endTime)],
          });
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            // Check that claim was successful
            await expect(claimAgainstERC721WithoutFee.connect(account).claimAgainstTokenIds([tokenId])).to.be.revertedWith("ClaimAgainstERC721::claimAgainstTokenIds: claims have closed");
          }
        })
        it("Should not allow claims to be made with no token IDs provided", async function () {
          const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            // Check that claim was successful
            await expect(claimAgainstERC721WithoutFee.connect(account).claimAgainstTokenIds([])).to.be.revertedWith("ClaimAgainstERC721::claimAgainstTokenIds: no token IDs provided");
          }
        })
        it("Should not allow claims to be made against a token ID that has already been claimed against", async function () {
          const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            await claimAgainstERC721WithoutFee.connect(account).claimAgainstTokenIds([tokenId]);
            // Check that claim was successful
            expect(await claimAgainstERC721WithoutFee.tokenIdToClaimant(tokenId)).to.equal(account.address);
            // Try to claim against token ID again
            await expect(claimAgainstERC721WithoutFee.connect(account).claimAgainstTokenIds([tokenId])).to.be.revertedWith("ClaimAgainstERC721::claimAgainstTokenIds: token with provided ID has already been claimed against");
          }
        });
        it("Should not allow claims to be made against a token ID that isn't owned by the msg.sender", async function () {
          const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let tokenId = 101;
          for(let account of accounts) {
            tokenId--;
            // Try to claim against unowned token ID
            await expect(claimAgainstERC721WithoutFee.connect(account).claimAgainstTokenIds([tokenId])).to.be.revertedWith("ClaimAgainstERC721::claimAgainstTokenIds: msg.sender does not own specified token");
          }
        });
      });
      context("happy path", async function () {
        it("Should allow each NFT holder to claim against their NFTs", async function () {
          const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            await claimAgainstERC721WithoutFee.connect(account).claimAgainstTokenIds([tokenId]);
            // Check that claim was successful
            expect(await claimAgainstERC721WithoutFee.tokenIdToClaimant(tokenId)).to.equal(account.address);
          }
        });
        it("Should allow each NFT holder to claim against multiple NFTs within one transaction", async function () {
          const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let tokenId = 0;
          for(let account of accounts) {
            tokenId++;
            if(tokenId === 100) {
              let tokenIds = [];
              for(let i = 0; i < lastAccountBalance; i++) {
                tokenIds.push(tokenId + i);
              }
              await claimAgainstERC721WithoutFee.connect(account).claimAgainstTokenIds(tokenIds);
              // Check that claim was successful
              for(let i = 0; i < lastAccountBalance; i++) {
                expect(await claimAgainstERC721WithoutFee.tokenIdToClaimant(tokenId + i)).to.equal(account.address);
              }
            }
          }
        });
      });
    });
    context("claimCount()", async function () {
      it("Should start at zero", async function () {
        const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
        // Increase to opening time
        await hre.network.provider.request({
          method: "evm_setNextBlockTimestamp",
          params: [Number(startTime)],
        });
        let claimCountExpected = 0;
        expect(await claimAgainstERC721WithoutFee.claimCount()).to.equal(claimCountExpected);
      });
      it("Should update the claim count after each successful claim", async function () {
        const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
        // Increase to opening time
        await hre.network.provider.request({
          method: "evm_setNextBlockTimestamp",
          params: [Number(startTime)],
        });
        let tokenId = 0;
        for(let account of accounts) {
          tokenId++;
          await claimAgainstERC721WithoutFee.connect(account).claimAgainstTokenIds([tokenId]);
          // Check that claim was successful
          expect(await claimAgainstERC721WithoutFee.tokenIdToClaimant(tokenId)).to.equal(account.address);
          expect(await claimAgainstERC721WithoutFee.claimCount()).to.equal(tokenId);
        }
      });
    })
    context("claimantClaimCount(address _claimant)", async function () {
      it("Should be zero for a claimant that has not claimed against any tokens", async function () {
        const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let expectedClaimCount = 0;
          for(let account of accounts) {
            expect(await claimAgainstERC721WithoutFee.claimantClaimCount(account.address)).to.equal(expectedClaimCount);
          }
      });
      it("Should correctly update the claimed token IDs count after claims", async function () {
        const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
        // Increase to opening time
        await hre.network.provider.request({
          method: "evm_setNextBlockTimestamp",
          params: [Number(startTime)],
        });
        let tokenId = 0;
        for(let account of accounts) {
          tokenId++;
          if(tokenId === 100) {
            let tokenIds = [];
            for(let i = 0; i < lastAccountBalance; i++) {
              tokenIds.push(tokenId + i);
            }
            await claimAgainstERC721WithoutFee.connect(account).claimAgainstTokenIds(tokenIds);
            // Check that claim was successful
            for(let i = 0; i < lastAccountBalance; i++) {
              expect(await claimAgainstERC721WithoutFee.tokenIdToClaimant(tokenId + i)).to.equal(account.address);
            }
            expect(await claimAgainstERC721WithoutFee.claimantClaimCount(account.address)).to.equal(lastAccountBalance);
          } else {
            await claimAgainstERC721WithoutFee.connect(account).claimAgainstTokenIds([tokenId]);
            expect(await claimAgainstERC721WithoutFee.claimantClaimCount(account.address)).to.equal(1);
          }
        }
      });
    });
    context("claimantToClaimedTokenIds(address _claimant)", async function () {
      it("Should be an empty array for a claimant that has not claimed against any tokens", async function () {
        const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
          // Increase to opening time
          await hre.network.provider.request({
            method: "evm_setNextBlockTimestamp",
            params: [Number(startTime)],
          });
          let expectedClaimCount = 0;
          for(let account of accounts) {
            let result = await claimAgainstERC721WithoutFee.claimantToClaimedTokenIds(account.address);
            expect(result.length).to.equal(expectedClaimCount);
          }
      });
      it("Should correctly update the claimed token IDs after claims", async function () {
        const [owner, firstParty, thirdParty, ...accounts] = await ethers.getSigners();
        // Increase to opening time
        await hre.network.provider.request({
          method: "evm_setNextBlockTimestamp",
          params: [Number(startTime)],
        });
        let tokenId = 0;
        for(let account of accounts) {
          tokenId++;
          if(tokenId === 100) {
            let tokenIds = [];
            for(let i = 0; i < lastAccountBalance; i++) {
              tokenIds.push(tokenId + i);
            }
            await claimAgainstERC721WithoutFee.connect(account).claimAgainstTokenIds(tokenIds);
            // Check that claim was successful
            let result = await claimAgainstERC721WithoutFee.claimantToClaimedTokenIds(account.address);
            for(let i = 0; i < lastAccountBalance; i++) {
              expect(await claimAgainstERC721WithoutFee.tokenIdToClaimant(tokenId + i)).to.equal(account.address);
              expect(result[i]).to.equal(tokenId + i);
            }
            expect(await claimAgainstERC721WithoutFee.claimantClaimCount(account.address)).to.equal(lastAccountBalance);
          } else {
            await claimAgainstERC721WithoutFee.connect(account).claimAgainstTokenIds([tokenId]);
            expect(await claimAgainstERC721WithoutFee.claimantClaimCount(account.address)).to.equal(1);
            let result = await claimAgainstERC721WithoutFee.claimantToClaimedTokenIds(account.address);
            expect(result[0]).to.equal(tokenId);
          }
        }
      });
    });
  });
});