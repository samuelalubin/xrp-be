// services/xrpMemecoin.service.js
const xrpl = require('xrpl');

// Connect to Testnet
// const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
const client = new xrpl.Client('wss://s1.ripple.com');

async function buyMemecoin(seed, memecoinIssuer, memecoinCode, xrpAmount) {
  await client.connect();
  const wallet = xrpl.Wallet.fromSeed(seed);
  const accountInfo = await client.request({
    command: 'account_info',
    account: wallet.classicAddress,
  });

  console.log(`Buying ${memecoinCode} from ${memecoinIssuer} using ${xrpAmount} XRP`);

  // 1️⃣ Ensure trust line
  const trustlineTx = {
    TransactionType: 'TrustSet',
    Account: wallet.classicAddress,
    LimitAmount: {
      currency: memecoinCode,
      issuer: memecoinIssuer,
      value: '1000000000', // arbitrary large trust limit
    },
  };
  const preparedTrust = await client.autofill(trustlineTx);
  const signedTrust = wallet.sign(preparedTrust);
  await client.submitAndWait(signedTrust.tx_blob);

  // 2️⃣ Create Offer (Buy Memecoin)
  const offerTx = {
    TransactionType: 'OfferCreate',
    Account: wallet.classicAddress,
    TakerPays: xrpl.xrpToDrops(xrpAmount), // spend XRP
    TakerGets: {
      currency: memecoinCode,
      issuer: memecoinIssuer,
      value: '1000', // quantity you want to buy
    },
  };

  const preparedOffer = await client.autofill(offerTx);
  const signedOffer = wallet.sign(preparedOffer);
  const result = await client.submitAndWait(signedOffer.tx_blob);

  await client.disconnect();
  return result;
}

module.exports = { buyMemecoin };

// const xrpl = require('xrpl');

// // Connect once globally
// const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');

// // Convert XRP to drops helper
// const toDrops = (xrp) => xrpl.xrpToDrops(xrp);

// // Simulate a platform/network fee (you can change this)
// const PLATFORM_FEE_PERCENT = 0.25; // 0.25% fee

// /**
//  * Execute a memecoin trade (buy or sell)
//  */
// async function executeTrade(seed, tokenSymbol, issuer, amount, type = 'buy') {
//   await client.connect();
//   const wallet = xrpl.Wallet.fromSeed(seed);

//   console.log(`\n[${type.toUpperCase()}] ${amount} ${type === 'buy' ? 'XRP' : tokenSymbol}`);

//   // ✅ 1. Ensure trustline (for buy only)
//   if (type === 'buy') {
//     const trustlineTx = {
//       TransactionType: 'TrustSet',
//       Account: wallet.classicAddress,
//       LimitAmount: {
//         currency: tokenSymbol,
//         issuer,
//         value: '1000000000',
//       },
//     };
//     const preparedTrust = await client.autofill(trustlineTx);
//     const signedTrust = wallet.sign(preparedTrust);
//     await client.submitAndWait(signedTrust.tx_blob);
//   }

//   // ✅ 2. Create offer (Buy or Sell)
//   const offerTx =
//     type === 'buy'
//       ? {
//           TransactionType: 'OfferCreate',
//           Account: wallet.classicAddress,
//           TakerPays: toDrops(amount), // spend XRP
//           TakerGets: { currency: tokenSymbol, issuer, value: '1000' }, // tokens bought (can be dynamic)
//         }
//       : {
//           TransactionType: 'OfferCreate',
//           Account: wallet.classicAddress,
//           TakerPays: { currency: tokenSymbol, issuer, value: amount.toString() }, // tokens to sell
//           TakerGets: toDrops(1), // receive 1 XRP (you can adjust for market logic)
//         };

//   const preparedOffer = await client.autofill(offerTx);
//   const signedOffer = wallet.sign(preparedOffer);
//   const result = await client.submitAndWait(signedOffer.tx_blob);

//   await client.disconnect();

//   // ✅ 3. Calculate tokenAmount and price per token (simulation for demo)
//   const tokenAmount = type === 'buy' ? 1000 : amount;
//   const pricePerToken = type === 'buy' ? amount / tokenAmount : 1 / tokenAmount;
//   const buyingFees = (amount * PLATFORM_FEE_PERCENT) / 100;

//   return {
//     resultCode: result.result.meta.TransactionResult,
//     txHash: result.result.hash,
//     tokenAmount,
//     pricePerToken,
//     buyingFees,
//   };
// }

// module.exports = { executeTrade };
