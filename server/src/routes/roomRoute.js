const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');

// 명세서 1: POST /rooms — 방 생성
router.post('/rooms', roomController.createRoom);

// 명세서 2: GET /rooms/:roomCode — 방 정보 조회
router.get('/rooms/:roomCode', roomController.getRoomStatus);

// 명세서 3: POST /rooms/:roomCode/players — 플레이어 슬롯 등록 (최초 입장)
router.post('/rooms/:roomCode/players', roomController.joinRoom);

// GET /rooms/:roomCode/party-quests/active — 현재 활성 파티 퀘스트 조회
router.get('/rooms/:roomCode/party-quests/active', roomController.getActivePartyQuest);

router.post('/party-quests/:partyQuestId/uploads', roomController.uploadPartyQuestImage);

router.post('/party-quests/:partyQuestId/simulate-complete', roomController.simulatePartyQuestComplete);

// GET /rooms/:roomCode/daily-uploads/today — 오늘 방 전체 업로드 현황 조회
router.get('/rooms/:roomCode/daily-uploads/today', roomController.getDailyUploadStatus);

module.exports = router;