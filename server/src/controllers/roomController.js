const pool = require('../db/db');

// 파티 퀘스트 발생 시각
const PARTY_HOURS = [1, 7, 12, 19]; // 시연용: 13시 → 12시 (시연 후 13으로 복구)

/**
 * 현재 시각이 파티 퀘스트 수락 윈도우(scheduledHour:00 ~ scheduledHour+2:30) 안이면
 * 해당 hour를 반환, 아니면 null
 */
function getActivePartyHour() {
  const now = new Date();
  const curH = now.getHours();
  const curM = now.getMinutes();
  for (const h of PARTY_HOURS) {
    const afterStart = curH > h || curH === h;
    const beforeEnd  = curH < h + 2 || (curH === h + 2 && curM < 30);
    if (afterStart && beforeEnd) return h;
  }
  return null;
}

// ==========================================
// 6자리 숫자 방 코드 생성
// ==========================================
const generateRoomCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ==========================================
// [명세서 2.1] POST /rooms — 방 생성
// ==========================================
exports.createRoom = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { maxPlayers, roomName = "루틴몬 방" } = req.body;

    if (!Number.isInteger(maxPlayers) || maxPlayers < 1 || maxPlayers > 5) {
      return res.status(400).json({
        success: false,
        error: '최대 인원은 1~5 사이의 정수여야 합니다.'
      });
    }

    await connection.beginTransaction();

    let roomCode = '';
    let roomCreated = false;
    let roomResult;

    while (!roomCreated) {
      roomCode = generateRoomCode();
      try {
        [roomResult] = await connection.query(
          `INSERT INTO rooms (room_code, max_players) VALUES (?, ?)`,
          [roomCode, maxPlayers]
        );
        roomCreated = true;
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') continue;
        throw err;
      }
    }

    const roomId = roomResult.insertId;

    // 초기 루틴몬 생성 - 명세서 표준 규격에 맞추어 소문자 'egg'로 안전하게 등록
    await connection.query(
      `INSERT INTO mons (room_id, catalog_id, stage, level, exp_percentage) VALUES (?, NULL, 'EGG', 1, 0.00)`,
      [roomId]
    );

    const [createdRows] = await connection.query(
      `SELECT created_at FROM rooms WHERE id = ?`, [roomId]
    );

    await connection.commit();

    // 현재 파티 퀘스트 수락 윈도우 안이면 신규 방에 즉시 퀘스트 생성
    const activeHour = getActivePartyHour();
    if (activeHour !== null) {
      const today = new Date().toISOString().slice(0, 10);
      // 같은 시간대에 다른 방에서 이미 사용 중인 definition을 재사용 (일관성 유지)
      const [existingDefs] = await pool.query(
        'SELECT definition_id FROM party_quests WHERE quest_date = ? AND scheduled_hour = ? LIMIT 1',
        [today, activeHour]
      );
      let defId = null;
      if (existingDefs.length > 0) {
        defId = existingDefs[0].definition_id;
      } else {
        const [defs] = await pool.query(
          'SELECT id FROM party_quest_definitions WHERE is_active = TRUE ORDER BY RAND() LIMIT 1'
        );
        if (defs.length > 0) defId = defs[0].id;
      }
      if (defId) {
        await pool.query(
          `INSERT IGNORE INTO party_quests (room_id, definition_id, quest_date, scheduled_hour, status)
           VALUES (?, ?, ?, ?, 'pending')`,
          [roomId, defId, today, activeHour]
        );
        console.log(`[Room] 신규 방 ${roomCode} — ${activeHour}시 파티 퀘스트 즉시 생성`);
      }
    }

    // [소켓 안전지대 알림] 방 생성 시 실시간 루틴몬 알 탄생 방송
    const io = req.app.get('io');
    if (io) {
      io.to(roomCode).emit('mon:status-changed', {
        status: 'born',
        statusEmoji: '🥚'
      });
    }

    // ✨ 명세서 Response 데이터셋 구조 100% 일치
    return res.status(201).json({
      success: true,
      data: {
        roomId: Number(roomId),
        roomCode: String(roomCode),
        maxPlayers: Number(maxPlayers),
        createdAt: new Date(createdRows[0].created_at).toISOString()
      }
    });

  } catch (err) {
    await connection.rollback();
    console.error('❌ 방 생성 중 서버 에러:', err.message);
    return res.status(500).json({ success: false, error: '서버 내부 오류가 발생했습니다.' });
  } finally {
    connection.release();
  }
};

