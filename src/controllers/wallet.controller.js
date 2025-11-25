const httpStatus = require('http-status');
const pick = require('../utils/pick');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { walletService } = require('../services');
const { buyMemecoin } = require('../services/xrpMemecoin.service');
const xrpl = require('xrpl');
const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
const Wallet = require('../models/wallet.model');

const createWallet = catchAsync(async (req, res) => {
  const wallet = await walletService.createWallet(req.user.id, req.body);
  res.status(httpStatus.CREATED).send(wallet);
});

const getWallets = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['type', 'address']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await walletService.queryWallets(filter, options);
  res.send(result);
});

const getWallet = catchAsync(async (req, res) => {
  const wallet = await walletService.getWalletById(req.params.walletId);
  if (!wallet) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Wallet not found');
  }
  res.send(wallet);
});

const updateWallet = catchAsync(async (req, res) => {
  console.log('chalyy3');

  const wallet = await walletService.updateWalletById(req.params.walletId, req.body);
  res.send(wallet);
});

const deleteWallet = catchAsync(async (req, res) => {
  await walletService.deleteWalletById(req.params.walletId);
  res.status(httpStatus.NO_CONTENT).send();
});

const coinbaseConnect = catchAsync(async (req, res) => {
  const authUrl = `https://www.coinbase.com/oauth/authorize?response_type=code&client_id=${process.env.COINBASE_CLIENT_ID}&redirect_uri=${process.env.COINBASE_REDIRECT_URI}&scope=wallet:accounts:read,wallet:addresses:create`;
  res.json({ url: authUrl });
});

// Coinbase callback (save tokens)
const coinbaseCallback = catchAsync(async (req, res) => {
  const { code } = req.query;
  const wallet = await walletService.handleCoinbaseCallback(req.user.id, code);
  res.json({ message: 'Coinbase wallet connected successfully', wallet });
});

// controllers / wallet.controller.js;

// const buyMemecoinController = async (req, res) => {
//   try {
//     const { memecoinIssuer, memecoinCode, xrpAmount } = req.body;

//     // Use your hot wallet seed (Testnet)
//     const seed = process.env.XRPL_TEST_SEED;

//     const txResult = await buyMemecoin(seed, memecoinIssuer, memecoinCode, xrpAmount);
//     res.status(200).json({ success: true, txResult });
//   } catch (err) {
//     console.error('Buy memecoin error:', err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// };
// 2

// const buyMemecoinController = async (req, res) => {
//   try {
//     const { memecoinIssuer, memecoinCode, xrpAmount } = req.body;
//     const seed = process.env.XRPL_TEST_SEED; // your hot wallet seed

//     // Execute the buy transaction
//     const txResult = await buyMemecoin(seed, memecoinIssuer, memecoinCode, xrpAmount);

//     const txHash = txResult?.result?.hash || txResult?.tx_json?.hash;
//     const totalAmountDrops = xrpl.xrpToDrops(xrpAmount);

//     // Save to DB
//     const walletDoc = await Wallet.create({
//       userId: req.user?._id || null, // if using auth middleware
//       address: xrpl.Wallet.fromSeed(seed).classicAddress,
//       cryptoName: memecoinCode,
//       issuer: memecoinIssuer,
//       quantity: 1000, // amount you bought (from your OfferCreate)
//       totalAmountDrops,
//       lastTxHash: txHash,
//       type: 'buy',
//     });

//     res.status(200).json({
//       success: true,
//       message: 'Memecoin bought successfully!',
//       txHash,
//       wallet: walletDoc,
//     });
//   } catch (err) {
//     console.error('Buy memecoin error:', err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// const buyMemecoinController = async (req, res) => {
//   try {
//     const { userId, memecoinIssuer, memecoinCode, xrpAmount } = req.body;
//     const seed = process.env.XRPL_TEST_SEED; // hot wallet seed (Testnet)

//     // 1️⃣ Perform the memecoin buy transaction
//     const txResult = await buyMemecoin(seed, memecoinIssuer, memecoinCode, xrpAmount);

//     // 2️⃣ Get transaction hash
//     const txHash = txResult?.result?.hash || txResult?.tx_json?.hash;

//     // 3️⃣ Convert XRP to drops
//     const totalAmountDrops = xrpl.xrpToDrops(xrpAmount);

//     // 4️⃣ Create XRPL wallet instance
//     const wallet = xrpl.Wallet.fromSeed(seed);

//     // 5️⃣ ✅ Fetch live XRP balance
//     await client.connect();
//     const balanceRes = await client.request({
//       command: 'account_info',
//       account: wallet.classicAddress,
//     });
//     await client.disconnect();

//     // balance in XRP
//     // const xrpBalance = xrpl.dropsToXrp(balanceRes.result.account_data.Balance);

//     const walletDoc = await Wallet.create({
//       userId, // ✅ from request
//       address: wallet.classicAddress,
//       cryptoName: memecoinCode,
//       issuer: memecoinIssuer,
//       quantity: 1000,
//       totalAmountDrops,
//       lastTxHash: txHash,
//       type: 'buy',
//       xrpBalance,
//     });

//     res.status(200).json({
//       success: true,
//       message: 'Memecoin bought successfully!',
//       txHash,
//       xrpBalance,
//       wallet: walletDoc,
//     });
//   } catch (err) {
//     console.error('Buy memecoin error:', err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// };
const buyMemecoinController = async (req, res) => {
  try {
    const { userId, memecoinIssuer, memecoinCode, xrpAmount } = req.body;
    const seed = process.env.XRPL_TEST_SEED;

    // 1️⃣ Perform memecoin buy
    const txResult = await buyMemecoin(seed, memecoinIssuer, memecoinCode, xrpAmount);

    // 2️⃣ Transaction details
    const txHash = txResult?.result?.hash || txResult?.tx_json?.hash;
    const totalAmountDrops = xrpl.xrpToDrops(xrpAmount);
    const wallet = xrpl.Wallet.fromSeed(seed);

    // 3️⃣ Get live XRP balance
    await client.connect();
    const balanceRes = await client.request({
      command: 'account_info',
      account: wallet.classicAddress,
    });
    await client.disconnect();

    const xrpBalance = xrpl.dropsToXrp(balanceRes.result.account_data.Balance);

    // 4️⃣ Save wallet info
    const walletDoc = await Wallet.create({
      userId,
      address: wallet.classicAddress,
      cryptoName: memecoinCode,
      issuer: memecoinIssuer,
      quantity: 1000,
      totalAmountDrops,
      lastTxHash: txHash,
      type: 'buy',
      xrpBalance,
    });

    // 5️⃣ Respond
    res.status(200).json({
      success: true,
      message: 'Memecoin bought successfully!',
      txHash,
      xrpBalance,
      wallet: walletDoc,
    });
  } catch (err) {
    console.error('Buy memecoin error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createWallet,
  getWallets,
  getWallet,
  updateWallet,
  deleteWallet,
  coinbaseConnect,
  coinbaseCallback,
  buyMemecoinController,
};
