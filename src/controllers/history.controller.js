// controllers/history.controller.js
const { historyService } = require('../services');

const createHistory = async (req, res) => {
  try {
    const data = req.body;
    data.userId = req.user?._id || data.userId;
    const record = await historyService.createHistory(data);
    res.status(201).json({
      success: true,
      message: 'History record created successfully',
      data: record,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getUserHistory = async (req, res) => {
  try {
    const userId = req.params.userId || req.user?._id;
    const records = await historyService.getUserHistory(userId);
    res.status(200).json({ success: true, data: records });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getUserMemecoinHistory = async (req, res) => {
  try {
    const { userId, identifier } = req.params;
    const records = await historyService.getUserMemecoinHistory(userId, identifier);
    if (!records.length) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'No history found for this memecoin.',
      });
    }
    res.status(200).json({ success: true, data: records });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteHistory = async (req, res) => {
  try {
    await historyService.deleteHistory(req.params.id);
    res.status(200).json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Get history of a specific memecoin by identifier only
 */
const getHistoryByIdentifier = async (req, res) => {
  try {
    const { identifier } = req.params;
    const records = await historyService.getHistoryByIdentifier(identifier);

    if (!records || records.length === 0) {
      return res.status(404).json({ success: false, message: 'No history found for this identifier' });
    }

    res.status(200).json({ success: true, data: records });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  createHistory,
  getUserHistory,
  getUserMemecoinHistory,
  deleteHistory,
  getHistoryByIdentifier,
};
