const express = require('express');
const router = express.Router();
const routineController = require('../controllers/routineController');

// [명세서 4.1] GET /api/players/:playerId/routines — 플레이어별 루틴 목록 조회
router.get('/players/:playerId/routines', routineController.getRoutines);

// [명세서 4.2] PUT /api/players/:playerId/routines — 루틴 전체 저장 (등록/수정)
router.put('/players/:playerId/routines', routineController.saveRoutines);

module.exports = router;