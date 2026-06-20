const express = require('express');
const router = express.Router();
const partyQuestController = require('../controllers/partyQuestController');
const { createPartyQuestsForHour } = require('../cron/partyQuestCron');
const { createUploader } = require('../utils/cloudinary');

const upload = createUploader('routinemon/party-quests');

// 파티 퀘스트 상태 조회
router.get('/rooms/:roomCode/party-quests/active', partyQuestController.getActivePartyQuest);
router.get('/rooms/:roomCode/party-quests/pending', partyQuestController.getPendingPartyQuest);
router.get('/rooms/:roomCode/party-quests/today-last', partyQuestController.getTodayLastPartyQuest);

// 수락 / 업로드 / 삭제
router.post('/party-quests/:partyQuestId/accept', partyQuestController.acceptPartyQuest);
router.post('/party-quests/:partyQuestId/upload', upload.single('image'), partyQuestController.uploadPartyQuest);
router.delete('/party-quests/:partyQuestId/uploads/:playerId', partyQuestController.deletePartyUpload);

// 테스트용 수동 트리거 (개발 환경 전용)
// POST /api/dev/party-quests/trigger/1  →  1시 퀘스트 즉시 생성
router.post('/dev/party-quests/trigger/:hour', async (req, res) => {
  const hour = parseInt(req.params.hour, 10);
  if (![1, 7, 13, 19].includes(hour)) {
    return res.status(400).json({ success: false, error: 'hour은 1, 7, 13, 19 중 하나여야 합니다.' });
  }
  await createPartyQuestsForHour(hour);
  res.json({ success: true, message: `${hour}시 파티 퀘스트 수동 생성 완료` });
});

module.exports = router;