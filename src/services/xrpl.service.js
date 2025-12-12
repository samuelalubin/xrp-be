// const xrpl = require('xrpl');

// const XRPL_NETWORK = 'wss://s.altnet.rippletest.net:51233'; // XRPL Testnet
// let client;

// // ✅ Connect XRPL client once and reuse
// const connectXRPL = async () => {
//   if (!client || !client.isConnected()) {
//     client = new xrpl.Client(XRPL_NETWORK);
//     await client.connect();
//     console.log('✅ Connected to XRPL Testnet');
//   }
//   return client;
// };

// /**
//  * Estimate how many tokens a given XRP amount can buy using XRPL DEX order book
//  * @param {string} token - token symbol (e.g. MEME)
//  * @param {string} issuer - memecoin issuer address (CA)
//  * @param {number} xrpAmount - amount of XRP to spend
//  */
// const estimateBuy = async (token, issuer, xrpAmount) => {
//   const client = await connectXRPL();

//   const book = await client.request({
//     command: 'book_offers',
//     taker_gets: { currency: token, issuer }, // what we want to get
//     taker_pays: { currency: 'XRP' }, // we are paying XRP
//     limit: 10,
//   });

//   let totalTokens = 0;
//   let remainingXrpDrops = xrpl.xrpToDrops(xrpAmount);

//   for (const offer of book.result.offers) {
//     if (remainingXrpDrops <= 0) break;
//     const takerPays = parseFloat(offer.TakerPays);
//     const takerGets = parseFloat(offer.TakerGets.value);
//     const price = takerPays / takerGets;

//     const xrpToUse = Math.min(remainingXrpDrops, takerPays);
//     const tokensBought = xrpToUse / price;

//     totalTokens += tokensBought;
//     remainingXrpDrops -= xrpToUse;
//   }

//   return totalTokens;
// };

// 2nd service
// // /**
// //  * Execute a buy/sell transaction (basic)
// //  * @param {string} walletSeed - platform or test wallet seed
// //  * @param {string} token - token symbol
// //  * @param {string} issuer - issuer address
// //  * @param {number} xrpAmount - amount in XRP
// //  * @param {'buy'|'sell'} type - transaction type
// //  */
// // const executeTrade = async (walletSeed, token, issuer, xrpAmount, type) => {
// //   const client = await connectXRPL();

// //   // Load wallet from seed (only for testnet)
// //   const wallet = xrpl.Wallet.fromSeed(walletSeed);

// //   // Prepare Payment (basic)
// //   const tx = {
// //     TransactionType: 'Payment',
// //     Account: wallet.classicAddress,
// //     Destination: wallet.classicAddress, // self-transfer for demo
// //     Amount:
// //       type === 'buy'
// //         ? { currency: token, issuer, value: xrpAmount.toString() } // buying memecoin
// //         : xrpl.xrpToDrops(xrpAmount), // selling memecoin back to XRP
// //   };

// //   const prepared = await client.autofill(tx);
// //   const signed = wallet.sign(prepared);
// //   const result = await client.submitAndWait(signed.tx_blob);

// //   return {
// //     txHash: result.result.hash,
// //     resultCode: result.result.meta?.TransactionResult,
// //   };
// // };
// /**
//  * Execute a buy or sell order on XRPL DEX for a given token
//  * @param {string} walletSeed - your XRPL wallet seed (testnet)
//  * @param {string} tokenSymbol - token symbol, e.g. MEME or TST
//  * @param {string} issuer - issuer (CA) of the token
//  * @param {number} xrpAmount - amount in XRP to trade
//  * @param {'buy' | 'sell'} type - trade type
//  */
// const executeTrade = async (walletSeed, tokenSymbol, issuer, xrpAmount, type) => {
//   const client = await connectXRPL();
//   const wallet = xrpl.Wallet.fromSeed(walletSeed);

//   console.log(`🔹 Preparing ${type.toUpperCase()} order on XRPL DEX...`);

//   // Convert XRP to drops (1 XRP = 1,000,000 drops)
//   const xrpDrops = xrpl.xrpToDrops(xrpAmount);

