const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const uploadController = require('../controllers/uploadController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/daily/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname)),
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// 명세서 5.1 — 일일 업로드
router.post('/players/:playerId/daily-uploads', upload.single('image'), uploadController.uploadDailyRoutine);

// 일일 업로드 삭제
router.delete('/players/:playerId/daily-uploads/:routineId', uploadController.deleteDailyUpload);

// 명세서 5.2 — 오늘 업로드 현황
router.get('/rooms/:roomCode/daily-uploads/today', uploadController.getTodayUploads);

// 방 플레이어별 누적 기여도
router.get('/rooms/:roomCode/players/contribution-counts', uploadController.getContributionCounts);

module.exports = router;