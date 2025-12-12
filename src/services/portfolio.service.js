// services/portfolio.service.js

const { Portfolio, User } = require('../models');

/**
 * Update or create portfolio entry for user after a trade.
 * Handles multiple entry points and FIFO sell logic.
 */
const updatePortfolio = async (
  userId,
  tokenSymbol,
  issuer,
  type,
  tokenAmount,
  xrpAmount,
  pricePerToken,
  transactionFees,
  image
) => {
  try {
    const identifier = `${userId}-${tokenSymbol}`;
    let portfolio = await Portfolio.findOne({ identifier });

    if (type === 'buy') {
      // Create or update existing portfolio
      if (!portfolio) {
        portfolio = await Portfolio.create({
          userId,
          tokenSymbol,
          issuer,
          identifier,
          entries: [
            {
              tokenAmount,
              pricePerToken,
              totalXrpSpent: xrpAmount,
            },
          ],
          totalTokenHeld: tokenAmount,
          totalInvestedXRP: xrpAmount,
          averageEntryPrice: pricePerToken,
          icon: image,
        });
      } else {
        // Add a new entry
        portfolio.entries.push({
          tokenAmount,
          pricePerToken,
          totalXrpSpent: xrpAmount,
        });

        // Recalculate totals
        const totalTokenHeld = portfolio.entries.reduce((sum, e) => sum + e.tokenAmount, 0);
        const totalInvestedXRP = portfolio.entries.reduce((sum, e) => sum + e.totalXrpSpent, 0);
        const averageEntryPrice = totalInvestedXRP / totalTokenHeld;
        // portfolio.icon = image;
        portfolio.totalTokenHeld = totalTokenHeld;
        portfolio.totalInvestedXRP = totalInvestedXRP;
        portfolio.averageEntryPrice = averageEntryPrice;
        portfolio.lastUpdated = new Date();
        await portfolio.save();
      }
      const c = await User.findOneAndUpdate(
        { _id: userId },
        { $inc: { totalAmount: -xrpAmount, totalAmountDrops: -(xrpAmount * 1_000_000) } }
      );
      const c2 = await User.findOneAndUpdate(
        { role: 'admin' },
        { $inc: { totalAmount: transactionFees, totalAmountDrops: transactionFees * 1_000_000 } }
      );
      console.log(c2);
    } else if (type === 'sell') {
      if (!portfolio) {
        console.warn('⚠️ Portfolio not found for user/token:', userId, tokenSymbol);
        return;
      }

      let remainingToSell = tokenAmount;
      let updatedEntries = [];
      let profitLoss = 0;

      // FIFO: deduct tokens starting from oldest entries
      // for (const entry of portfolio.entries) {
      //   if (remainingToSell <= 0) {
      //     updatedEntries.push(entry);
      //     continue;
      //   }

      //   if (entry.tokenAmount <= remainingToSell) {
      //     remainingToSell -= entry.tokenAmount;
      //     // fully consumed, skip adding back
      //   } else {
      //     entry.tokenAmount -= remainingToSell;
      //     entry.totalXrpSpent = entry.tokenAmount * entry.pricePerToken;
      //     updatedEntries.push(entry);
      //     remainingToSell = 0;
      //   }
      // }

      for (const entry of portfolio.entries) {
        if (remainingToSell <= 0) {
          updatedEntries.push(entry);
          continue;
        }

        const qtyToSell = Math.min(entry.tokenAmount, remainingToSell);
        profitLoss += (pricePerToken - entry.pricePerToken) * qtyToSell; // realized profit/loss
        remainingToSell -= qtyToSell;

        // fully consume this entry
        entry.tokenAmount -= qtyToSell;
        entry.totalXrpSpent = entry.tokenAmount * entry.pricePerToken;

        // Only keep if some tokens remain
        if (entry.tokenAmount > 0) updatedEntries.push(entry);
      }
      portfolio.entries = updatedEntries.filter((e) => e.tokenAmount > 0);

      // Recalculate totals after sell
      const totalTokenHeld = portfolio.entries.reduce((sum, e) => sum + e.tokenAmount, 0);
      const totalInvestedXRP = portfolio.entries.reduce((sum, e) => sum + e.totalXrpSpent, 0);
      const averageEntryPrice = totalTokenHeld > 0 ? totalInvestedXRP / totalTokenHeld : 0;

      portfolio.totalTokenHeld = totalTokenHeld;
      portfolio.totalInvestedXRP = totalInvestedXRP;
      portfolio.averageEntryPrice = averageEntryPrice;
      portfolio.lastUpdated = new Date();

      await portfolio.save();
      const c = await User.findOneAndUpdate(
        { _id: userId },
        { $inc: { totalAmount: xrpAmount, totalAmountDrops: xrpAmount * 1_000_000 } }
      );
      const c2 = await User.findOneAndUpdate(
        { role: 'admin' },
        { $inc: { totalAmount: transactionFees, totalAmountDrops: transactionFees * 1_000_000 } }
      );
      return profitLoss;
    }
  } catch (err) {
    console.error('❌ Error updating portfolio:', err);
  }
};

module.exports = { updatePortfolio };
