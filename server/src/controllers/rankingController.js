const pool = require('../db/db');

// [명세서 6.1] GET /rooms/:roomCode/players/ranking — 기여도 TOP 3 조회
exports.getRoomRankings = async (req, res) => {
  try {
    const { roomCode } = req.params; // 명세서 규격: 주소창에 id가 아닌 roomCode가 들어옵니다!
    const connection = await pool.getConnection();

    try {
      // 1. 방 코드로 방 ID 찾기
      const [roomRows] = await connection.query('SELECT id FROM rooms WHERE room_code = ?', [roomCode]);
      if (roomRows.length === 0) {
        return res.status(404).json({ success: false, error: '존재하지 않는 방 코드입니다.' });
      }
      const roomId = roomRows[0].id;

      // 2. 팀 설계도 문서에 명시된 '기여도 TOP 3 조회 쿼리' 적용
      const query = `
        SELECT
          p.id AS playerId,
          p.nickname AS nickname,
          p.slot_number AS slotNumber,
          (COALESCE(daily.completed_days, 0) * 3) + (COALESCE(party.party_count, 0) * 1) AS score
        FROM players p
        LEFT JOIN (
          SELECT player_id, COUNT(*) AS completed_days
          FROM (
            SELECT player_id, upload_date
            FROM daily_uploads
            GROUP BY player_id, upload_date
            HAVING COUNT(id) >= 3
          ) AS daily_completions
          GROUP BY player_id
        ) daily ON daily.player_id = p.id
        LEFT JOIN (
          SELECT pqu.player_id, COUNT(*) AS party_count
          FROM party_quest_uploads pqu
          JOIN party_quests pq ON pq.id = pqu.party_quest_id
          WHERE pq.status = 'completed'
            AND pq.room_id = ?
          GROUP BY pqu.player_id
        ) party ON party.player_id = p.id
        WHERE p.room_id = ?
        ORDER BY score DESC, p.created_at ASC
        LIMIT 3
      `;

      const [rankingRows] = await connection.query(query, [roomId, roomId]);

      // 3. 순위 배열 매핑
      const data = rankingRows.map((row, index) => ({
        playerId: row.playerId,
        nickname: row.nickname,
        slotNumber: Number(row.slotNumber),
        score: Number(row.score),
        rank: index + 1
      }));

      // 4. 명세서 출력 규격 완벽 일치
      return res.status(200).json({
        success: true,
        data: data
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