const pool = require('../db/db');

// 6자리 랜덤 방 코드 생성 함수 (숫자 + 대문자 알파벳)
const generateRoomCode = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

// ==========================================
// [명세서 1.1] POST /api/rooms 
// — 방 생성 (방 생성 및 루틴몬 알 동시 생성)
// ==========================================
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
      // 트랜잭션: 방 생성과 루틴몬 생성을 안전하게 묶음
      await connection.beginTransaction();

      // 중복되지 않는 고유한 방 코드가 나올 때까지 반복 생성
      while (!isUnique) {
        roomCode = generateRoomCode();
        const [rows] = await connection.query('SELECT id FROM rooms WHERE room_code = ?', [roomCode]);
        if (rows.length === 0) {
          isUnique = true;
        }
      }

      // 1. 방 생성 (rooms 테이블)
      const [roomResult] = await connection.query(
        'INSERT INTO rooms (room_code, max_players) VALUES (?, ?)',
        [roomCode, maxPlayers]
      );
      const roomId = roomResult.insertId;

      // 2. 방 생성 시 루틴몬 알(EGG) 동시 분양 (mons 테이블)
      await connection.query(
        'INSERT INTO mons (room_id, level, stage, exp_percentage) VALUES (?, 1, "EGG", 0.00)',
        [roomId]
      );

      await connection.commit();

      // 명세서 1번 출력 규격에 맞게 반환
      return res.status(201).json({
        success: true,
        data: {
          roomId: roomId,
          roomCode: roomCode,
          maxPlayers: maxPlayers
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
