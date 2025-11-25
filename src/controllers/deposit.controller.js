const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { depositService } = require('../services');
const { DEPOSIT_WALLET_ADDRESS } = process.env;

const getDepositInfoEmail = catchAsync(async (req, res) => {
  const user = await depositService.getDepositInfoEmail(req.params);
  res.send({
    address: DEPOSIT_WALLET_ADDRESS,
    destinationTag: user.destinationTag,
  });
});

const getDeposit = catchAsync(async (req, res) => {
  const user = await depositService.getDeposit(req.body);
  res.send(user);
});

module.exports = {
  getDepositInfoEmail,
  getDeposit,
};