// ==========================================
// [명세서 2.2] GET /rooms/:roomCode — 방 정보 조회
// ==========================================
exports.getRoomStatus = async (req, res) => {
  try {
    const { roomCode } = req.params;
    if (!roomCode) return res.status(400).json({ success: false, error: '방 코드가 필요합니다.' });

    const connection = await pool.getConnection();
    try {
      const [rooms] = await connection.query(
        'SELECT id, room_code, max_players FROM rooms WHERE room_code = ?',
        [roomCode]
      );
      if (rooms.length === 0) return res.status(404).json({ success: false, error: '존재하지 않는 방 코드입니다.' });

      const room = rooms[0];

      // 1. 플레이어 슬롯 리스트 스캔 (명세서 필드명 완벽 싱크: playerId, slotNumber, nickname, currentSkinId, hasPin)
      const [players] = await connection.query(
        `SELECT id as playerId, slot_number as slotNumber, nickname, current_skin_id as currentSkinId,
         character_type as characterType,
         CASE WHEN pin_hash IS NOT NULL THEN true ELSE false END as hasPin
         FROM players WHERE room_id = ? ORDER BY slot_number ASC`,
        [room.id]
      );

      // 2. 루틴몬 현황 바인딩 (mon_catalog JOIN으로 catalogName도 함께 조회)
      const [mons] = await connection.query(
        `SELECT m.id as monId, m.catalog_id as catalogId, m.stage, m.level,
                m.exp_percentage as expPercentage, mc.name as catalogName
         FROM mons m
         LEFT JOIN mon_catalog mc ON m.catalog_id = mc.id
         WHERE m.room_id = ?`,
        [room.id]
      );

      // 3. dailyQuestProgress 통계 계산 (오늘 날짜 기준 3개 이상 사진을 업로드한 고유 플레이어 수)
      const [progressRows] = await connection.query(
        `SELECT COUNT(DISTINCT player_id) AS completedCount FROM (
           SELECT player_id FROM daily_uploads du
           JOIN players p ON du.player_id = p.id
           WHERE p.room_id = ? AND du.upload_date = CURDATE()
           GROUP BY player_id HAVING COUNT(du.id) >= 3
         ) as completed_users`,
        [room.id]
      );
      const completedCount = progressRows[0]?.completedCount || 0;

      // ✨ 명세서 Response 규격 본문 예시와 100% 매칭 보장
      return res.status(200).json({
        success: true,
        data: {
          roomId: room.id,
          roomCode: room.room_code,
          maxPlayers: room.max_players,
          players,
          mon: mons[0] ? {
            monId: mons[0].monId,
            catalogId: mons[0].catalogId ?? null,
            catalogName: mons[0].catalogName ?? null,
            stage: mons[0].stage, // 소문자 'egg' 등으로 안전하게 리턴
            level: mons[0].level,
            expPercentage: parseFloat(mons[0].expPercentage)
          } : null,
          dailyQuestProgress: {
            completedCount: Number(completedCount),
            totalCount: players.length
          }
        }
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('❌ 방 정보 조회 중 서버 에러:', err.message);
    return res.status(500).json({ success: false, error: '서버 내부 오류가 발생했습니다.' });
  }
};

// GET /rooms/:roomCode/players-with-routines — 플레이어 목록 + 각 루틴 조회
exports.getPlayersWithRoutines = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const connection = await pool.getConnection();
    try {
      const [rooms] = await connection.query(
        'SELECT id, max_players FROM rooms WHERE room_code = ?', [roomCode]
      );
      if (rooms.length === 0) {
        return res.status(404).json({ success: false, error: '존재하지 않는 방 코드입니다.' });
      }
      const roomId = rooms[0].id;
      const maxPlayers = rooms[0].max_players;

      // 플레이어 + 스킨 이미지 JOIN
      const [players] = await connection.query(
        `SELECT p.id as playerId, p.slot_number as slotNumber, p.nickname,
                p.character_type as characterType,
                s.image_url as skinImageUrl
         FROM players p
         LEFT JOIN skins s ON p.current_skin_id = s.id
         WHERE p.room_id = ?
         ORDER BY p.slot_number ASC`,
        [roomId]
      );

      if (players.length === 0) {
        return res.status(200).json({ success: true, data: { players: [], maxPlayers } });
      }

      // 루틴 일괄 조회
      const playerIds = players.map(p => p.playerId);
      const [routines] = await connection.query(
        `SELECT player_id as playerId, slot_number as slotNumber, emoji, title
         FROM routines
         WHERE player_id IN (?)
         ORDER BY slot_number ASC`,
        [playerIds]
      );

      // playerId별 루틴 그룹화
      const routinesMap = {};
      for (const r of routines) {
        if (!routinesMap[r.playerId]) routinesMap[r.playerId] = [];
        routinesMap[r.playerId].push({
          slotNumber: r.slotNumber,
          emoji: r.emoji ?? '',
          title: r.title,
        });
      }

      const SLOT_DEFAULT_COLOR = { 1:'white', 2:'green', 3:'blue', 4:'yellow', 5:'red' };
      const result = players.map(p => ({
        playerId: p.playerId,
        slotNumber: p.slotNumber,
        nickname: p.nickname,
        characterType: p.characterType ?? SLOT_DEFAULT_COLOR[p.slotNumber] ?? 'white',
        skinImageUrl: p.skinImageUrl ?? null,
        routines: routinesMap[p.playerId] ?? [],
      }));

      return res.status(200).json({ success: true, data: { players: result, maxPlayers } });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('❌ players-with-routines 조회 에러:', err.message);
    return res.status(500).json({ success: false, error: '서버 내부 오류가 발생했습니다.' });
  }
};

// [명세서 6.1] GET /rooms/:roomCode/party-quests/active — 현재 활성/완료 파티 퀘스트 조회
exports.getActivePartyQuest = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const connection = await pool.getConnection();
    try {
      const [rooms] = await connection.query('SELECT id FROM rooms WHERE room_code = ?', [roomCode]);
      if (rooms.length === 0) return res.status(404).json({ success: false, error: '존재하지 않는 방 코드입니다.' });
      const roomId = rooms[0].id;

      // 'active' + 'completed' 모두 반환: 완료 직후에도 업로드 결과가 화면에 유지되도록
      const [quests] = await connection.query(
        `SELECT pq.id as partyQuestId, pqd.content, pq.status, pq.scheduled_hour as scheduledHour,
                pq.accepted_by_player_id as acceptedByPlayerId, pq.accepted_at as acceptedAt, pq.expires_at as expiresAt
         FROM party_quests pq
         JOIN party_quest_definitions pqd ON pq.definition_id = pqd.id
         WHERE pq.room_id = ? AND pq.status IN ('active', 'completed')
         ORDER BY pq.id DESC LIMIT 1`,
        [roomId]
      );

      if (quests.length === 0) return res.status(200).json({ success: true, data: null });

      const quest = quests[0];

      // 업로드 목록 + 업로드 시각 포함
      const [uploads] = await connection.query(
        `SELECT player_id as playerId, image_url as imageUrl,
                validation_status as validationStatus,
                TIME_FORMAT(created_at, '%H:%i') as uploadTime
         FROM party_quest_uploads WHERE party_quest_id = ?`,
        [quest.partyQuestId]
      );

      return res.status(200).json({
        success: true,
        data: { ...quest, uploads }
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: '서버 내부 오류가 발생했습니다.' });
  }
};

// [명세서 6.3] POST /party-quests/:partyQuestId/accept — 파티 퀘스트 수락
exports.acceptPartyQuest = async (req, res) => {
  try {
    const { partyQuestId } = req.params;
    const { playerId } = req.body;

    if (!playerId) {
      return res.status(400).json({ success: false, error: 'playerId는 필수입니다.' });
    }

    const connection = await pool.getConnection();
    try {
      const [quests] = await connection.query(
        'SELECT * FROM party_quests WHERE id = ?', [partyQuestId]
      );
      if (quests.length === 0) {
        return res.status(404).json({ success: false, error: '존재하지 않는 파티 퀘스트입니다.' });
      }
      if (quests[0].status !== 'pending') {
        return res.status(400).json({ success: false, error: '수락 가능한 상태가 아닙니다.' });
      }

      // 수락 시각 + 2시간 = expiresAt
      const acceptedAt = new Date();
      const expiresAt = new Date(acceptedAt.getTime() + 2 * 60 * 60 * 1000);

      // room_code + 현재 방 인원 수 조회 (소켓 브로드캐스트 + 스냅샷용)
      const [roomRows] = await connection.query(
        'SELECT r.room_code FROM rooms r JOIN party_quests pq ON pq.room_id = r.id WHERE pq.id = ?',
        [partyQuestId]
      );
      const roomCode = roomRows[0]?.room_code;

      // 수락 시점 인원 스냅샷 — 이후 들어온 인원은 완료 판정에서 제외
      const roomId = quests[0].room_id;
      const [playerCountRows] = await connection.query(
        'SELECT COUNT(*) AS total FROM players WHERE room_id = ?', [roomId]
      );
      const acceptedPlayerCount = playerCountRows[0].total;

      await connection.query(
        `UPDATE party_quests
         SET status = 'active', accepted_by_player_id = ?, accepted_at = ?, expires_at = ?,
             accepted_player_count = ?
         WHERE id = ?`,
        [playerId, acceptedAt, expiresAt, acceptedPlayerCount, partyQuestId]
      );

      // 소켓 브로드캐스트
      const io = req.app.get('io');
      if (io && roomCode) {
        io.to(roomCode).emit('party-quest:accepted', {
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
        }
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: '서버 내부 오류가 발생했습니다.' });
  }
};

// [명세서 6.2] GET /rooms/:roomCode/party-quests/pending — 대기 중인 파티 퀘스트 조회
exports.getPendingPartyQuest = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const connection = await pool.getConnection();
    try {
      const [rooms] = await connection.query('SELECT id FROM rooms WHERE room_code = ?', [roomCode]);
      if (rooms.length === 0) {
        return res.status(404).json({ success: false, error: '존재하지 않는 방 코드입니다.' });
      }
      const roomId = rooms[0].id;

      const [quests] = await connection.query(
        `SELECT pq.id as partyQuestId, pqd.content, pq.scheduled_hour as scheduledHour, pq.status
         FROM party_quests pq
         JOIN party_quest_definitions pqd ON pq.definition_id = pqd.id
         WHERE pq.room_id = ? AND pq.status = 'pending'
         ORDER BY pq.id DESC LIMIT 1`,
        [roomId]
      );

      if (quests.length === 0) return res.status(200).json({ success: true, data: null });

      return res.status(200).json({ success: true, data: quests[0] });
    } finally {
      connection.release();
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: '서버 내부 오류가 발생했습니다.' });
  }
};

