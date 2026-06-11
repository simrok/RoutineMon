const express = require('express');
const router = express.Router();
const monsterController = require('../controllers/monsterController');

// 명세서 규격: GET /rooms/:roomId/monster
router.get('/rooms/:roomId/monster', monsterController.getMonsterInRoom);

// 표정 판단용 데이터
router.get('/rooms/:roomCode/mon-face', monsterController.getMonFace);

module.exports = router;