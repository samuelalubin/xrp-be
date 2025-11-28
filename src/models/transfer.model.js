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
  //     networkFee: { type: String },
});

const Transfer = mongoose.model('Transfer', transferSchema);
module.exports = Transfer;
