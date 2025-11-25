const express = require('express');
const { buyMemecoin, sellMemecoin } = require('../../controllers/xrpl.controller');
const { buySellSchema } = require('../../validations/xrpl.validation');
const validate = require('../../middlewares/validate');

const router = express.Router();

// ✅ Use your validation middleware correctly
router.post('/buy', validate(buySellSchema), buyMemecoin);
router.post('/sell', validate(buySellSchema), sellMemecoin);

module.exports = router;
