const xrpl = require('xrpl');
// const getClient = require('../config/xrplClient');
const Big = require('big.js');
const BigNumber = require('bignumber.js');

const XRPL_NETWORK = 'wss://s.altnet.rippletest.net:51233';
let client;

const HOT_WALLET_SEED = 'sEdVXpD1HQD59Y9Ta9W1oRaVQGjB4kU';
if (!HOT_WALLET_SEED) console.warn('XRPL_SEED not set in .env');

// -----------------------------------------------------
// Get wallet for signing
// -----------------------------------------------------
const getWallet = async () => {
  if (!HOT_WALLET_SEED) throw new Error('XRPL_SEED not set');
  return xrpl.Wallet.fromSeed(HOT_WALLET_SEED);
};

// -----------------------------------------------------
// 1. Get Balances (XRP + trustlines)
// -----------------------------------------------------
const getBalances = async (address) => {
  // const client = await getClient();
  const client = await connectXRPL();
  const accountInfo = await client.request({
    command: 'account_info',
    account: address,
    ledger_index: 'validated',
  });

  const xrp = xrpl.dropsToXrp(accountInfo.result.account_data.Balance);

  const lines = await client.request({
    command: 'account_lines',
    account: address,
  });

  return { xrp: Number(xrp), trustlines: lines.result.lines || [] };
};

const checkTokenBalance = async (address, currency, issuer) => {
  const client = await connectXRPL();
  const lines = await client.request({ command: 'account_lines', account: address });
  const line = lines.result.lines.find((l) => l.currency === currency && l.account === issuer);

  if (!line) return { exists: false, balance: 0, fundedBalance: 0 };

  return {
    exists: true,
    balance: Number(line.balance),
    fundedBalance: Number(line.balance) - Number(line.used || 0), // tokens free to use
  };
};

const checkFundedTokenBalance = async (address, currency, issuer) => {
  const client = await connectXRPL();
  const lines = await client.request({ command: 'account_lines', account: address });

  const line = lines.result.lines.find((l) => l.currency === currency && l.account === issuer);
  if (!line) return { exists: false, balance: 0, fundedBalance: 0 };

  return {
    exists: true,
    balance: Number(line.balance), // total balance
    fundedBalance: Number(line.balance) - Number(line.balance) + Number(line.owner_funds || 0),
  };
};

// -----------------------------------------------------
// 2. Create Trustline
// -----------------------------------------------------
const createTrustline = async ({ currency, issuer, limit = '1000000000' }) => {
  // const client = await getClient();
  const client = await connectXRPL();
  const wallet = await getWallet();

  const tx = {
    TransactionType: 'TrustSet',
    Account: wallet.address,
    LimitAmount: { currency, issuer, value: limit },
  };

  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);

  return { result, tx_hash: signed.hash };
};
const sendIssuedTokens = async ({ issuerWallet, recipientAddress, currency, amount }) => {
  const client = await connectXRPL();

  const tx = {
    TransactionType: 'Payment',
    Account: issuerWallet.address,
    Amount: {
      currency,
      value: amount.toString(),
      issuer: issuerWallet.address,
    },
    Destination: recipientAddress,
  };

  const prepared = await client.autofill(tx);
  const signed = issuerWallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);

  return result;
};

// -----------------------------------------------------
// 3. Fetch SELL Offers (token → XRP)
// -----------------------------------------------------
const getSellOffers = async ({ currency, issuer, limit = 50 }) => {
  // const client = await getClient();
  const client = await connectXRPL();
  const resp = await client.request({
    command: 'book_offers',
    taker_gets: { currency, issuer },
    taker_pays: { currency: 'XRP' },
    limit,
  });
  return resp.result.offers || [];
};

// -----------------------------------------------------
// 4. Fetch BUY Offers (XRP → token)
// -----------------------------------------------------
const getBuyOffers = async ({ currency, issuer, limit = 50 }) => {
  // const client = await getClient();
  const client = await connectXRPL();
  const resp = await client.request({
    command: 'book_offers',
    taker_gets: { currency: 'XRP' },
    taker_pays: { currency, issuer },
    limit,
  });
  return resp.result.offers || [];
};