//   // Define the OfferCreate transaction (DEX order)
//   let tx;
//   if (type === 'buy') {
//     // You offer XRP to buy the token
//     tx = {
//       TransactionType: 'OfferCreate',
//       Account: wallet.classicAddress,
//       TakerGets: xrpDrops, // You pay XRP
//       TakerPays: {
//         currency: tokenSymbol,
//         issuer,
//         value: (xrpAmount * 10).toString(), // estimate tokens (adjust as needed)
//       },
//       Flags: 0x80000000,
//     };
//   } else {
//     // You offer tokens to get XRP
//     tx = {
//       TransactionType: 'OfferCreate',
//       Account: wallet.classicAddress,
//       TakerGets: {
//         currency: tokenSymbol,
//         issuer,
//         value: (xrpAmount * 10).toString(), // tokens you're selling
//       },
//       TakerPays: xrpDrops, // you get XRP
//       Flags: 0x80000000,
//     };
//   }

//   // Autofill transaction fields
//   const prepared = await client.autofill(tx);
//   const signed = wallet.sign(prepared);
//   const result = await client.submitAndWait(signed.tx_blob);

//   console.log(`✅ Transaction submitted: ${result.result.hash}`);
//   console.log(`📊 Result Code: ${result.result.meta?.TransactionResult}`);

//   return {
//     txHash: result.result.hash,
//     resultCode: result.result.meta?.TransactionResult,
//     explorer: `https://testnet.xrpl.org/transactions/${result.result.hash}`,
//   };
// };

// module.exports = {
//   connectXRPL,
//   estimateBuy,
//   executeTrade,
// };

// 3rd service
// const xrpl = require('xrpl');

// const XRPL_NETWORK = 'wss://s.altnet.rippletest.net:51233';
// let client;

// // Reuse XRPL client connection
// const connectXRPL = async () => {
//   if (!client || !client.isConnected()) {
//     client = new xrpl.Client(XRPL_NETWORK);
//     await client.connect();
//     console.log('✅ Connected to XRPL Testnet');
//   }
//   return client;
// };

// /**
//  * Estimate how many tokens a given XRP amount can buy using XRPL DEX order book
//  */
// const estimateBuy = async (token, issuer, xrpAmount) => {
//   const client = await connectXRPL();

//   const book = await client.request({
//     command: 'book_offers',
//     taker_gets: { currency: token, issuer }, // what we want to get
//     taker_pays: { currency: 'XRP' }, // paying XRP
//     limit: 10,
//   });

//   let totalTokens = 0;
//   let remainingXrpDrops = xrpl.xrpToDrops(xrpAmount);

//   for (const offer of book.result.offers) {
//     if (remainingXrpDrops <= 0) break;
//     const takerPays = parseFloat(offer.TakerPays);
//     const takerGets = parseFloat(offer.TakerGets.value);
//     const price = takerPays / takerGets;

//     const xrpToUse = Math.min(remainingXrpDrops, takerPays);
//     const tokensBought = xrpToUse / price;

//     totalTokens += tokensBought;
//     remainingXrpDrops -= xrpToUse;
//   }

//   return totalTokens;
// };

// /**
//  * Execute a buy or sell order on XRPL DEX for a given token
//  */
// const executeTrade = async (walletSeed, tokenSymbol, issuer, xrpAmount, type) => {
//   const client = await connectXRPL();
//   const wallet = xrpl.Wallet.fromSeed(walletSeed);

//   console.log(`🔹 Preparing ${type.toUpperCase()} order on XRPL DEX...`);

//   const xrpDrops = xrpl.xrpToDrops(xrpAmount);
//   let tx;

//   if (type === 'buy') {
//     // Offer to buy token with XRP
//     tx = {
//       TransactionType: 'OfferCreate',
//       Account: wallet.classicAddress,
//       TakerGets: xrpDrops, // you pay this much XRP
//       TakerPays: {
//         currency: tokenSymbol,
//         issuer,
//         value: (xrpAmount * 10).toString(), // estimate tokens wanted
//       },
//       Flags: 0x80000000,
//     };
//   } else {
//     // Offer to sell token for XRP
//     tx = {
//       TransactionType: 'OfferCreate',
//       Account: wallet.classicAddress,
//       TakerGets: {
//         currency: tokenSymbol,
//         issuer,
//         value: (xrpAmount * 10).toString(),
//       },
//       TakerPays: xrpDrops,
//       Flags: 0x80000000,
//     };
//   }

//   const prepared = await client.autofill(tx);
//   const signed = wallet.sign(prepared);
//   const result = await client.submitAndWait(signed.tx_blob);

//   console.log(`✅ TX: ${result.result.hash} | Code: ${result.result.meta?.TransactionResult}`);

//   return {
//     txHash: result.result.hash,
//     resultCode: result.result.meta?.TransactionResult,
//     explorer: `https://testnet.xrpl.org/transactions/${result.result.hash}`,
//   };
// };

// module.exports = {
//   connectXRPL,
//   estimateBuy,
//   executeTrade,
// };

