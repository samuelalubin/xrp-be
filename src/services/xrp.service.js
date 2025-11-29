// const xrpl = require('xrpl');
// require('dotenv').config();

// const sendXrpPayment = async (destination, amountXrp, destinationTag) => {
//   try {
//     // Connect to XRPL Testnet
//     const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
//     await client.connect();

//     // Load your wallet (sender)
//     const wallet = xrpl.Wallet.fromSeed(process.env.DEPOSIT_WALLET_SECRET);
//     const senderAddress = wallet.address;

//     // Prepare transaction
//     const prepared = await client.autofill({
//       TransactionType: 'Payment',
//       Account: wallet.classicAddress,
//       Amount: xrpl.xrpToDrops(amountXrp), // Convert XRP → drops
//       Destination: destination,
//       DestinationTag: destinationTag, // optional but important
//     });

//     // Sign transaction
//     const signed = wallet.sign(prepared);

//     // Submit and wait for validation
//     const tx = await client.submitAndWait(signed.tx_blob);

//     console.log('✅ Transaction successful!');
//     console.log('Explorer link:', `https://testnet.xrpl.org/transactions/${tx.result.hash}`);

//     await client.disconnect();
//     return tx.result;
//   } catch (error) {
//     console.error('❌ Error sending XRP:', error);
//     throw error;
//   }
// };

// module.exports = {
//   sendXrpPayment,
// };

// ____________________________________________________________________

// const xrpl = require('xrpl');

// const sendXrpPayment = async (destination, amountXRP, destinationTag) => {
//   const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233'); // XRPL testnet
//   await client.connect();

//   const wallet = xrpl.Wallet.fromSeed(process.env.DEPOSIT_WALLET_SECRET);
//   const senderAddress = wallet.address;

//   // 1️⃣ Check wallet balance
//   const accountInfo = await client.request({
//     command: 'account_info',
//     account: senderAddress,
//     ledger_index: 'validated',
//   });

//   const balanceDrops = accountInfo.result.account_data.Balance;
//   const balanceXRP = parseFloat(balanceDrops) / 1_000_000;
//   const requiredXRP = parseFloat(amountXRP);

//   if (balanceXRP < requiredXRP) {
//     await client.disconnect();
//     throw new Error(`Insufficient funds: Balance ${balanceXRP} XRP, required ${requiredXRP} XRP`);
//   }

//   // 2️⃣ Create transaction
//   const tx = {
//     TransactionType: 'Payment',
//     Account: senderAddress,
//     Amount: xrpl.xrpToDrops(amountXRP),
//     Destination: destination,
//     DestinationTag: destinationTag,
//   };

//   // 3️⃣ Sign & submit
//   const prepared = await client.autofill(tx);
//   const signed = wallet.sign(prepared);
//   const result = await client.submitAndWait(signed.tx_blob);

//   await client.disconnect();

//   // Return full XRPL response
//   return {
//     hash: result.result.tx_json.hash,
//     status: result.result.meta.TransactionResult,
//     explorer: `https://testnet.xrpl.org/transactions/${result.result.tx_json.hash}`,
//     raw: result.result,
//   };
// };

// module.exports = {
//   sendXrpPayment,
// };

// ________________________________________________________

const xrpl = require('xrpl');
const { User, Deposit } = require('../models');
const Transfer = require('../models/transfer.model');
const { getIO } = require('../socket');

/**
 * Send XRP payment after verifying user's stored balance
 * - Checks if entered amount ≤ user's totalAmount
 * - Deducts it, updates user record
 * - Sends payment to destination wallet
 */
const getXrpUsdPrice = async () => {
  // const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
  const response = await fetch('https://min-api.cryptocompare.com/data/pricemulti?fsyms=XRP&tsyms=USD');
  const data = await response.json();
  // return data.ripple.usd; // price in USD
  return data.XRP.USD; // price in USD
};
const calculateFees = async (xrpAmount) => {
  const xrpUsdPrice = await getXrpUsdPrice();

  // 0.15% fee in XRP
  const percentageFeeXrp = xrpAmount * 0.0015;
  console.log(percentageFeeXrp, 'xrpUsdPrice');

  // Minimum fee $0.95 converted to XRP
  const minFeeXrp = 0.95 / xrpUsdPrice;
  console.log(minFeeXrp, 'xrpUsdPrice');

  // Pick the larger fee
  const feeXrp = Math.max(percentageFeeXrp, minFeeXrp);
  console.log(feeXrp, 'xrpUsdPrice');
  console.log(xrpAmount - feeXrp, 'xrpUsdPrice');

  return {
    // xrpUsdPrice,
    transactionFees: feeXrp,
    buyingFees: xrpAmount - feeXrp,
    // feeInUsd: feeXrp * xrpUsdPrice
  };
};

