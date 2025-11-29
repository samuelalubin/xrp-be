// services/history.service.js

const { History } = require('../models');

/**
 * Create a new history record
 */
const createHistory = async (data) => {
  const history = new History(data);
  return await history.save();
};

/**
 * Create history from an existing Trade object
 */
const createFromTrade = async (trade) => {
  // Map fields as you prefer
  const data = {
    userId: trade.userId,
    identifier: `${trade.userId}-${trade.tokenSymbol}`,
    tokenSymbol: trade.tokenSymbol,
    issuer: trade.issuer,
    type: trade.type, // 'buy' | 'sell'
    // choose quantity semantics:
    quantity: trade.tokenAmount || trade.xrpAmount || 0,
    xrpInvestedOrReceived: trade.xrpAmount || 0,
    entryPrice: trade.type === 'buy' ? trade.pricePerToken : undefined,
    exitPrice: trade.type === 'sell' ? trade.pricePerToken : undefined,
    currentPrice: trade.currentMarketPrice || undefined,
    profitLossXRP: trade.profitLossXRP || 0,
    profitLossUSD: trade.profitLossUSD || 0,
    buyDate: trade.type === 'buy' ? trade.createdAt || new Date() : trade.buyDate,
    soldDate: trade.type === 'sell' ? trade.sellDate || new Date() : trade.soldDate,
    txHash: trade.txHash,
    status: trade.status || 'success',
    createdAt: new Date(),
  };

  return createHistory(data);
};
/**
 * Get full memecoin history for a user by identifier
 */
const getUserMemecoinHistory = async (userId, identifier) => {
  return await History.find({ userId, identifier }).sort({ createdAt: -1 });
};

/**
 * Get all history for a user (all tokens)
 */
const getUserHistory = async (userId) => {
  return await History.find({ userId }).sort({ createdAt: -1 });
};

/**
 * Get all history for a user (all tokens)
 */
const getHistory = async (filter, options) => {
  return await History.paginate(filter, options);
};

/**
 * Delete a history record
 */
const deleteHistory = async (id) => {
  return await History.findByIdAndDelete(id);
};

const getHistoryByIdentifier = async (identifier) => {
  return await History.find({ identifier }).sort({ createdAt: -1 });
};

module.exports = {
  createHistory,
  getUserMemecoinHistory,
  getUserHistory,
  deleteHistory,
  createFromTrade,
  getHistoryByIdentifier,
  getHistory,
};
