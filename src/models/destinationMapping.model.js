const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const DestinationMappingSchema = new mongoose.Schema({
  destinationTag: { type: Number, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});

// add plugin that converts mongoose to json
DestinationMappingSchema.plugin(toJSON);
DestinationMappingSchema.plugin(paginate);

const DestinationMapping = mongoose.model('DestinationMapping', DestinationMappingSchema);

module.exports = DestinationMapping;
