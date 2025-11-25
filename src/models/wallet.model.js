// const mongoose = require('mongoose');
// const validator = require('validator');

// const walletSchema = mongoose.Schema(
//   {
//     userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//     type: { type: String, enum: ['xrpl_custodial', 'xrpl_xumm', 'coinbase'], required: true },
//     address: { type: String }, // XRPL rAddress
//     destinationTag: { type: Number }, // For custodial deposit mapping
//     xummUserToken: { type: String }, // For XUMM (if non-custodial)
//     coinbaseAccountId: { type: String }, // If linked Coinbase account
//     isPrimary: { type: Boolean, default: false },
//     metadata: { type: mongoose.Schema.Types.Mixed },
//   },
//   { timestamps: true }
// );
// const Wallet = mongoose.model('Wallet', walletSchema);

// module.exports = Wallet;

// models/wallet.model.js
// 2
const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins'); // optional if you already have these

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // address: {
    //   type: String,
    //   required: true,
    //   unique: true,
    // },
    cryptoName: {
      type: String,
      default: 'XRP', // e.g. XRP, TST, PEPE
    },
    issuer: {
      type: String, // only for tokens like memecoins
    },
    quantity: {
      type: Number,
      default: 0,
    },
    totalAmountDrops: {
      type: String, // keep as string to match XRPL precision
    },
    lastTxHash: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    // xrpBalance: {
    //   type: String,
    //   default: '0',
    // },
  },
  {
    timestamps: true,
  }
);

walletSchema.plugin(toJSON);
walletSchema.plugin(paginate);

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;