// -----------------------------------------------------
// 5. Estimate token amount for given XRP
// -----------------------------------------------------
const estimateTokenForXrp = (xrpAmount, sellOffers) => {
  let remainingXrp = Big(xrpAmount);
  let accToken = Big(0);

  for (const o of sellOffers) {
    const offerToken = Big(o.TakerGets?.value || 0);

    let offerXrp;
    if (o.TakerPays?.value) offerXrp = Big(o.TakerPays.value);
    else offerXrp = Big(xrpl.dropsToXrp(o.TakerPays.amount || o.TakerPays || 0));

    if (remainingXrp.lte(0)) break;

    if (offerXrp.lte(remainingXrp)) {
      accToken = accToken.plus(offerToken);
      remainingXrp = remainingXrp.minus(offerXrp);
    } else {
      const fraction = remainingXrp.div(offerXrp);
      accToken = accToken.plus(offerToken.times(fraction));
      remainingXrp = Big(0);
      break;
    }
  }

  return {
    tokenAmount: accToken.toString(),
    leftoverXrp: remainingXrp.toString(),
  };
};

// -----------------------------------------------------
// 6. Market Buy: Spend XRP → Receive Token
// -----------------------------------------------------
const buyTokenMarket = async ({ xrpAmount, tokenCurrency, tokenIssuer }) => {
  // const client = await getClient();
  const client = await connectXRPL();
  const wallet = await getWallet();
  const roundedXrp = Number(xrpAmount.toFixed(6));
  // const balanceXRP = xrpl.dropsToXrp(res.result.account_data.Balance);
  // console.log('Balance:', balanceXRP, 'XRP');
  const sellOffers = await getSellOffers({ currency: tokenCurrency, issuer: tokenIssuer, limit: 200 });
  const estimate = estimateTokenForXrp(roundedXrp, sellOffers);

  if (estimate.tokenAmount === '0') {
    throw new Error('No liquidity to buy token');
  }

  const takerGets = xrpl.xrpToDrops(String(roundedXrp));
  const takerPays = {
    currency: tokenCurrency,
    issuer: tokenIssuer,
    value: fixPrecision(estimate.tokenAmount),
  };

  const tx = {
    TransactionType: 'OfferCreate',
    Account: wallet.address,
    TakerGets: takerGets,
    TakerPays: takerPays,
  };

  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  const resp = await client.submitAndWait(signed.tx_blob);

  return { resp, tx_hash: signed.hash, tokenAmountBought: fixPrecision(estimate.tokenAmount) };
};

// -----------------------------------------------------
// 7. Market Sell: Sell Token → Receive XRP
// -----------------------------------------------------
// const sellTokenMarket = async ({ tokenAmount, tokenCurrency, tokenIssuer }) => {
//   // const client = await getClient();
//   const client = await connectXRPL();
//   const wallet = await getWallet();

//   const tokenCheck = await checkTokenBalance(wallet.address, tokenCurrency, tokenIssuer);
//   // const tokenCheck = await checkTokenBalance(wallet.address, 'TST', 'rP9jPyP5kyvFRb6ZiRghAGw5u8SGAmU4bd');

//   if (!tokenCheck.exists || tokenCheck.balance <= 0) {
//     console.log('❌ No TST tokens available to sell!');
//   } else {
//     console.log(`✅ You have ${tokenCheck.balance} TST available to sell.`);
//   }
//   const response = await client.request({
//     command: 'account_info',
//     account: wallet.address,
//     ledger_index: 'validated',
//   });

//   const balanceDrops = response.result.account_data.Balance;
//   const balanceXrp = xrpl.dropsToXrp(balanceDrops);
//   console.log('xrpBalance', { xrpBalance: balanceXrp });
//   const buyOffers = await getBuyOffers({ currency: tokenCurrency, issuer: tokenIssuer, limit: 200 });
//   // let remainingToken = Big(tokenAmount);
//   // let accXrp = Big(0);

//   // console.log('Starting sell calculation');
//   // console.log('Token to sell:', remainingToken.toString());

//   // for (const [index, o] of buyOffers.entries()) {
//   //   // Use funded values if available
//   //   const offerTokenValue = o.taker_pays_funded?.value || o.TakerPays?.value;
//   //   const offerXrpValue =
//   //     o.taker_gets_funded?.value || (o.TakerGets?.value ? o.TakerGets.value : xrpl.dropsToXrp(o.TakerGets?.amount || 0));

