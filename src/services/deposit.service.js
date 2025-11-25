const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const { Deposit, User } = require('../models');

const getDepositInfoEmail = async (updateBody) => {
  console.log('chalyy6');

  const email = updateBody.email;
  const user = await User.findOne({ email });
  //   if (!user) return res.status(404).json({ error: 'user not found' });
  if (!user) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'user not found');
  }
  return user;
};

// Save a new deposit (used by webhook or listener)
const saveDeposit = async (tx) => {
  console.log('chalyy7');
  const destinationTag = tx.DestinationTag;
  const user = await User.findOne({ destinationTag });

  if (!user) return;

  const amountDrops = tx.Amount;
  const amountXRP = (parseFloat(amountDrops) / 1_000_000).toFixed(6);

  await Deposit.create({
    txId: tx.hash,
    userId: user._id,
    amountDrops,
    amountXRP,
    source: tx.Account,
    destination: tx.Destination,
    destinationTag,
    validated: tx.validated,
    raw: tx,
  });

  // 1️⃣ Fetch all deposits for this user
  const deposits = await Deposit.find({ userId: user._id });

  // 2️⃣ Sum total XRP
  const totalXRP = deposits.reduce((acc, d) => acc + parseFloat(d.amountXRP), 0);

  // 3️⃣ Store total balance in user (optional field)
  user.totalBalanceXRP = totalXRP.toFixed(6);
  await user.save();
};

// Get deposits (demo)
const getDeposit = async () => {
  console.log('chalyy8');

  const deposits = await Deposit.find();
  //   .sort({ createdAt: -1 }).limit(50).populate('userId');
  return deposits;
};

module.exports = {
  getDepositInfoEmail,
  getDeposit,
  saveDeposit,
};
