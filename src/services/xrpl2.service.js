const xrpl = require('xrpl');
// const getClient = require('../config/xrplClient');
const Big = require('big.js');

// const XRPL_NETWORK = 'wss://s.altnet.rippletest.net:51233';
const XRPL_NETWORK = 'wss://s1.ripple.com';
let client;

// const HOT_WALLET_SEED = 'sEdVXpD1HQD59Y9Ta9W1oRaVQGjB4kU';
const HOT_WALLET_SEED = 'snLgRjhWdz1gqtV4ymss3puBK3Ncd';
if (!HOT_WALLET_SEED) console.warn('XRPL_SEED not set in .env');

// -----------------------------------------------------
// Get wallet for signing
// -----------------------------------------------------
const getWallet = async () => {
  if (!HOT_WALLET_SEED) throw new Error('XRPL_SEED not set');
  return xrpl.Wallet.fromSeed(HOT_WALLET_SEED, { algorithm: 'secp256k1' });
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
  console.log(accountInfo);

  const xrp = xrpl.dropsToXrp(accountInfo.result.account_data.Balance);

  const lines = await client.request({
    command: 'account_lines',
    account: address,
  });

  return { xrp: Number(xrp), trustlines: lines.result.lines || [] };
};

// -----------------------------------------------------
// 2. Create Trustline
// -----------------------------------------------------
const createTrustline = async ({ currency, issuer, limit = '1000000000' }) => {
  // const client = await getClient();
  const client = await connectXRPL();
  const wallet = await getWallet();
  console.log('trust 1', wallet.address, HOT_WALLET_SEED);
  console.log('2222222222', wallet);
  const tx = {
    TransactionType: 'TrustSet',
    Account: 'raD6xuCTKCJpAcW4pnqeuuUUiMREhbbDFJ',
    LimitAmount: { currency, issuer, value: limit },
  };

  const prepared = await client.autofill(tx);
  console.log('trust 2');

  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);
  console.log('trust 3');

  return { result, tx_hash: signed.hash };
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
  console.log('buy step 1');
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
const sellTokenMarket = async ({ tokenAmount, tokenCurrency, tokenIssuer }) => {
  // const client = await getClient();
  const client = await connectXRPL();
  const wallet = await getWallet();
  const response = await client.request({
    command: 'account_info',
    account: wallet.address,
    ledger_index: 'validated',
  });

  const balanceDrops = response.result.account_data.Balance;
  const balanceXrp = xrpl.dropsToXrp(balanceDrops);
  console.log('xrpBalance', { xrpBalance: balanceXrp });
  const buyOffers = await getBuyOffers({ currency: tokenCurrency, issuer: tokenIssuer, limit: 200 });
  // let remainingToken = Big(tokenAmount);
  // let accXrp = Big(0);

  // console.log('Starting sell calculation');
  // console.log('Token to sell:', remainingToken.toString());

  // for (const [index, o] of buyOffers.entries()) {
  //   // Use funded values if available
  //   const offerTokenValue = o.taker_pays_funded?.value || o.TakerPays?.value;
  //   const offerXrpValue =
  //     o.taker_gets_funded?.value || (o.TakerGets?.value ? o.TakerGets.value : xrpl.dropsToXrp(o.TakerGets?.amount || 0));

  //   console.log(`\nOffer #${index + 1}`);
  //   console.log('Raw offerTokenValue:', offerTokenValue, 'Raw offerXrpValue:', offerXrpValue);

  //   if (!offerTokenValue || !offerXrpValue) {
  //     console.log('Skipping invalid offer');
  //     continue; // skip invalid offers
  //   }

  //   const offerToken = Big(offerTokenValue);
  //   const offerXrp = Big(offerXrpValue);

  //   console.log('Offer token:', offerToken.toString(), 'Offer XRP:', offerXrp.toString());
  //   console.log('Remaining token before this offer:', remainingToken.toString());

  //   if (remainingToken.lte(0)) break;
  //   if (offerToken.lte(0)) {
  //     console.log('Skipping empty offer');
  //     continue;
  //   }

  //   if (offerToken.lte(remainingToken)) {
  //     accXrp = accXrp.plus(offerXrp);
  //     remainingToken = remainingToken.minus(offerToken);
  //     console.log('Taking full offer');
  //   } else {
  //     const fraction = remainingToken.div(offerToken);
  //     accXrp = accXrp.plus(offerXrp.times(fraction));
  //     remainingToken = Big(0);
  //     console.log('Taking partial offer, fraction:', fraction.toString());
  //     break;
  //   }

  //   console.log('Accumulated XRP so far:', accXrp.toString());
  //   console.log('Remaining token after this offer:', remainingToken.toString());
  // }

  // console.log('\nFinal accumulated XRP:', accXrp.toString());
  // console.log('Remaining token unsold:', remainingToken.toString());
  let remainingToken = Big(tokenAmount);
  let accXrp = Big(0);

  for (const o of buyOffers) {
    const offerTokenValue = o.taker_pays_funded?.value || o.TakerPays?.value;

    // Correct handling of TakerGets
    const offerXrpValue =
      o.taker_gets_funded?.value || (typeof o.TakerGets === 'string' ? xrpl.dropsToXrp(o.TakerGets) : o.TakerGets?.value);

    if (!offerTokenValue || !offerXrpValue) continue;

    const offerToken = Big(offerTokenValue);
    const offerXrp = Big(offerXrpValue);

    if (remainingToken.lte(0)) break;
    if (offerToken.lte(0)) continue;

    if (offerToken.lte(remainingToken)) {
      accXrp = accXrp.plus(offerXrp);
      remainingToken = remainingToken.minus(offerToken);
    } else {
      const fraction = remainingToken.div(offerToken);
      accXrp = accXrp.plus(offerXrp.times(fraction));
      remainingToken = Big(0);
      break;
    }
  }

  console.log('Final accumulated XRP:', accXrp.toString());

  if (accXrp.eq(0)) throw new Error('No liquidity to sell token');

  console.log('Total XRP we will get:', accXrp.toString());
  const xrpToReceive = Big(accXrp.toString()).round(6, 0);
  const tx = {
    TransactionType: 'OfferCreate',
    Account: wallet.address,
    TakerGets: xrpl.xrpToDrops(xrpToReceive),
    TakerPays: { currency: tokenCurrency, issuer: tokenIssuer, value: fixPrecision(tokenAmount) },
    // Flags: xrpl.OfferCreateFlags.tfImmediateOrCancel,
  };

  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  const resp = await client.submitAndWait(signed.tx_blob);

  return { resp, tx_hash: signed.hash, xrpReceivedEstimate: accXrp.toString() };
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
(async () => {
  const seed = 'snLgRjhWdz1gqtV4ymss3puBK3Ncd';
  const wallet = xrpl.Wallet.fromSeed(seed, { algorithm: 'secp256k1' });
  const check = await getBalances(wallet.address);

  console.log('Available XRP:', check);
  console.log(wallet.publicKey);
  console.log(wallet.privateKey);
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
