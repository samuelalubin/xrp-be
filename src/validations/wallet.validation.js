// const Joi = require('joi');
// const { objectId } = require('./custom.validation');

// const createWallet = {
//   body: Joi.object().keys({
//     type: Joi.string().required().valid('coinbase', 'xrpl'),
//     address: Joi.string().required(),
//     label: Joi.string().optional(), // nickname for wallet
//   }),
// };

// const getWallets = {
//   query: Joi.object().keys({
//     type: Joi.string().valid('coinbase', 'xrpl'),
//     address: Joi.string(),
//     sortBy: Joi.string(),
//     limit: Joi.number().integer(),
//     page: Joi.number().integer(),
//   }),
// };

// const getWallet = {
//   params: Joi.object().keys({
//     walletId: Joi.string().custom(objectId),
//   }),
// };

// const updateWallet = {
//   params: Joi.object().keys({
//     walletId: Joi.required().custom(objectId),
//   }),
//   body: Joi.object()
//     .keys({
//       type: Joi.string().valid('coinbase', 'xrpl'),
//       address: Joi.string(),
//       label: Joi.string(),
//     })
//     .min(1),
// };

// const deleteWallet = {
//   params: Joi.object().keys({
//     walletId: Joi.string().custom(objectId),
//   }),
// };

// module.exports = {
//   createWallet,
//   getWallets,
//   getWallet,
//   updateWallet,
//   deleteWallet,
// };

const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createWallet = {
  body: Joi.object().keys({
    type: Joi.string().required().valid('coinbase', 'xrpl'),
    address: Joi.when('type', {
      is: 'xrpl',
      then: Joi.string().required(),
      otherwise: Joi.string().optional().allow(null, ''),
    }),
    label: Joi.string().optional(), // nickname for wallet
  }),
};

const getWallets = {
  query: Joi.object().keys({
    type: Joi.string().valid('coinbase', 'xrpl'),
    address: Joi.string(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const getWallet = {
  params: Joi.object().keys({
    walletId: Joi.string().custom(objectId),
  }),
};

const updateWallet = {
  params: Joi.object().keys({
    walletId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      type: Joi.string().valid('coinbase', 'xrpl'),
      address: Joi.string(),
      label: Joi.string(),
    })
    .min(1),
};

const deleteWallet = {
  params: Joi.object().keys({
    walletId: Joi.string().custom(objectId),
  }),
};

module.exports = {
  createWallet,
  getWallets,
  getWallet,
  updateWallet,
  deleteWallet,
};
