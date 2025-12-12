const httpStatus = require('http-status');
// const { User, DestinationMapping } = require('../models');
const ApiError = require('../utils/ApiError');
const User = require('../models/user.model');
const Company = require('../models/company.model');
const DestinationMapping = require('../models/destinationMapping.model');
const { DEPOSIT_WALLET_ADDRESS } = process.env;

/**
 * Create a user
 * @param {Object} userBody
 * @returns {Promise<User>}
 */
const createUser = async (userBody) => {
  console.log('chalyy9');

  if (await User.isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  let company = await Company.findOne({});
  if (!company) {
    company = await Company.create({
      transactionFee: 0.95,
      transactionFeePercentage: 0.15,
      policy: `Xtokens.io Disclaimer
This website-hosted user interface (this “Interface”) is an open-source frontend software portal that enables users to access and interact with third-party blockchain and exchange protocols, including but not limited to the 1inch Network (a decentralized and community-driven collection of blockchain-enabled smart contracts and tools) and the Binance Exchange APIs (collectively, the “Third-Party Protocols”).

This Interface and its related tools are made available by Xtokens.io, however, all transactions conducted through these Protocols are executed by permissionless smart contracts or by external exchange systems operated independently by those third parties.

As the Interface is open-sourced, and the 1inch Protocol and Binance APIs are each accessible by any user, entity, or third party, there may be other independent web or mobile interfaces that allow for interaction with these or similar protocols.

No Warranties & Limitation of Liability
THIS INTERFACE AND ALL RELATED THIRD-PARTY PROTOCOLS ARE PROVIDED “AS IS,” AT YOUR OWN RISK, AND WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED.

Xtokens.io, its developers, contributors, and affiliates do not provide, own, or control the 1inch Network, the Binance Exchange APIs, or any transactions conducted through those systems or their related smart contracts.

By using or accessing this Interface, the 1inch Network, or Binance APIs, you agree that no developer, contributor, or entity involved in creating, deploying, or maintaining this Interface or integrating with the 1inch Network or Binance Exchange APIs will be liable for any claims or damages whatsoever arising from your use, inability to use, or interaction with other users of this Interface or the underlying protocols — including but not limited to direct, indirect, incidental, special, exemplary, punitive, or consequential damages, or loss of profits, digital assets, tokens, or anything else of value.

Third-Party Relationships
The 1inch Network and Binance Exchange are independent platforms. Xtokens.io is not affiliated with, endorsed by, or acting on behalf of Binance, 1inch, or their respective foundations, owners, or affiliates.

All trades, swaps, or transactions initiated through this Interface are executed by external smart contracts or exchange systems controlled exclusively by those third parties. Users are solely responsible for reviewing and complying with the terms of service, privacy policies, and jurisdictional restrictions of each platform they choose to interact with.

Prohibited Jurisdictions
The 1inch Network and Binance Exchange may be unavailable or restricted in certain jurisdictions. Without limitation, residents or citizens of the following jurisdictions are prohibited from accessing or using this Interface, the 1inch Network, or Binance services: Belarus, the Central African Republic, the Democratic Republic of Congo, the Democratic People's Republic of Korea, the Crimea, Donetsk People's Republic, and Luhansk People's Republic regions of Ukraine, Cuba, Iran, Libya, Somalia, Sudan, South Sudan, Syria, the United States of America, Yemen, Zimbabwe, and any other jurisdiction in which such use is prohibited by applicable law or by the policies of those platforms (collectively, the “Prohibited Jurisdictions”).

By using or accessing this Interface, the 1inch Network, or Binance APIs, you represent and warrant that you are not located in, incorporated in, or a resident of any Prohibited Jurisdiction. You also represent that you are not subject to sanctions or listed on any sanctions-related list of prohibited or restricted parties, including but not limited to those maintained by the U.S. Department of the Treasury’s Office of Foreign Assets Control (OFAC), the United Nations Security Council, the European Union or its Member States, or any other competent government authority.

User Responsibility
You acknowledge that you are solely responsible for your actions, wallet security, and compliance with all applicable laws and regulations. You should carefully evaluate the risks and consult your own advisors before using this Interface or interacting with the 1inch Network, Binance Exchange, or any other integrated blockchain or exchange service.`,
    });
  }
  const { email, password, name } = userBody;
  console.log(email, password, name);
  const last = await DestinationMapping.findOne().sort({ destinationTag: -1 });
  const nextTag = last ? last.destinationTag + 1 : 1000;
  const user = new User({
    email,
    password,
    name,
    destinationTag: nextTag,
    deposit: {
      address: DEPOSIT_WALLET_ADDRESS,
      destinationTag: nextTag,
      memo: `Send XRP to address and include destinationTag ${nextTag}`,
    },
    companyId: company._id,
  });
  await user.save();

  const mapping = new DestinationMapping({
    destinationTag: nextTag,
    userId: user._id,
  });
  await mapping.save();

  // return User.create({
  //   user: { id: user._id, email: user.email },
  //   deposit: {
  //     address: DEPOSIT_WALLET_ADDRESS,
  //     destinationTag: nextTag,
  //     memo: `Send XRP to address and include destinationTag ${nextTag}`,
  //   },
  // });
  return user;
};

/**
 * Query for users
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryUsers = async (filter, options) => {
  const users = await User.paginate({ ...filter, delete: { $ne: true } }, options);
  return users;
};

/**
 * Get user by id
 * @param {ObjectId} id
 * @returns {Promise<User>}
 */
const getUserById = async (id) => {
  console.log('chalyy10');

  return User.findById(id).populate('companyId');
};

/**
 * Get user by email
 * @param {string} email
 * @returns {Promise<User>}
 */
const getUserByEmail = async (email) => {
  return User.findOne({ email }).populate('companyId');
};

/**
 * Update user by id
 * @param {ObjectId} userId
 * @param {Object} updateBody
 * @returns {Promise<User>}
 */
const updateUserById = async (userId, updateBody) => {
  console.log('chalyy11');

  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (updateBody.email && (await User.isEmailTaken(updateBody.email, userId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  if (updateBody?.oldPassword) {
    if (!(await user.isPasswordMatch(updateBody?.oldPassword))) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect password');
    }
  }
  Object.assign(user, updateBody);
  await user.save();
  return user;
};

/**
 * Delete user by id
 * @param {ObjectId} userId
 * @returns {Promise<User>}
 */
const deleteUserById = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  await user.remove();
  return user;
};
const aggregateStats = async ({ model, dateField, lastNDays, sumField }) => {
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - lastNDays);

  const aggregation = await model.aggregate([
    { $match: { [dateField]: { $gte: startDate } } },
    {
      $group: {
        _id: { year: { $year: `$${dateField}` }, month: { $month: `$${dateField}` } },
        count: sumField ? { $sum: `$${sumField}` } : { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  return aggregation;
};

const updateCompanyById = async (companyId, updateBody) => {
  const company = await Company.findById(companyId);

  if (!company) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Company not found');
  }

  Object.assign(company, updateBody);
  await company.save();

  return company;
};

module.exports = {
  createUser,
  queryUsers,
  getUserById,
  getUserByEmail,
  updateUserById,
  deleteUserById,
  aggregateStats,
  updateCompanyById,
};
