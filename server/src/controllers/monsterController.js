const pool = require('../db/db');

// GET /rooms/:roomCode/mon-face — 표정 판단용 데이터 조회
exports.getMonFace = async (req, res) => {
  const { roomCode } = req.params;
  const connection = await pool.getConnection();
  try {
    // created_at도 함께 조회 — 방 생성일 이전 날짜를 inactiveDays에 포함하지 않기 위해
    const [rooms] = await connection.query('SELECT id, created_at FROM rooms WHERE room_code = ?', [roomCode]);
    if (rooms.length === 0) return res.status(404).json({ success: false, error: '존재하지 않는 방입니다.' });
    const roomId = rooms[0].id;

    const [players] = await connection.query('SELECT id FROM players WHERE room_id = ?', [roomId]);
    const totalPlayers = players.length;

    if (totalPlayers === 0) {
      return res.status(200).json({ success: true, data: { consecutiveDays: 0, inactiveDays: 0, todayAllCompleted: false } });
    }

    const playerIds = players.map(p => p.id);
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstNow = new Date(new Date().getTime() + kstOffset);

    // 방 생성일(KST)
    const roomCreatedKST = new Date(new Date(rooms[0].created_at).getTime() + kstOffset);
    const roomCreatedDate = roomCreatedKST.toISOString().split('T')[0];

    // 최근 30일 날짜 목록 — 방 생성일 이후로만 제한
    // (방을 어제 만들었으면 오늘 하루만 계산 → inactiveDays 최대 1일)
    const dates = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(kstNow.getTime() - i * 24 * 60 * 60 * 1000);
      return d.toISOString().split('T')[0];
    }).filter(date => date >= roomCreatedDate);

    // 업로드 기록이 아예 없으면 신설 방 → 기본 상태
    const [anyUpload] = await connection.query(
      'SELECT id FROM daily_uploads WHERE player_id IN (?) LIMIT 1',
      [playerIds]
    );
    if (anyUpload.length === 0) {
      return res.status(200).json({
        success: true,
        data: { consecutiveDays: 0, inactiveDays: 0, todayAllCompleted: false }
      });
    }

    // 날짜별 전원 완료 여부
    const completionMap = {};
    for (const date of dates) {
      const [rows] = await connection.query(
        `SELECT player_id FROM daily_uploads
         WHERE player_id IN (?) AND upload_date = ?
         GROUP BY player_id HAVING COUNT(DISTINCT routine_id) >= 3`,
        [playerIds, date]
      );
      completionMap[date] = rows.length >= totalPlayers;
    }

    const today = dates[0];
    const todayAllCompleted = completionMap[today] || false;

    // 연속 달성 일수 (오늘 포함해서 역으로)
    let consecutiveDays = 0;
    for (const date of dates) {
      if (completionMap[date]) consecutiveDays++;
      else break;
    }

    // 미진행 일수 (오늘 미완료 기준으로 역으로)
    let inactiveDays = 0;
    if (!todayAllCompleted) {
      for (const date of dates) {
        if (!completionMap[date]) inactiveDays++;
        else break;
      }
    }

    return res.status(200).json({
      success: true,
      data: { consecutiveDays, inactiveDays, todayAllCompleted }
    });
  } catch (err) {
    console.error('❌ mon-face 조회 에러:', err.message);
    return res.status(500).json({ success: false, error: '서버 내부 오류' });
  } finally {
    connection.release();
  }
};

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