const express = require('express');
const auth = require('../../middlewares/auth');
const depositController = require('../../controllers/deposit.controller');
const router = express.Router();

router.get('/deposit-info/:email', depositController.getDepositInfoEmail);

router.post('/deposits', depositController.getDeposit);

module.exports = router;
