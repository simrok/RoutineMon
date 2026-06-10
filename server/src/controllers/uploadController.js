const pool = require('../db/db');

// [명세서 5.1 교정] POST /players/:playerId/daily-uploads — 일일 루틴 사진 업로드 및 인증
exports.uploadDailyRoutine = async (req, res) => {
    // 명세서 라우터 규격에 따라 playerId는 params에서 추출
    const { playerId } = req.params;
    // multipart/form-data 또는 파일 업로드 미들웨어가 만들어준 경로 매핑
    const { routineId } = req.body;
    
    // Multer나 Cloudinary 파일 가공 결과물 주소 선택 (없을 시 더미 텍스트 대응)
    const imageUrl = req.file ? req.file.path : (req.body.imageUrl || "https://res.cloudinary.com/dummy/photo.jpg");

    // 1. 필수 파라미터 누락 검증
    if (!playerId || !routineId) {
      return res.status(400).json({ success: false, error: '필수 파라미터가 누락되었습니다.' });
    }

    const connection = await pool.getConnection();

    try {
      // 2. 해당 플레이어와 루틴이 유효한지 검증 및 방 코드(room_code) 함께 조회
      const [routineRows] = await connection.query(`
        SELECT r.*, p.room_id, r_table.room_code 
        FROM routines r 
        JOIN players p ON r.player_id = p.id 
        JOIN rooms r_table ON p.room_id = r_table.id
        WHERE r.id = ? AND r.player_id = ?
      `, [routineId, playerId]);

      if (routineRows.length === 0) {
        return res.status(404).json({ success: false, error: '일치하는 루틴 정보를 찾을 수 없습니다.' });
      }

      const roomId = routineRows[0].room_id;
      const roomCode = routineRows[0].room_code;

      const kstDate = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
      const today = kstDate.toISOString().split('T')[0];

      const [duplicateCheck] = await connection.query(
        'SELECT id FROM daily_uploads WHERE player_id = ? AND routine_id = ? AND upload_date = ?',
        [playerId, routineId, today]
      );
      if (duplicateCheck.length > 0) {
        return res.status(400).json({ success: false, error: '오늘 이미 인증을 완료한 루틴입니다.' });
      }

      await connection.beginTransaction();

      // 3. daily_uploads 테이블에 인증 내역 기록
      const [uploadResult] = await connection.query(
        'INSERT INTO daily_uploads (player_id, routine_id, image_url, upload_date) VALUES (?, ?, ?, ?)',
        [playerId, routineId, imageUrl, today]
      );

      // 4. 해당 플레이어가 오늘 총 몇 개의 루틴을 달성했는지 동적 카운트
      const [countRows] = await connection.query(
        'SELECT COUNT(*) AS uploadedCount FROM daily_uploads WHERE player_id = ? AND upload_date = ?',
        [playerId, today]
      );
      const uploadedCount = countRows[0].uploadedCount;

      let expGained = 0;
      let monUpdated = null;
      let dailyQuestCompletedNow = false;
      
      let dailyQuestCompletedSocket = false;
      let monExpUpdatedSocket = null;
      let monEvolvedSocket = null;

      // 5. [명세서 조건 동기화] 개인이 오늘 딱 3번째 업로드(일일퀘 완성 조건)를 달성한 시점 검사
      if (uploadedCount === 3) {
        
        const [playerCountRows] = await connection.query(
          'SELECT COUNT(*) AS totalPlayers FROM players WHERE room_id = ?',
          [roomId]
        );
        const totalPlayers = playerCountRows[0].totalPlayers;

        const [progressRows] = await connection.query(`
          SELECT player_id
          FROM daily_uploads
          WHERE player_id IN (SELECT id FROM players WHERE room_id = ?)
            AND upload_date = ?
          GROUP BY player_id
          HAVING COUNT(DISTINCT routine_id) >= 3
        `, [roomId, today]);

        const completedPlayersCount = progressRows.length;

        // 방 멤버 전원이 미션을 충족했을 때 일일 퀘스트 최종 클리어
        if (completedPlayersCount === totalPlayers) {
          const [monRows] = await connection.query('SELECT * FROM mons WHERE room_id = ?', [roomId]);
          if (monRows.length > 0) {
            const mon = monRows[0];
            const monId = mon.id;

            const [logRows] = await connection.query(
              "SELECT id FROM exp_logs WHERE mon_id = ? AND source = 'daily_quest' AND DATE(gained_at) = ?",
              [monId, today]
            );

            if (logRows.length === 0) {
              expGained = 20;
              dailyQuestCompletedNow = true;
              dailyQuestCompletedSocket = true;

              let currentExp = Number(mon.exp_percentage || 0);
              let currentLevel = Number(mon.level || 1);
              let currentStage = mon.stage || 'EGG';
              let nextCatalogId = mon.catalog_id;

              let newExp = currentExp + expGained;

              if (newExp >= 100) {
                newExp -= 100;
                currentLevel += 1;
                
                if (currentLevel > 2) {
                  currentLevel = 1;
                  if (currentStage === 'EGG') currentStage = 'BABY';
                  else if (currentStage === 'BABY') currentStage = 'CHILD';
                  else if (currentStage === 'CHILD') currentStage = 'ADULT';
                  else if (currentStage === 'ADULT') {
                    currentStage = 'EGG';
                    nextCatalogId = null;
                  }
                  
                  monEvolvedSocket = {
                    newStage: currentStage,
                    catalogId: nextCatalogId ? Number(nextCatalogId) : null,
                    name: mon.name || '루틴몬'
                  };
                }
              }

              const finalExpPercentage = Number(newExp.toFixed(2));

              await connection.query(
                'UPDATE mons SET level = ?, stage = ?, exp_percentage = ?, catalog_id = ? WHERE room_id = ?',
                [currentLevel, currentStage, finalExpPercentage, nextCatalogId, roomId]
              );

              await connection.query(
                "INSERT INTO exp_logs (mon_id, source, exp_gained) VALUES (?, 'daily_quest', ?)",
                [monId, expGained]
              );

              monUpdated = {
                monId: monId,
                catalogId: nextCatalogId,
                stage: currentStage,
                level: currentLevel,
                expPercentage: finalExpPercentage
              };

              monExpUpdatedSocket = {
                expPercentage: finalExpPercentage,
                level: currentLevel,
                stage: currentStage
              };
            }
          }
        }
      }

      // DB 안전 커밋
      await connection.commit();

      // 안전 소켓 영역 작동
      const io = req.app.get('io');
      if (io && roomCode) {
        io.to(roomCode).emit('daily:upload-updated', {
          playerId: Number(playerId),
          routineId: Number(routineId),
          uploadedCount: Number(uploadedCount)
        });

        if (dailyQuestCompletedSocket) {
          io.to(roomCode).emit('daily:quest-completed', { expGained: 20 });
        }
        if (monExpUpdatedSocket) {
          io.to(roomCode).emit('mon:exp-updated', monExpUpdatedSocket);
        }
        if (monEvolvedSocket) {
          io.to(roomCode).emit('mon:evolved', monEvolvedSocket);
        }
      }

      // 명세서 5.1 출력 응답 규격 100% 매칭 반환
      return res.status(200).json({
        success: true,
        data: {
          uploadId: uploadResult.insertId,
          routineId: Number(routineId),
          imageUrl: imageUrl,
          uploadDate: today
        }
      });

    } catch (error) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: error.message });
    } finally {
      connection.release();
    }
};
