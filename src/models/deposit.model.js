const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const DepositSchema = new mongoose.Schema(
  {
    txId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    amountDrops: { type: String, required: true }, // amount in drops (1 XRP = 1,000,000 drops)
    amountXRP: { type: String, required: true }, // human readable
    source: { type: String }, // sending address
    destination: { type: String }, // your hot wallet address
    destinationTag: { type: Number, default: null },
    depositType: { type: String, default: 'received' },
    ledgerIndex: { type: Number },
    validated: { type: Boolean, default: false },
    transactionFees: {
      type: Number,
      default: 0.9,
    },
    raw: { type: Object }, // full transaction object for auditing
  },
  { timestamps: true }
);

// add plugin that converts mongoose to json
DepositSchema.plugin(toJSON);
DepositSchema.plugin(paginate);

const Deposit = mongoose.model('Deposit', DepositSchema);

module.exports = Deposit;
