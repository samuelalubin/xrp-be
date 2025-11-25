const Portfolio = require('../models/portfolio.model');

const getUserPortfolio = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const portfolio = await Portfolio.find({ userId });
    res.status(200).json({ portfolio });
  } catch (err) {
    console.error('❌ Error fetching portfolio:', err);
    res.status(500).json({ error: err.message });
  }
};

const getSingleCoinPortfolio = async (req, res) => {
  try {
    const { userId, tokenSymbol } = req.params;
    const entry = await Portfolio.findOne({ userId, tokenSymbol });
    if (!entry) return res.status(404).json({ error: 'Not found' });
    res.status(200).json({ portfolio: entry });
  } catch (err) {
    console.error('❌ Error fetching single portfolio:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getUserPortfolio,
  getSingleCoinPortfolio,
};
