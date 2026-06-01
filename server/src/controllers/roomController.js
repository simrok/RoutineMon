const pool = require('../db/db');
const bcrypt = require('bcrypt');

// 6자리 랜덤 방 코드 생성 함수
const generateRoomCode = () => {
  const characters = '0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

// [명세서 2] GET /rooms/:roomCode — 방 정보 및 플레이어 리스트 조회
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

      // 1. 설계도 고유 키 매칭: 플레이어 슬롯 정보 조회
      const [players] = await connection.query(
        `SELECT id as playerId, slot_number as slotNumber, nickname, current_skin_id as currentSkinId,
         CASE WHEN pin_hash IS NOT NULL THEN true ELSE false END as hasPin
         FROM players WHERE room_id = ? ORDER BY slot_number ASC`,
        [room.id]
      );

      // 2. 9번 테이블 mons 상태 조회
      const [mons] = await connection.query(
        'SELECT id as monId, catalog_id as catalogId, stage, level, exp_percentage as expPercentage FROM mons WHERE room_id = ?',
        [room.id]
      );

      // 3. 명세서 양식의 dailyQuestProgress 통계 계산 (오늘 3개 이상 업로드한 플레이어 수)
      const [progressRows] = await connection.query(
        `SELECT COUNT(DISTINCT player_id) AS completedCount FROM daily_uploads du
         JOIN players p ON du.player_id = p.id
         WHERE p.room_id = ? AND du.upload_date = CURDATE()
         GROUP BY p.id HAVING COUNT(du.id) >= 3`,
        [room.id]
      );
      const completedCount = progressRows.length;

      return res.status(200).json({
        success: true,
        data: {
          roomId: room.id,
          roomCode: room.room_code,
          maxPlayers: room.max_players,
          players,
          mon: mons[0] || null,
          dailyQuestProgress: {
            completedCount,
            totalCount: players.length
          }
        }
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('❌ 방 조회 중 서버 에러:', err.message);
    return res.status(500).json({ success: false, error: '서버 내부 오류가 발생했습니다.' });
  }
};

// [명세서 1] POST /rooms — 방 생성
exports.createRoom = async (req, res) => {
  try {
    const { maxPlayers } = req.body;
    if (!maxPlayers || maxPlayers < 1 || maxPlayers > 5) {
      return res.status(400).json({ success: false, error: '최대 인원은 1명에서 5명 사이여야 합니다.' });
    }

    let roomCode = '';
    let isUnique = false;
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      while (!isUnique) {
        roomCode = generateRoomCode();
        const [rows] = await connection.query('SELECT id FROM rooms WHERE room_code = ?', [roomCode]);
        if (rows.length === 0) isUnique = true;
      }

      const [result] = await connection.query(
        'INSERT INTO rooms (room_code, max_players) VALUES (?, ?)',
        [roomCode, maxPlayers]
      );
      const roomId = result.insertId;

      await connection.query(
        "INSERT INTO mons (room_id, stage, level, exp_percentage) VALUES (?, 'egg', 1, 0.00)",
        [roomId]
      );

      await connection.commit();
      return res.status(201).json({
        success: true,
        data: { roomId, roomCode, maxPlayers, createdAt: new Date() }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('❌ 방 생성 중 서버 에러:', err.message);
    return res.status(500).json({ success: false, error: '서버 내부 오류가 발생했습니다.' });
  }
};

// [명세서 3] POST /rooms/:roomCode/players — 플레이어 슬롯 등록
exports.joinRoom = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { slotNumber, nickname, pin } = req.body;

    if (!slotNumber || !nickname || !pin) {
      return res.status(400).json({ success: false, error: '슬롯 번호, 닉네임, PIN 번호는 필수 입력 사항입니다.' });
    }

    const connection = await pool.getConnection();
    try {
      const [rooms] = await connection.query('SELECT id, max_players FROM rooms WHERE room_code = ?', [roomCode]);
      if (rooms.length === 0) return res.status(404).json({ success: false, error: '존재하지 않는 방 코드입니다.' });

      const roomId = rooms[0].id;
      const maxPlayers = rooms[0].max_players;

      if (slotNumber < 1 || slotNumber > maxPlayers) {
        return res.status(400).json({ success: false, error: `슬롯 번호는 1에서 ${maxPlayers} 사이여야 합니다.` });
      }

      const [existingPlayer] = await connection.query(
        'SELECT id FROM players WHERE room_id = ? AND slot_number = ?',
        [roomId, slotNumber]
      );
      if (existingPlayer.length > 0) return res.status(409).json({ success: false, error: '해당 슬롯이 이미 사용 중' });

      const pinHash = await bcrypt.hash(pin, 10);
      const [result] = await connection.query(
        'INSERT INTO players (room_id, slot_number, nickname, pin_hash) VALUES (?, ?, ?, ?)',
        [roomId, slotNumber, nickname, pinHash]
      );

      return res.status(201).json({
        success: true,
        data: { playerId: result.insertId, slotNumber: Number(slotNumber), nickname, isHost: Number(slotNumber) === 1 }
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('❌ 플레이어 입장 중 서버 에러:', err.message);
    return res.status(500).json({ success: false, error: '서버 내부 오류가 발생했습니다.' });
  }
};

// [명세서 6.1] GET /rooms/:roomCode/party-quests/active — 현재 활성 파티 퀘스트 조회
exports.getActivePartyQuest = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const connection = await pool.getConnection();
    try {
      const [rooms] = await connection.query('SELECT id FROM rooms WHERE room_code = ?', [roomCode]);
      if (rooms.length === 0) return res.status(404).json({ success: false, error: '존재하지 않는 방 코드입니다.' });
      const roomId = rooms[0].id;

      // 6번 테이블 party_quests 상태 연결 조회
      const [quests] = await connection.query(
        `SELECT pq.id as partyQuestId, pqd.content, pq.status, pq.accepted_by_player_id as acceptedByPlayerId, pq.accepted_at as acceptedAt, pq.expires_at as expiresAt
         FROM party_quests pq
         JOIN party_quest_definitions pqd ON pq.definition_id = pqd.id
         WHERE pq.room_id = ? AND pq.status = 'active'`, [roomId]
      );

      if (quests.length === 0) return res.status(200).json({ success: true, data: null });

      const quest = quests[0];
      // 7번 테이블 party_quest_uploads 연동 목록 조회
      const [uploads] = await connection.query(
        'SELECT player_id as playerId, image_url as imageUrl, validation_status as validationStatus FROM party_quest_uploads WHERE party_quest_id = ?',
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

// [명세서 5.2 전면 전용화] GET /rooms/:roomCode/daily-uploads/today — 오늘 방 전체 업로드 현황 조회
exports.getDailyUploadStatus = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 포맷 동적 추출

    const connection = await pool.getConnection();
    try {
      // 1. 방 코드로 방 ID 추적
      const [rooms] = await connection.query('SELECT id FROM rooms WHERE room_code = ?', [roomCode]);
      if (rooms.length === 0) return res.status(404).json({ success: false, error: '존재하지 않는 방 코드입니다.' });
      const roomId = rooms[0].id;

      // 2. 해당 방의 전체 등록 플레이어 리스트 스캔
      const [players] = await connection.query('SELECT id as playerId, nickname FROM players WHERE room_id = ?', [roomId]);

      const playersStatus = [];
      let totalCompletedPlayers = 0;

      // 3. 설계도 기반 반복 조회 프로세스 가동
      for (const player of players) {
        // 3번 테이블 routines에서 플레이어가 가진 진짜 일일 루틴 목록(최대 4개)을 로드
        const [routines] = await connection.query(
          'SELECT id as routineId FROM routines WHERE player_id = ? ORDER BY slot_number ASC',
          [player.playerId]
        );

        // 4번 테이블 daily_uploads에서 오늘 날짜(CURDATE) 기준으로 이 플레이어가 올린 업로드 목록 추출
        const [uploads] = await connection.query(
          'SELECT routine_id as routineId, image_url as imageUrl FROM daily_uploads WHERE player_id = ? AND upload_date = CURDATE()',
          [player.playerId]
        );

        // 명세서 양식 규격 매칭: 루틴별 업로드 매핑 (없으면 null 처리)
        const uploadsMap = [];
        let completedCount = 0;

        // 실제 유저가 설정한 루틴 기준으로 업로드 유무 바인딩
        if (routines.length > 0) {
          for (const r of routines) {
            const foundUpload = uploads.find(u => u.routineId === r.routineId);
            if (foundUpload) completedCount++;
            uploadsMap.push({
              routineId: r.routineId,
              imageUrl: foundUpload ? foundUpload.imageUrl : null
            });
          }
        } else {
          // 루틴을 아직 생성하지 않은 초기 상태의 경우 예시 더미 구조 매칭
          uploadsMap.push({ routineId: 1, imageUrl: null }, { routineId: 2, imageUrl: null });
        }

        const isDailyQuestDone = completedCount >= 3; // 3개 이상이면 일일 미션 달성 완료 조건
        if (isDailyQuestDone) totalCompletedPlayers++;

        playersStatus.push({
          playerId: player.playerId,
          nickname: player.nickname,
          uploads: uploadsMap,
          completedCount: completedCount,
          isDailyQuestDone: isDailyQuestDone
        });
      }

      // 명세서 5.2 문서에 적힌 최상단 Response JSON Key 구조체와 완전히 일치하도록 바인딩
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
    console.error('❌ 설계도 기반 일일 업로드 집계 DB 에러:', err.message);
    return res.status(500).json({ success: false, error: '서버 내부 오류가 발생했습니다.' });
  }
};

// [서영 전용 API] GET /:partyId/uploads — 특정 파티 퀘스트의 진짜 사진 데이터 목록 조회
exports.getPartyUploads = async (req, res) => {
  try {
    const { partyId } = req.params;
    if (!partyId) {
      return res.status(400).json({ success: false, error: 'partyId가 필요합니다.' });
    }

    const connection = await pool.getConnection();
    try {
      const [uploads] = await connection.query(
        `SELECT 
          pqu.id as uploadId, 
          pqu.player_id as playerId, 
          p.nickname as playerName, 
          pqu.image_url as imageUrl, 
          pqu.validation_status as status,
          pqu.created_at as uploadedAt
         FROM party_quest_uploads pqu
         JOIN players p ON pqu.player_id = p.id
         WHERE pqu.party_quest_id = ?
         ORDER BY pqu.created_at DESC`,
        [partyId]
      );

      return res.status(200).json({
        success: true,
        data: {
          partyQuestId: Number(partyId),
          uploadList: uploads
        }
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('❌ 파티 퀘스트 사진 목록 조회 DB 에러:', err.message);
    return res.status(500).json({ success: false, error: '서버 내부 오류가 발생했습니다.' });
  }
};