// 4th service

const xrpl = require('xrpl');

// const XRPL_NETWORK = 'wss://s.altnet.rippletest.net:51233';
const XRPL_NETWORK = 'wss://s1.ripple.com';
let client;

/**
 * Connect XRPL client once and reuse connection
 */
const connectXRPL = async () => {
  if (!client || !client.isConnected()) {
    client = new xrpl.Client(XRPL_NETWORK);
    await client.connect();
    console.log('✅ Connected to XRPL Testnet');
  }
  return client;
};

/**
 * Ensure trust line exists for a given token
 * Creates it if missing
 */
const ensureTrustLine = async (walletSeed, currency, issuer, limit = '1000000') => {
  const client = await connectXRPL();
  const wallet = xrpl.Wallet.fromSeed(walletSeed);

  console.log(`🔍 Checking trust line for ${currency} issued by ${issuer}`);

  const accountInfo = await client.request({
    command: 'account_lines',
    account: wallet.classicAddress,
  });

  const hasTrust = accountInfo.result.lines.some((line) => line.currency === currency && line.account === issuer);

  if (hasTrust) {
    console.log('✅ Trust line already exists');
    return { created: false };
  }

  console.log('🪄 Creating trust line...');

  const trustSet = {
    TransactionType: 'TrustSet',
    Account: wallet.classicAddress,
    LimitAmount: { currency, issuer, value: limit },
  };

  const prepared = await client.autofill(trustSet);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);

  console.log(`✅ Trust line TX: ${result.result.hash} (${result.result.meta?.TransactionResult})`);

  return {
    created: true,
    txHash: result.result.hash,
    resultCode: result.result.meta?.TransactionResult,
  };
};

/**
 * Estimate how many tokens a given XRP amount can buy using XRPL DEX order book
 */
const estimateBuy = async (token, issuer, xrpAmount) => {
  const client = await connectXRPL();
  console.log({ currency: token, issuer: issuer });
  const book = await client.request({
    command: 'book_offers',
    taker_gets: { currency: token, issuer: issuer }, // what we want to get
    taker_pays: { currency: 'XRP' }, // paying XRP
    limit: 10,
  });

  let totalTokens = 0;
  let remainingXrpDrops = xrpl.xrpToDrops(xrpAmount);

  for (const offer of book.result.offers) {
    if (remainingXrpDrops <= 0) break;
    const takerPays = parseFloat(offer.TakerPays);
    const takerGets = parseFloat(offer.TakerGets.value);
    const price = takerPays / takerGets;

    const xrpToUse = Math.min(remainingXrpDrops, takerPays);
    const tokensBought = xrpToUse / price;

    totalTokens += tokensBought;
    remainingXrpDrops -= xrpToUse;
  }

  return totalTokens;
};

/**
 * Execute a buy or sell order on XRPL DEX for a given token
 */
const executeTrade = async (walletSeed, tokenSymbol, issuer, xrpAmount, type) => {
  const client = await connectXRPL();
  const wallet = xrpl.Wallet.fromSeed(walletSeed);

  // ✅ Ensure trust line before trade
  await ensureTrustLine(walletSeed, tokenSymbol, issuer);

  console.log(`🔹 Preparing ${type.toUpperCase()} order on XRPL DEX...`);

  const xrpDrops = xrpl.xrpToDrops(xrpAmount);
  let tx;

  if (type === 'buy') {
    // Offer to buy token with XRP
    tx = {
      TransactionType: 'OfferCreate',
      Account: wallet.classicAddress,
      TakerGets: xrpDrops, // you pay this much XRP
      TakerPays: {
        currency: tokenSymbol,
        issuer,
        value: (xrpAmount * 10).toString(), // estimated tokens
      },
      Flags: 0x80000000,
    };
  } else {
    // Offer to sell token for XRP
    tx = {
      TransactionType: 'OfferCreate',
      Account: wallet.classicAddress,
      TakerGets: {
        currency: tokenSymbol,
        issuer,
        value: (xrpAmount * 10).toString(),
      },
      TakerPays: xrpDrops,
      Flags: 0x80000000,
    };
  }

  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);

  console.log(`✅ TX: ${result.result.hash} | Code: ${result.result.meta?.TransactionResult}`);

  return {
    txHash: result.result.hash,
    resultCode: result.result.meta?.TransactionResult,
    explorer: `https://testnet.xrpl.org/transactions/${result.result.hash}`,
  };
};

module.exports = {
  connectXRPL,
  ensureTrustLine,
  estimateBuy,
  executeTrade,
};
