const Trade = require('../models/trade.model');
const { estimateBuy, executeTrade } = require('../services/xrpl.service');
const { updatePortfolio } = require('../services/portfolio.service');
const { historyService } = require('../services');

const xrpl = require('xrpl');

// Fetch real-time XRP price in USD from CoinGecko
const getXrpUsdPrice = async () => {
  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
  const data = await response.json();
  return data.ripple.usd; // price in USD
};

/**
 * Calculate transaction and buying fees
 * @param {number} xrpAmount - amount in XRP
 * @returns {{ transactionFees: number, buyingFees: number }}
 */
const calculateFees = async (xrpAmount) => {
  const xrpUsdPrice = await getXrpUsdPrice();
  console.log(xrpUsdPrice, 'xrpUsdPrice');

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

/**
 * Buy memecoin using XRP
 */
const buyMemecoin = async (req, res) => {
  try {
    const { userId, tokenSymbol, issuer, xrpAmount } = req.body;
    if (!userId || !tokenSymbol || !issuer || !xrpAmount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1️⃣ Estimate how many tokens user will get
    const tokenAmount = await estimateBuy(tokenSymbol, issuer, xrpAmount);

    // 2️⃣ Compute price per token and fees
    // const pricePerToken = xrpAmount / tokenAmount;
    const { transactionFees, buyingFees } = await calculateFees(xrpAmount);
    console.log(transactionFees, buyingFees, 'transactionFees, buyingFees');

    // const estimatedXrp = xrpAmount * 0.1; // placeholder conversion rate

    // 2️⃣ Hardcode pricePerToken = 100 / xrpAmount entered
    const pricePerToken = 100 / xrpAmount;
    // 3️⃣ Save pending trade
    const trade = await Trade.create({
      userId,
      type: 'buy',
      xrpAmount,
      tokenAmount: 100,
      tokenSymbol,
      issuer,
      pricePerToken,
      buyingFees,
      status: 'pending',
    });

    // 4️⃣ Execute trade
    const walletSeed = process.env.XRPL_TEST_SEED;
    const txResult = await executeTrade(walletSeed, tokenSymbol, issuer, xrpAmount, 'buy');

    // 5️⃣ Update status
    trade.txHash = txResult.txHash;
    trade.status = txResult.resultCode === 'tesSUCCESS' ? 'success' : 'failed';
    trade.updatedAt = new Date();
    await trade.save();

    // ✅ 6️⃣ Update user portfolio only if successful
    if (trade.status === 'success') {
      await updatePortfolio(
        userId,
        tokenSymbol,
        issuer,
        'buy',
        trade.tokenAmount,
        trade.xrpAmount,
        trade.pricePerToken,
        transactionFees
      );
    }
    //
    // ✅ 7️⃣ Log history
    if (trade.status === 'success') {
      await historyService.createHistory({
        userId,
        identifier: `${userId}-${tokenSymbol}`,
        tokenSymbol,
        issuer,
        type: 'buy',
        quantity: trade.tokenAmount,
        xrpInvestedOrReceived: trade.xrpAmount,
        entryPrice: trade.pricePerToken,
        buyDate: new Date(),
        txHash: trade.txHash,
        status: 'success',
      });
    }

    res.status(200).json({
      message: '✅ Memecoin buy transaction executed successfully',
      trade,
      txResult,
      fees: { transactionFees, buyingFees },
    });
  } catch (err) {
    console.error('❌ Buy memecoin error:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Sell memecoin for XRP
 */
const sellMemecoin = async (req, res) => {
  try {
    const { userId, tokenSymbol, issuer, tokenAmount } = req.body;
    if (!userId || !tokenSymbol || !issuer || !tokenAmount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1️⃣ Assume you’re selling at current estimated market price
    const estimatedXrp = tokenAmount * 0.1; // placeholder rate for demo
    const pricePerToken = 100 / estimatedXrp; // fixed: use estimatedXrp instead of xrpAmount

    // 2️⃣ Compute fees
    const { transactionFees } = await calculateFees(estimatedXrp);

    // 3️⃣ Save pending sell trade
    const trade = await Trade.create({
      userId,
      type: 'sell',
      tokenAmount,
      tokenSymbol,
      issuer,
      xrpAmount: estimatedXrp, // use estimatedXrp instead of undefined xrpAmount
      pricePerToken,
      buyingFees: transactionFees,
      status: 'pending',
    });

    // 4️⃣ Execute trade
    // const walletSeed = process.env.XRPL_TEST_SEED;
    // const txResult = await executeTrade(walletSeed, tokenSymbol, issuer, estimatedXrp, 'sell');

    // 5️⃣ Update trade after XRPL response
    //   trade.txHash = txResult.txHash;
    //   trade.status = txResult.resultCode === 'tesSUCCESS' ? 'success' : 'failed';
    //   if (trade.status === 'success') {
    //     trade.sellDate = new Date();
    //   }
    //   trade.updatedAt = new Date();
    //   await trade.save();

    //   res.status(200).json({
    //     message: '✅ Memecoin sell transaction executed successfully',
    //     trade,
    //     txResult,
    //     fees: { transactionFees },
    //   });
    // } catch (err) {
    //   console.error('❌ Sell memecoin error:', err);
    //   res.status(500).json({ error: err.message });
    // }
    // Simulate successful sell
    const txResult = {
      txHash: 'SIMULATED_TX_HASH',
      resultCode: 'tesSUCCESS',
      explorer: 'https://testnet.xrpl.org/transactions/SIMULATED_TX_HASH',
    };

    // 5️⃣ Update trade as success
    trade.txHash = txResult.txHash;
    trade.status = 'success';
    trade.sellDate = new Date();
    trade.updatedAt = new Date();
    await trade.save();

    // ✅ Update user portfolio for sell
    await updatePortfolio(userId, tokenSymbol, issuer, 'sell', tokenAmount, trade.xrpAmount, trade.pricePerToken);

    // ✅ Log sell history
    await historyService.createHistory({
      userId,
      identifier: `${userId}-${tokenSymbol}`,
      tokenSymbol,
      issuer,
      type: 'sell',
      quantity: tokenAmount,
      xrpInvestedOrReceived: trade.xrpAmount,
      exitPrice: trade.pricePerToken,
      soldDate: new Date(),
      txHash: trade.txHash,
      status: 'success',
    });

    res.status(200).json({
      message: '✅ Memecoin sell transaction simulated successfully',
      trade,
      txResult,
      fees: { transactionFees },
    });
  } catch (err) {
    console.error('❌ Sell memecoin error:', err);
    res.status(500).json({ error: err.message });
  }
};

const sellTokenMarket = async ({ tokenAmount, tokenCurrency, tokenIssuer, userAddress }) => {
  const client = await getClient();
  const wallet = await getWallet();

  // Fetch buy offers (buyers who want the token — they pay XRP)
  const buyOffers = await this.getBuyOffers({ currency: tokenCurrency, issuer: tokenIssuer, limit: 200 });

  // Estimate how much XRP we'll get when selling tokenAmount
  let remainingToken = Big(tokenAmount);
  let accXrp = Big(0);

  for (const o of buyOffers) {
    // o.TakerGets will be XRP (buyers want XRP), o.TakerPays will be token (value)
    let offerXrp, offerToken;
    if (o.TakerGets && (o.TakerGets.currency === 'XRP' || o.TakerGets === 'XRP')) {
      if (o.TakerGets.value) offerXrp = Big(o.TakerGets.value);
      else if (o.TakerGets.amount) offerXrp = Big(xrpl.dropsToXrp(o.TakerGets.amount));
      else offerXrp = Big(o.TakerGets); // fallback
    } else if (o.taker_gets && o.taker_gets.currency === 'XRP') {
      offerXrp = Big(xrpl.dropsToXrp(o.taker_gets.amount || 0));
    } else {
      continue;
    }

    if (o.TakerPays && o.TakerPays.value) offerToken = Big(o.TakerPays.value);
    else if (o.taker_pays && o.taker_pays.currency) offerToken = Big(o.taker_pays.value || 0);
    else offerToken = Big(0);

    if (remainingToken.lte(0)) break;

    if (offerToken.lte(remainingToken)) {
      // take full offer
      // price = offerXrp / offerToken => xrpReceived = offerXrp
      accXrp = accXrp.plus(offerXrp);
      remainingToken = remainingToken.minus(offerToken);
    } else {
      // partially take
      // xrpReceived = offerXrp * (remainingToken / offerToken)
      const fraction = remainingToken.div(offerToken);
      accXrp = accXrp.plus(offerXrp.times(fraction));
      remainingToken = Big(0);
      break;
    }
  }

  if (accXrp.eq(0)) throw new Error('No buy-side liquidity for token');

  // Create OfferCreate: TakerGets = token (value), TakerPays = XRP (drops)
  const tx = {
    TransactionType: 'OfferCreate',
    Account: wallet.address,
    TakerGets: {
      currency: tokenCurrency,
      issuer: tokenIssuer,
      value: tokenAmount,
    },
    TakerPays: xrpl.xrpToDrops(accXrp.toString()),
    Flags: xrpl.common.txFlags.OfferCreate.Sell,
  };

  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  const resp = await client.submitAndWait(signed.tx_blob);

  return { resp, tx_hash: signed.hash, xrpReceivedEstimate: accXrp.toString() };
};

module.exports = {
  buyMemecoin,
  sellMemecoin,
};
