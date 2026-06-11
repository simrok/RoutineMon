const express = require('express');
const router = express.Router();
const skinsController = require('../controllers/skinsController');

// 9번 명세서 스킨 API 라우팅 구체화
router.get('/skins', skinsController.getAllSkins);
router.get('/players/:playerId/skins', skinsController.getPlayerSkins);

module.exports = router;