const sendXrpPayment = async (userId, destination, amountXRP, destinationTag) => {
  // ✅ Connect to XRPL testnet
  const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
  await client.connect();

  // ✅ Load deposit wallet credentials from environment variables
  const wallet = xrpl.Wallet.fromSeed(process.env.DEPOSIT_WALLET_SECRET);
  const senderAddress = wallet.address;

  // ✅ Find the sender user in MongoDB
  const user = await User.findById(userId);
  if (!user) {
    await client.disconnect();
    throw new Error('User not found');
  }

  // ✅ Convert strings to numbers to avoid type issues
  const enteredAmount = parseFloat(amountXRP);
  const availableAmount = parseFloat(user.totalAmount);

  // ✅ Check user’s stored balance first
  if (availableAmount < enteredAmount) {
    await client.disconnect();
    throw new Error(`Insufficient stored funds: Available ${availableAmount} XRP, required ${enteredAmount} XRP`);
  }
  const { transactionFees, buyingFees } = await calculateFees(enteredAmount);

  // ✅ Deduct the amount from user’s totalAmount and totalAmountDrops
  user.totalAmount = availableAmount - enteredAmount;

  user.totalAmountDrops = user.totalAmount * 1_000_000; // convert XRP → drops
  await user.save();
  console.log(user);

  // ✅ Check on-chain XRPL wallet balance
  const accountInfo = await client.request({
    command: 'account_info',
    account: senderAddress,
    ledger_index: 'validated',
  });

  const balanceDrops = accountInfo.result.account_data.Balance;
  const balanceXRP = parseFloat(balanceDrops) / 1_000_000;

  // ✅ If XRPL wallet doesn’t have enough, revert user balance & throw error
  if (balanceXRP < enteredAmount) {
    // Revert user balance
    user.totalAmount = availableAmount;
    user.totalAmountDrops = availableAmount * 1_000_000;
    await user.save();
    await client.disconnect();
    throw new Error(`Insufficient on-chain balance: Wallet has ${balanceXRP} XRP, required ${enteredAmount} XRP`);
  }

  // ✅ Build transaction object
  const roundedXrp = Number(buyingFees.toFixed(6));

  const tx = {
    TransactionType: 'Payment',
    Account: senderAddress,
    Amount: xrpl.xrpToDrops(roundedXrp),
    Destination: destination,
    DestinationTag: destinationTag || user.destinationTag, // fallback to user's tag if not provided
  };

  // ✅ Autofill missing fields (like Fee, Sequence, etc.)
  const prepared = await client.autofill(tx);

  // ✅ Sign transaction with wallet’s private key
  const signed = wallet.sign(prepared);

  // ✅ Submit transaction to XRPL and wait for validation
  const result = await client.submitAndWait(signed.tx_blob);

  // ✅ Disconnect from XRPL client
  await client.disconnect();

  // ✅ Return transaction details
  //   return {
  //     hash: result.result.tx_json.hash,
  //     status: result.result.meta.TransactionResult,
  //     explorer: `https://testnet.xrpl.org/transactions/${result.result.tx_json.hash}`,
  //     raw: result.result,
  //   };
  //   };

  // module.exports = {
  //   sendXrpPayment,
  // };

  // ✅ Extract details from result
  //   const txHash = result.result.tx_json.hash;
  const txHash = result.result.tx_json.hash || result.result.hash;
  const txStatus = result.result.meta.TransactionResult;
  const explorerUrl = `https://testnet.xrpl.org/transactions/${txHash}`;

  // ✅ If transaction failed, revert user funds and save failed transfer
  if (txStatus !== 'tesSUCCESS') {
    user.totalAmount = availableAmount;
    user.totalAmountDrops = availableAmount * 1_000_000;
    await user.save();

    await Transfer.create({
      fromUserId: user._id,
      toAddress: destination,
      destinationTag,
      amount: enteredAmount,
      txId: txHash,
      status: 'failed',
      explorerUrl,
      rawResponse: result.result,
    });

    throw new Error(`Transaction failed with status: ${txStatus}`);
  }

  // ✅ Save successful transfer history
  await Transfer.create({
    fromUserId: user._id,
    toAddress: destination,
    destinationTag,
    amount: enteredAmount,
    txId: txHash,
    status: 'success',
    explorerUrl,
    rawResponse: result.result,
  });
  const c2 = await User.findOneAndUpdate(
    { role: 'admin' },
    { $inc: { totalAmount: transactionFees, totalAmountDrops: transactionFees * 1_000_000 } }
  );
  if (user) {
    getIO().emit(`xrpReceived${user._id}`, user);
  }
  const deposit = new Deposit({
    txId: txHash,
    userId,
    amountXRP: enteredAmount,
    amountDrops: enteredAmount * 1_000_000,
    source: process.env.DEPOSIT_WALLET_SECRET,
    destination,
    destinationTag,
    validated: true,
    raw: result.result,
    depositType: 'sent',
    transactionFees: transactionFees,
  });

  await deposit.save();
  // ✅ Return transaction details
  return {
    hash: txHash,
    status: txStatus,
    explorer: explorerUrl,
    raw: result.result,
  };
};

module.exports = {
  sendXrpPayment,
};
