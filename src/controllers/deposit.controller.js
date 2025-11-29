const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { depositService } = require('../services');
const { User } = require('../models');
const pick = require('../utils/pick');

const { DEPOSIT_WALLET_ADDRESS } = process.env;

const getDepositInfoEmail = catchAsync(async (req, res) => {
  const user = await depositService.getDepositInfoEmail(req.params);
  res.send({
    address: DEPOSIT_WALLET_ADDRESS,
    destinationTag: user.destinationTag,
  });
});

const getDeposit = catchAsync(async (req, res) => {
  let filter = {};
  const options = pick(req.body, ['sortBy', 'limit', 'page']);
  const user = await User.findOne({ _id: req.body.userId });
  const role = user?.role || 'user';
  if (role !== 'admin') {
    filter.userId = req.body.userId;
  }
  // const filter = pick(req.body, ['userId']);
  const deposit = await depositService.getDeposit(filter, options);
  res.send(deposit);
});

module.exports = {
  getDepositInfoEmail,
  getDeposit,
};