//   //   console.log(`\nOffer #${index + 1}`);
//   //   console.log('Raw offerTokenValue:', offerTokenValue, 'Raw offerXrpValue:', offerXrpValue);

//   //   if (!offerTokenValue || !offerXrpValue) {
//   //     console.log('Skipping invalid offer');
//   //     continue; // skip invalid offers
//   //   }

//   //   const offerToken = Big(offerTokenValue);
//   //   const offerXrp = Big(offerXrpValue);

//   //   console.log('Offer token:', offerToken.toString(), 'Offer XRP:', offerXrp.toString());
//   //   console.log('Remaining token before this offer:', remainingToken.toString());

//   //   if (remainingToken.lte(0)) break;
//   //   if (offerToken.lte(0)) {
//   //     console.log('Skipping empty offer');
//   //     continue;
//   //   }

//   //   if (offerToken.lte(remainingToken)) {
//   //     accXrp = accXrp.plus(offerXrp);
//   //     remainingToken = remainingToken.minus(offerToken);
//   //     console.log('Taking full offer');
//   //   } else {
//   //     const fraction = remainingToken.div(offerToken);
//   //     accXrp = accXrp.plus(offerXrp.times(fraction));
//   //     remainingToken = Big(0);
//   //     console.log('Taking partial offer, fraction:', fraction.toString());
//   //     break;
//   //   }

//   //   console.log('Accumulated XRP so far:', accXrp.toString());
//   //   console.log('Remaining token after this offer:', remainingToken.toString());
//   // }

//   // console.log('\nFinal accumulated XRP:', accXrp.toString());
//   // console.log('Remaining token unsold:', remainingToken.toString());
//   let remainingToken = Big(tokenAmount);
//   let accXrp = Big(0);

//   for (const o of buyOffers) {
//     const offerTokenValue = o.taker_pays_funded?.value || o.TakerPays?.value;

//     // Correct handling of TakerGets
//     const offerXrpValue =
//       o.taker_gets_funded?.value || (typeof o.TakerGets === 'string' ? xrpl.dropsToXrp(o.TakerGets) : o.TakerGets?.value);

//     if (!offerTokenValue || !offerXrpValue) continue;

//     const offerToken = Big(offerTokenValue);
//     const offerXrp = Big(offerXrpValue);

//     if (remainingToken.lte(0)) break;
//     if (offerToken.lte(0)) continue;

//     if (offerToken.lte(remainingToken)) {
//       accXrp = accXrp.plus(offerXrp);
//       remainingToken = remainingToken.minus(offerToken);
//     } else {
//       const fraction = remainingToken.div(offerToken);
//       accXrp = accXrp.plus(offerXrp.times(fraction));
//       remainingToken = Big(0);
//       break;
//     }
//   }

//   console.log('Final accumulated XRP:', accXrp.toString());

//   if (accXrp.eq(0)) throw new Error('No liquidity to sell token');

//   console.log('Total XRP we will get:', accXrp.toString());
//   const xrpToReceive = Big(accXrp.toString()).round(6, 0);
//   const tx = {
//     TransactionType: 'OfferCreate',
//     Account: wallet.address,
//     TakerGets: xrpl.xrpToDrops(xrpToReceive),
//     TakerPays: { currency: tokenCurrency, issuer: tokenIssuer, value: fixPrecision(tokenAmount) },
//     Flags: xrpl.OfferCreateFlags.tfImmediateOrCancel,
//   };

//   const prepared = await client.autofill(tx);
//   const signed = wallet.sign(prepared);
//   const resp = await client.submitAndWait(signed.tx_blob);

//   return { resp, tx_hash: signed.hash, xrpReceivedEstimate: accXrp.toString() };
// };

