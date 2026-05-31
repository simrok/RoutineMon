// src/routes/roomRoute.js
const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const path = require('path');
const multer = require('multer');

// 윈도우/맥 공통 크로스 플랫폼 디스크 스토리지 설정
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // index.js가 실행되는 최상단 기준의 uploads 폴더 지정
    cb(null, 'uploads/party-quests/'); 
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB 제한
});

// 명세서 1: POST /rooms — 방 생성
router.post('/rooms', roomController.createRoom);

// 명세서 2: GET /rooms/:roomCode — 방 정보 조회
router.get('/rooms/:roomCode', roomController.getRoomStatus);

// 명세서 3: POST /rooms/:roomCode/players — 플레이어 슬롯 등록
router.post('/rooms/:roomCode/players', roomController.joinRoom);

// 명세서 5.1: GET /rooms/:roomCode/party-quests/active — 활성 파티 퀘스트 조회
router.get('/rooms/:roomCode/party-quests/active', roomController.getActivePartyQuest);

// 명세서 6.4: POST /party-quests/:partyQuestId/uploads 
router.post('/party-quests/:partyQuestId/uploads', upload.single('image'), roomController.uploadPartyQuestImage);

// 명세서 10: 시뮬레이션
router.post('/party-quests/:partyQuestId/simulate-complete', roomController.simulatePartyQuestComplete);

// 명세서 5.2: 오늘 일일 업로드 현황 조회
router.get('/rooms/:roomCode/daily-uploads/today', roomController.getDailyUploadStatus);

module.exports = router;