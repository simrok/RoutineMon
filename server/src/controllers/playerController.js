const pool = require('../db/db');
const bcrypt = require('bcrypt');

// 닉네임 규칙:
// - 한글/영문/숫자
// - 1~7자
const nicknameRegex = /^[가-힣a-zA-Z0-9]{1,7}$/;

// PIN 규칙:
// - 숫자 4자리
const pinRegex = /^\d{4}$/;

// ==========================================
// [명세서 3.1]
// POST /rooms/:roomCode/players
// 플레이어 슬롯 등록
// ==========================================
exports.registerPlayer = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { roomCode } = req.params;
    const { slotNumber, nickname, pin } = req.body;

    // 필수값 검증
    if (
      slotNumber === undefined ||
      !nickname ||
      !pin
    ) {
      return res.status(400).json({
        success: false,
        error: '필수 입력값이 누락되었습니다.'
      });
    }

    // 닉네임 검증
    if (!nicknameRegex.test(nickname)) {
      return res.status(400).json({
        success: false,
        error: '닉네임은 한글/영문/숫자 1~7자만 가능합니다.'
      });
    }

    // PIN 검증
    if (!pinRegex.test(pin)) {
      return res.status(400).json({
        success: false,
        error: 'PIN은 숫자 4자리여야 합니다.'
      });
    }

    await connection.beginTransaction();

    // 방 조회
    const [roomRows] = await connection.query(
      `
      SELECT id, max_players
      FROM rooms
      WHERE room_code = ?
      `,
      [roomCode]
    );

    if (roomRows.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        error: '존재하지 않는 방입니다.'
      });
    }

    const room = roomRows[0];

    // 슬롯 범위 검증
    if (
      Number(slotNumber) < 1 ||
      Number(slotNumber) > room.max_players
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        error: `슬롯 번호는 1~${room.max_players} 사이여야 합니다.`
      });
    }

    // 슬롯 중복 검사
    const [existingSlot] = await connection.query(
      `
      SELECT id
      FROM players
      WHERE room_id = ?
        AND slot_number = ?
      `,
      [room.id, slotNumber]
    );

    if (existingSlot.length > 0) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        error: '해당 슬롯이 이미 사용 중입니다.'
      });
    }

    // PIN 해싱
    const pinHash = await bcrypt.hash(pin, 10);

    // 플레이어 생성
    const [insertResult] = await connection.query(
      `
      INSERT INTO players
      (
        room_id,
        slot_number,
        nickname,
        pin_hash
      )
      VALUES (?, ?, ?, ?)
      `,
      [
        room.id,
        slotNumber,
        nickname,
        pinHash
      ]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      data: {
        playerId: insertResult.insertId,
        slotNumber: Number(slotNumber),
        nickname
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

// ==========================================
// [명세서 3.2]
// POST /rooms/:roomCode/players/:slotNumber/verify
// PIN 인증
// ==========================================
exports.verifyPin = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { roomCode, slotNumber } = req.params;
    const { pin } = req.body;

    // PIN 형식 검증
    if (!pinRegex.test(pin)) {
      return res.status(400).json({
        success: false,
        error: 'PIN은 숫자 4자리여야 합니다.'
      });
    }

    const [playerRows] = await connection.query(
      `
      SELECT
        p.id,
        p.nickname,
        p.pin_hash
      FROM players p
      JOIN rooms r
        ON p.room_id = r.id
      WHERE r.room_code = ?
        AND p.slot_number = ?
      `,
      [roomCode, slotNumber]
    );

    if (playerRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '해당 슬롯에 등록된 플레이어가 없습니다.'
      });
    }

    const player = playerRows[0];

    const isMatch = await bcrypt.compare(
      pin,
      player.pin_hash
    );

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'PIN 번호가 일치하지 않습니다.'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        playerId: player.id,
        slotNumber: Number(slotNumber),
        nickname: player.nickname
      }
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: '서버 내부 오류 발생'
    });

  } finally {
    connection.release();
  }
};

