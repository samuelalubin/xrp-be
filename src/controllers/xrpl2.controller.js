const Trade = require('../models/trade.model');
const { estimateBuy, executeTrade } = require('../services/xrpl.service');
const { updatePortfolio } = require('../services/portfolio.service');
const { historyService } = require('../services');
const { xrplService2 } = require('../services');

const xrpl = require('xrpl');
const { User } = require('../models');

const getXrpUsdPrice = async () => {
  // const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
  const response = await fetch('https://min-api.cryptocompare.com/data/pricemulti?fsyms=XRP&tsyms=USD');
  const data = await response.json();
  console.log(data);
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

// Fetch real-time XRP price in USD from CoinGecko
const buyToken = async (req, res) => {
  try {
    const { issuer, userId, currency, amountXrp, amountUsd, priceFromPortal } = req.body;
    const xrpUsdPrice = await getXrpUsdPrice();
    const xrpAmount = amountUsd / xrpUsdPrice;
    const { transactionFees, buyingFees } = await calculateFees(xrpAmount);

    console.log(issuer, userId, currency);
    if (!currency || !amountUsd) return res.status(400).json({ message: 'currency & amountUsd required' });

    // ---- Fetch user ----
    const user = await User.findById(userId);
    if (!user) return res.status(400).json({ message: 'Invalid user' });

    if (user.totalAmount < xrpAmount) return res.status(400).json({ message: 'Not enough XRP' });

    // ---- Auto-get issuer ----
    // let issuer = await getTokenIssuer(currency);
    if (!issuer) return res.status(400).json({ message: 'Issuer not found for token' });

    // ---- Create trustline (required before buy) ----
    await xrplService2.createTrustline({
      currency,
      issuer,
    });

    // ---- Buy token ----
    const buyResult = await xrplService2.buyTokenMarket({
      xrpAmount: xrpAmount,
      tokenCurrency: currency,
      tokenIssuer: issuer,
    });
    const slippageTolerance = 0.001; // 0.1%
    const expectedPricePerToken = xrpAmount / buyResult.tokenAmountBought;
    const maxPricePerToken = priceFromPortal * (1 + slippageTolerance);

    if (expectedPricePerToken > maxPricePerToken) {
      return res.status(400).json({ message: 'Slippage too high, please try again', status });
    }
    const trade = await Trade.create({
      userId,
      type: 'buy',
      xrpAmount,
      tokenAmount: buyResult.tokenAmountBought,
      tokenSymbol: currency,
      issuer,
      buyingFees,
      transactionFees,
      amountUsd,
      status: 'pending',
      pricePerToken: xrpAmount / buyResult.tokenAmountBought,
    });
    // ---- Confirm transaction ----
    const status = await xrplService2.txStatus(buyResult.tx_hash);
    console.log(buyResult);
    console.log(status);
    trade.txHash = buyResult.tx_hash;
    trade.status = status.meta.TransactionResult === 'tesSUCCESS' ? 'success' : 'failed';
    trade.updatedAt = new Date();
    await trade.save();
    if (trade.status === 'success') {
      await updatePortfolio(
        userId,
        currency,
        issuer,
        'buy',
        buyResult.tokenAmountBought,
        xrpAmount,
        xrpAmount / buyResult.tokenAmountBought,
        transactionFees
      );
      await historyService.createHistory({
        userId,
        identifier: `${userId}-${currency}`,
        tokenSymbol: currency,
        issuer,
        type: 'buy',
        quantity: buyResult.tokenAmountBought,
        xrpInvestedOrReceived: xrpAmount,
        entryPrice: xrpAmount / buyResult.tokenAmountBought,
        buyingFees,
        transactionFees,
        amountUsd,
        buyDate: new Date(),
        txHash: trade.txHash,
        status: 'success',
      });
    }
    if (status.meta.TransactionResult !== 'tesSUCCESS') {
      return res.status(400).json({ message: 'Buy failed', status });
    }

    // ---- Deduct user XRP ----
    // user.totalAmount -= Number(xrpAmount);
    // user.totalAmountDrops -= Number(xrpAmount * 1_000_000);
    // await user.save();

    return res.json({
      message: 'Token purchased successfully',
      tokenBought: buyResult.tokenAmountBought,
      txHash: buyResult.tx_hash,
      issuer,
    });
  } catch (err) {
    console.error('BUY ERROR:', err);
    return res.status(500).json({ message: err.message });
  }
};

const sellToken = async (req, res) => {
  try {
    const { issuer, userId, currency, tokenAmount, priceFromPortal } = req.body;

    if (!currency || !tokenAmount) return res.status(400).json({ message: 'currency & tokenAmount required' });

    // ---- Get user ----
    const user = await User.findById(userId);
    if (!user) return res.status(400).json({ message: 'Invalid user' });

    // ---- Auto-get issuer ----
    // let issuer = await getTokenIssuer(currency);
    if (!issuer) return res.status(400).json({ message: 'Issuer not found for token' });

    // ---- Sell token ----
    const sellResult = await xrplService2.sellTokenMarket({
      tokenAmount,
      tokenCurrency: currency,
      tokenIssuer: issuer,
    });
    const xrpAmount = sellResult.xrpReceivedEstimate;
    const { transactionFees, buyingFees } = await calculateFees(xrpAmount);
    const xrpUsdPrice = await getXrpUsdPrice();
    const slippageTolerance = 0.001; // 0.1%
    const expectedPricePerToken = xrpAmount / tokenAmount;
    const minPricePerToken = priceFromPortal * (1 - slippageTolerance);
    if (expectedPricePerToken < minPricePerToken) {
      return res.status(400).json({ message: 'Slippage too high, please try again', status });
    }
    const trade = await Trade.create({
      userId,
      type: 'sell',
      tokenAmount: tokenAmount,
      tokenSymbol: currency,
      issuer,
      xrpAmount: xrpAmount,
      buyingFees,
      transactionFees,
      pricePerToken: xrpAmount / tokenAmount,
      status: 'pending',
      amountUsd: xrpAmount * xrpUsdPrice,
    });
    // ---- Confirm transaction ----
    const status = await xrplService2.txStatus(sellResult.tx_hash);
    trade.txHash = sellResult.tx_hash;
    trade.status = status.meta.TransactionResult === 'tesSUCCESS' ? 'success' : 'failed';
    trade.updatedAt = new Date();
    await trade.save();
    if (trade.status === 'success') {
      const profitLoss = await updatePortfolio(
        userId,
        currency,
        issuer,
        'sell',
        tokenAmount,
        xrpAmount,
        xrpAmount / tokenAmount,
        transactionFees
      );
      const plUSD = Number((profitLoss / xrpUsdPrice).toFixed(4));
      await historyService.createHistory({
        userId,
        identifier: `${userId}-${currency}`,
        tokenSymbol: currency,
        issuer,
        type: 'sell',
        quantity: tokenAmount,
        xrpInvestedOrReceived: xrpAmount,
        exitPrice: xrpAmount / tokenAmount,
        buyingFees,
        transactionFees,
        amountUsd: xrpAmount * xrpUsdPrice,
        soldDate: new Date(),
        txHash: trade.txHash,
        status: 'success',
        profitLossXRP: profitLoss,
        profitLossUSD: plUSD,
      });
    }
    if (status.meta.TransactionResult !== 'tesSUCCESS') {
      return res.status(400).json({ message: 'Sell failed', status });
    }

    const xrpReceived = Number(sellResult.xrpReceivedEstimate);

    // ---- Add XRP to user ----
    user.totalAmount += xrpReceived;
    await user.save();

    return res.json({
      message: 'Token sold successfully',
      xrpReceived,
      txHash: sellResult.tx_hash,
      issuer,
    });
  } catch (err) {
    console.error('SELL ERROR:', err);
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  buyToken,
  sellToken,
};
