// const { sendXrpPayment } = require('../services/xrp.service');
// const httpStatus = require('http-status');
// const ApiError = require('../utils/ApiError');

// const sendPayment = async (req, res) => {
//   console.log('chalyy4');

//   try {
//     const { destination, amount, destinationTag } = req.body;

//     if (!destination || !amount) {
//       throw new ApiError(httpStatus.BAD_REQUEST, 'Destination and amount are required');
//     }

//     const txResult = await sendXrpPayment(destination, amount, destinationTag);

//     res.status(200).json({
//       success: true,
//       message: 'Payment sent successfully',
//       txResult,
//     });
//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: err.message || 'Payment failed',
//     });
//   }
// };

// module.exports = {
//   sendPayment,
// };

const httpStatus = require('http-status');
const { sendXrpPayment } = require('../services/xrp.service');

/**
 * Controller for sending payment
 */
const sendPayment = async (req, res) => {
  try {
    // ✅ Extract fields from request body
    const { userId, destination, amount, destinationTag } = req.body;

    // ✅ Simple validation
    if (!userId || !destination || !amount) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: 'userId, destination, and amount are required',
      });
    }

    // ✅ Call the XRPL payment service
    const txResult = await sendXrpPayment(userId, destination, amount, destinationTag);

    // ✅ Send success response
    res.status(httpStatus.OK).json({
      success: true,
      message: 'Payment sent successfully',
      txResult,
    });
  } catch (err) {
    console.error('❌ Payment error:', err);
    res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: err.message || 'Payment failed',
    });
  }
};

module.exports = {
  sendPayment,
};