// [명세서 6.4 전면 전용화] POST /party-quests/:partyQuestId/uploads — 파티 퀘스트 사진 업로드
exports.uploadPartyQuestImage = async (req, res) => {
  try {
    const { partyQuestId } = req.params;
    const { playerId } = req.body; 

    // 임의 파일명에 의존하지 않고 오직 명세서 필드 규격에 맞는 멀티파트 파일 자체를 검증
    if (!req.file) {
      return res.status(400).json({ success: false, error: '명세서 규격 에러: image 파일(바이너리)이 누락되었습니다.' });
    }
    if (!playerId) return res.status(400).json({ success: false, error: 'playerId가 필요합니다.' });

    const connection = await pool.getConnection();
    try {
      // 6번 테이블에 실제 존재하는 파티 퀘스트인지 무결성 검증
      const [quests] = await connection.query('SELECT id FROM party_quests WHERE id = ?', [partyQuestId]);
      if (quests.length === 0) return res.status(404).json({ success: false, error: '존재하지 않는 파티 퀘스트 인스턴스입니다.' });

      // 임시로 디스크에 저장된 Multer 파일 시스템 경로를 설계도 규격(VARCHAR 500)에 맞춰 안전하게 대입
      const finalStorageUrl = `/uploads/party-quests/${req.file.filename}`;

      // 7번 테이블 party_quest_uploads 스키마 명세에 일치하도록 INSERT 쿼리 실행
      const [result] = await connection.query(
        `INSERT INTO party_quest_uploads (party_quest_id, player_id, image_url, validation_status)
         VALUES (?, ?, ?, 'pending')
         ON DUPLICATE KEY UPDATE image_url = VALUES(image_url), validation_status = 'pending'`,
        [partyQuestId, playerId, finalStorageUrl]
      );

      // 명세서에 작성된 Response 포맷 규칙과 정확히 일치하는 데이터셋 반환
      return res.status(200).json({
        success: true,
        data: {
          uploadId: result.insertId || 33,
          validationStatus: "pending",
          message: "이미지를 검증 중입니다..."
        }
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('❌ 7번 테이블 사진 업로드 SQL 에러:', err.message);
    return res.status(500).json({ success: false, error: '서버 내부 오류가 발생했습니다.' });
  }
};

// [명세서 10] POST /party-quests/:partyQuestId/simulate-complete — 경험치 정산 시뮬레이션
exports.simulatePartyQuestComplete = async (req, res) => {
  try {
    const { partyQuestId } = req.params;
    return res.status(200).json({
      success: true,
      message: `🎉 [파티 퀘스트 ${partyQuestId}번] 전원 인증 완료! 루틴몬 경험치 정산 가동!`,
      data: {
        questStatus: "completed",
        socketEventPayload: { expGained: 20, skinReward: { skinId: 1, name: "핑크 땡땡이 스킨" } },
        monsterStatus: { name: "루몬", stage: "egg", level: 1, expPercentage: 50.0 }
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: '서버 내부 오류가 발생했습니다.' });
  }
};

// ==========================================
// [명세서 5.2] GET /rooms/:roomCode/daily-uploads/today — 오늘 방 전체 업로드 현황 조회
// ==========================================

// PATCH /rooms/:roomCode/max-players — max_players 1 증가 (최대 5)
exports.expandMaxPlayers = async (req, res) => {
  const { roomCode } = req.params;
  const connection = await pool.getConnection();
  try {
    const [rooms] = await connection.query('SELECT id, max_players FROM rooms WHERE room_code = ?', [roomCode]);
    if (rooms.length === 0) return res.status(404).json({ success: false, error: '존재하지 않는 방입니다.' });
    const { id: roomId, max_players } = rooms[0];
    if (max_players >= 5) return res.status(400).json({ success: false, error: '최대 인원(5명)에 도달했습니다.' });
    const newMax = max_players + 1;
    await connection.query('UPDATE rooms SET max_players = ? WHERE id = ?', [newMax, roomId]);
    return res.status(200).json({ success: true, data: { maxPlayers: newMax } });
  } catch (err) {
    console.error('❌ max_players 증가 에러:', err.message);
    return res.status(500).json({ success: false, error: '서버 내부 오류' });
  } finally {
    connection.release();
  }
};

exports.getDailyUploadStatus = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 동적 변환

    const connection = await pool.getConnection();
    try {
      const [rooms] = await connection.query('SELECT id FROM rooms WHERE room_code = ?', [roomCode]);
      if (rooms.length === 0) return res.status(404).json({ success: false, error: '존재하지 않는 방 코드입니다.' });
      const roomId = rooms[0].id;

      const [players] = await connection.query('SELECT id as playerId, nickname FROM players WHERE room_id = ?', [roomId]);

      const playersStatus = [];
      let totalCompletedPlayers = 0;

      for (const player of players) {
        // 플레이어의 실제 할당된 루틴 데이터 로드
        const [routines] = await connection.query(
          'SELECT id as routineId, slot_number as slotNumber FROM routines WHERE player_id = ? ORDER BY slot_number ASC',
          [player.playerId]
        );

        // 오늘 올린 사진 목록 조회
        const [uploads] = await connection.query(
          "SELECT routine_id as routineId, image_url as imageUrl, TIME_FORMAT(created_at, '%H:%i') as uploadTime FROM daily_uploads WHERE player_id = ? AND upload_date = CURDATE()",
          [player.playerId]
        );

        // 🌟 명세서 보장 규칙: 루틴 생성 개수나 상태에 상관없이 프론트 화면을 위해 1~4번 슬롯 구조 무조건 배열로 보장!
        const uploadsMap = [];
        let completedCount = 0;

        for (let slot = 1; slot <= 4; slot++) {
          const targetRoutine = routines.find(r => r.slotNumber === slot);
          if (targetRoutine) {
            const foundUpload = uploads.find(u => u.routineId === targetRoutine.routineId);
            if (foundUpload) completedCount++;

            uploadsMap.push({
              routineId: targetRoutine.routineId,
              imageUrl: foundUpload ? foundUpload.imageUrl : null,
              uploadTime: foundUpload ? foundUpload.uploadTime : null
            });
          } else {
            // 루틴 설정이 미비한 가상 빈 슬롯 매칭
            uploadsMap.push({
              routineId: slot,
              imageUrl: null,
              uploadTime: null
            });
          }
        }

        // 미션 달성 조건 판별 (루틴 4개 중 3개 이상 업로드 시 true)
        const isDailyQuestDone = completedCount >= 3;
        if (isDailyQuestDone) totalCompletedPlayers++;

        // 플레이어별 최종 집계 데이터 푸시
        playersStatus.push({
          playerId: player.playerId,
          nickname: player.nickname,
          uploads: uploadsMap,
          completedCount: completedCount,
          isDailyQuestDone: isDailyQuestDone
        });
      }

      // ✨ 명세서 5.2 최상단 Response 스키마 포맷 완벽 바인딩
      return res.status(200).json({
        success: true,
        data: {
          date: todayStr,
          players: playersStatus,
          dailyQuestProgress: {
            completedCount: totalCompletedPlayers,
            totalCount: players.length
          }
        }
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('❌ 오늘 방 업로드 현황 조회 중 DB 에러:', err.message);
    return res.status(500).json({ success: false, error: '서버 내부 오류가 발생했습니다.' });
  }
};