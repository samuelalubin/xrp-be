const express = require('express');
const { buyMemecoin, sellMemecoin } = require('../../controllers/xrpl.controller');
const { buyToken, sellToken } = require('../../controllers/xrpl2.controller');
const { buySellSchema } = require('../../validations/xrpl.validation');
const validate = require('../../middlewares/validate');

const router = express.Router();

// ✅ Use your validation middleware correctly
router.post('/buy', validate(buySellSchema), buyMemecoin);
router.post('/sell', validate(buySellSchema), sellMemecoin);

router.post('/buy2', buyToken);
router.post('/sell2', sellToken);

module.exports = router;
