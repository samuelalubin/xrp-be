const express = require('express');
const router = express.Router();
const { getUserPortfolio, getSingleCoinPortfolio } = require('../../controllers/portfolio.controller');
const { updatePortfolio } = require('../../services/portfolio.service');

// 📊 Portfolio dashboard
router.get('/:userId', getUserPortfolio);
router.post('/update', updatePortfolio);
// router.get('/:userId/:tokenSymbol', getSingleCoinPortfolio);

module.exports = router;
