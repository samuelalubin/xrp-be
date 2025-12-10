const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const CompanySchema = new mongoose.Schema({
  transactionFee: { type: Number, default: 0.95 },
  transactionFeePercentage: { type: Number, default: 0.15 },
  policy: { type: String },
});

// add plugin that converts mongoose to json
CompanySchema.plugin(toJSON);
CompanySchema.plugin(paginate);

const Company = mongoose.model('Company', CompanySchema);

module.exports = Company;
