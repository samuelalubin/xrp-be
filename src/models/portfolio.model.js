const mongoose = require('mongoose');
const { Schema } = mongoose;

const PortfolioSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tokenSymbol: { type: String, required: true },
  issuer: { type: String, required: true },
  identifier: { type: String, unique: true, required: true }, // userId-tokenSymbol combo

  // entries: [EntrySchema],

  entries: [
    {
      tokenAmount: { type: Number, required: true },
      pricePerToken: { type: Number, required: true },
      totalXrpSpent: { type: Number, required: true },
      date: { type: Date, default: Date.now },
    },
  ], // 📊 Multiple entry batches

  totalTokenHeld: { type: Number, default: 0 },
  totalInvestedXRP: { type: Number, default: 0 },
  averageEntryPrice: { type: Number, default: 0 },

  currentMarketPrice: { type: Number, default: 0 },
  currentValueXRP: { type: Number, default: 0 },
  profitLossXRP: { type: Number, default: 0 },
  profitLossUSD: { type: Number, default: 0 },

  lastUpdated: { type: Date, default: Date.now },
});

PortfolioSchema.index({ userId: 1, tokenSymbol: 1 }, { unique: true });

module.exports = mongoose.model('Portfolio', PortfolioSchema);
