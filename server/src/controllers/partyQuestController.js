const pool = require('../db/db');

// [명세서 6.2] GET /api/rooms/:roomCode/party-quest — 현재 진행 중인 파티 퀘스트 조회
exports.getActivePartyQuest = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const connection = await pool.getConnection();

    try {
      // 1. 방 코드로 방 ID 조회
      const [roomRows] = await connection.query('SELECT id FROM rooms WHERE room_code = ?', [roomCode]);
      if (roomRows.length === 0) {
        return res.status(404).json({ success: false, error: '존재하지 않는 방 코드입니다.' });
      }
      const roomId = roomRows[0].id;

      // 2. 유나의 진짜 컬럼 구조(content) 반영해서 쿼리 수정!
      const [questRows] = await connection.query(
        `SELECT pq.id AS partyQuestId, pq.status, pq.expires_at AS expiresAt, pqd.content 
         FROM party_quests pq
         JOIN party_quest_definitions pqd ON pq.definition_id = pqd.id
         WHERE pq.room_id = ? AND pq.status IN ('active', 'accepted')
         ORDER BY pq.id DESC LIMIT 1`,
        [roomId]
      );

      if (questRows.length === 0) {
        return res.status(200).json({ success: true, data: null });
      }

      return res.status(200).json({ success: true, data: questRows[0] });

    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    } finally {
      connection.release();
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: '서버 내부 오류 발생' });
  }
};

// [명세서 6.3] POST /api/party-quests/:partyQuestId/upload — 파티 퀘스트 사진 업로드 (인증 및 기여)
exports.uploadPartyQuest = async (req, res) => {
  try {
    const { partyQuestId } = req.params;
    const { playerId, imageUrl } = req.body;

    if (!playerId || !imageUrl) {
      return res.status(400).json({ success: false, error: 'playerId와 imageUrl은 필수입니다.' });
    }

    const connection = await pool.getConnection();
    try {
      const [questRows] = await connection.query('SELECT * FROM party_quests WHERE id = ?', [partyQuestId]);
      if (questRows.length === 0) {
        return res.status(404).json({ success: false, error: '존재하지 않는 파티 퀘스트입니다.' });
      }
      const quest = questRows[0];
      const roomId = quest.room_id;

      await connection.beginTransaction();

      // 1. 파티 퀘스트 업로드 테이블에 데이터 인서트 (Mock 검증 상태는 기본 approved 처리)
      const [uploadResult] = await connection.query(
        'INSERT INTO party_quest_uploads (party_quest_id, player_id, image_url, validation_status) VALUES (?, ?, ?, "approved")',
        [partyQuestId, playerId, imageUrl]
      );

      // 2. [설계도 가중치 규칙용] 방 안의 모든 플레이어가 전부 참여했는지 체크하기
      const [playerCountRows] = await connection.query('SELECT COUNT(*) AS total FROM players WHERE room_id = ?', [roomId]);
      const [uploadedCountRows] = await connection.query(
        'SELECT COUNT(DISTINCT player_id) AS uploaded FROM party_quest_uploads WHERE party_quest_id = ? AND validation_status = "approved"',
        [partyQuestId]
      );

      const totalPlayers = playerCountRows[0].total;
      const uploadedPlayers = uploadedCountRows[0].uploaded;

      let questCompleted = false;
      let expGained = 0;

      // 3. 전원 참여 시 명세서 규칙대로 퀘스트 'completed' 전환 및 몬스터 보상 경험치 +5% 정산 연산!
      if (uploadedPlayers >= totalPlayers) {
        questCompleted = true;
        expGained = 5; // 파티 퀘스트 보상 가중치

        await connection.query('UPDATE party_quests SET status = "completed" WHERE id = ?', [partyQuestId]);

        const [monRows] = await connection.query('SELECT * FROM mons WHERE room_id = ?', [roomId]);
        if (monRows.length > 0) {
          const mon = monRows[0];
          let newExp = Number(mon.exp_percentage || 0) + expGained;
          let currentLevel = Number(mon.level || 1);
          let currentStage = mon.stage || 'EGG';

          // 100% 도달 시 레벨업 및 진화 연산 로직 작동
          if (newExp >= 100) {
            newExp -= 100;
            currentLevel += 1;
            if (currentLevel > 2 && currentStage !== 'ADULT') {
              currentLevel = 1;
              if (currentStage === 'EGG') currentStage = 'BABY';
              else if (currentStage === 'BABY') currentStage = 'CHILD';
              else if (currentStage === 'CHILD') currentStage = 'ADULT';
            }
          }

          await connection.query(
            'UPDATE mons SET level = ?, stage = ?, exp_percentage = ? WHERE room_id = ?',
            [currentLevel, currentStage, newExp.toFixed(2), roomId]
          );
        }
      }

      await connection.commit();

      return res.status(201).json({
        success: true,
        data: {
          uploadId: uploadResult.insertId,
          partyQuestId: Number(partyQuestId),
          playerId: Number(playerId),
          status: questCompleted ? 'completed' : 'active',
          expGained: expGained
        }
      });

    } catch (error) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: error.message });
    } finally {
      connection.release();
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: '서버 내부 오류 발생' });
  }
};