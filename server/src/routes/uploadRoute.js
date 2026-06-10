const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');

// 명세서 5.1
router.post('/players/:playerId/daily-uploads', uploadController.uploadDailyRoutine);

// 명세서 5.2
router.get('/rooms/:roomCode/daily-uploads/today', uploadController.getTodayUploads);

module.exports = router;