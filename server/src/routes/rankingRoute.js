const express = require('express');
const router = express.Router();
const rankingController = require('../controllers/rankingController');

// 명세서 규격: GET /rooms/:roomCode/players/ranking
router.get('/rooms/:roomCode/players/ranking', rankingController.getRoomRankings);

module.exports = router;