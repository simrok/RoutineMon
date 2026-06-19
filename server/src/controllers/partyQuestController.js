const pool = require('../db/db');
const path = require('path');
const fs = require('fs');
const { validateImageForQuest } = require('../utils/validateImage');

// GET /api/rooms/:roomCode/party-quests/active — 현재 active 파티 퀘스트 조회
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
        `SELECT pq.id AS partyQuestId, pq.status, pq.expires_at AS expiresAt, pq.scheduled_hour AS scheduledHour, pqd.content
         FROM party_quests pq
         JOIN party_quest_definitions pqd ON pq.definition_id = pqd.id
         WHERE pq.room_id = ? AND pq.status = 'active'
         ORDER BY pq.id DESC LIMIT 1`,
        [roomId]
      );

      if (questRows.length === 0) {
        return res.status(200).json({ success: true, data: null });
      }

      const quest = questRows[0];

      // 현재 퀘스트 업로드 목록 조회
      const [uploadRows] = await connection.query(
        'SELECT player_id as playerId, image_url as imageUrl FROM party_quest_uploads WHERE party_quest_id = ?',
        [quest.partyQuestId]
      );

      return res.status(200).json({ success: true, data: { ...quest, uploads: uploadRows } });

    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    } finally {
      connection.release();
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: '서버 내부 오류 발생' });
  }
};

// GET /api/rooms/:roomCode/party-quests/pending — 수락 대기 중인 파티 퀘스트 조회
exports.getPendingPartyQuest = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const [roomRows] = await pool.query('SELECT id FROM rooms WHERE room_code = ?', [roomCode]);
    if (roomRows.length === 0) {
      return res.status(404).json({ success: false, error: '존재하지 않는 방 코드입니다.' });
    }
    const roomId = roomRows[0].id;

    const [questRows] = await pool.query(
      `SELECT pq.id AS partyQuestId, pq.scheduled_hour AS scheduledHour, pq.status, pqd.content
       FROM party_quests pq
       JOIN party_quest_definitions pqd ON pq.definition_id = pqd.id
       WHERE pq.room_id = ? AND pq.status = 'pending'
       ORDER BY pq.id DESC LIMIT 1`,
      [roomId]
    );

    if (questRows.length === 0) {
      return res.status(200).json({ success: true, data: null });
    }
    return res.status(200).json({ success: true, data: questRows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: '서버 내부 오류 발생' });
  }
};

