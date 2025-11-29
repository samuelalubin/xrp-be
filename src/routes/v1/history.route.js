// routes/history.route.js
const express = require('express');
const router = express.Router();
// const {
//   createHistory,
//   getUserHistory,
//   getUserMemecoinHistory,
//   deleteHistory,
// } = require('../../controllers/history.controller');
const { historyController } = require('../../controllers');

router.post('/', historyController.createHistory);
router.get('/user/:userId', historyController.getUserHistory);
router.get('/:userId/:identifier', historyController.getUserMemecoinHistory);
router.delete('/:id', historyController.deleteHistory);
router.get('/:identifier', historyController.getHistoryByIdentifier);
router.post('/history', historyController.getHistory);

module.exports = router;
