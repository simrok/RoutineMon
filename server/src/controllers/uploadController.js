const pool = require('../db/db');

// [명세서 5.2] GET /rooms/:roomCode/daily-uploads/today — 오늘 방 전체 업로드 현황 조회
exports.getTodayUploads = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { roomCode } = req.params;

    // 방 조회
    const [rooms] = await connection.query(
      'SELECT id FROM rooms WHERE room_code = ?', [roomCode]
    );
    if (rooms.length === 0) {
      return res.status(404).json({ success: false, error: '존재하지 않는 방 코드입니다.' });
    }
    const roomId = rooms[0].id;

    // KST 기준 오늘 날짜
    const kstDate = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
    const today = kstDate.toISOString().split('T')[0];

    // 방의 모든 플레이어 조회
    const [players] = await connection.query(
      'SELECT id as playerId, nickname FROM players WHERE room_id = ? ORDER BY slot_number ASC',
      [roomId]
    );

    if (players.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          date: today,
          players: [],
          dailyQuestProgress: { completedCount: 0, totalCount: 0 }
        }
      });
    }

    const playerIds = players.map(p => p.playerId);

    // 각 플레이어의 루틴 조회
    const [routines] = await connection.query(
      'SELECT id as routineId, player_id as playerId FROM routines WHERE player_id IN (?) ORDER BY slot_number ASC',
      [playerIds]
    );

    // 오늘 업로드 기록 조회
    const [uploads] = await connection.query(
      `SELECT player_id as playerId, routine_id as routineId, image_url as imageUrl
       FROM daily_uploads
       WHERE player_id IN (?) AND upload_date = ?`,
      [playerIds, today]
    );

    // 조회 결과를 플레이어별로 그룹핑
    const routineMap = {}; // playerId -> routineId[]
    for (const r of routines) {
      if (!routineMap[r.playerId]) routineMap[r.playerId] = [];
      routineMap[r.playerId].push(r.routineId);
    }

    const uploadMap = {}; // playerId -> { routineId: imageUrl }
    for (const u of uploads) {
      if (!uploadMap[u.playerId]) uploadMap[u.playerId] = {};
      uploadMap[u.playerId][u.routineId] = u.imageUrl;
    }

    let dailyQuestCompletedCount = 0;

    const playersData = players.map(player => {
      const playerRoutineIds = routineMap[player.playerId] ?? [];
      const playerUploadMap = uploadMap[player.playerId] ?? {};

      const uploadsArr = playerRoutineIds.map(routineId => ({
        routineId,
        imageUrl: playerUploadMap[routineId] ?? null
      }));

      const completedCount = uploadsArr.filter(u => u.imageUrl !== null).length;
      const isDailyQuestDone = completedCount >= 3;

      if (isDailyQuestDone) dailyQuestCompletedCount++;

      return {
        playerId: player.playerId,
        nickname: player.nickname,
        uploads: uploadsArr,
        completedCount,
        isDailyQuestDone
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        date: today,
        players: playersData,
        dailyQuestProgress: {
          completedCount: dailyQuestCompletedCount,
          totalCount: players.length
        }
      }
    });

  } catch (err) {
    console.error('❌ 오늘 업로드 현황 조회 에러:', err.message);
    return res.status(500).json({ success: false, error: '서버 내부 오류가 발생했습니다.' });
  } finally {
    connection.release();
  }
};