const sellTokenMarket = async ({ tokenAmount, tokenCurrency, tokenIssuer }) => {
  const client = await connectXRPL();
  const wallet = await getWallet();

  const tokenCheck = await checkFundedTokenBalance(wallet.address, tokenCurrency, tokenIssuer);

  if (!tokenCheck.exists || tokenCheck.fundedBalance <= 0) {
    throw new Error('❌ You have no funded tokens to sell.');
  }

  // limit to funded
  tokenAmount = Math.min(tokenAmount, tokenCheck.fundedBalance);

  const buyOffers = await getBuyOffers({ currency: tokenCurrency, issuer: tokenIssuer, limit: 200 });

  if (!buyOffers.length) {
    throw new Error('❌ No buy offers available — zero liquidity.');
  }

  let remaining = Big(tokenAmount);
  let accXrp = Big(0);

  for (const o of buyOffers) {
    const offerToken = Big(o.taker_pays_funded?.value || 0);
    const offerXrp = Big(o.taker_gets_funded?.value || 0);

    if (offerToken.eq(0)) continue;

    if (offerToken.lte(remaining)) {
      accXrp = accXrp.plus(offerXrp);
      remaining = remaining.minus(offerToken);
    } else {
      const fraction = remaining.div(offerToken);
      accXrp = accXrp.plus(offerXrp.times(fraction));
      remaining = Big(0);
      break;
    }
  }

  if (accXrp.eq(0)) {
    throw new Error('❌ No liquidity to execute sell.');
  }

  const tx = {
    TransactionType: 'OfferCreate',
    Account: wallet.address,
    TakerGets: xrpl.xrpToDrops(accXrp),
    TakerPays: { currency: tokenCurrency, issuer: tokenIssuer, value: tokenAmount.toString() },
    Flags: xrpl.OfferCreateFlags.tfImmediateOrCancel,
  };

  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  const resp = await client.submitAndWait(signed.tx_blob);

  return { resp, xrpReceivedEstimate: accXrp.toString() };
};

// -----------------------------------------------------
// 8. Transaction Status
// -----------------------------------------------------
const txStatus = async (txHash) => {
  // const client = await getClient();
  const client = await connectXRPL();
  const resp = await client.request({ command: 'tx', transaction: txHash });
  return resp.result;
};

const connectXRPL = async () => {
  if (!client || !client.isConnected()) {
    client = new xrpl.Client(XRPL_NETWORK);
    await client.connect();
    console.log('✅ Connected to XRPL Testnet');
  }
  return client;
};

const fixPrecision = (num) => {
  return Number(num)
    .toPrecision(15)
    .replace(/\.?0+$/, '');
};

const checkAllFundedTokenBalances = async (address) => {
  const client = await connectXRPL();

  // Fetch all trustlines
  const resp = await client.request({
    command: 'account_lines',
    account: address,
  });

  const lines = resp.result.lines || [];

  // Map each line to an object with balance + funded balance
  return lines.map((l) => ({
    currency: l.currency,
    issuer: l.account, // the issuing account
    balance: Number(l.balance), // total tokens in trustline
    fundedBalance: Number(l.owner_funds || 0), // tokens actually available to sell
  }));
};
const createInitialLiquidity = async (currency, issuer, priceXRP, tokenAmount) => {
  const client = await connectXRPL();

  // Load issuer wallet (this wallet must pay XRP to buy tokens)
  const issuerWallet = await getWallet('issuer');

  // XRP issuer will pay:
  // totalXRP = tokenAmount * price
  const totalXRP = Big(tokenAmount).times(priceXRP).toString();

  console.log(`📘 Creating liquidity`);
  console.log(`Buying ${tokenAmount} ${currency} at price ${priceXRP} XRP`);
  console.log(`Issuer will pay ${totalXRP} XRP`);

  const tx = {
    TransactionType: 'OfferCreate',
    Account: issuerWallet.address,

    // Issuer PAYS XRP (buying your token)
    TakerPays: xrpl.xrpToDrops(totalXRP),

    // Issuer RECEIVES your token
    TakerGets: {
      currency,
      issuer,
      value: tokenAmount.toString(),
    },

    Flags: 0,
  };

  const prepared = await client.autofill(tx);
  const signed = issuerWallet.sign(prepared);
  const resp = await client.submitAndWait(signed.tx_blob);

  console.log('💧 Liquidity Added → Buy Offer Created');
  console.log(resp);

  return {
    success: resp.meta?.TransactionResult === 'tesSUCCESS',
    totalXRP,
    tokenAmount,
    txHash: signed.hash,
  };
};

