const pool = require('../db/db');

// [명세서 5.1] POST /uploads/daily — 일일 루틴 사진 업로드 및 인증
exports.uploadDailyRoutine = async (req, res) => {
  try {
    const { playerId, routineId, imageUrl } = req.body;

    if (!playerId || !routineId || !imageUrl) {
      return res.status(400).json({ success: false, error: '필수 파라미터가 누락되었습니다.' });
    }

    const connection = await pool.getConnection();
    try {
      // 1. 해당 플레이어와 루틴이 유효한지 검증
      const [routineRows] = await connection.query(
        'SELECT r.*, p.room_id FROM routines r JOIN players p ON r.player_id = p.id WHERE r.id = ? AND r.player_id = ?',
        [routineId, playerId]
      );

      if (routineRows.length === 0) {
        return res.status(404).json({ success: false, error: '일치하는 루틴 정보를 찾을 수 없습니다.' });
      }

      const roomId = routineRows[0].room_id;
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      await connection.beginTransaction();

      // 2. daily_uploads 테이블에 인증 내역 기록
      const [uploadResult] = await connection.query(
        'INSERT INTO daily_uploads (player_id, routine_id, image_url, upload_date) VALUES (?, ?, ?, ?)',
        [playerId, routineId, imageUrl, today]
      );

      // 3. 해당 플레이어가 오늘 총 몇 개의 루틴을 달성했는지 체크
      const [countRows] = await connection.query(
        'SELECT COUNT(*) AS uploadedCount FROM daily_uploads WHERE player_id = ? AND upload_date = ?',
        [playerId, today]
      );
      const uploadedCount = countRows[0].uploadedCount;

      let expGained = 0;
      let monUpdated = null;

      // 4. [설계도 규칙] 하루 3개 이상 업로드 시 일일 퀘스트 완료 처리 및 몬스터 EXP +20% 지급
      if (uploadedCount === 3) {
        expGained = 20;
        
        const [monRows] = await connection.query('SELECT * FROM mons WHERE room_id = ?', [roomId]);
        if (monRows.length > 0) {
          const mon = monRows[0];
          let currentExp = Number(mon.exp_percentage || 0);
          let currentLevel = Number(mon.level || 1);
          let currentStage = mon.stage || 'EGG';

          let newExp = currentExp + expGained;

          // 레벨업 및 진화 로직 (EGG -> BABY -> CHILD -> ADULT)
          if (newExp >= 100) {
            newExp -= 100;
            currentLevel += 1;
            if (currentLevel > 2) {
              currentLevel = 1; // 다음 단계의 LV1로 초기화
              if (currentStage === 'EGG') currentStage = 'BABY';
              else if (currentStage === 'BABY') currentStage = 'CHILD';
              else if (currentStage === 'CHILD') currentStage = 'ADULT';
            }
          }

          await connection.query(
            'UPDATE mons SET level = ?, stage = ?, exp_percentage = ? WHERE room_id = ?',
            [currentLevel, currentStage, newExp.toFixed(2), roomId]
          );

          monUpdated = {
            stage: currentStage,
            level: currentLevel,
            expPercentage: newExp.toFixed(2)
          };
        }
      }

      await connection.commit();

      // 명세서 5.1 출력 규격 100% 매칭
      return res.status(201).json({
        success: true,
        data: {
          uploadId: uploadResult.insertId,
          playerId: Number(playerId),
          routineId: Number(routineId),
          imageUrl: imageUrl,
          uploadedCountToday: uploadedCount,
          dailyQuestCompleted: uploadedCount >= 3,
          expGained: expGained,
          mon: monUpdated
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