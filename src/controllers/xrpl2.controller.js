const Trade = require('../models/trade.model');
const { estimateBuy, executeTrade } = require('../services/xrpl.service');
const { updatePortfolio } = require('../services/portfolio.service');
const { historyService } = require('../services');
const { xrplService2 } = require('../services');

const xrpl = require('xrpl');
const { User } = require('../models');

// Fetch real-time XRP price in USD from CoinGecko
const buyToken = async (req, res) => {
  try {
    const { issuer, userId, currency, amountXrp } = req.body;
    console.log(issuer, userId, currency);
    if (!currency || !amountXrp) return res.status(400).json({ message: 'currency & amountXrp required' });

    // ---- Fetch user ----
    const user = await User.findById(userId);
    if (!user) return res.status(400).json({ message: 'Invalid user' });

    if (user.totalAmount < amountXrp) return res.status(400).json({ message: 'Not enough XRP' });

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
      xrpAmount: amountXrp,
      tokenCurrency: currency,
      tokenIssuer: issuer,
    });

    // ---- Confirm transaction ----
    const status = await xrplService2.txStatus(buyResult.tx_hash);

    if (status.meta.TransactionResult !== 'tesSUCCESS') {
      return res.status(400).json({ message: 'Buy failed', status });
    }

    // ---- Deduct user XRP ----
    user.totalAmount -= Number(amountXrp);
    await user.save();

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
    const { issuer, userId, currency, tokenAmount } = req.body;

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

    // ---- Confirm transaction ----
    const status = await xrplService2.txStatus(sellResult.tx_hash);

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