const sendTokens = async (issuer, holderAddress, currency, amount) => {
  const client = await connectXRPL();

  // Load issuer wallet (the account that holds + issues TST)
  const issuerWallet = await getWallet('issuer');

  // Create Payment transaction
  const tx = {
    TransactionType: 'Payment',
    Account: issuerWallet.address, // Sender
    Destination: holderAddress, // Receiver

    Amount: {
      currency,
      issuer: issuerWallet.address,
      value: amount.toString(),
    },
  };

  console.log(`📤 Sending ${amount} ${currency} to ${holderAddress}`);

  // Prepare, sign, submit
  const prepared = await client.autofill(tx);
  const signed = issuerWallet.sign(prepared);
  const resp = await client.submitAndWait(signed.tx_blob);

  console.log('💸 Token Transfer Complete');
  console.log(resp);

  return {
    success: resp.meta?.TransactionResult === 'tesSUCCESS',
    amount,
    currency,
    txHash: signed.hash,
  };
};

async function getAllTokens() {
  const client = new xrpl.Client('wss://s1.ripple.com');
  await client.connect();

  let marker = undefined;
  let currencies = [];
  // console.log(client, 's');
  do {
    const resp = await client.request({
      command: 'ledger_data',
      type: 'account',
      marker,
    });

    resp.result.state.forEach((i) => {
      if (i.LedgerEntryType === 'RippleState') {
        const currency = i.Balance.currency;
        const issuer = i.HighLimit.issuer;

        // filter out XRP (native)
        if (currency !== 'XRP') {
          currencies.push({
            currency,
            issuer,
          });
        }
      }
    });

    marker = resp.result.marker;
  } while (marker);

  console.log(currencies.length, 'tokens found');
  console.log(currencies.slice(0, 20));
}

