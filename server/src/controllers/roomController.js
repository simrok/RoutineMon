const pool = require('../db/db');

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
      `INSERT INTO mons (room_id, catalog_id, stage, level, exp_percentage) VALUES (?, NULL, 'egg', 1, 0.00)`,
      [roomId]
    );

    const [createdRows] = await connection.query(
      `SELECT created_at FROM rooms WHERE id = ?`, [roomId]
    );

    await connection.commit();

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
         CASE WHEN pin_hash IS NOT NULL THEN true ELSE false END as hasPin
         FROM players WHERE room_id = ? ORDER BY slot_number ASC`,
        [room.id]
      );

      // 2. 루틴몬 현황 바인딩 (명세서 예시 필드명: monId, catalogId, stage, level, expPercentage)
      const [mons] = await connection.query(
        `SELECT id as monId, catalog_id as catalogId, stage, level, exp_percentage as expPercentage 
         FROM mons WHERE room_id = ?`,
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
            catalogId: mons[0].catalogId,
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

// ==========================================
// [명세서 5.2] GET /rooms/:roomCode/daily-uploads/today — 오늘 방 전체 업로드 현황 조회
// ==========================================
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
          'SELECT routine_id as routineId, image_url as imageUrl FROM daily_uploads WHERE player_id = ? AND upload_date = CURDATE()',
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
              imageUrl: foundUpload ? foundUpload.imageUrl : null
            });
          } else {
            // 루틴 설정이 미비한 가상 빈 슬롯 매칭
            uploadsMap.push({
              routineId: slot,
              imageUrl: null
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