// [명세서 5.1] POST /uploads/daily — 일일 루틴 사진 업로드 및 인증
exports.uploadDailyRoutine = async (req, res) => {

    const { playerId, routineId, imageUrl } = req.body;

    // 1. 필수 파라미터 누락 검증
    if (!playerId || !routineId || !imageUrl) {
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

      // [명세서 실시간 소켓 반영] 누군가 루틴 사진을 올렸음을 방 전체에 브로드캐스트
      const io = req.app.get('io');
      if (io) {
        io.to(roomCode).emit('daily:upload-updated', {
          playerId: Number(playerId),
          routineId: Number(routineId),
          uploadedCount: uploadedCount
        });
      }

      let expGained = 0;
      let monUpdated = null;
      let dailyQuestCompletedNow = false;

      // 5. [기획서 핵심] 개인이 오늘 딱 3번째 업로드를 달성한 순간에만 방 전체 퀘스트 조건 검사 진입
      if (uploadedCount === 3) {
        
        // (A) 현재 이 방에 등록된 총 플레이어 수 조회
        const [playerCountRows] = await connection.query(
          'SELECT COUNT(*) AS totalPlayers FROM players WHERE room_id = ?',
          [roomId]
        );
        const totalPlayers = playerCountRows[0].totalPlayers;

        // (B) 오늘 3개 이상 업로드하여 자기 몫을 다한 '서로 다른 플레이어 수' 집계
        const [progressRows] = await connection.query(`
          SELECT player_id
          FROM daily_uploads
          WHERE player_id IN (SELECT id FROM players WHERE room_id = ?)
            AND upload_date = ?
          GROUP BY player_id
          HAVING COUNT(DISTINCT routine_id) >= 3
        `, [roomId, today]);

        const completedPlayersCount = progressRows.length;

        // (C) 방 멤버 전원이 오늘 미션을 완수했다면 방 전체 일일 퀘스트 최종 클리어!
        if (completedPlayersCount === totalPlayers) {
          
          const [monRows] = await connection.query('SELECT * FROM mons WHERE room_id = ?', [roomId]);
          if (monRows.length > 0) {
            const mon = monRows[0];
            const monId = mon.id;

            // (D) 중복 지급 방지: 오늘 이미 일일 퀘스트(daily_quest) 보상을 지급받았는지 로그 확인
            const [logRows] = await connection.query(
              "SELECT id FROM exp_logs WHERE mon_id = ? AND source = 'daily_quest' AND DATE(gained_at) = ?",
              [monId, today]
            );

            // 오늘 최초로 전원 달성 조건을 충족한 시점인 경우 보상 부여
            if (logRows.length === 0) {
              expGained = 20;
              dailyQuestCompletedNow = true;

              let currentExp = Number(mon.exp_percentage || 0);
              let currentLevel = Number(mon.level || 1);
              let currentStage = mon.stage || 'EGG';
              let nextCatalogId = mon.catalog_id;

              let newExp = currentExp + expGained;

              // 레벨업 및 기획서 기반 단계별 진화 시스템 (EGG -> BABY -> CHILD -> ADULT -> 만렙 시 EGG 리셋)
              if (newExp >= 100) {
                newExp -= 100;
                currentLevel += 1;
                
                if (currentLevel > 2) {
                  currentLevel = 1; // 다음 단계의 레벨 1로 리셋
                  
                  if (currentStage === 'EGG') currentStage = 'BABY';
                  else if (currentStage === 'BABY') currentStage = 'CHILD';
                  else if (currentStage === 'CHILD') currentStage = 'ADULT';
                  else if (currentStage === 'ADULT') {
                    // 기획서 반영: ADULT LV2 100% 달성 시 새로운 알(EGG)로 순환
                    currentStage = 'EGG';
                    nextCatalogId = null;
                  }
                  
                  // 진화 성공 시 소켓 이벤트 브로드캐스트
                  if (io) {
                    io.to(roomCode).emit('mon:evolved', {
                      newStage: currentStage,
                      catalogId: nextCatalogId,
                      name: '루틴몬'
                    });
                  }
                }
              }

              // 몬스터 상태값 DB 업데이트
              await connection.query(
                'UPDATE mons SET level = ?, stage = ?, exp_percentage = ?, catalog_id = ? WHERE room_id = ?',
                [currentLevel, currentStage, newExp.toFixed(2), nextCatalogId, roomId]
              );

              // DB 테이블 규격: 경험치 로그 기록 적재
              await connection.query(
                "INSERT INTO exp_logs (mon_id, source, exp_gained) VALUES (?, 'daily_quest', ?)",
                [monId, expGained]
              );

              monUpdated = {
                stage: currentStage,
                level: currentLevel,
                expPercentage: newExp.toFixed(2)
              };

              // [명세서 실시간 소켓 반영] 방 전체 일일퀘스트 완료 및 몬스터 상태 변경 전송
              if (io) {
                io.to(roomCode).emit('daily:quest-completed', { expGained: 20 });
                io.to(roomCode).emit('mon:exp-updated', {
                  expPercentage: newExp.toFixed(2),
                  level: currentLevel,
                  stage: currentStage
                });
              }
            }
          }
        }
      }

      await connection.commit();

      // 명세서 5.1 출력 응답 규격 100% 동기화 반환
      return res.status(201).json({
        success: true,
        data: {
          uploadId: uploadResult.insertId,
          playerId: Number(playerId),
          routineId: Number(routineId),
          imageUrl: imageUrl,
          uploadedCountToday: uploadedCount,
          dailyQuestCompleted: dailyQuestCompletedNow, // 실제 방 전원이 성공했을 때만 true 반환
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
};
