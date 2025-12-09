const httpStatus = require('http-status');
const pick = require('../utils/pick');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { userService } = require('../services');
const { User, History } = require('../models');

const createUser = catchAsync(async (req, res) => {
  const user = await userService.createUser(req.body);
  res.status(httpStatus.CREATED).send(user);
});

const getUsers = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['name', 'role']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await userService.queryUsers(filter, options);
  res.send(result);
});

const getUser = catchAsync(async (req, res) => {
  const user = await userService.getUserById(req.params.userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  res.send(user);
});

const updateUser = catchAsync(async (req, res) => {
  console.log('chalyy2');

  const user = await userService.updateUserById(req.params.userId, req.body);
  res.send(user);
});

const deleteUser = catchAsync(async (req, res) => {
  await userService.deleteUserById(req.params.userId);
  res.status(httpStatus.NO_CONTENT).send();
});

const getXrpUsdPrice = async () => {
  // const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
  const response = await fetch(
    'https://min-api.cryptocompare.com/data/pricemulti?fsyms=XRP&tsyms=USD&api_key=cac4cc4bdd9088646112252cc2cab4eebe9c927483b7a93d8f77d5f83e464151'
  );
  const data = await response.json();
  console.log(data);
  // return data.ripple.usd; // price in USD
  return data.XRP.USD; // price in USD
};
const stats = catchAsync(async (req, res) => {
  const xrpPriceUSD = await getXrpUsdPrice();

  // Users
  const users30 = await userService.aggregateStats({ model: User, dateField: 'createdAt', lastNDays: 30 });
  const users365 = await userService.aggregateStats({ model: User, dateField: 'createdAt', lastNDays: 365 });

  // Trades
  const trades30 = await userService.aggregateStats({ model: History, dateField: 'createdAt', lastNDays: 30 });
  const trades365 = await userService.aggregateStats({ model: History, dateField: 'createdAt', lastNDays: 365 });

  // Revenue (sum of transactionFees in XRP, converted to USD)
  const revenue30XRP = await userService.aggregateStats({
    model: History,
    dateField: 'createdAt',
    lastNDays: 30,
    sumField: 'transactionFees',
  });
  const revenue365XRP = await userService.aggregateStats({
    model: History,
    dateField: 'createdAt',
    lastNDays: 365,
    sumField: 'transactionFees',
  });

  // Convert revenue to USD
  const revenue30 = revenue30XRP.map((item) => ({
    _id: item._id,
    revenueUSD: item.count * xrpPriceUSD,
  }));
  const revenue365 = revenue365XRP.map((item) => ({
    _id: item._id,
    revenueUSD: item.count * xrpPriceUSD,
  }));

  const obj = {
    users: { users30, users365 },
    trades: { trades30, trades365 },
    revenue: { revenue30, revenue365 },
  };
  res.send(obj);
});

const updateCompany = catchAsync(async (req, res) => {
  const company = await userService.updateCompanyById(req.params.companyId, req.body);
  res.send(company);
});

module.exports = {
  createUser,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  stats,
  updateCompany,
};
