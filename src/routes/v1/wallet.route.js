// const express = require('express');
// const auth = require('../../middlewares/auth');
// const validate = require('../../middlewares/validate');
// const userValidation = require('../../validations/user.validation');
// const userController = require('../../controllers/user.controller');

// const router = express.Router();

// // router
// //   .route('/')
// //   .post(auth('manageUsers'), validate(userValidation.createUser), userController.createUser)
// //   .get(auth('getUsers'), validate(userValidation.getUsers), userController.getUsers);

// router.get('/wallets/coinbase/connect', async (req, res) => {
//   const authUrl = `https://www.coinbase.com/oauth/authorize?response_type=code&client_id=${process.env.COINBASE_CLIENT_ID}&redirect_uri=${process.env.COINBASE_REDIRECT_URI}&scope=wallet:accounts:read,wallet:addresses:create`;
//   res.json({ url: authUrl });
// });

// module.exports = router;4

const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const walletValidation = require('../../validations/wallet.validation');
const walletController = require('../../controllers/wallet.controller');
const { Wallet } = require('../../models');

const router = express.Router();

router
  .route('/')
  .post(auth('manageWallets'), validate(walletValidation.createWallet), walletController.createWallet)
  .get(auth('getWallets'), validate(walletValidation.getWallets), walletController.getWallets);

router
  .route('/:walletId')
  .get(auth('getWallets'), validate(walletValidation.getWallet), walletController.getWallet)
  .patch(auth('manageWallets'), validate(walletValidation.updateWallet), walletController.updateWallet)
  .delete(auth('manageWallets'), validate(walletValidation.deleteWallet), walletController.deleteWallet);

// Coinbase routes
router.get('/coinbase/connect', auth('manageWallets'), walletController.coinbaseConnect);
router.get('/coinbase/callback', auth('manageWallets'), walletController.coinbaseCallback);

router.post('/buy-memecoin', walletController.buyMemecoinController);

// get all user wallets
router.get('/wallets', async (req, res) => {
  try {
    const wallets = await Wallet.find().populate('userId', 'email name');
    res.status(200).json({ success: true, count: wallets.length, wallets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// get a wallet by userId
router.get('/wallets/:userId', async (req, res) => {
  try {
    const wallet = await Wallet.find({ userId: req.params.userId });
    res.status(200).json({ success: true, wallet });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
