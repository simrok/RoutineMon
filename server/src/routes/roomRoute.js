const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');

// 명세서 1: POST /rooms — 방 생성
router.post('/rooms', roomController.createRoom);

// 명세서 2: GET /rooms/:roomCode — 방 정보 조회
router.get('/rooms/:roomCode', roomController.getRoomStatus);

// 명세서 3: POST /rooms/:roomCode/players — 플레이어 슬롯 등록 (최초 입장) 👈 정밀 주소 변경 완료!
router.post('/rooms/:roomCode/players', roomController.joinRoom);

module.exports = router;