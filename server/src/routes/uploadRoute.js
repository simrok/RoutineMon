const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { createUploader } = require('../utils/cloudinary');

const upload = createUploader('routinemon/daily');

// 명세서 5.1 — 일일 업로드
router.post('/players/:playerId/daily-uploads', upload.single('image'), uploadController.uploadDailyRoutine);

// 일일 업로드 삭제
router.delete('/players/:playerId/daily-uploads/:routineId', uploadController.deleteDailyUpload);

// 명세서 5.2 — 오늘 업로드 현황
router.get('/rooms/:roomCode/daily-uploads/today', uploadController.getTodayUploads);

// 방 플레이어별 누적 기여도
router.get('/rooms/:roomCode/players/contribution-counts', uploadController.getContributionCounts);

module.exports = router;