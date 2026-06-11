const express = require('express');
const router = express.Router();
const playerController = require('../controllers/playerController');

// 방 입장 (새로운 플레이어 등록)
router.post('/rooms/:roomCode/players', playerController.registerPlayer);

// PIN 인증 (재입장)
router.post('/rooms/:roomCode/players/:slotNumber/verify', playerController.verifyPin);

// PIN 분실 재설정
router.post('/rooms/:roomCode/players/:slotNumber/reset-pin', playerController.resetPin);

// 플레이어 정보 수정 (닉네임/스킨, 헤더에 X-Player-Pin 필요)
router.patch('/players/:playerId', playerController.updatePlayer);

// 방 나가기
router.delete('/players/:playerId/leave', playerController.leaveRoom);

// 루틴 미설정 플레이어 등록 취소 (이전 버튼)
router.delete('/players/:playerId/cancel', playerController.cancelRegistration);

// 플레이어 누적 기여도 조회
router.get('/players/:playerId/contribution', playerController.getContribution);

module.exports = router;