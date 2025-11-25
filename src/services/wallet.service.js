const httpStatus = require('http-status');
const { Wallet, User } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * Create a wallet for user
 * @param {ObjectId} userId
 * @param {Object} walletBody
 * @returns {Promise<Wallet>}
 */
const createWallet = async (userId, walletBody) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const wallet = await Wallet.create({ ...walletBody, user: userId });
  return wallet;
};

/**
 * Query wallets
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
const queryWallets = async (filter, options) => {
  const wallets = await Wallet.paginate(filter, options);
  return wallets;
};

/**
 * Get wallet by id
 * @param {ObjectId} id
 * @returns {Promise<Wallet>}
 */
const getWalletById = async (id) => {
  return Wallet.findById(id);
};

/**
 * Update wallet by id
 * @param {ObjectId} walletId
 * @param {Object} updateBody
 * @returns {Promise<Wallet>}
 */
const updateWalletById = async (walletId, updateBody) => {
  const wallet = await getWalletById(walletId);
  if (!wallet) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Wallet not found');
  }
  Object.assign(wallet, updateBody);
  await wallet.save();
  return wallet;
};

/**
 * Delete wallet by id
 * @param {ObjectId} walletId
 * @returns {Promise<Wallet>}
 */
const deleteWalletById = async (walletId) => {
  const wallet = await getWalletById(walletId);
  if (!wallet) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Wallet not found');
  }
  await wallet.remove();
  return wallet;
};

// Coinbase callback logic
const handleCoinbaseCallback = async (userId, code) => {
  const tokenResponse = await axios.post('https://api.coinbase.com/oauth/token', {
    grant_type: 'authorization_code',
    code,
    client_id: process.env.COINBASE_CLIENT_ID,
    client_secret: process.env.COINBASE_CLIENT_SECRET,
    redirect_uri: process.env.COINBASE_REDIRECT_URI,
  });

  const { access_token, refresh_token } = tokenResponse.data;

  const wallet = await Wallet.create({
    user: userId,
    type: 'coinbase',
    connected: true,
    accessToken: access_token,
    refreshToken: refresh_token,
  });

  return wallet;
};

module.exports = {
  createWallet,
  queryWallets,
  getWalletById,
  updateWalletById,
  deleteWalletById,
  handleCoinbaseCallback,
};
