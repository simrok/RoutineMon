const pool = require('../db/db');

// ==========================================
// 6자리 숫자 방 코드 생성
// ==========================================
const generateRoomCode = () => {
  return Math.floor(
    100000 + Math.random() * 900000
  ).toString();
};

// ==========================================
// [명세서 1.1]
// POST /api/rooms
// 방 생성
// ==========================================
exports.createRoom = async (req, res) => {

  const connection = await pool.getConnection();

  try {

    const { maxPlayers } = req.body;

    // ==========================================
    // maxPlayers 검증
    // 명세:
    // - number
    // - 1~5
    // ==========================================
    if (
      !Number.isInteger(maxPlayers) ||
      maxPlayers < 1 ||
      maxPlayers > 5
    ) {
      return res.status(400).json({
        success: false,
        error: '최대 인원은 1~5 사이의 정수여야 합니다.'
      });
    }

    await connection.beginTransaction();

    let roomCode = '';
    let roomCreated = false;
    let roomResult;

    // ==========================================
    // UNIQUE room_code 생성
    // race condition 대응
    // ==========================================
    while (!roomCreated) {

      roomCode = generateRoomCode();

      try {

        [roomResult] = await connection.query(
          `
          INSERT INTO rooms
          (
            room_code,
            max_players
          )
          VALUES (?, ?)
          `,
          [roomCode, maxPlayers]
        );

        roomCreated = true;

      } catch (err) {

        // room_code 중복 시 재시도
        if (err.code === 'ER_DUP_ENTRY') {
          continue;
        }

        throw err;
      }
    }

    const roomId = roomResult.insertId;

    // ==========================================
    // 방 생성 시 기본 루틴몬 생성
    // DB ENUM:
    // 'egg', 'baby', 'child', 'adult'
    // ==========================================
    await connection.query(
      `
      INSERT INTO mons
      (
        room_id,
        catalog_id,
        stage,
        level,
        exp_percentage
      )
      VALUES (?, NULL, 'EGG', 1, 0.00)
      `,
      [roomId]
    );

    // 생성 시간 조회
    const [createdRows] = await connection.query(
      `
      SELECT created_at
      FROM rooms
      WHERE id = ?
      `,
      [roomId]
    );

    await connection.commit();

    // ==========================================
    // 명세 응답 형식
    // ==========================================
    return res.status(201).json({
      success: true,
      data: {
        roomId,
        roomCode,
        maxPlayers,
        createdAt: createdRows[0].created_at
      }
    });

  } catch (err) {

    await connection.rollback();

    return res.status(500).json({
      success: false,
      error: '서버 내부 오류 발생'
    });

  } finally {

    connection.release();
  }
};