// const mongoose = require('mongoose');
// const { toJSON, paginate } = require('./plugins');

// const TransferSchema = new mongoose.Schema(
//   {
//     txId: { type: String, unique: true },
//     fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//     toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // internal transfer
//     source: { type: String }, // sending wallet
//     destination: { type: String, required: true },
//     destinationTag: { type: Number, default: null },
//     amountDrops: { type: String, required: true },
//     amountXRP: { type: String, required: true },
//     networkFee: { type: String },
//     status: { type: String, enum: ['pending', 'processing', 'confirmed', 'failed'], default: 'pending' },
//     validated: { type: Boolean, default: false },
//     raw: { type: Object },
//   },
//   { timestamps: true }
// );

// TransferSchema.plugin(toJSON);
// TransferSchema.plugin(paginate);

// const Transfer = mongoose.model('Transfer', TransferSchema);
// module.exports = Transfer;

// models/transfer.model.js
const mongoose = require('mongoose');

const transferSchema = new mongoose.Schema({
  fromUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  toAddress: {
    type: String,
    required: true,
  },
  destinationTag: {
    type: String,
  },
  amount: {
    type: Number,
    required: true,
  },
  txId: {
    type: String,
    // required: true,
    // index: true,
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending',
  },
  explorerUrl: {
    type: String,
  },
  rawResponse: {
    type: Object,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Transfer = mongoose.model('Transfer', transferSchema);
module.exports = Transfer;