// POST /api/party-quests/:partyQuestId/accept — 파티 퀘스트 수락
exports.acceptPartyQuest = async (req, res) => {
  const { partyQuestId } = req.params;
  const { playerId } = req.body;

  if (!playerId) {
    return res.status(400).json({ success: false, error: 'playerId는 필수입니다.' });
  }

  const connection = await pool.getConnection();
  try {
    const [questRows] = await connection.query(
      `SELECT pq.*, r.room_code FROM party_quests pq
       JOIN rooms r ON pq.room_id = r.id
       WHERE pq.id = ?`,
      [partyQuestId]
    );

    if (questRows.length === 0) {
      return res.status(404).json({ success: false, error: '존재하지 않는 파티 퀘스트입니다.' });
    }
    const quest = questRows[0];
    if (quest.status !== 'pending') {
      return res.status(400).json({ success: false, error: '이미 수락됐거나 만료된 퀘스트입니다.' });
    }

    // 수락 시각 기준 +2시간
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    await connection.query(
      `UPDATE party_quests
       SET status = 'active', accepted_by_player_id = ?, accepted_at = NOW(), expires_at = ?
       WHERE id = ?`,
      [playerId, expiresAt, partyQuestId]
    );

    const io = req.app.get('io');
    if (io && quest.room_code) {
      io.to(quest.room_code).emit('party-quest:accepted', {
        partyQuestId: Number(partyQuestId),
        acceptedByPlayerId: Number(playerId),
        expiresAt: expiresAt.toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        partyQuestId: Number(partyQuestId),
        status: 'active',
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: '서버 내부 오류 발생' });
  } finally {
    connection.release();
  }
};

// POST /api/party-quests/:partyQuestId/upload — 파티 퀘스트 사진 업로드 (인증 및 기여)
exports.uploadPartyQuest = async (req, res) => {
  try {
    const { partyQuestId } = req.params;
    const { playerId } = req.body;
    const imageUrl = req.file ? `/uploads/party-quests/${req.file.filename}` : req.body.imageUrl;

    if (!playerId || !imageUrl) {
      return res.status(400).json({ success: false, error: 'playerId와 image는 필수입니다.' });
    }

    const connection = await pool.getConnection();
    try {
      // 소켓 방송 + AI 판별용으로 퀘스트 내용(content)도 함께 조회
      const [questRows] = await connection.query(
        `SELECT pq.*, r.room_code, pqd.content
         FROM party_quests pq
         JOIN rooms r ON pq.room_id = r.id
         JOIN party_quest_definitions pqd ON pq.definition_id = pqd.id
         WHERE pq.id = ?`,
        [partyQuestId]
      );
      
      if (questRows.length === 0) {
        return res.status(404).json({ success: false, error: '존재하지 않는 파티 퀘스트입니다.' });
      }
      const quest = questRows[0];
      const roomId = quest.room_id;
      const roomCode = quest.room_code;

      // 이미 완료된 퀘스트엔 업로드 차단
      if (quest.status === 'completed') {
        connection.release();
        return res.status(409).json({ success: false, error: '이미 완료된 파티 퀘스트입니다.' });
      }

      // 🤖 AI 이미지 판별
      const questContent = quest.content; // party_quest_definitions.content (JOIN 필요)
      let aiApproved = true;
      if (req.file) {
        const localPath = path.join(__dirname, '../../uploads/party-quests', req.file.filename);
        const { approved, reason } = await validateImageForQuest(localPath, questContent);
        aiApproved = approved;
        if (!approved) {
          // 거절된 파일 삭제
          try { fs.unlinkSync(localPath); } catch (_) {}
          connection.release();
          return res.status(400).json({ success: false, error: reason });
        }
      }

      await connection.beginTransaction();

      // 1. 파티 퀘스트 업로드 테이블에 데이터 인서트
      const [uploadResult] = await connection.query(
        'INSERT INTO party_quest_uploads (party_quest_id, player_id, image_url, validation_status) VALUES (?, ?, ?, "approved")',
        [partyQuestId, playerId, imageUrl]
      );

      // 2. [설계도 가중치 규칙용] 수락 시점 스냅샷 인원 기준으로 전원 참여 여부 체크
      // accepted_player_count가 없으면(구버전 레코드) 현재 방 인원을 fallback으로 사용
      let totalPlayers = quest.accepted_player_count;
      if (!totalPlayers) {
        const [playerCountRows] = await connection.query('SELECT COUNT(*) AS total FROM players WHERE room_id = ?', [roomId]);
        totalPlayers = playerCountRows[0].total;
      }

      const [uploadedCountRows] = await connection.query(
        'SELECT COUNT(DISTINCT player_id) AS uploaded FROM party_quest_uploads WHERE party_quest_id = ? AND validation_status = "approved"',
        [partyQuestId]
      );

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

// GET /api/rooms/:roomCode/party-quests/today-last — 당일 마지막 수락 파티퀘스트 + 업로드 조회
exports.getTodayLastPartyQuest = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { roomCode } = req.params;
    const [roomRows] = await connection.query('SELECT id FROM rooms WHERE room_code = ?', [roomCode]);
    if (roomRows.length === 0)
      return res.status(404).json({ success: false, error: '존재하지 않는 방 코드입니다.' });
    const roomId = roomRows[0].id;

    const kstDate = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
    const today = kstDate.toISOString().split('T')[0];

    const [questRows] = await connection.query(
      `SELECT pq.id AS partyQuestId, pq.status, pqd.content
       FROM party_quests pq
       JOIN party_quest_definitions pqd ON pq.definition_id = pqd.id
       WHERE pq.room_id = ? AND pq.quest_date = ? AND pq.status IN ('active', 'completed')
       ORDER BY pq.id DESC LIMIT 1`,
      [roomId, today]
    );

    if (questRows.length === 0)
      return res.status(200).json({ success: true, data: null });

    const quest = questRows[0];
    const [uploadRows] = await connection.query(
      'SELECT player_id AS playerId, image_url AS imageUrl FROM party_quest_uploads WHERE party_quest_id = ?',
      [quest.partyQuestId]
    );

    return res.status(200).json({ success: true, data: { ...quest, uploads: uploadRows } });
  } catch (err) {
    return res.status(500).json({ success: false, error: '서버 내부 오류 발생' });
  } finally {
    connection.release();
  }
};

// DELETE /api/party-quests/:partyQuestId/uploads/:playerId — 파티 퀘스트 사진 삭제
exports.deletePartyUpload = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { partyQuestId, playerId } = req.params;

    const [questRows] = await connection.query(
      `SELECT pq.status, r.room_code
       FROM party_quests pq JOIN rooms r ON pq.room_id = r.id
       WHERE pq.id = ?`,
      [partyQuestId]
    );
    if (questRows.length === 0) {
      return res.status(404).json({ success: false, error: '존재하지 않는 파티 퀘스트입니다.' });
    }
    if (questRows[0].status === 'completed') {
      return res.status(400).json({ success: false, error: '완료된 퀘스트의 사진은 삭제할 수 없습니다.' });
    }

    const roomCode = questRows[0].room_code;
    await connection.query(
      'DELETE FROM party_quest_uploads WHERE party_quest_id = ? AND player_id = ?',
      [partyQuestId, playerId]
    );

    const io = req.app.get('io');
    if (io) io.to(roomCode).emit('party-quest:upload-deleted', { playerId: Number(playerId) });

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: '서버 내부 오류 발생' });
  } finally {
    connection.release();
  }
};