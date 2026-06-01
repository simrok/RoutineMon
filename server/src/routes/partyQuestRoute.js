const express = require('express');
const router = express.Router();
const partyQuestController = require('../controllers/partyQuestController');

// 명세서 6.2 및 6.3 완벽 결합
router.get('/rooms/:roomCode/party-quest', partyQuestController.getActivePartyQuest);
router.post('/party-quests/:partyQuestId/upload', partyQuestController.uploadPartyQuest);

module.exports = router;