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
      // 🌟 소켓 룸 방송을 위해 rooms 테이블과 JOIN하여 room_code를 미리 받아옴
      const [questRows] = await connection.query(
        `SELECT pq.*, r.room_code 
         FROM party_quests pq
         JOIN rooms r ON pq.room_id = r.id
         WHERE pq.id = ?`, 
        [partyQuestId]
      );
      
      if (questRows.length === 0) {
        return res.status(404).json({ success: false, error: '존재하지 않는 파티 퀘스트입니다.' });
      }
      const quest = questRows[0];
      const roomId = quest.room_id;
      const roomCode = quest.room_code; // 소켓 룸 ID로 활용

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
      
      // 소켓 데이터 전송용 변수 사전 선언
      let isEvolved = false;
      let monSocketPayload = null;
      let evolutionSocketPayload = null;

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
          const oldStage = currentStage; // 진화 여부 체크용 원본 스테이지 백업

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

          const finalExpPercentage = Number(newExp.toFixed(2));

          await connection.query(
            'UPDATE mons SET level = ?, stage = ?, exp_percentage = ? WHERE room_id = ?',
            [currentLevel, currentStage, finalExpPercentage, roomId]
          );

          // 🌟 [소켓 페이로드 구성] 변경된 Mon의 실시간 데이터 빌드
          monSocketPayload = {
            expPercentage: finalExpPercentage,
            level: currentLevel,
            stage: currentStage
          };

          // 스테이지 단계가 실제로 변했다면 진화 성공
          if (oldStage !== currentStage) {
            isEvolved = true;
            evolutionSocketPayload = {
              newStage: currentStage,
              catalogId: mon.catalog_id || 1, // 안전하게 원본 catalog_id 사용
              name: mon.name || '몬스터'
            };
          }
        }
      }

      await connection.commit();

      // 🌟 [소켓 실시간 방송 연동부] 명세서 규격 일치화
      const io = req.app.get('io');
      if (io && roomCode) {
        // 1. 누군가 사진을 성공적으로 올림 알림
        io.to(roomCode).emit('party-quest:upload-updated', {
          playerId: Number(playerId),
          validationStatus: "approved"
        });

        // 2. 만약 전원 참여로 퀘스트가 끝났다면 완료 및 보상 정보 추가 연쇄 방송
        if (questCompleted) {
          // 파티 퀘스트 완수 브로드캐스트
          io.to(roomCode).emit('party-quest:completed', {
            expGained: expGained,
            skinReward: null // 명세서 표 기반 스킨 보상이 없다면 null 처리
          });

          // Mon 경험치 변동 상황 브로드캐스트
          if (monSocketPayload) {
            io.to(roomCode).emit('mon:exp-updated', monSocketPayload);
          }

          // 레벨업 임계치를 넘겨 진화까지 이뤄졌다면 진화 알림 브로드캐스트
          if (isEvolved && evolutionSocketPayload) {
            io.to(roomCode).emit('mon:evolved', evolutionSocketPayload);
          }
        }
        console.log(`📡 [소켓 방송] 방 ${roomCode}에 파티 퀘스트 실시간 싱크 방송 완료!`);
      }

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