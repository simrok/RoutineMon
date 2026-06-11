const pool = require('../db/db');

// ==========================================
// [명세서 4.2] PUT /players/:playerId/routines 
// — 루틴 전체 저장 (등록/수정 덮어쓰기)
// ==========================================
exports.saveRoutines = async (req, res) => {
  try {
    const { playerId } = req.params;
    const { routines } = req.body; // 규격: [{ slotNumber, title, emoji }, ...]

    if (!routines || !Array.isArray(routines) || routines.length === 0) {
      return res.status(400).json({ success: false, error: '루틴 배열은 필수입니다.' });
    }
    if (routines.length > 4) {
      return res.status(400).json({ success: false, error: '루틴은 인당 최대 4개까지만 등록할 수 있습니다.' });
    }

    const connection = await pool.getConnection();
    try {
      // 플레이어 존재 여부 검증
      const [playerCheck] = await connection.query('SELECT id FROM players WHERE id = ?', [playerId]);
      if (playerCheck.length === 0) {
        return res.status(404).json({ success: false, error: '존재하지 않는 플레이어 ID입니다.' });
      }

      await connection.beginTransaction();

      // 기존 루틴을 싹 지우고 새로 덮어씁니다 (명세서 규격: "기존 루틴은 덮어씁니다.")
      await connection.query('DELETE FROM routines WHERE player_id = ?', [playerId]);

      let savedCount = 0;
      for (const r of routines) {
        const { slotNumber, title, emoji } = r;
        if (!title || title.trim() === '') throw new Error('루틴 제목은 공백일 수 없습니다.');
        if (slotNumber < 1 || slotNumber > 4) throw new Error('슬롯 번호는 1에서 4 사이여야 합니다.');

        await connection.query(
          'INSERT INTO routines (player_id, slot_number, title, emoji) VALUES (?, ?, ?, ?)',
          [playerId, slotNumber, title, emoji || null]
        );
        savedCount++;
      }

      await connection.commit();

      // 명세서 100% 일치 응답 폼
      return res.status(200).json({
        success: true,
        data: {
          saved: savedCount
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

// ==========================================
// [명세서 4.1] GET /players/:playerId/routines 
// — 플레이어별 루틴 목록 조회
// ==========================================
exports.getRoutines = async (req, res) => {
  try {
    const { playerId } = req.params;
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.query(
        'SELECT id AS routineId, slot_number AS slotNumber, title, emoji FROM routines WHERE player_id = ? ORDER BY slot_number ASC',
        [playerId]
      );

      return res.status(200).json({
        success: true,
        data: rows
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