// Usage
(async () => {
  // getAllTokens();
  const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
  await client.connect();

  const wallet = xrpl.Wallet.fromSeed('sEdVXpD1HQD59Y9Ta9W1oRaVQGjB4kU');

  const sellAmount = '1';
  const token = {
    currency: 'TST',
    issuer: 'rP9jPyP5kyvFRb6ZiRghAGw5u8SGAmU4bd',
    value: sellAmount,
  };

  // Best buy offer in order book
  const orderbook = await client.request({
    command: 'book_offers',
    taker: wallet.address,
    taker_gets: { currency: 'XRP' },
    taker_pays: token,
    ledger_index: 'current',
    limit: 10,
  });

  const offers = orderbook.result.offers;
  if (!offers || offers.length === 0) {
    console.log('No buy offers in order book!');
    await client.disconnect();
    return;
  }

  // Take best offer
  const bestOffer = offers[0];
  let xrpAmount = bestOffer.TakerGets; // XRP in drops

  // Create market sell transaction
  const tx = {
    TransactionType: 'OfferCreate',
    Account: wallet.address,
    TakerPays: xrpAmount,
    TakerGets: token,
    // Flags: xrpl.OfferCreateFlags.tfImmediateOrCancel, // ⚡ market sell
  };

  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);

  console.log(result.result.meta.TransactionResult);
  console.log('Balance changes:', xrpl.getBalanceChanges(result.result.meta));

  await client.disconnect();
  // const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
  // await client.connect();
  // console.log('✅ Connected to XRPL Testnet');

  // // 2️⃣ Load your wallet
  // const wallet = xrpl.Wallet.fromSeed('sEdVXpD1HQD59Y9Ta9W1oRaVQGjB4kU');
  // console.log(`Using wallet: ${wallet.address}`);

  // // 3️⃣ Amount of TST to sell
  // const sellAmount = '1'; // 1 TST
  // const token = {
  //   currency: 'TST',
  //   issuer: 'rP9jPyP5kyvFRb6ZiRghAGw5u8SGAmU4bd',
  //   value: sellAmount,
  // };

  // // 4️⃣ Fetch order book: TST/XRP (buy offers)
  // const orderbook = await client.request({
  //   command: 'book_offers',
  //   taker: wallet.address,
  //   taker_gets: { currency: 'XRP' }, // we want XRP
  //   taker_pays: token, // we sell TST
  //   ledger_index: 'current',
  //   limit: 10,
  // });

  // const offers = orderbook.result.offers;
  // if (!offers || offers.length === 0) {
  //   console.log('⚠️ No buy offers in the order book. Market sell not possible.');
  //   await client.disconnect();
  //   return;
  // }

  // // 5️⃣ Take best buy offer
  // const bestOffer = offers[0];

  // // Determine how much XRP this TST will get
  // let xrpAmount;
  // if (typeof bestOffer.TakerGets === 'string') {
  //   xrpAmount = bestOffer.TakerGets; // XRP in drops
  // } else if (bestOffer.TakerGets.value) {
  //   // If someone is offering issued currency, ignore (rare for XRP)
  //   console.error('Best offer is not in XRP:', bestOffer.TakerGets);
  //   await client.disconnect();
  //   return;
  // }

  // console.log(`💰 Selling ${sellAmount} TST for approximately ${xrpl.dropsToXrp(xrpAmount)} XRP`);

  // // 6️⃣ Create OfferCreate transaction
  // const offerTx = {
  //   TransactionType: 'OfferCreate',
  //   Account: wallet.address,
  //   TakerPays: token, // TST we are selling
  //   TakerGets: xrpAmount, // XRP we will receive
  //   Flags: 0, // default
  // };

  // const prepared = await client.autofill(offerTx);
  // const signed = wallet.sign(prepared);

  // console.log('📤 Submitting OfferCreate transaction...');
  // const result = await client.submitAndWait(signed.tx_blob);

  // if (result.result.meta.TransactionResult === 'tesSUCCESS') {
  //   console.log('✅ TST sold successfully!');
  //   console.log(`Transaction hash: ${signed.hash}`);

  //   // Show balance changes
  //   const balanceChanges = xrpl.getBalanceChanges(result.result.meta);
  //   console.log('💹 Balance changes:', balanceChanges);
  // } else {
  //   console.error('❌ Transaction failed:', result.result.meta.TransactionResult);
  // }

  // // 7️⃣ Disconnect
  // await client.disconnect();
  // const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
  // await client.connect();
  // console.log('✅ Connected to XRPL Testnet');

  // const wallet = xrpl.Wallet.fromSeed('sEdVXpD1HQD59Y9Ta9W1oRaVQGjB4kU');
  // console.log(`Using wallet: ${wallet.address}`);

  // const sellAmount = '1'; // TST to sell
  // const token = {
  //   currency: 'TST',
  //   issuer: 'rP9jPyP5kyvFRb6ZiRghAGw5u8SGAmU4bd',
  //   value: sellAmount,
  // };

  // // 1️⃣ Fetch order book
  // const orderbook = await client.request({
  //   command: 'book_offers',
  //   taker: wallet.address,
  //   taker_gets: { currency: 'XRP' }, // want XRP
  //   taker_pays: token, // selling TST
  //   ledger_index: 'current',
  //   limit: 10,
  // });

  // const offers = orderbook.result.offers;
  // if (!offers || offers.length === 0) {
  //   console.log('⚠️ No offers in order book, cannot sell immediately.');
  //   return;
  // }

  // // 2️⃣ Take the best offer
  // const bestOffer = offers[0];

  // // Determine XRP drops offered
  // let xrpAmount;
  // if (typeof bestOffer.TakerGets === 'string') {
  //   xrpAmount = bestOffer.TakerGets;
  // } else if (bestOffer.TakerGets.value) {
  //   console.error('Best offer TakerGets is issued currency, not XRP. Cannot sell immediately.');
  //   return;
  // }

  // console.log(`💰 Selling ${sellAmount} TST for ~${xrpl.dropsToXrp(xrpAmount)} XRP`);

  // // 3️⃣ Create OfferCreate to sell 1 TST for XRP in best offer
  // const offerTx = {
  //   TransactionType: 'OfferCreate',
  //   Account: wallet.address,
  //   TakerPays: token,
  //   TakerGets: xrpAmount,
  //   Flags: 0, // default
  // };

  // const prepared = await client.autofill(offerTx);
  // const signed = wallet.sign(prepared);
  // console.log('📤 Submitting OfferCreate transaction...');

  // const result = await client.submitAndWait(signed.tx_blob);

  // if (result.result.meta.TransactionResult === 'tesSUCCESS') {
  //   console.log('✅ TST sold successfully!');
  //   console.log(`Transaction hash: ${signed.hash}`);

  //   const balanceChanges = xrpl.getBalanceChanges(result.result.meta);
  //   console.log('💹 Balance changes:', balanceChanges);
  // } else {
  //   console.error('❌ Transaction failed:', result.result.meta.TransactionResult);
  // }

  // client.disconnect();
  // const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
  // await client.connect();
  // console.log('✅ Connected to XRPL Testnet');

  // // 2️⃣ Load your wallet
  // const wallet = xrpl.Wallet.fromSeed('sEdVXpD1HQD59Y9Ta9W1oRaVQGjB4kU');
  // console.log(`Using wallet: ${wallet.address}`);

  // // 3️⃣ Define token to sell
  // const sellAmount = '1'; // 1 TST
  // const token = {
  //   currency: 'TST',
  //   issuer: 'rP9jPyP5kyvFRb6ZiRghAGw5u8SGAmU4bd',
  //   value: sellAmount,
  // };

  // // 4️⃣ Fetch order book (TST/XRP)
  // const orderbook = await client.request({
  //   command: 'book_offers',
  //   taker: wallet.address,
  //   taker_gets: { currency: 'XRP' }, // you want XRP
  //   taker_pays: token, // you sell TST
  //   ledger_index: 'current',
  //   limit: 10,
  // });

  // const offers = orderbook.result.offers;
  // if (!offers || offers.length === 0) {
  //   console.log('⚠️ No existing offers in book. Market order not possible.');
  //   return;
  // }

  // // 5️⃣ Take the best offer (first in list)
  // const bestOffer = offers[0];

  // // Determine how much XRP this TST will get
  // let xrpAmount;
  // if (typeof bestOffer.TakerGets === 'string') {
  //   xrpAmount = bestOffer.TakerGets; // XRP in drops
  // } else {
  //   console.error('Unexpected TakerGets format:', bestOffer.TakerGets);
  //   return;
  // }

  // console.log(`💰 Selling ${sellAmount} TST for approximately ${xrpl.dropsToXrp(xrpAmount)} XRP`);

  // // 6️⃣ Create OfferCreate to sell exactly 1 TST for the XRP in best offer
  // const offerTx = {
  //   TransactionType: 'OfferCreate',
  //   Account: wallet.address,
  //   TakerPays: token,
  //   TakerGets: xrpAmount, // XRP in drops
  //   Flags: 0, // default
  // };

  // const prepared = await client.autofill(offerTx);
  // const signed = wallet.sign(prepared);
  // console.log('📤 Submitting OfferCreate transaction...');
  // const result = await client.submitAndWait(signed.tx_blob);

  // if (result.result.meta.TransactionResult === 'tesSUCCESS') {
  //   console.log('✅ TST sold successfully!');
  //   console.log(`Transaction hash: ${signed.hash}`);

  //   // Show balance changes
  //   const balance_changes = xrpl.getBalanceChanges(result.result.meta);
  //   console.log('💹 Balance changes:', balance_changes);
  // } else {
  //   console.error('❌ Transaction failed:', result.result.meta.TransactionResult);
  // }

  // client.disconnect();
  // const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
  // await client.connect();
  // console.log('Connected to XRPL Testnet');

  // // Load your wallet (replace with your secret)
  // const wallet = xrpl.Wallet.fromSeed('sEdVXpD1HQD59Y9Ta9W1oRaVQGjB4kU');
  // console.log(`Using wallet: ${wallet.address}`);

  // // Define token to sell
  // const sellAmount = '1'; // 1 TST
  // const token = {
  //   currency: 'TST',
  //   issuer: 'rP9jPyP5kyvFRb6ZiRghAGw5u8SGAmU4bd',
  //   value: sellAmount,
  // };

  // // Step 1: Query the order book (TST/XRP)
  // const orderbook = await client.request({
  //   command: 'book_offers',
  //   taker: wallet.address,
  //   taker_gets: { currency: 'XRP' }, // you want XRP
  //   taker_pays: token, // you sell TST
  //   ledger_index: 'current',
  //   limit: 20,
  // });

  // const offers = orderbook.result.offers;
  // if (!offers || offers.length === 0) {
  //   console.log('No existing offers to match. Offer will be placed on the book.');
  //   return;
  // }

  // // Step 2: Calculate how much XRP you get for 1 TST at best available rates
  // let remaining = new BigNumber(sellAmount);
  // let totalXRP = new BigNumber(0);

  // for (const o of offers) {
  //   console.log(o.TakerPays, 'sssssssssssss');
  //   // TST amount in this offer (taker_pays)
  //   let offerAmount;
  //   if (typeof o.TakerPays === 'string') {
  //     // XRP in drops (rare for us, but handle it)
  //     offerAmount = new BigNumber(o.TakerPays);
  //   } else if (o.TakerPays.value) {
  //     // Issued currency
  //     offerAmount = new BigNumber(o.TakerPays.value);
  //   } else {
  //     console.warn('Unexpected taker_pays format:', o.TakerPays);
  //     continue;
  //   }

  //   // XRP offered in this offer (taker_gets)
  //   let offerRate;
  //   if (typeof o.TakerGets === 'string') {
  //     offerRate = new BigNumber(o.TakerGets); // XRP in drops
  //   } else if (o.TakerGets.value) {
  //     offerRate = new BigNumber(o.TakerGets.value); // token amount (if not XRP)
  //   } else {
  //     console.warn('Unexpected taker_gets format:', o.TakerGets);
  //     continue;
  //   }

  //   if (remaining.lte(offerAmount)) {
  //     totalXRP = totalXRP.plus(remaining.multipliedBy(offerRate).dividedBy(offerAmount));
  //     remaining = new BigNumber(0);
  //     break;
  //   } else {
  //     totalXRP = totalXRP.plus(offerRate);
  //     remaining = remaining.minus(offerAmount);
  //   }
  // }
  // console.log(totalXRP, 'ssssssss');

  // console.log(`Selling 1 TST will give approximately ${xrpl.dropsToXrp(totalXRP.toString(2))} XRP`);
  // // Step 3: Create OfferCreate transaction to sell 1 TST for calculated XRP
  // const offerTx = {
  //   TransactionType: 'OfferCreate',
  //   Account: wallet.address,
  //   TakerPays: token,
  //   TakerGets: totalXRP.toFixed(0),
  //   // totalXRP.toFixed(0), // XRP in drops
  // };

  // const prepared = await client.autofill(offerTx);
  // const signed = wallet.sign(prepared);
  // console.log('Submitting OfferCreate transaction...');
  // const result = await client.submitAndWait(signed.tx_blob);

  // if (result.result.meta.TransactionResult === 'tesSUCCESS') {
  //   console.log('TST sold successfully!');
  //   console.log(`Transaction hash: ${signed.hash}`);

  //   // Show balance changes
  //   const balance_changes = xrpl.getBalanceChanges(result.result.meta);
  //   console.log('Balance changes:', balance_changes);
  // } else {
  //   console.error('Transaction failed:', result.result.meta.TransactionResult);
  // }

  // client.disconnect();
  // await createTrustline({
  //   currency: 'TST',
  //   issuer: 'rP9jPyP5kyvFRb6ZiRghAGw5u8SGAmU4bd',
  //   limit: '1000000000',
  // });

  // await sendTokens(
  //   'rP9jPyP5kyvFRb6ZiRghAGw5u8SGAmU4bd', // issuer address
  //   'rsHeH3bzrhhS7mJEGFCqgoNpPRUYPPPEL1', // holder address
  //   'TST', // currency
  //   '10' // amount
  // );
  // await createInitialLiquidity(
  //   'TST', // currency code
  //   'rP9jPyP5kyvFRb6ZiRghAGw5u8SGAmU4bd', // token issuer address
  //   '0.2', // price in XRP per token
  //   '1000' // token amount the issuer wants to buy
  // );
  const address = 'rsHeH3bzrhhS7mJEGFCqgoNpPRUYPPPEL1';
  const balances = await checkAllFundedTokenBalances(address);
  console.log(balances);
})();

// -----------------------------------------------------
// EXPORT ALL ARROW FUNCTIONS
// -----------------------------------------------------
module.exports = {
  getBalances,
  createTrustline,
  getSellOffers,
  getBuyOffers,
  estimateTokenForXrp,
  buyTokenMarket,
  sellTokenMarket,
  txStatus,
};
