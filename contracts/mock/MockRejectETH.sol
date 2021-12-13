// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockRejectETH {
  receive() external payable {
    require(msg.value == 0, "MockRejectETH: No payments allowed");
  }
}