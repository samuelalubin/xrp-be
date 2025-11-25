const mongoose = require('mongoose');
const { Schema } = mongoose;

// XRPL Trade schema for buy/sell transactions
const TradeSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['buy', 'sell'], required: true },
  // xrpAmount: { type: Number, required: true }, // XRP spent or received
  xrpAmount: {
    type: Number,
    required: function () {
      return this.type === 'buy'; // required only for buy
    },
  },
  tokenAmount: {
    type: Number,
    required: function () {
      return this.type === 'sell';
    },
  },
  // tokenAmount: { type: Number }, // Tokens bought or sold
  tokenSymbol: { type: String, required: true }, // e.g. MEME
  issuer: { type: String, required: true }, // Contract address (issuer)
  txHash: { type: String }, // XRPL transaction hash
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },

  xrpDropAmountToBuy: {
    type: Number,
  }, // XRP drop amount used to buy (if applicable)

  buyingFees: {
    type: Number,
    default: 0,
  }, // Fees incurred during buying

  pricePerToken: {
    type: Number,
  }, // Price of a single token during the trade

  transactionFees: {
    type: Number,
    default: 0.9,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  }, // When the trade was created

  updatedAt: {
    type: Date,
    default: Date.now,
  }, // Last updated timestamp

  sellDate: {
    type: Date,
    // default: Date.now,
  }, // Timestamp when the token was sold (only for sell trades)
});

module.exports = mongoose.model('Trade', TradeSchema);

// const mongoose = require('mongoose');
// const { toJSON, paginate } = require('./plugins');

// const TradeSchema = new mongoose.Schema(
//   {
//     userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//     type: { type: String, enum: ['buy', 'sell'], required: true },
//     baseCurrency: { type: String, required: true }, // e.g., XRP
//     quoteCurrency: { type: String, required: true }, // e.g., USD
//     price: { type: Number, required: true },
//     amount: { type: Number, required: true },
//     total: { type: Number, required: true },
//     status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'pending' },
//     txId: { type: String },
//     type: { type: String, enum: ['buy', 'sell'], required: true },
//     xrpAmount: { type: Number, required: true }, // XRP spent or received
//     tokenAmount: { type: Number }, // Tokens bought or sold
//     tokenSymbol: { type: String, required: true }, // e.g. MEME
//     issuer: { type: String, required: true }, // Contract address (issuer)
//   },
//   { timestamps: true }
// );

// TradeSchema.plugin(toJSON);
// TradeSchema.plugin(paginate);

// const Trade = mongoose.model('Trade', TradeSchema);

// module.exports = Trade;
