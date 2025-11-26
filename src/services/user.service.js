const httpStatus = require('http-status');
// const { User, DestinationMapping } = require('../models');
const ApiError = require('../utils/ApiError');
const User = require('../models/user.model');
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
  const users = await User.paginate(filter, options);
  return users;
};

/**
 * Get user by id
 * @param {ObjectId} id
 * @returns {Promise<User>}
 */
const getUserById = async (id) => {
  console.log('chalyy10');

  return User.findById(id);
};

/**
 * Get user by email
 * @param {string} email
 * @returns {Promise<User>}
 */
const getUserByEmail = async (email) => {
  return User.findOne({ email });
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

module.exports = {
  createUser,
  queryUsers,
  getUserById,
  getUserByEmail,
  updateUserById,
  deleteUserById,
};
