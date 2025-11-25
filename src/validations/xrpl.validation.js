const Joi = require('joi');

const buySellSchema = Joi.object({
  userId: Joi.string().required(),
  tokenSymbol: Joi.string().required(),
  issuer: Joi.string().required(), // contract address (CA)
  xrpAmount: Joi.number().positive().required(),
});

module.exports = {
  buySellSchema,
};
