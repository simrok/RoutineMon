const pool = require('../db/db');
const bcrypt = require('bcrypt'); // 👈 팀 기술 스택인 bcrypt 라이브러리 추가!

// 6자리 랜덤 방 코드 생성 함수 (숫자로만 생성하도록 변경 완!)
const generateRoomCode = () => {
  const characters = '0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

// [명세서 1] POST /rooms — 방 생성 컨트롤러
exports.createRoom = async (req, res) => {
  try {
    const { maxPlayers } = req.body;

    // 인원수 검증 (1~5명 허용, 명세서 기준)
    if (!maxPlayers || maxPlayers < 1 || maxPlayers > 5) {
      return res.status(400).json({
        success: false,
        error: '최대 인원은 1명에서 5명 사이여야 합니다.'
      });
    }

    let roomCode = '';
    let isUnique = false;
    const connection = await pool.getConnection();

    try {
      // 트랜잭션 개념 적용: 방 생성과 몬스터 생성을 안전하게 묶음
      await connection.beginTransaction();

      // 중복되지 않는 고유한 방 코드가 나올 때까지 반복 생성
      while (!isUnique) {
        roomCode = generateRoomCode();
        const [rows] = await connection.query('SELECT id FROM rooms WHERE room_code = ?', [roomCode]);
        if (rows.length === 0) {
          isUnique = true;
        }
      }

      // 1. 데이터베이스에 방 생성 (INSERT)
      const [result] = await connection.query(
        'INSERT INTO rooms (room_code, max_players) VALUES (?, ?)',
        [roomCode, maxPlayers]
      );

      const roomId = result.insertId;

      // 2. 🐣 스키마 기준: 방 생성 시 기본 알(egg) 단계의 루틴몬도 자동 매칭 생성
      await connection.query(
        "INSERT INTO mons (room_id, stage, level, exp_percentage) VALUES (?, 'egg', 1, 0.00)",
        [roomId]
      );

      await connection.commit();

      // 명세서 규격 리스폰스 100% 일치
      return res.status(201).json({
        success: true,
        data: {
          roomId: roomId,
          roomCode: roomCode,
          maxPlayers: maxPlayers,
          createdAt: new Date()
        }
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (err) {
    console.error('❌ 방 생성 중 서버 에러 발생:', err.message);
    return res.status(500).json({
      success: false,
      error: '서버 내부 오류가 발생했습니다.'
    });
  }
};

// [명세서 2] GET /rooms/:roomCode — 방 정보 및 플레이어 리스트 조회 컨트롤러
exports.getRoomStatus = async (req, res) => {
  try {
    const { roomCode } = req.params;

    if (!roomCode) {
      return res.status(400).json({
        success: false,
        error: '방 코드가 필요합니다.'
      });
    }

    const connection = await pool.getConnection();

    try {
      // 1. 방 정보 조회
      const [rooms] = await connection.query(
        'SELECT id, room_code, max_players, created_at FROM rooms WHERE room_code = ?',
        [roomCode]
      );

      if (rooms.length === 0) {
        return res.status(404).json({
          success: false,
          error: '존재하지 않는 방 코드입니다.'
        });
      }

      const room = rooms[0];

      // 2. 해당 방에 속한 플레이어 리스트 조회
      const [players] = await connection.query(
        'SELECT id as playerId, slot_number as slotNumber, nickname, current_skin_id as currentSkinId FROM players WHERE room_id = ? ORDER BY slot_number ASC',
        [room.id]
      );

      // 3. 해당 방의 루틴몬 상태 조회
      const [mons] = await connection.query(
        'SELECT id as monId, catalog_id as catalogId, stage, level, exp_percentage as expPercentage FROM mons WHERE room_id = ?',
        [room.id]
      );

      // 명세서의 대기방 로드 응답 포맷 요구사항 완벽 충족
      return res.status(200).json({
        success: true,
        data: {
          roomId: room.id,
          roomCode: room.room_code,
          maxPlayers: room.max_players,
          players: players,
          mon: mons[0] || null
        }
      });

    } finally {
      connection.release();
    }

  } catch (err) {
    console.error('❌ 방 조회 중 서버 에러 발생:', err.message);
    return res.status(500).json({
      success: false,
      error: '서버 내부 오류가 발생했습니다.'
    });
  }
};

// [명세서 3] POST /rooms/:roomCode/players — 플레이어 슬롯 등록 (최초 입장)
exports.joinRoom = async (req, res) => {
  try {
    const { roomCode } = req.params; // 주소 라우트 파라미터에서 추출
    const { slotNumber, nickname, pin } = req.body;

    // 1. 필수 파라미터 검증
    if (!slotNumber || !nickname || !pin) {
      return res.status(400).json({
        success: false,
        error: '슬롯 번호, 닉네임, PIN 번호는 필수 입력 사항입니다.'
      });
    }

    const connection = await pool.getConnection();

    try {
      // 2. 해당 방 코드가 실제로 존재하는지 확인
      const [rooms] = await connection.query('SELECT id, max_players FROM rooms WHERE room_code = ?', [roomCode]);
      if (rooms.length === 0) {
        return res.status(404).json({
          success: false,
          error: '존재하지 않는 방 코드입니다.'
        });
      }

      const roomId = rooms[0].id;
      const maxPlayers = rooms[0].max_players;

      // 3. 슬롯 범위 검증 (방 최대 인원 기준, 1~5)
      if (slotNumber < 1 || slotNumber > maxPlayers) {
        return res.status(400).json({
          success: false,
          error: `슬롯 번호는 1에서 ${maxPlayers} 사이여야 합니다.`
        });
      }

      // 4. 선택한 슬롯 중복 검사 (409 에러 처리)
      const [existingPlayer] = await connection.query(
        'SELECT id FROM players WHERE room_id = ? AND slot_number = ?',
        [roomId, slotNumber]
      );

      if (existingPlayer.length > 0) {
        return res.status(409).json({
          success: false,
          error: '해당 슬롯이 이미 사용 중'
        });
      }

      // 5. 보안 규격 준수: PIN 번호를 bcrypt로 해싱 암호화
      const saltRounds = 10;
      const pinHash = await bcrypt.hash(pin, saltRounds);

      // 6. 플레이어 생성 및 DB 저장
      const [result] = await connection.query(
        'INSERT INTO players (room_id, slot_number, nickname, pin_hash) VALUES (?, ?, ?, ?)',
        [roomId, slotNumber, nickname, pinHash]
      );

      const isHost = Number(slotNumber) === 1;

      // 7. 명세서 문서
      return res.status(201).json({
        success: true,
        data: {
          playerId: result.insertId,
          slotNumber: Number(slotNumber),
          nickname: nickname,
          isHost: isHost
        }
      });

    } finally {
      connection.release();
    }

  } catch (err) {
    console.error('❌ 플레이어 입장 중 서버 에러 발생:', err.message);
    return res.status(500).json({
      success: false,
      error: '서버 내부 오류가 발생했습니다.'
    });
  }
};

// [명세서 6.1] GET /rooms/:roomCode/party-quests/active — 현재 활성 파티 퀘스트 조회
exports.getActivePartyQuest = async (req, res) => {
  try {
    const { roomCode } = req.params;

    // 임시로 명세서와 똑같은 규격의 가짜(Mock) 데이터를 반환해서 테스트 진행!
    // 나중에 실제 DB 조회 로직으로 고도화
    return res.status(200).json({
      success: true,
      data: {
        partyQuestId: 7,
        content: "빨간 지붕을 찍어라!",
        status: "active",
        acceptedByPlayerId: 10,
        acceptedAt: "2026-06-01T07:05:00Z",
        expiresAt: "2026-06-01T09:05:00Z",
        uploads: [
          {
            playerId: 10,
            imageUrl: "https://res.cloudinary.com/.../pq1.jpg",
            validationStatus: "approved"
          }
        ]
      }
    });
  } catch (err) {
    console.error('❌ 활성 파티 퀘스트 조회 중 에러:', err.message);
    return res.status(500).json({
      success: false,
      error: '서버 내부 오류가 발생했습니다.'
    });
  }
};

// [명세서 6.4] POST /party-quests/:partyQuestId/uploads — 파티 퀘스트 사진 업로드 (테스트용)
exports.uploadPartyQuestImage = async (req, res) => {
  try {
    const { partyQuestId } = req.params;
    // form-data가 자꾸 씹히니까, 편하게 JSON Body로 playerId를 받도록 설계!
    const { playerId } = req.body; 

    return res.status(200).json({
      success: true,
      data: {
        uploadId: 33,
        partyQuestId: Number(partyQuestId),
        playerId: Number(playerId),
        validationStatus: "pending",
        message: "이미지를 검증 중입니다..."
      }
    });
  } catch (err) {
    console.error('❌ 파티 퀘스트 업로드 중 에러:', err.message);
    return res.status(500).json({
      success: false,
      error: '서버 내부 오류가 발생했습니다.'
    });
  }
};

// [명세서 10] POST /party-quests/:partyQuestId/simulate-complete — 파티 퀘스트 전원 완료 및 경험치 정산 시뮬레이션
exports.simulatePartyQuestComplete = async (req, res) => {
  try {
    const { partyQuestId } = req.params;

    // 원래는 AI 검증이 다 끝나면 실행되는 로직
    // 퀘스트 성공 시 몬스터에게 경험치 보상(+20%)을 주고 레벨업 연산을 처리함!
    return res.status(200).json({
      success: true,
      message: `🎉 [파티 퀘스트 ${partyQuestId}번] 전원 인증 완료! 루틴몬 경험치 정산 가동!`,
      data: {
        questStatus: "completed",
        // 유나 소켓 명세서 규격 일치 (party-quest:completed)
        socketEventPayload: {
          expGained: 20, 
          skinReward: {
            skinId: 1,
            name: "핑크 땡땡이 스킨"
          }
        },
        // 유나 몬스터 경험치 변화 명세서 규격 일치 (mon:exp-updated)
        monsterStatus: {
          name: "루몬",
          stage: "egg",
          level: 1,
          expPercentage: 50.0 // 원래 30%였는데 20% 더해져서 50%로 증가! 🔥
        }
      }
    });
  } catch (err) {
    console.error('❌ 경험치 정산 시뮬레이션 중 에러:', err.message);
    return res.status(500).json({
      success: false,
      error: '서버 내부 오류가 발생했습니다.'
    });
  }
};

// [명세서 5.2] GET /rooms/:roomCode/daily-uploads/today — 오늘 방 전체 업로드 현황 조회
exports.getDailyUploadStatus = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const todayStr = new Date().toISOString().split('T')[0]; // 오늘 날짜 YYYY-MM-DD 구하기

    const connection = await pool.getConnection();

    try {
      // 1. 방 코드로 방 ID 조회
      const [rooms] = await connection.query('SELECT id FROM rooms WHERE room_code = ?', [roomCode]);
      if (rooms.length === 0) {
        return res.status(404).json({ success: false, error: '존재하지 않는 방 코드입니다.' });
      }
      const roomId = rooms[0].id;

      // 2. 해당 방에 참여 중인 플레이어 목록 조회
      const [players] = await connection.query(
        'SELECT id as playerId, nickname FROM players WHERE room_id = ?',
        [roomId]
      );

      // 3. 각 플레이어별 오늘 업로드한 루틴 개수 파악 및 데이터 빌드
      const playersStatus = [];
      let totalCompletedPlayers = 0;

      for (const player of players) {
        // 이 플레이어가 오늘 업로드한 내역 조회 (실제로는 uploads 테이블 등 조회)
        // 일단 테스트를 위해 업로드한 루틴 개수를 임시 변수로 시뮬레이션
        const completedCount = 3; // 👈 테스트를 위해 3개 완료한 것으로 설정! (3개 이상이면 퀘스트 완료)
        const isDailyQuestDone = completedCount >= 3;

        if (isDailyQuestDone) totalCompletedPlayers++;

        playersStatus.push({
          playerId: player.playerId,
          nickname: player.nickname,
          uploads: [
            { routineId: 1, imageUrl: "https://res.cloudinary.com/.../1.jpg" },
            { routineId: 2, imageUrl: "https://res.cloudinary.com/.../2.jpg" },
            { routineId: 3, imageUrl: "https://res.cloudinary.com/.../3.jpg" },
            { routineId: 4, imageUrl: null }
          ],
          completedCount: completedCount,
          isDailyQuestDone: isDailyQuestDone
        });
      }

      // 4. 명세서 양식 100% 일치하는 데이터 반환
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
    console.error('❌ 일일 업로드 현황 조회 중 에러:', err.message);
    return res.status(500).json({ success: false, error: '서버 내부 오류가 발생했습니다.' });
  }
};