// ==========================================
// [명세서 3.3]
// POST /rooms/:roomCode/players/:slotNumber/reset-pin
// PIN 재설정
// ==========================================
exports.resetPin = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { roomCode, slotNumber } = req.params;
    const {
      newPin,
      approverPlayerId
    } = req.body;

    if (
      !newPin ||
      !approverPlayerId
    ) {
      return res.status(400).json({
        success: false,
        error: '새 PIN과 승인자 ID가 필요합니다.'
      });
    }

    // PIN 형식 검증
    if (!pinRegex.test(newPin)) {
      return res.status(400).json({
        success: false,
        error: 'PIN은 숫자 4자리여야 합니다.'
      });
    }

    await connection.beginTransaction();

    // 대상 플레이어 조회
    const [targetRows] = await connection.query(
      `
      SELECT
        p.id,
        p.room_id
      FROM players p
      JOIN rooms r
        ON p.room_id = r.id
      WHERE r.room_code = ?
        AND p.slot_number = ?
      `,
      [roomCode, slotNumber]
    );

    if (targetRows.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        error: '플레이어를 찾을 수 없습니다.'
      });
    }

    const targetPlayer = targetRows[0];

    // 자기 자신 승인 방지
    if (
      Number(approverPlayerId) ===
      Number(targetPlayer.id)
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        error: '자기 자신은 승인할 수 없습니다.'
      });
    }

    // 같은 방 플레이어인지 확인
    const [approverRows] = await connection.query(
      `
      SELECT id
      FROM players
      WHERE id = ?
        AND room_id = ?
      `,
      [
        approverPlayerId,
        targetPlayer.room_id
      ]
    );

    if (approverRows.length === 0) {
      await connection.rollback();

      return res.status(403).json({
        success: false,
        error: '승인자는 같은 방 플레이어여야 합니다.'
      });
    }

    // TODO:
    // 실제 Socket 승인 여부 검증 필요
    // ex) pin_reset_approvals 테이블 등

    const hashedPin = await bcrypt.hash(
      newPin,
      10
    );

    await connection.query(
      `
      UPDATE players
      SET pin_hash = ?
      WHERE id = ?
      `,
      [
        hashedPin,
        targetPlayer.id
      ]
    );

    await connection.commit();

    return res.status(200).json({
      success: true
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

// ==========================================
// [명세서 3.4]
// PATCH /players/:playerId
// 플레이어 정보 수정
// ==========================================
exports.updatePlayer = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { playerId } = req.params;
    const {
      nickname,
      currentSkinId
    } = req.body;

    const pinHeader =
      req.headers['x-player-pin'];

    if (!pinHeader) {
      return res.status(401).json({
        success: false,
        error: 'PIN 인증이 필요합니다.'
      });
    }

    const [playerRows] = await connection.query(
      `
      SELECT
        id,
        pin_hash
      FROM players
      WHERE id = ?
      `,
      [playerId]
    );

    if (playerRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '존재하지 않는 플레이어입니다.'
      });
    }

    const isPinValid = await bcrypt.compare(
      pinHeader,
      playerRows[0].pin_hash
    );

    if (!isPinValid) {
      return res.status(401).json({
        success: false,
        error: 'PIN 번호가 일치하지 않습니다.'
      });
    }

    let updateFields = [];
    let queryParams = [];

    // nickname 수정
    if (nickname !== undefined) {
      if (!nicknameRegex.test(nickname)) {
        return res.status(400).json({
          success: false,
          error: '닉네임은 한글/영문/숫자 1~7자만 가능합니다.'
        });
      }

      updateFields.push('nickname = ?');
      queryParams.push(nickname);
    }

    // skin 수정
    if (currentSkinId !== undefined) {

      // null이면 기본 스킨 허용
      if (currentSkinId !== null) {

        const [skinRows] = await connection.query(
          `
          SELECT ps.id
          FROM player_skins ps
          JOIN skins s
            ON ps.skin_id = s.id
          WHERE ps.player_id = ?
            AND ps.skin_id = ?
          `,
          [
            playerId,
            currentSkinId
          ]
        );

        if (skinRows.length === 0) {
          return res.status(403).json({
            success: false,
            error: '보유하지 않은 스킨입니다.'
          });
        }
      }

      updateFields.push('current_skin_id = ?');
      queryParams.push(currentSkinId);
    }

    // 수정값 없음
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: '수정할 값이 없습니다.'
      });
    }

    queryParams.push(playerId);

    await connection.query(
      `
      UPDATE players
      SET ${updateFields.join(', ')}
      WHERE id = ?
      `,
      queryParams
    );

    const [updatedRows] = await connection.query(`SELECT id AS playerId, nickname, current_skin_id AS currentSkinId FROM players WHERE id = ?`, [playerId]);

    return res.status(200).json({
        success: true,
        data: {
            playerId: Number(updatedRows[0].playerId),
            nickname: updatedRows[0].nickname,
            currentSkinId: updatedRows[0].currentSkinId !== null ? Number(updatedRows[0].currentSkinId) : null
        }
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: '서버 내부 오류 발생'
    });

  } finally {
    connection.release();
  }
};

// ==========================================
// [명세서 3.5]
// GET /players/:playerId/contribution
// 기여도 조회
// ==========================================
exports.getContribution = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { playerId } = req.params;

    // 일일 퀘스트 완료 일수
    const [dailyRows] = await connection.query(
      `
      SELECT COUNT(*) AS completed_days
      FROM (
        SELECT upload_date
        FROM daily_uploads
        WHERE player_id = ?
        GROUP BY upload_date
        HAVING COUNT(id) >= 3
      ) AS daily_completion
      `,
      [playerId]
    );

    const dailyCompletedDays =
      Number(dailyRows[0].completed_days);

    // 파티 퀘스트 기여 횟수
    const [partyRows] = await connection.query(
      `
      SELECT COUNT(*) AS party_contributions
      FROM party_quest_uploads pqu
      JOIN party_quests pq
        ON pq.id = pqu.party_quest_id
      WHERE pqu.player_id = ?
        AND pq.status = 'completed'
        AND pqu.validation_status = 'approved'
      `,
      [playerId]
    );

    const partyContributions =
      Number(partyRows[0].party_contributions);

    // 공식:
    // (일일 완료일 × 3)
    // + (파티 기여 × 1)
    const totalScore =
      (dailyCompletedDays * 3)
      + partyContributions;

    return res.status(200).json({
      success: true,
      data: {
        playerId: Number(playerId),
        dailyCompletedDays,
        partyContributions,
        totalScore
      }
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: '서버 내부 오류 발생'
    });

  } finally {
    connection.release();
  }
};