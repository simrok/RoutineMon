const express = require('express');
const router = express.Router();
const monsterController = require('../controllers/monsterController');

// 명세서 규격: GET /rooms/:roomId/monster
router.get('/rooms/:roomId/monster', monsterController.getMonsterInRoom);

module.exports = router;