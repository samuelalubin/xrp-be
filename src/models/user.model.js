const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const { toJSON, paginate } = require('./plugins');
const { roles } = require('../config/roles');

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      // required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      validate(value) {
        if (!validator.isEmail(value)) {
          throw new Error('Invalid email');
        }
      },
    },
    destinationTag: {
      type: Number,
      default: null,
    }, // assigned destTag when created
    totalAmountDrops: {
      type: Number,
      default: 0,
      min: [0, 'Total amount cannot be negative'],
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: [0, 'Total amount cannot be negative'],
    },
    password: {
      type: String,
      required: true,
      trim: true,
      minlength: 8,
      validate(value) {
        if (!value.match(/\d/) || !value.match(/[a-zA-Z]/)) {
          throw new Error('Password must contain at least one letter and one number');
        }
      },
      private: true, // used by the toJSON plugin
    },
    role: {
      type: String,
      enum: roles,
      default: 'user',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    delete: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
userSchema.plugin(toJSON);
userSchema.plugin(paginate);

/**
 * Check if email is taken
 * @param {string} email - The user's email
 * @param {ObjectId} [excludeUserId] - The id of the user to be excluded
 * @returns {Promise<boolean>}
 */
userSchema.statics.isEmailTaken = async function (email, excludeUserId) {
  const user = await this.findOne({ email, _id: { $ne: excludeUserId } });
  return !!user;
};

/**
 * Check if password matches the user's password
 * @param {string} password
 * @returns {Promise<boolean>}
 */
userSchema.methods.isPasswordMatch = async function (password) {
  const user = this;
  return bcrypt.compare(password, user.password);
};

userSchema.pre('save', async function (next) {
  const user = this;
  if (user.isModified('password')) {
    user.password = await bcrypt.hash(user.password, 8);
  }
  next();
});

/**
 * @typedef User
 */

const User = mongoose.model('User', userSchema);

module.exports = User;

// const DestinationMappingSchema = new mongoose.Schema({
//   destinationTag: { type: Number, required: true, unique: true },
//   userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   createdAt: { type: Date, default: Date.now },
// });

// const DepositSchema = new mongoose.Schema(
//   {
//     txId: { type: String, required: true, unique: true },
//     userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
//     amountDrops: { type: String, required: true }, // amount in drops (1 XRP = 1,000,000 drops)
//     amountXRP: { type: String, required: true }, // human readable
//     source: { type: String }, // sending address
//     destination: { type: String }, // your hot wallet address
//     destinationTag: { type: Number, default: null },
//     ledgerIndex: { type: Number },
//     validated: { type: Boolean, default: false },
//     raw: { type: Object }, // full transaction object for auditing
//   },
//   { timestamps: true }
// );

// const DestinationMapping = mongoose.model('DestinationMapping', DestinationMappingSchema);
// const Deposit = mongoose.model('Deposit', DepositSchema);

// module.exports = { User, DestinationMapping, Deposit };
