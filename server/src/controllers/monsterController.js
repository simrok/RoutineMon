const pool = require('../db/db');

// [명세서 7.1] GET /rooms/:roomCode/monster — 루틴몬 상태 조회
exports.getMonsterInRoom = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const connection = await pool.getConnection();

    try {
      // 1. 룸 코드로 방 조회
      const [roomRows] = await connection.query('SELECT id FROM rooms WHERE room_code = ?', [roomCode]);
      if (roomRows.length === 0) {
        return res.status(404).json({ success: false, error: '존재하지 않는 방 코드입니다.' });
      }
      const roomId = roomRows[0].id;

      // 2. 루틴몬 조회
      let [monRows] = await connection.query('SELECT * FROM mons WHERE room_id = ?', [roomId]);

      // 없을 시 자동 분양 (EGG 단계 대문자 정렬)
      if (monRows.length === 0) {
        const [insertResult] = await connection.query(
          'INSERT INTO mons (room_id, level, stage, exp_percentage) VALUES (?, 1, "EGG", 0.00)',
          [roomId]
        );
        const [newMonRows] = await connection.query('SELECT * FROM mons WHERE id = ?', [insertResult.insertId]);
        monRows = newMonRows;
      }

      const mon = monRows[0];

      // 명세서 7.1 반환 규격 100% 매칭
      return res.status(200).json({
        success: true,
        data: {
          monId: mon.id,
          stage: mon.stage, // EGG, BABY, CHILD, ADULT
          level: Number(mon.level),
          expPercentage: Number(mon.exp_percentage).toFixed(2)
        }
      });

    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    } finally {
      connection.release();
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: '서버 내부 오류 발생' });
  }
};