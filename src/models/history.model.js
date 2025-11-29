// models/history.model.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { toJSON, paginate } = require('./plugins');

const HistorySchema = new Schema({
  // userId: {
  //   type: Schema.Types.ObjectId,
  //   ref: 'User',
  //   required: true,
  // },
  // tradeId: {
  //   type: Schema.Types.ObjectId,
  //   ref: 'Trade',
  //   required: true,
  // },
  // tokenSymbol: {
  //   type: String,
  //   required: true,
  // },
  // issuer: {
  //   type: String,
  //   required: true,
  // },
  // type: {
  //   type: String,
  //   enum: ['buy', 'sell'],
  //   required: true,
  // },
  // xrpAmount: {
  //   type: Number,
  // },
  // tokenAmount: {
  //   type: Number,
  // },
  // pricePerToken: {
  //   type: Number,
  // },
  // transactionFees: {
  //   type: Number,
  //   default: 0,
  // },
  // txHash: {
  //   type: String,
  // },
  // status: {
  //   type: String,
  //   enum: ['success', 'failed'],
  //   required: true,
  // },
  // createdAt: {
  //   type: Date,
  //   default: Date.now,
  // },
  // ________________________
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  identifier: { type: String, required: true }, // userId-tokenSymbol combo
  tokenSymbol: { type: String, required: true },
  issuer: { type: String, required: true },

  type: { type: String, enum: ['buy', 'sell'], required: true },

  quantity: { type: Number, required: true },
  xrpInvestedOrReceived: { type: Number, required: true },

  entryPrice: { type: Number },
  exitPrice: { type: Number },
  currentPrice: { type: Number },

  profitLossXRP: { type: Number, default: 0 },
  profitLossUSD: { type: Number, default: 0 },
  // new
  marketPrice: { type: Number, default: 0 },

  buyDate: { type: Date },
  soldDate: { type: Date },

  txHash: { type: String },
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'success' },
  amountUsd: {
    type: Number,
  }, // Price of a single token during the trade
  transactionFees: {
    type: Number,
    default: 0.9,
  },
  buyingFees: {
    type: Number,
    default: 0,
  }, // Fees incurred during buying

  createdAt: { type: Date, default: Date.now },
});

HistorySchema.plugin(toJSON);
HistorySchema.plugin(paginate);

module.exports = mongoose.model('History', HistorySchema);
