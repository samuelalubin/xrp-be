const express = require('express');
const { sendPayment } = require('../../controllers/xrp.controller');

const router = express.Router();

router.post('/send', sendPayment);

module.exports = router;
